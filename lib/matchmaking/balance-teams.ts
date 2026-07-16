import { and, asc, eq, inArray } from "drizzle-orm"
import { db } from "@/lib/db"
import { players, playerPositionRatings, signups, trainings } from "@/lib/db/schema"
import { getRatingConfidence, getRatingStatus } from "@/lib/ratings/confidence"
import { calculateRotationStrength } from "@/lib/ratings/rotation-strength"
import { PLAYER_POSITIONS, type PlayerPosition } from "@/lib/ratings/types"
import { MAX_CANDIDATES, MAX_COMPUTATION_TIME_MS } from "./constants"
import { ACTIVE_SLOTS_PER_POSITION, getActivePlayersPerTeamLimit, MAX_ACTIVE_PLAYERS_PER_TEAM, TEAM_NUMBERS } from "./rules"
import { buildPositionSlotGroups, buildRotationSteps } from "./slots"
export { buildPositionSlotGroups, buildRotationSteps } from "./slots"
import { getFeasibleLineupTarget } from "./target-lineup"
import { runGeneticOptimization, type GeneticOptions } from "./genetic"
import type { DraftAssignment } from "./candidate"
import type { MatchmakingAssignment, MatchmakingPlayer, MatchmakingResult, RotationGroup, RotationGroupMember, TeamSummary } from "./types"


function average(values: number[]): number { return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length) }
function spread(values: number[]): number { return values.length ? Math.max(...values) - Math.min(...values) : 0 }

function makeGroup(id: number, team: 1 | 2, position: PlayerPosition, members: MatchmakingPlayer[], type: RotationGroup["type"], startIndexes: Set<number>): RotationGroup {
  const ratings = members.map((member) => member.ratings[position])
  const activeSlotCount: 1 | 2 = startIndexes.size > 1 ? 2 : 1
  const activePairRatings = type === "triple" && activeSlotCount > 1 ? ratings.map((rating, index) => (rating + ratings[(index + 1) % ratings.length]) / 2) : undefined
  const { averageMemberRating, effectiveRating } = calculateRotationStrength(ratings, activeSlotCount)
  return {
    id, team, position, type, activeSlotCount,
    members: members.map((member, index) => ({ signupId: member.signupId, playerId: member.playerId, name: member.name, rating: member.ratings[position], rotationOrder: index + 1, startsInWater: startIndexes.has(index) })),
    averageMemberRating,
    effectiveRating,
    ratingSpread: Math.round(activePairRatings ? spread(activePairRatings) : spread(ratings)),
    activePairRatings: activePairRatings?.map(Math.round),
  }
}

function makeFinalLineupGroup(id: number, team: 1 | 2, position: PlayerPosition, members: MatchmakingPlayer[]): RotationGroup {
  const type: RotationGroup["type"] = members.length === 1 ? "single" : members.length === 2 ? "pair" : "position"
  const group = makeGroup(id, team, position, members, type, new Set([0]))
  return { ...group, rotationSteps: buildRotationSteps(group.members, 1) }
}

