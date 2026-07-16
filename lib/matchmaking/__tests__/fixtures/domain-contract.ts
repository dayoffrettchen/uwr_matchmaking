import { expect } from "vitest"
import { PLAYER_POSITIONS, type PlayerPosition } from "@/lib/ratings/types"
import type { MatchmakingAssignment, MatchmakingPlayer, MatchmakingResult, RotationGroup } from "../../types"

export const TEST_OPTIONS = { seed: 222, maxCandidates: 700, maxGenerations: 18, maxComputationTimeMs: 0, populationSize: 24 }

type PlayerSpec = { id: number; eligible?: PlayerPosition[]; preferences?: PlayerPosition[]; rating?: number }

export function player({ id, eligible = [...PLAYER_POSITIONS], preferences = eligible, rating = 1000 }: PlayerSpec): MatchmakingPlayer {
  return {
    signupId: id,
    playerId: id,
    name: `P${id}`,
    eligiblePositions: eligible,
    positionPreferences: preferences.map((position, index) => ({ position, order: index + 1 })),
    ratings: Object.fromEntries(PLAYER_POSITIONS.map((position) => [position, rating + id])) as Record<PlayerPosition, number>,
    gamesPlayed: Object.fromEntries(PLAYER_POSITIONS.map((position) => [position, 20])) as Record<PlayerPosition, number>,
    confidence: Object.fromEntries(PLAYER_POSITIONS.map((position) => [position, 1])) as Record<PlayerPosition, number>,
  }
}

export const rosters = {
  six: () => Array.from({ length: 6 }, (_, index) => player({ id: index + 1 })),
  twelveFeasible: () => Array.from({ length: 12 }, (_, index) => player({ id: index + 1 })),
  fourteenFeasible: () => Array.from({ length: 14 }, (_, index) => player({ id: index + 1 })),
  thirty: () => Array.from({ length: 30 }, (_, index) => player({ id: index + 1 })),
  restricted: () => PLAYER_POSITIONS.flatMap((position, positionIndex) => Array.from({ length: 4 }, (_, index) => player({ id: positionIndex * 4 + index + 1, eligible: [position] }))),
  flexible: () => Array.from({ length: 12 }, (_, index) => player({ id: index + 1, preferences: rotatePositions(index) })),
  missingGoalkeeper: () => Array.from({ length: 12 }, (_, index) => player({ id: index + 1, eligible: index % 2 === 0 ? ["defender"] : ["forward"] })),
  missingDefender: () => Array.from({ length: 12 }, (_, index) => player({ id: index + 1, eligible: index % 2 === 0 ? ["goalkeeper"] : ["forward"] })),
  missingForward: () => Array.from({ length: 12 }, (_, index) => player({ id: index + 1, eligible: index % 2 === 0 ? ["goalkeeper"] : ["defender"] })),
  odd: () => Array.from({ length: 13 }, (_, index) => player({ id: index + 1 })),
  equalRating: () => Array.from({ length: 12 }, (_, index) => player({ id: index + 1, rating: 1000 })),
  allFlexible11: () => Array.from({ length: 11 }, (_, index) => player({ id: index + 1 })),
  overlapGoalkeeperDefender: () => [
    ...Array.from({ length: 4 }, (_, index) => player({ id: index + 1, eligible: ["goalkeeper", "defender"] })),
    ...Array.from({ length: 8 }, (_, index) => player({ id: index + 5, eligible: ["forward"] })),
  ],
  singlePosition: () => Array.from({ length: 12 }, (_, index) => player({ id: index + 1, eligible: ["goalkeeper"] })),
}

function rotatePositions(offset: number): PlayerPosition[] {
  return PLAYER_POSITIONS.map((_, index) => PLAYER_POSITIONS[(index + offset) % PLAYER_POSITIONS.length])
}

export function seededRoster(size: number, seed: number): MatchmakingPlayer[] {
  return Array.from({ length: size }, (_, index) => {
    const id = index + 1
    const mask = ((seed + id * 17) % 7) + 1
    const eligible = PLAYER_POSITIONS.filter((_, bit) => (mask & (1 << bit)) !== 0)
    const prefs = [...eligible].sort((a, b) => ((seed + id + a.length) % 9) - ((seed + id + b.length) % 9) || a.localeCompare(b))
    return player({ id, eligible, preferences: prefs, rating: 900 + ((seed * 31 + id * 53) % 300) })
  })
}

export function semanticAssignments(result: MatchmakingResult) {
  return result.assignments.map((assignment) => ({ signupId: assignment.signupId, team: assignment.team, position: assignment.position, slot: stableSlot(result.rotationGroups, assignment), rotationOrder: assignment.rotationOrder, startsInWater: assignment.startsInWater })).sort((a, b) => a.signupId - b.signupId)
}

