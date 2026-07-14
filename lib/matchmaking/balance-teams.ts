import { and, asc, eq, inArray } from "drizzle-orm"
import { db } from "@/lib/db"
import { players, playerPositionRatings, signups, trainings } from "@/lib/db/schema"
import { getRatingConfidence, getRatingStatus } from "@/lib/ratings/confidence"
import { ROTATION_BONUS_PER_SUBSTITUTE } from "@/lib/ratings/constants"
import { PLAYER_POSITIONS, type PlayerPosition } from "@/lib/ratings/types"
import { MAX_ACTIVE_PLAYERS_PER_TEAM } from "./constants"
import { getTargetLineup } from "./target-lineup"
import type { MatchmakingAssignment, MatchmakingPlayer, MatchmakingResult, RotationGroup, TeamSummary } from "./types"

function getPreferenceOrder(player: MatchmakingPlayer, position: PlayerPosition): number {
  const explicitOrder = player.positionPreferences.find((entry) => entry.position === position)?.order
  if (explicitOrder) return explicitOrder

  const eligibleIndex = player.eligiblePositions.indexOf(position)
  return eligibleIndex === -1 ? PLAYER_POSITIONS.length + 1 : PLAYER_POSITIONS.length + eligibleIndex + 1
}

type DraftAssignment = Omit<MatchmakingAssignment, "rotationGroupId" | "rotationGroupType" | "rotationOrder" | "startsInWater" | "lineupType">

function average(values: number[]): number { return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length) }
function spread(values: number[]): number { return values.length ? Math.max(...values) - Math.min(...values) : 0 }

function makeGroup(id: number, team: 1 | 2, position: PlayerPosition, members: MatchmakingPlayer[], type: "single" | "pair" | "triple", startIndexes: Set<number>): RotationGroup {
  const ratings = members.map((member) => member.ratings[position])
  const activeSlotCount = type === "triple" ? 2 : 1
  const activePairRatings = type === "triple" ? ratings.map((rating, index) => (rating + ratings[(index + 1) % ratings.length]) / 2) : undefined
  const averageMemberRating = Math.round(average(ratings))
  const effectiveRating = type === "single"
    ? averageMemberRating
    : type === "pair"
      ? Math.round(averageMemberRating + ROTATION_BONUS_PER_SUBSTITUTE)
      : Math.round(average(activePairRatings!) + ROTATION_BONUS_PER_SUBSTITUTE / 2)
  return {
    id, team, position, type, activeSlotCount,
    members: members.map((member, index) => ({ signupId: member.signupId, playerId: member.playerId, name: member.name, rating: member.ratings[position], rotationOrder: index + 1, startsInWater: startIndexes.has(index) })),
    averageMemberRating,
    effectiveRating,
    ratingSpread: Math.round(type === "triple" ? spread(activePairRatings!) : spread(ratings)),
    activePairRatings: activePairRatings?.map(Math.round),
  }
}

function pairings<T>(items: T[]): Array<[T[], T[]]> {
  return [[[items[0], items[1]], [items[2], items[3]]], [[items[0], items[2]], [items[1], items[3]]], [[items[0], items[3]], [items[1], items[2]]]]
}