export function finalizeUnderwaterRugbyLineup(players: MatchmakingPlayer[], assignments: MatchmakingAssignment[], warnings: string[]): { assignments: MatchmakingAssignment[]; rotationGroups: RotationGroup[]; team1: TeamSummary; team2: TeamSummary } {
  const bySignup = new Map(players.map((p) => [p.signupId, p]))
  const rotationGroups: RotationGroup[] = []
  let nextGroupId = 1
  for (const team of TEAM_NUMBERS) for (const position of PLAYER_POSITIONS) {
    const positionAssignments = assignments.filter((a) => a.team === team && a.position === position)
    const hasRotationOrder = positionAssignments.some((a) => a.rotationOrder > 0)
    const orderBySignup = new Map(positionAssignments.map((a) => [a.signupId, a.rotationOrder]))
    const members = positionAssignments
      .map((a) => bySignup.get(a.signupId)!)
      .sort((a, b) => hasRotationOrder
        ? (orderBySignup.get(a.signupId) ?? 0) - (orderBySignup.get(b.signupId) ?? 0) || b.ratings[position] - a.ratings[position] || a.signupId - b.signupId
        : b.ratings[position] - a.ratings[position] || a.signupId - b.signupId)
    if (members.length === 0) {
      warnings.push(`Team ${team}: Keine Spieler für ${position} zugeordnet. Die finale Aufstellung ist dort unterbesetzt.`)
      continue
    }
    if (members.length < 2) warnings.push(`Team ${team}: Nur ${members.length} Spieler für ${position} zugeordnet. Es starten nur vorhandene Spieler im Wasser.`)
    for (const slotMembers of buildPositionSlotGroups(members, position)) {
      rotationGroups.push(makeFinalLineupGroup(nextGroupId++, team, position, slotMembers))
    }
  }
  const finalMemberBySignup = new Map<number, { group: RotationGroup; member: RotationGroupMember }>()
  for (const group of rotationGroups) for (const member of group.members) finalMemberBySignup.set(member.signupId, { group, member })
  const finalizedAssignments = assignments.map((assignment) => {
    const finalMember = finalMemberBySignup.get(assignment.signupId)
    if (!finalMember) throw new Error("Für eine Anmeldung konnte keine finale Wechselgruppe erstellt werden.")
    const { group, member } = finalMember
    return { ...assignment, rotationGroupId: group.id, rotationGroupType: group.type, rotationOrder: member.rotationOrder, startsInWater: member.startsInWater, lineupType: member.startsInWater ? "active" as const : "substitute" as const }
  })
  return { assignments: finalizedAssignments, rotationGroups, team1: summarize(bySignup, finalizedAssignments, rotationGroups, 1), team2: summarize(bySignup, finalizedAssignments, rotationGroups, 2) }
}

export function completeAssignments(players: MatchmakingPlayer[], drafts: DraftAssignment[], warnings: string[]): { assignments: MatchmakingAssignment[]; rotationGroups: RotationGroup[] } {
  const draftAssignments: MatchmakingAssignment[] = drafts.map((draft) => ({
    ...draft,
    rotationGroupId: 0,
    rotationGroupType: "single" as const,
    rotationOrder: 0,
    startsInWater: false,
    lineupType: "substitute" as const,
  }))
  const finalLineup = finalizeUnderwaterRugbyLineup(players, draftAssignments, warnings)
  return { assignments: finalLineup.assignments, rotationGroups: finalLineup.rotationGroups }
}

export function calculateEffectiveTeamStrength(groups: RotationGroup[]): number {
  const activeSlotCount = groups.reduce((sum, group) => sum + group.activeSlotCount, 0)
  if (activeSlotCount === 0) throw new Error("Team besitzt keine aktiven Plätze")
  return groups.reduce((sum, group) => sum + group.effectiveRating * group.activeSlotCount, 0) / activeSlotCount
}

