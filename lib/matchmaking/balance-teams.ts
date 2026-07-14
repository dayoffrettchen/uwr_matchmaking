import { and, asc, eq, inArray } from "drizzle-orm"
import { db } from "@/lib/db"
import { players, playerPositionRatings, signups, trainings } from "@/lib/db/schema"
import { getRatingConfidence, getRatingStatus } from "@/lib/ratings/confidence"
import { ROTATION_BONUS_PER_SUBSTITUTE } from "@/lib/ratings/constants"
import { PLAYER_POSITIONS, type PlayerPosition } from "@/lib/ratings/types"
import { MAX_ACTIVE_PLAYERS_PER_TEAM, MAX_CANDIDATES, MAX_COMPUTATION_TIME_MS } from "./constants"
import { getTargetLineup } from "./target-lineup"
import { runGeneticOptimization, type GeneticOptions } from "./genetic"
import type { DraftAssignment } from "./candidate"
import type { MatchmakingAssignment, MatchmakingPlayer, MatchmakingResult, RotationGroup, TeamSummary } from "./types"


function average(values: number[]): number { return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length) }
function spread(values: number[]): number { return values.length ? Math.max(...values) - Math.min(...values) : 0 }

function makeGroup(id: number, team: 1 | 2, position: PlayerPosition, members: MatchmakingPlayer[], type: "single" | "pair" | "triple", startIndexes: Set<number>): RotationGroup {
  const ratings = members.map((member) => member.ratings[position])
  const activeSlotCount: 1 | 2 = startIndexes.size > 1 ? 2 : 1
  const activePairRatings = type === "triple" && activeSlotCount > 1 ? ratings.map((rating, index) => (rating + ratings[(index + 1) % ratings.length]) / 2) : undefined
  const averageMemberRating = Math.round(average(ratings))
  const effectiveRating = type === "single"
    ? averageMemberRating
    : type === "pair"
      ? Math.round(averageMemberRating + ROTATION_BONUS_PER_SUBSTITUTE)
      : activePairRatings
        ? Math.round(average(activePairRatings) + ROTATION_BONUS_PER_SUBSTITUTE / 2)
        : Math.round(averageMemberRating + ROTATION_BONUS_PER_SUBSTITUTE)
  return {
    id, team, position, type, activeSlotCount,
    members: members.map((member, index) => ({ signupId: member.signupId, playerId: member.playerId, name: member.name, rating: member.ratings[position], rotationOrder: index + 1, startsInWater: startIndexes.has(index) })),
    averageMemberRating,
    effectiveRating,
    ratingSpread: Math.round(activePairRatings ? spread(activePairRatings) : spread(ratings)),
    activePairRatings: activePairRatings?.map(Math.round),
  }
}

function pairings<T>(items: T[]): Array<[T[], T[]]> {
  return [[[items[0], items[1]], [items[2], items[3]]], [[items[0], items[2]], [items[1], items[3]]], [[items[0], items[3]], [items[1], items[2]]]]
}

function buildSingleSlotGroups(members: MatchmakingPlayer[], slots: number, position: PlayerPosition): MatchmakingPlayer[][] {
  const groups = Array.from({ length: slots }, () => [] as MatchmakingPlayer[])
  members.forEach((member, index) => groups[index % slots].push(member))
  return groups.sort((a, b) => b.length - a.length || b[0].ratings[position] - a[0].ratings[position])
}

export function buildRotationGroups(playersBySignup: Map<number, MatchmakingPlayer>, drafts: DraftAssignment[], target: Record<PlayerPosition, number>, warnings: string[]): RotationGroup[] {
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
    } else if (slots > 2) {
      if (members.length > slots * 2) warnings.push(`Für ${position} wurden sehr viele Wechselspieler eingeplant. Es wurde ein erweiterter Rotationsplan erzeugt.`)
      for (const groupMembers of buildSingleSlotGroups(members, slots, position)) {
        const type = groupMembers.length === 1 ? "single" : groupMembers.length === 2 ? "pair" : "triple"
        groups.push(makeGroup(nextGroupId++, team, position, groupMembers, type, new Set([0])))
      }
    } else {
      for (const member of members.slice(0, slots)) groups.push(makeGroup(nextGroupId++, team, position, [member], "single", new Set([0])))
    }
  }
  return groups
}

