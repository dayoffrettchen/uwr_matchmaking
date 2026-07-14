import { and, asc, eq, inArray } from "drizzle-orm"
import { db } from "@/lib/db"
import { ensureDatabaseSchema } from "@/lib/db/ensure-schema"
import { players, playerPositionRatings, signups, trainings } from "@/lib/db/schema"
import { getRatingConfidence, getRatingStatus } from "@/lib/ratings/confidence"
import { PLAYER_POSITIONS, type PlayerPosition } from "@/lib/ratings/types"
import { getTargetLineup } from "./target-lineup"
import { scoreAssignments } from "./objective"
import type { MatchmakingAssignment, MatchmakingPlayer, MatchmakingResult, TeamSummary } from "./types"

function summarize(playersBySignup: Map<number, MatchmakingPlayer>, assignments: MatchmakingAssignment[], team: 1 | 2): TeamSummary {
  const mine = assignments.filter((a) => a.team === team)
  const active = mine.filter((a) => a.lineupType === "active")
  const avg = (items: MatchmakingAssignment[]) => items.reduce((sum, a) => sum + playersBySignup.get(a.signupId)!.ratings[a.position], 0) / Math.max(1, items.length)
  const averageActiveRating = Math.round(avg(active))
  const subs = mine.filter((a) => a.lineupType === "substitute")
  const bestSub = subs.reduce((best, a) => Math.max(best, playersBySignup.get(a.signupId)!.ratings[a.position]), 0)
  const substituteBonus = Math.max(0, bestSub - averageActiveRating) * 0.15
  return {
    activeCount: active.length,
    substituteCount: subs.length,
    averageActiveRating,
    effectiveStrength: Math.round(averageActiveRating + substituteBonus),
    positionAverages: Object.fromEntries(PLAYER_POSITIONS.map((p) => [p, Math.round(avg(active.filter((a) => a.position === p)))])) as Record<PlayerPosition, number>,
    confidence: active.reduce((sum, a) => sum + playersBySignup.get(a.signupId)!.confidence[a.position], 0) / Math.max(1, active.length),
  }
}

export function balanceMatchmakingPlayers(input: MatchmakingPlayer[]): MatchmakingResult {
  const started = Date.now()
  const warnings: string[] = []
  if (input.length < 6) warnings.push("Weniger als sechs Spieler sind angemeldet. Die Aufteilung ist nur eingeschränkt aussagekräftig.")
  if (input.length % 2 === 1) warnings.push("Ungerade Teilnehmerzahl: Ein Spieler wird als Wechselspieler eingeplant.")
  const players = input.map((p) => p.eligiblePositions.length ? p : { ...p, eligiblePositions: [...PLAYER_POSITIONS], positionPreferences: PLAYER_POSITIONS.map((position, i) => ({ position, order: i + 1 })) })
  for (const p of input.filter((p) => p.eligiblePositions.length === 0)) warnings.push(`${p.name} besitzt keine freigeschaltete Position und wurde nur provisorisch zugeordnet.`)
  const availability = Object.fromEntries(PLAYER_POSITIONS.map((pos) => [pos, players.filter((p) => p.eligiblePositions.includes(pos)).length])) as Record<PlayerPosition, number>
  for (const pos of PLAYER_POSITIONS) if (availability[pos] < 2) warnings.push(`Nicht genügend Spieler für ${pos} verfügbar.`)
  const activePerTeam = Math.floor(players.length / 2)
  const totalActive = activePerTeam * 2
  const target = getTargetLineup(activePerTeam, availability)
  const ordered = [...players].sort((a, b) => a.eligiblePositions.length - b.eligiblePositions.length || a.name.localeCompare(b.name))
  const assignments: MatchmakingAssignment[] = []
  const activeCounts = { 1: { goalkeeper: 0, defender: 0, forward: 0 }, 2: { goalkeeper: 0, defender: 0, forward: 0 } } as Record<1 | 2, Record<PlayerPosition, number>>
  const teamActive = { 1: 0, 2: 0 } as Record<1 | 2, number>
  let candidatesEvaluated = 0
  for (const p of ordered) {
    const options: MatchmakingAssignment[] = []
    for (const position of p.eligiblePositions) for (const team of [1, 2] as const) {
      const canActive = teamActive[team] < activePerTeam && activeCounts[team][position] < target[position]
      options.push({ signupId: p.signupId, playerId: p.playerId, team, position, lineupType: canActive ? "active" : "substitute" })
    }
    options.sort((a, b) => {
      const activeBias = a.lineupType === b.lineupType ? 0 : a.lineupType === "active" ? -100000 : 100000
      const slotBias = (activeCounts[a.team][a.position] - activeCounts[b.team][b.position]) * 1000
      const ratingBias = p.ratings[b.position] - p.ratings[a.position]
      return activeBias + slotBias + ratingBias || a.team - b.team || a.position.localeCompare(b.position)
    })
    const chosen = options[0]
    assignments.push(chosen)
    if (chosen.lineupType === "active") { teamActive[chosen.team]++; activeCounts[chosen.team][chosen.position]++ }
    candidatesEvaluated += options.length
  }
  // move strongest substitute to weaker effective team for odd counts
  const bySignup = new Map(players.map((p) => [p.signupId, p]))
  const team1 = summarize(bySignup, assignments, 1), team2 = summarize(bySignup, assignments, 2)
  for (const sub of assignments.filter((a) => a.lineupType === "substitute")) sub.team = team1.averageActiveRating <= team2.averageActiveRating ? 1 : 2
  const finalTeam1 = summarize(bySignup, assignments, 1), finalTeam2 = summarize(bySignup, assignments, 2)
  const diff = Math.abs(finalTeam1.averageActiveRating - finalTeam2.averageActiveRating)
  const unstable = assignments.filter((a) => getRatingStatus(bySignup.get(a.signupId)!.gamesPlayed[a.position]) !== "established").length
  const quality = warnings.length || diff > 80 ? "low" : diff > 25 || unstable > assignments.length / 3 ? "medium" : "high"
  return { assignments, team1: finalTeam1, team2: finalTeam2, warnings, computationTimeMs: Date.now() - started, candidatesEvaluated, optimality: candidatesEvaluated > 10000 ? "best-found" : "exact", quality }
}