export function summarize(playersBySignup: Map<number, MatchmakingPlayer>, assignments: MatchmakingAssignment[], rotationGroups: RotationGroup[], team: 1 | 2): TeamSummary {
  const mine = assignments.filter((a) => a.team === team)
  const active = mine.filter((a) => a.startsInWater)
  const subs = mine.filter((a) => !a.startsInWater)
  const avg = (items: MatchmakingAssignment[]) => items.reduce((sum, a) => sum + playersBySignup.get(a.signupId)!.ratings[a.position], 0) / Math.max(1, items.length)
  const averageParticipantRating = Math.round(avg(mine))
  const rotationBonus = rotationGroups.filter((group) => group.team === team).reduce((sum, group) => sum + Math.max(0, group.effectiveRating - Math.max(...group.members.map((member) => member.rating))), 0)
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

export function normalizeMatchmakingPlayers(input: MatchmakingPlayer[], warnings: string[]): MatchmakingPlayer[] {
  const players = input.map((p) => p.eligiblePositions.length ? p : { ...p, eligiblePositions: [...PLAYER_POSITIONS], positionPreferences: PLAYER_POSITIONS.map((position, i) => ({ position, order: i + 1 })) })
  for (const p of input.filter((p) => p.eligiblePositions.length === 0)) warnings.push(`${p.name} besitzt keine freigeschaltete Position und wurde nur provisorisch zugeordnet.`)
  return players.sort((a, b) => a.signupId - b.signupId || a.playerId - b.playerId || a.name.localeCompare(b.name))
}

export function balanceMatchmakingPlayers(input: MatchmakingPlayer[], options: Partial<GeneticOptions> = {}): MatchmakingResult {
  const now = options.now ?? Date.now
  const started = now()
  const warnings: string[] = []
  if (input.length < 6) warnings.push("Weniger als sechs Spieler sind angemeldet. Die Aufteilung ist nur eingeschränkt aussagekräftig.")
  if (input.length % 2 === 1) warnings.push("Ungerade Teilnehmerzahl: Ein Spieler wird als Wechselspieler eingeplant.")
  const players = normalizeMatchmakingPlayers(input, warnings)
  const activePlayersPerTeam = getActivePlayersPerTeamLimit(players.length)
  const target = getFeasibleLineupTarget(players, activePlayersPerTeam)
  const availability = Object.fromEntries(PLAYER_POSITIONS.map((pos) => [pos, players.filter((p) => p.eligiblePositions.includes(pos)).length])) as Record<PlayerPosition, number>
  for (const pos of PLAYER_POSITIONS) {
    if (availability[pos] < 2) warnings.push(`Nicht genügend Spieler für ${pos} verfügbar.`)
    if (target[pos] < ACTIVE_SLOTS_PER_POSITION[pos]) warnings.push(`Die Zielverteilung für ${pos} ist mit den verfügbaren Berechtigungen nur als Best-Effort erfüllbar.`)
  }
  const result = runGeneticOptimization(players, {
    seed: options.seed,
    maxCandidates: options.maxCandidates ?? MAX_CANDIDATES,
    maxGenerations: options.maxGenerations ?? 80,
    maxComputationTimeMs: options.maxComputationTimeMs ?? MAX_COMPUTATION_TIME_MS,
    populationSize: options.populationSize ?? 48,
  }, warnings)
  for (const team of [1, 2] as const) if (result.assignments.filter((a) => a.team === team && a.startsInWater).length > MAX_ACTIVE_PLAYERS_PER_TEAM) warnings.push("Mehr als sechs Spieler wurden als aktiv eingeplant.")
  for (const group of result.rotationGroups.filter((g) => g.type === "triple" && g.ratingSpread > 200)) warnings.push(`Die Dreier-Wechselgruppe ${group.members.map((m) => m.name).join("/")} besitzt eine stark schwankende aktive Paarstärke. Die Elo-Spannweite dieser Wechselgruppe beträgt ${group.ratingSpread} Punkte.`)
  const diff = Math.abs(result.team1.effectiveStrength - result.team2.effectiveStrength)
  const bySignup = new Map(players.map((p) => [p.signupId, p]))
  const unstable = result.assignments.filter((a) => getRatingStatus(bySignup.get(a.signupId)!.gamesPlayed[a.position]) !== "established").length
  const uniqueWarnings = [...new Set(warnings)]
  const quality = uniqueWarnings.length || diff > 80 ? "low" : diff > 25 || unstable > result.assignments.length / 3 ? "medium" : "high"
  return { ...result, warnings: uniqueWarnings, computationTimeMs: now() - started, optimality: "best-found", quality }
}

async function loadMatchmakingPlayers(trainingId: number) {
  const signupRows = await db.select({ signupId: signups.id, playerId: players.id, name: players.name, team: signups.team, assignedPosition: signups.assignedPosition }).from(signups).innerJoin(players, eq(players.id, signups.playerId)).where(eq(signups.trainingId, trainingId)).orderBy(asc(signups.createdAt))
  const ratings = signupRows.length > 0 ? await db.select().from(playerPositionRatings).where(inArray(playerPositionRatings.playerId, signupRows.map((r) => r.playerId))) : []
  const matchmakingPlayers = signupRows.map((row) => {
    const mine = ratings.filter((r) => r.playerId === row.playerId)
    return { signupId: row.signupId, playerId: row.playerId, name: row.name, eligiblePositions: mine.filter((r) => r.isEligible).map((r) => r.position as PlayerPosition), positionPreferences: mine.filter((r) => r.preferenceOrder).map((r) => ({ position: r.position as PlayerPosition, order: r.preferenceOrder! })), ratings: Object.fromEntries(PLAYER_POSITIONS.map((p) => [p, mine.find((r) => r.position === p)?.rating ?? 1000])) as Record<PlayerPosition, number>, gamesPlayed: Object.fromEntries(PLAYER_POSITIONS.map((p) => [p, mine.find((r) => r.position === p)?.gamesPlayed ?? 0])) as Record<PlayerPosition, number>, confidence: Object.fromEntries(PLAYER_POSITIONS.map((p) => [p, getRatingConfidence(mine.find((r) => r.position === p)?.gamesPlayed ?? 0)])) as Record<PlayerPosition, number> }
  })
  return { signupRows, players: matchmakingPlayers }
}

export async function rebuildManualLineup(trainingId: number) {
  const { signupRows, players } = await loadMatchmakingPlayers(trainingId)
  const normalizedPlayers = players.map((p) => p.eligiblePositions.length ? p : { ...p, eligiblePositions: [...PLAYER_POSITIONS], positionPreferences: PLAYER_POSITIONS.map((position, i) => ({ position, order: i + 1 })) })
  const drafts = signupRows
    .filter((row): row is typeof row & { team: 1 | 2; assignedPosition: PlayerPosition } => (row.team === 1 || row.team === 2) && PLAYER_POSITIONS.includes(row.assignedPosition as PlayerPosition))
    .map((row) => ({ signupId: row.signupId, playerId: row.playerId, team: row.team, position: row.assignedPosition }))
  if (drafts.length === 0) return
  const warnings: string[] = []
  const { assignments } = completeAssignments(normalizedPlayers, drafts, warnings)
  await db.transaction(async (tx) => {
    for (const assignment of assignments) await tx.update(signups).set({ team: assignment.team, assignedPosition: assignment.position, lineupType: assignment.lineupType, rotationGroupId: assignment.rotationGroupId, rotationGroupType: assignment.rotationGroupType, rotationOrder: assignment.rotationOrder, startsInWater: assignment.startsInWater }).where(and(eq(signups.id, assignment.signupId), eq(signups.trainingId, trainingId)))
  })
}

export async function assignBalancedTeams(trainingId?: number, options: Partial<GeneticOptions> = {}): Promise<MatchmakingResult | null> {
  const [training] = trainingId
    ? await db.select().from(trainings).where(eq(trainings.id, trainingId)).limit(1)
    : await db.select().from(trainings).where(eq(trainings.isOpen, true)).limit(1)
  if (!training) return null
  const { signupRows, players: input } = await loadMatchmakingPlayers(training.id)
  const beforeIds = signupRows.map((r) => r.signupId).sort().join(",")
  const result = balanceMatchmakingPlayers(input, options)
  await db.transaction(async (tx) => {
    const current = await tx.select({ id: signups.id }).from(signups).where(eq(signups.trainingId, training.id))
    if (current.map((r) => r.id).sort().join(",") !== beforeIds) throw new Error("Die Teilnehmerliste wurde während der Berechnung verändert.")
    for (const a of result.assignments) await tx.update(signups).set({ team: a.team, assignedPosition: a.position, lineupType: a.lineupType, rotationGroupId: a.rotationGroupId, rotationGroupType: a.rotationGroupType, rotationOrder: a.rotationOrder, startsInWater: a.startsInWater }).where(and(eq(signups.id, a.signupId), eq(signups.trainingId, training.id)))
  })
  return result
}