function buildRotationGroups(playersBySignup: Map<number, MatchmakingPlayer>, drafts: DraftAssignment[], target: Record<PlayerPosition, number>, warnings: string[]): RotationGroup[] {
  const groups: RotationGroup[] = []
  let nextGroupId = 1
  for (const team of [1, 2] as const) for (const position of PLAYER_POSITIONS) {
    const members = drafts.filter((a) => a.team === team && a.position === position).map((a) => playersBySignup.get(a.signupId)!).sort((a, b) => b.ratings[position] - a.ratings[position])
    const slots = target[position]
    if (members.length === 0) continue
    if (members.length < slots) warnings.push(`Für Team ${team} konnte keine gültige Wechselgruppe für ${position} erstellt werden.`)
    if (slots === 1) {
      const type = members.length === 1 ? "single" : "pair"
      if (members.length > 2) warnings.push(`Für diese Position mussten mehr als zwei Spieler eingeplant werden. Es wurde ein vereinfachter Rotationsplan erzeugt.`)
      groups.push(makeGroup(nextGroupId++, team, position, members, type, new Set([0])))
      continue
    }
    if (slots === 2 && members.length === 3) {
      groups.push(makeGroup(nextGroupId++, team, position, members, "triple", new Set([0, 1])))
    } else if (slots === 2 && members.length >= 4) {
      if (members.length > 4) {
        warnings.push(`Für diese Position mussten mehr als vier Spieler eingeplant werden. Es wurde ein erweiterter Rotationsplan erzeugt.`)
        groups.push(makeGroup(nextGroupId++, team, position, members, "triple", new Set([0, 1])))
      } else {
        const best = pairings(members).sort((a, b) => (spread(a[0].map((m) => m.ratings[position])) + spread(a[1].map((m) => m.ratings[position]))) - (spread(b[0].map((m) => m.ratings[position])) + spread(b[1].map((m) => m.ratings[position]))))[0]
        for (const pair of best) groups.push(makeGroup(nextGroupId++, team, position, pair, "pair", new Set([0])))
      }
    } else {
      for (const member of members.slice(0, slots)) groups.push(makeGroup(nextGroupId++, team, position, [member], "single", new Set([0])))
    }
  }
  return groups
}

export function calculateEffectiveTeamStrength(groups: RotationGroup[]): number {
  const activeSlotCount = groups.reduce((sum, group) => sum + group.activeSlotCount, 0)
  if (activeSlotCount === 0) throw new Error("Team besitzt keine aktiven Plätze")
  return groups.reduce((sum, group) => sum + group.effectiveRating * group.activeSlotCount, 0) / activeSlotCount
}

function summarize(playersBySignup: Map<number, MatchmakingPlayer>, assignments: MatchmakingAssignment[], rotationGroups: RotationGroup[], team: 1 | 2): TeamSummary {
  const mine = assignments.filter((a) => a.team === team)
  const active = mine.filter((a) => a.startsInWater)
  const subs = mine.filter((a) => !a.startsInWater)
  const avg = (items: MatchmakingAssignment[]) => items.reduce((sum, a) => sum + playersBySignup.get(a.signupId)!.ratings[a.position], 0) / Math.max(1, items.length)
  const averageParticipantRating = Math.round(avg(mine))
  const rotationBonus = subs.length * ROTATION_BONUS_PER_SUBSTITUTE
  return {
    activeCount: active.length,
    substituteCount: subs.length,
    averageParticipantRating,
    rotationBonus,
    effectiveStrength: Math.round(calculateEffectiveTeamStrength(rotationGroups.filter((group) => group.team === team))),
    startingLineupStrength: Math.round(avg(active)),
    positionAverages: Object.fromEntries(PLAYER_POSITIONS.map((p) => [p, Math.round(avg(mine.filter((a) => a.position === p)))])) as Record<PlayerPosition, number>,
    confidence: mine.reduce((sum, a) => sum + playersBySignup.get(a.signupId)!.confidence[a.position], 0) / Math.max(1, mine.length),
  }
}

