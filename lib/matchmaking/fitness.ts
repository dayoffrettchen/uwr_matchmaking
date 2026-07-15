import { getRatingStatus } from "@/lib/ratings/confidence"
import { PLAYER_POSITIONS, type PlayerPosition } from "@/lib/ratings/types"
import { OBJECTIVE_WEIGHTS } from "./constants"
import { getActivePlayersPerTeamLimit, MAX_ACTIVE_PLAYERS_PER_TEAM } from "./rules"
import { completeAssignments, summarize } from "./balance-teams"
import { getFeasibleLineupTarget } from "./target-lineup"
import { toDraftAssignments, type Candidate } from "./candidate"
import type { MatchmakingAssignment, MatchmakingPlayer, MatchmakingResult, RotationGroup, TeamSummary } from "./types"

export type FitnessBreakdown = {
  effectiveStrengthDifference: number
  startingLineupDifference: number
  positionStrengthDifference: number
  targetLineupPenalty: number
  activePlayerDifference: number
  substituteAdvantagePenalty: number
  rotationSpreadPenalty: number
  rotationMatchPenalty: number
  positionCrowdingPenalty: number
  preferencePenalty: number
  confidencePenalty: number
  unratedPlayerPenalty: number
  hardViolations: number
  total: number
}

export type EvaluatedCandidate = MatchmakingResult & { fitness: FitnessBreakdown; candidate: Candidate; hash: string }

export function getPositionPenalty(player: MatchmakingPlayer, position: PlayerPosition): number {
  if (!player.eligiblePositions.includes(position)) return 1_000_000
  const pref = player.positionPreferences.find((entry) => entry.position === position)
  if (!pref) return 180
  if (pref.order === 1) return 0
  if (pref.order === 2) return 40
  if (pref.order === 3) return 120
  return 180
}

function positionEffective(groups: RotationGroup[], position: PlayerPosition): number {
  const mine = groups.filter((g) => g.position === position)
  const slots = mine.reduce((sum, g) => sum + g.activeSlotCount, 0)
  return slots ? mine.reduce((sum, g) => sum + g.effectiveRating * g.activeSlotCount, 0) / slots : 0
}

function rotationSpread(groups: RotationGroup[]): number {
  return groups.reduce((sum, group) => {
    const base = group.ratingSpread * group.ratingSpread / 100
    const pairVariance = group.activePairRatings && group.activePairRatings.length ? (Math.max(...group.activePairRatings) - Math.min(...group.activePairRatings)) ** 2 / 100 : 0
    return sum + (group.type === "triple" ? 1.8 : 1) * (base + pairVariance)
  }, 0)
}

export function calculateTargetLineupPenalty(assignments: MatchmakingAssignment[], target: Record<PlayerPosition, number>): number {
  return PLAYER_POSITIONS.reduce((sum, position) => {
    const team1Active = assignments.filter((a) => a.team === 1 && a.startsInWater && a.position === position).length
    const team2Active = assignments.filter((a) => a.team === 2 && a.startsInWater && a.position === position).length
    return sum + Math.abs(team1Active - target[position]) + Math.abs(team2Active - target[position])
  }, 0)
}

export function compareBreakdowns(a: FitnessBreakdown, b: FitnessBreakdown, aTie = "", bTie = ""): number {
  return a.hardViolations - b.hardViolations || a.total - b.total || aTie.localeCompare(bTie)
}