function stableSlot(groups: RotationGroup[], assignment: MatchmakingAssignment): number {
  const peers = groups.filter((group) => group.team === assignment.team && group.position === assignment.position).sort((a, b) => Math.min(...a.members.map((m) => m.signupId)) - Math.min(...b.members.map((m) => m.signupId)))
  return peers.findIndex((group) => group.members.some((member) => member.signupId === assignment.signupId)) + 1
}

export function expectEverySignupAssignedExactlyOnce(players: MatchmakingPlayer[], result: MatchmakingResult) {
  const expected = [...players].map((player) => player.signupId).sort((a, b) => a - b)
  const actual = result.assignments.map((assignment) => assignment.signupId).sort((a, b) => a - b)
  expect(actual).toEqual(expected)
}

export function expectOnlyEligiblePositions(players: MatchmakingPlayer[], result: MatchmakingResult) {
  const byId = new Map(players.map((player) => [player.signupId, player]))
  for (const assignment of result.assignments) expect(byId.get(assignment.signupId)!.eligiblePositions).toContain(assignment.position)
}

export function expectBalancedTeamSizes(result: MatchmakingResult) {
  const sizes = [1, 2].map((team) => result.assignments.filter((assignment) => assignment.team === team).length)
  expect(Math.abs(sizes[0] - sizes[1])).toBeLessThanOrEqual(1)
}

export function expectAtMostSixStartersPerTeam(result: MatchmakingResult) {
  for (const team of [1, 2]) expect(result.assignments.filter((assignment) => assignment.team === team && assignment.startsInWater).length).toBeLessThanOrEqual(6)
}

export function expectCompleteTwoTwoTwoWhenFeasible(result: MatchmakingResult) {
  for (const team of [1, 2]) for (const position of PLAYER_POSITIONS) expect(result.assignments.filter((assignment) => assignment.team === team && assignment.position === position && assignment.startsInWater).length).toBe(2)
}

export function expectTwoIndependentSlotsPerPosition(result: MatchmakingResult) {
  for (const team of [1, 2]) for (const position of PLAYER_POSITIONS) {
    const groups = result.rotationGroups.filter((group) => group.team === team && group.position === position)
    expect(groups.length).toBe(2)
    for (const group of groups) expect(group.members.filter((member) => member.startsInWater)).toHaveLength(1)
  }
}

export function expectExactlyOneStarterPerPopulatedSlot(result: MatchmakingResult) {
  for (const group of result.rotationGroups) expect(group.members.filter((member) => member.startsInWater)).toHaveLength(1)
}

export function expectValidClosedRotationCycle(group: RotationGroup) {
  const steps = group.rotationSteps ?? []
  if (group.members.length === 1) {
    expect(steps).toHaveLength(0)
    return
  }
  expect(steps.map((step) => step.outgoingSignupId).sort((a, b) => a - b)).toEqual(group.members.map((member) => member.signupId).sort((a, b) => a - b))
  expect(steps.map((step) => step.incomingSignupId).sort((a, b) => a - b)).toEqual(group.members.map((member) => member.signupId).sort((a, b) => a - b))
  for (const step of steps) expect(step.outgoingSignupId === step.incomingSignupId).toBe(false)
}

export function expectDeterministicSemanticResult(a: MatchmakingResult, b: MatchmakingResult) {
  expect(semanticAssignments(a)).toEqual(semanticAssignments(b))
}

export function expectNoImprovingSamePositionSwap(players: MatchmakingPlayer[], result: MatchmakingResult) {
  // Lazy require avoids adding runtime dependencies to production helpers.
  const { evaluateCandidate, compareFitnessQuality } = require("../../fitness") as typeof import("../../fitness")
  const base = evaluateCandidate(players, result.assignments.map((assignment) => ({ signupId: assignment.signupId, team: assignment.team, position: assignment.position })))!
  for (let i = 0; i < base.candidate.length; i++) for (let j = i + 1; j < base.candidate.length; j++) {
    if (base.candidate[i].team === base.candidate[j].team || base.candidate[i].position !== base.candidate[j].position) continue
    const swapped = base.candidate.map((gene) => ({ ...gene }))
    ;[swapped[i].team, swapped[j].team] = [swapped[j].team, swapped[i].team]
    const evaluated = evaluateCandidate(players, swapped)
    if (evaluated) expect(compareFitnessQuality(evaluated.fitness, base.fitness)).toBeGreaterThanOrEqual(0)
  }
}