export function completeAssignments(players: MatchmakingPlayer[], drafts: DraftAssignment[], warnings: string[]): { assignments: MatchmakingAssignment[]; rotationGroups: RotationGroup[] } {
  const availability = Object.fromEntries(PLAYER_POSITIONS.map((pos) => [pos, players.filter((p) => p.eligiblePositions.includes(pos)).length])) as Record<PlayerPosition, number>
  const target = getTargetLineup(MAX_ACTIVE_PLAYERS_PER_TEAM, availability)
  const bySignup = new Map(players.map((p) => [p.signupId, p]))
  const rotationGroups = buildRotationGroups(bySignup, drafts, target, warnings)
  const assignments: MatchmakingAssignment[] = drafts.map((draft) => {
    const group = rotationGroups.find((candidate) => candidate.members.some((member) => member.signupId === draft.signupId))
    const member = group?.members.find((candidate) => candidate.signupId === draft.signupId)
    if (!group || !member) throw new Error("Für eine Anmeldung konnte keine Wechselgruppe erstellt werden.")
    return { ...draft, rotationGroupId: group.id, rotationGroupType: group.type, rotationOrder: member.rotationOrder, startsInWater: member.startsInWater, lineupType: member.startsInWater ? "active" : "substitute" }
  })
  return { assignments, rotationGroups }
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

export function normalizeMatchmakingPlayers(input: MatchmakingPlayer[], warnings: string[]): MatchmakingPlayer[] {
  const players = input.map((p) => p.eligiblePositions.length ? p : { ...p, eligiblePositions: [...PLAYER_POSITIONS], positionPreferences: PLAYER_POSITIONS.map((position, i) => ({ position, order: i + 1 })) })
  for (const p of input.filter((p) => p.eligiblePositions.length === 0)) warnings.push(`${p.name} besitzt keine freigeschaltete Position und wurde nur provisorisch zugeordnet.`)
  return players.sort((a, b) => a.signupId - b.signupId || a.playerId - b.playerId || a.name.localeCompare(b.name))
}

export function balanceMatchmakingPlayers(input: MatchmakingPlayer[], options: Partial<GeneticOptions> = {}): MatchmakingResult {
  const started = Date.now()
  const warnings: string[] = []
  if (input.length < 6) warnings.push("Weniger als sechs Spieler sind angemeldet. Die Aufteilung ist nur eingeschränkt aussagekräftig.")
  if (input.length % 2 === 1) warnings.push("Ungerade Teilnehmerzahl: Ein Spieler wird als Wechselspieler eingeplant.")
  const players = normalizeMatchmakingPlayers(input, warnings)
  const availability = Object.fromEntries(PLAYER_POSITIONS.map((pos) => [pos, players.filter((p) => p.eligiblePositions.includes(pos)).length])) as Record<PlayerPosition, number>
  const target = getTargetLineup(MAX_ACTIVE_PLAYERS_PER_TEAM, availability)
  for (const pos of PLAYER_POSITIONS) {
    if (availability[pos] < 2) warnings.push(`Nicht genügend Spieler für ${pos} verfügbar.`)
    if (availability[pos] < target[pos] * 2) warnings.push(`Die Zielverteilung für ${pos} ist mit den verfügbaren Berechtigungen nur als Best-Effort erfüllbar.`)
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
  const quality = warnings.length || diff > 80 ? "low" : diff > 25 || unstable > result.assignments.length / 3 ? "medium" : "high"
  return { ...result, warnings, computationTimeMs: Date.now() - started, optimality: "best-found", quality }
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