export function evaluateCandidate(players: MatchmakingPlayer[], candidate: Candidate, hash = ""): EvaluatedCandidate | null {
  const warnings: string[] = []
  const bySignup = new Map(players.map((p) => [p.signupId, p]))
  const seen = new Set<number>()
  let hardViolations = 0
  for (const g of candidate) {
    const player = bySignup.get(g.signupId)
    if (!player || seen.has(g.signupId) || (g.team !== 1 && g.team !== 2) || !player.eligiblePositions.includes(g.position)) hardViolations += 1
    seen.add(g.signupId)
  }
  hardViolations += Math.abs(players.length - seen.size)
  const sizes = [candidate.filter((g) => g.team === 1).length, candidate.filter((g) => g.team === 2).length]
  if (Math.abs(sizes[0] - sizes[1]) > players.length % 2) hardViolations += 10
  let assignments: MatchmakingAssignment[], rotationGroups: RotationGroup[]
  try { ({ assignments, rotationGroups } = completeAssignments(players, toDraftAssignments(players, candidate), warnings)) } catch { return null }
  for (const team of [1, 2] as const) if (assignments.filter((a) => a.team === team && a.startsInWater).length > MAX_ACTIVE_PLAYERS_PER_TEAM) hardViolations += 100
  const team1 = summarize(bySignup, assignments, rotationGroups, 1)
  const team2 = summarize(bySignup, assignments, rotationGroups, 2)
  const effectiveStrengthDifference = Math.abs(team1.effectiveStrength - team2.effectiveStrength)
  const startingLineupDifference = Math.abs(team1.startingLineupStrength - team2.startingLineupStrength)
  const positionDiffs = Object.fromEntries(PLAYER_POSITIONS.map((p) => [p, Math.abs(positionEffective(rotationGroups.filter((g) => g.team === 1), p) - positionEffective(rotationGroups.filter((g) => g.team === 2), p))])) as Record<PlayerPosition, number>
  const positionStrengthDifference = PLAYER_POSITIONS.reduce((sum, p) => sum + positionDiffs[p], 0)
  const target = getFeasibleLineupTarget(players, getActivePlayersPerTeamLimit(players.length))
  const targetLineupPenalty = calculateTargetLineupPenalty(assignments, target)
  const activePlayerDifference = Math.abs(team1.activeCount - team2.activeCount)
  const substituteAdvantagePenalty = Math.max(0, Math.abs(team1.substituteCount - team2.substituteCount) - (players.length % 2))
  const rotationSpreadPenalty = rotationSpread(rotationGroups)
  const rotationMatchPenalty = PLAYER_POSITIONS.reduce((sum, p) => {
    const a = rotationGroups.filter((g) => g.team === 1 && g.position === p).reduce((s, g) => s + g.effectiveRating * g.activeSlotCount, 0)
    const b = rotationGroups.filter((g) => g.team === 2 && g.position === p).reduce((s, g) => s + g.effectiveRating * g.activeSlotCount, 0)
    return sum + Math.abs(a - b)
  }, 0)
  const positionCrowdingPenalty = PLAYER_POSITIONS.reduce((sum, p) => {
    const team1PositionCount = assignments.filter((a) => a.team === 1 && a.position === p).length
    const team2PositionCount = assignments.filter((a) => a.team === 2 && a.position === p).length
    const preferredMax = target[p] + 1
    const excess = Math.max(0, team1PositionCount - preferredMax) + Math.max(0, team2PositionCount - preferredMax)
    return sum + Math.abs(team1PositionCount - team2PositionCount) + excess * excess * 4
  }, 0)
  const preferencePenalty = assignments.reduce((sum, a) => sum + getPositionPenalty(bySignup.get(a.signupId)!, a.position), 0)
  const confidencePenalty = Math.abs(team1.confidence - team2.confidence)
  const unratedPlayerPenalty = Math.abs(assignments.filter((a) => a.team === 1 && getRatingStatus(bySignup.get(a.signupId)!.gamesPlayed[a.position]) !== "established").length - assignments.filter((a) => a.team === 2 && getRatingStatus(bySignup.get(a.signupId)!.gamesPlayed[a.position]) !== "established").length)
  const total = hardViolations * 1_000_000_000
    + effectiveStrengthDifference * OBJECTIVE_WEIGHTS.activeTeamRatingDifference
    + startingLineupDifference * 8
    + positionStrengthDifference * OBJECTIVE_WEIGHTS.defenderRatingDifference
    + targetLineupPenalty * 10_000
    + activePlayerDifference * OBJECTIVE_WEIGHTS.activePlayerCountDifference
    + substituteAdvantagePenalty * OBJECTIVE_WEIGHTS.substituteAdvantagePenalty
    + rotationSpreadPenalty * OBJECTIVE_WEIGHTS.rotationSpread
    + rotationMatchPenalty * OBJECTIVE_WEIGHTS.rotationGroupMatchDifference
    + positionCrowdingPenalty * OBJECTIVE_WEIGHTS.positionCrowdingPenalty
    + preferencePenalty * OBJECTIVE_WEIGHTS.positionPreference
    + confidencePenalty * OBJECTIVE_WEIGHTS.confidenceDifference
    + unratedPlayerPenalty * OBJECTIVE_WEIGHTS.unratedPlayerDifference
  const safeTotal = Number.isFinite(total) ? total : 1_000_000_000_000
  const fitness = { effectiveStrengthDifference, startingLineupDifference, positionStrengthDifference, targetLineupPenalty, activePlayerDifference, substituteAdvantagePenalty, rotationSpreadPenalty, rotationMatchPenalty, positionCrowdingPenalty, preferencePenalty, confidencePenalty, unratedPlayerPenalty, hardViolations, total: safeTotal }
  return { assignments, rotationGroups, team1, team2, warnings, computationTimeMs: 0, candidatesEvaluated: 1, optimality: "best-found", quality: "medium", fitness, candidate, hash }
}

export function scoreAssignments(players: MatchmakingPlayer[], assignments: MatchmakingAssignment[]): number {
  const candidate = assignments.map((a) => ({ signupId: a.signupId, team: a.team, position: a.position }))
  return evaluateCandidate(players, candidate)?.fitness.total ?? 1_000_000_000_000
}