export function getTripleActivePairRatings(ratings: [number, number, number]): [number, number, number] {
  return [(ratings[0] + ratings[1]) / 2, (ratings[1] + ratings[2]) / 2, (ratings[2] + ratings[0]) / 2]
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
  const activePerTeam = Math.min(MAX_ACTIVE_PLAYERS_PER_TEAM, Math.floor(players.length / 2))
  const target = getTargetLineup(activePerTeam, availability)
  const ordered = [...players].sort((a, b) => a.eligiblePositions.length - b.eligiblePositions.length || a.name.localeCompare(b.name))
  const drafts: DraftAssignment[] = []
  const positionCounts = { 1: { goalkeeper: 0, defender: 0, forward: 0 }, 2: { goalkeeper: 0, defender: 0, forward: 0 } } as Record<1 | 2, Record<PlayerPosition, number>>
  const teamCounts = { 1: 0, 2: 0 } as Record<1 | 2, number>
  let candidatesEvaluated = 0
  const maxTeamSize = Math.ceil(players.length / 2)
  for (const p of ordered) {
    const options: DraftAssignment[] = []
    for (const position of p.eligiblePositions) for (const team of [1, 2] as const) {
      if (teamCounts[team] < maxTeamSize) options.push({ signupId: p.signupId, playerId: p.playerId, team, position })
    }
    options.sort((a, b) => {
      const teamSizeBias = (teamCounts[a.team] - teamCounts[b.team]) * 100000
      const preferenceBias = (getPreferenceOrder(p, a.position) - getPreferenceOrder(p, b.position)) * 10000
      const overUsefulSlotsBias = (Math.max(0, positionCounts[a.team][a.position] - target[a.position]) - Math.max(0, positionCounts[b.team][b.position] - target[b.position])) * 5000
      const slotBias = (positionCounts[a.team][a.position] - positionCounts[b.team][b.position]) * 1000
      const ratingBias = p.ratings[b.position] - p.ratings[a.position]
      return teamSizeBias + preferenceBias + overUsefulSlotsBias + slotBias + ratingBias || a.team - b.team || a.position.localeCompare(b.position)
    })
    const chosen = options[0]
    drafts.push(chosen); teamCounts[chosen.team]++; positionCounts[chosen.team][chosen.position]++; candidatesEvaluated += options.length
  }
  const bySignup = new Map(players.map((p) => [p.signupId, p]))
  const rotationGroups = buildRotationGroups(bySignup, drafts, target, warnings)
  const assignments: MatchmakingAssignment[] = drafts.map((draft) => {
    const group = rotationGroups.find((candidate) => candidate.members.some((member) => member.signupId === draft.signupId))
    const member = group?.members.find((candidate) => candidate.signupId === draft.signupId)
    if (!group || !member) throw new Error("Für eine Anmeldung konnte keine Wechselgruppe erstellt werden.")
    return { ...draft, rotationGroupId: group.id, rotationGroupType: group.type, rotationOrder: member.rotationOrder, startsInWater: member.startsInWater, lineupType: member.startsInWater ? "active" : "substitute" }
  })
  for (const team of [1, 2] as const) if (assignments.filter((a) => a.team === team && a.startsInWater).length > MAX_ACTIVE_PLAYERS_PER_TEAM) warnings.push("Mehr als sechs Spieler wurden als aktiv eingeplant.")
  for (const group of rotationGroups.filter((g) => g.type === "triple" && g.ratingSpread > 200)) warnings.push(`Die Dreier-Wechselgruppe ${group.members.map((m) => m.name).join("/")} besitzt eine stark schwankende aktive Paarstärke. Die Elo-Spannweite dieser Wechselgruppe beträgt ${group.ratingSpread} Punkte.`)
  const finalTeam1 = summarize(bySignup, assignments, rotationGroups, 1), finalTeam2 = summarize(bySignup, assignments, rotationGroups, 2)
  const diff = Math.abs(finalTeam1.effectiveStrength - finalTeam2.effectiveStrength)
  const unstable = assignments.filter((a) => getRatingStatus(bySignup.get(a.signupId)!.gamesPlayed[a.position]) !== "established").length
  const quality = warnings.length || diff > 80 ? "low" : diff > 25 || unstable > assignments.length / 3 ? "medium" : "high"
  return { assignments, rotationGroups, team1: finalTeam1, team2: finalTeam2, warnings, computationTimeMs: Date.now() - started, candidatesEvaluated, optimality: candidatesEvaluated > 10000 ? "best-found" : "exact", quality }
}

export async function assignBalancedTeams(trainingId?: number): Promise<MatchmakingResult | null> {
  const [training] = trainingId
    ? await db.select().from(trainings).where(eq(trainings.id, trainingId)).limit(1)
    : await db.select().from(trainings).where(eq(trainings.isOpen, true)).limit(1)
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
    for (const a of result.assignments) await tx.update(signups).set({ team: a.team, assignedPosition: a.position, lineupType: a.lineupType, rotationGroupId: a.rotationGroupId, rotationGroupType: a.rotationGroupType, rotationOrder: a.rotationOrder, startsInWater: a.startsInWater }).where(and(eq(signups.id, a.signupId), eq(signups.trainingId, training.id)))
  })
  return result
}