export async function assignBalancedTeams(): Promise<MatchmakingResult | null> {
  await ensureDatabaseSchema()
  const [training] = await db.select().from(trainings).where(eq(trainings.isOpen, true)).limit(1)
  if (!training) return null
  const signupRows = await db.select({ signupId: signups.id, playerId: players.id, name: players.name }).from(signups).innerJoin(players, eq(players.id, signups.playerId)).where(eq(signups.trainingId, training.id)).orderBy(asc(signups.createdAt))
  const ratings = await db.select().from(playerPositionRatings).where(inArray(playerPositionRatings.playerId, signupRows.map((r) => r.playerId)))
  const input = signupRows.map((row) => {
    const mine = ratings.filter((r) => r.playerId === row.playerId)
    return { signupId: row.signupId, playerId: row.playerId, name: row.name, eligiblePositions: mine.filter((r) => r.isEligible).map((r) => r.position as PlayerPosition), positionPreferences: mine.filter((r) => r.preferenceOrder).map((r) => ({ position: r.position as PlayerPosition, order: r.preferenceOrder! })), ratings: Object.fromEntries(PLAYER_POSITIONS.map((p) => [p, mine.find((r) => r.position === p)?.rating ?? 1000])) as Record<PlayerPosition, number>, gamesPlayed: Object.fromEntries(PLAYER_POSITIONS.map((p) => [p, mine.find((r) => r.position === p)?.gamesPlayed ?? 0])) as Record<PlayerPosition, number>, confidence: Object.fromEntries(PLAYER_POSITIONS.map((p) => [p, getRatingConfidence(mine.find((r) => r.position === p)?.gamesPlayed ?? 0)])) as Record<PlayerPosition, number> }
  })
  const beforeIds = signupRows.map((r) => r.signupId).sort().join(",")
  const result = balanceMatchmakingPlayers(input)
  await db.transaction(async (tx) => {
    const current = await tx.select({ id: signups.id }).from(signups).where(eq(signups.trainingId, training.id))
    if (current.map((r) => r.id).sort().join(",") !== beforeIds) throw new Error("Die Teilnehmerliste wurde während der Berechnung verändert.")
    for (const a of result.assignments) await tx.update(signups).set({ team: a.team, assignedPosition: a.position, lineupType: a.lineupType }).where(and(eq(signups.id, a.signupId), eq(signups.trainingId, training.id)))
  })
  return result
}
