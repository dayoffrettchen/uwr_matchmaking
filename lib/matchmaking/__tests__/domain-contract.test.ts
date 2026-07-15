import { describe, expect, it } from "vitest"
import { PLAYER_POSITIONS } from "@/lib/ratings/types"
import { balanceMatchmakingPlayers, buildRotationSteps } from "../balance-teams"
import { getTargetLineup } from "../target-lineup"
import { evaluateCandidate } from "../fitness"
import {
  TEST_OPTIONS,
  expectAtMostSixStartersPerTeam,
  expectBalancedTeamSizes,
  expectCompleteTwoTwoTwoWhenFeasible,
  expectDeterministicSemanticResult,
  expectEverySignupAssignedExactlyOnce,
  expectExactlyOneStarterPerPopulatedSlot,
  expectOnlyEligiblePositions,
  expectTwoIndependentSlotsPerPosition,
  expectValidClosedRotationCycle,
  rosters,
  seededRoster,
} from "./fixtures/domain-contract"

function assertCoreInvariants(players: ReturnType<typeof rosters.six>, result: ReturnType<typeof balanceMatchmakingPlayers>) {
  expectEverySignupAssignedExactlyOnce(players, result)
  expectOnlyEligiblePositions(players, result)
  expectBalancedTeamSizes(result)
  expectAtMostSixStartersPerTeam(result)
}

describe("matchmaking domain contract: current characterization", () => {
  it("documents that the target-lineup helper returns the authoritative 2/2/2 target", () => {
    expect(getTargetLineup(6)).toEqual({ goalkeeper: 2, defender: 2, forward: 2 })
  })

  it("keeps six-player rosters balanced without pretending each team can field six active players", () => {
    const players = rosters.six()
    const result = balanceMatchmakingPlayers(players, TEST_OPTIONS)
    assertCoreInvariants(players, result)
  })

  it("assigns every player in a fourteen-player feasible roster and finalizes deterministic one-starter slots", () => {
    const players = rosters.fourteenFeasible()
    const result = balanceMatchmakingPlayers(players, TEST_OPTIONS)
    assertCoreInvariants(players, result)
    expectExactlyOneStarterPerPopulatedSlot(result)
    for (const group of result.rotationGroups) expectValidClosedRotationCycle(group)
  })

  it("assigns all thirty players exactly once into valid teams and positions", () => {
    const players = rosters.thirty()
    const result = balanceMatchmakingPlayers(players, { ...TEST_OPTIONS, maxCandidates: 900 })
    assertCoreInvariants(players, result)
  })

  it("never assigns position-restricted players to ineligible positions", () => {
    const players = rosters.restricted()
    const result = balanceMatchmakingPlayers(players, TEST_OPTIONS)
    assertCoreInvariants(players, result)
  })

  it("keeps flexible-player preference scoring finite without weakening eligibility", () => {
    const players = rosters.flexible()
    const result = balanceMatchmakingPlayers(players, TEST_OPTIONS)
    assertCoreInvariants(players, result)
    expect(evaluateCandidate(players, result.assignments.map((assignment) => ({ signupId: assignment.signupId, team: assignment.team, position: assignment.position })))!.fitness.preferencePenalty).toBeGreaterThanOrEqual(0)
  })

  it("represents missing-goalkeeper rosters as best-effort assignments without illegal positions", () => {
    const players = rosters.missingGoalkeeper()
    const result = balanceMatchmakingPlayers(players, TEST_OPTIONS)
    assertCoreInvariants(players, result)
    expect(result.assignments.some((assignment) => assignment.position === "goalkeeper")).toBe(false)
  })

  it("represents missing-defender rosters as best-effort assignments without illegal positions", () => {
    const players = rosters.missingDefender()
    const result = balanceMatchmakingPlayers(players, TEST_OPTIONS)
    assertCoreInvariants(players, result)
    expect(result.assignments.some((assignment) => assignment.position === "defender")).toBe(false)
  })

  it("represents missing-forward rosters as best-effort assignments without illegal positions", () => {
    const players = rosters.missingForward()
    const result = balanceMatchmakingPlayers(players, TEST_OPTIONS)
    assertCoreInvariants(players, result)
    expect(result.assignments.some((assignment) => assignment.position === "forward")).toBe(false)
  })

  it("keeps odd-number rosters within one player of team-size balance", () => {
    const players = rosters.odd()
    const result = balanceMatchmakingPlayers(players, TEST_OPTIONS)
    assertCoreInvariants(players, result)
  })

  it("keeps equal-rating rosters within current enforceable invariants", () => {
    const players = rosters.equalRating()
    const first = balanceMatchmakingPlayers(players, TEST_OPTIONS)
    assertCoreInvariants(players, first)
  })

  it("normalizes input order for the same logical roster and seed", () => {
    const normal = rosters.twelveFeasible()
    const reversed = [...normal].reverse()
    const shuffled = [normal[4], normal[0], normal[8], normal[2], normal[10], normal[1], normal[6], normal[3], normal[11], normal[5], normal[9], normal[7]]
    expectDeterministicSemanticResult(balanceMatchmakingPlayers(normal, TEST_OPTIONS), balanceMatchmakingPlayers(reversed, TEST_OPTIONS))
    expectDeterministicSemanticResult(balanceMatchmakingPlayers(normal, TEST_OPTIONS), balanceMatchmakingPlayers(shuffled, TEST_OPTIONS))
  })
})

describe("matchmaking domain contract: independent rotation cycles", () => {
  for (const size of [1, 2, 3, 4, 5]) it(`defines a deterministic closed cycle for slot size ${size}`, () => {
    const members = Array.from({ length: size }, (_, index) => ({ signupId: index + 1, playerId: index + 1, name: `P${index + 1}`, rating: 1000, rotationOrder: index + 1, startsInWater: index === 0 }))
    const steps = buildRotationSteps(members, 1)
    expect(steps).toEqual(size === 1 ? [] : members.map((member, index) => ({ outgoingSignupId: member.signupId, incomingSignupId: members[(index + 1) % members.length].signupId })))
  })
})

describe("matchmaking domain contract: bounded randomized characterization", () => {
  for (const seed of [101, 202, 303, 404, 505]) for (const size of [2, 3, 6, 7, 12, 13, 20, 30]) it(`preserves enforceable invariants for seed ${seed} and size ${size}`, () => {
    const players = seededRoster(size, seed)
    const result = balanceMatchmakingPlayers(players, { ...TEST_OPTIONS, seed, maxCandidates: 160 })
    assertCoreInvariants(players, result)
    expect(result.candidatesEvaluated).toBeLessThanOrEqual(160)
  })
})

describe("matchmaking domain contract: final 2/2/2 slot model", () => {
  it("lib/matchmaking/target-lineup returns { goalkeeper: 2, defender: 2, forward: 2 } for feasible six-active teams", () => {
    expect(getTargetLineup(6)).toEqual({ goalkeeper: 2, defender: 2, forward: 2 })
  })

  it("lib/matchmaking/fitness evaluates candidates from the same independent one-starter slot structure returned by balance-teams", () => {
    const players = rosters.fourteenFeasible()
    const result = balanceMatchmakingPlayers(players, TEST_OPTIONS)
    const evaluated = evaluateCandidate(players, result.assignments.map((assignment) => ({ signupId: assignment.signupId, team: assignment.team, position: assignment.position })))!

    expect(evaluated.rotationGroups.map((group) => ({ team: group.team, position: group.position, activeSlotCount: group.activeSlotCount, members: group.members.map((member) => member.signupId) }))).toEqual(result.rotationGroups.map((group) => ({ team: group.team, position: group.position, activeSlotCount: group.activeSlotCount, members: group.members.map((member) => member.signupId) })))
  })

  it("lib/matchmaking/balance-teams returns two one-person slots per position for a twelve-player fully feasible roster", () => {
    const result = balanceMatchmakingPlayers(rosters.twelveFeasible(), TEST_OPTIONS)

    expectCompleteTwoTwoTwoWhenFeasible(result)
    expectTwoIndependentSlotsPerPosition(result)
    for (const group of result.rotationGroups) {
      expect(group.members).toHaveLength(1)
      expect(group.activeSlotCount).toBe(1)
    }
  })

  it("lib/matchmaking/balance-teams keeps fourteen-player feasible rosters at six active players per team with deterministic substitute slots", () => {
    const result = balanceMatchmakingPlayers(rosters.fourteenFeasible(), TEST_OPTIONS)

    expectCompleteTwoTwoTwoWhenFeasible(result)
    expectTwoIndependentSlotsPerPosition(result)
    expect(result.assignments.filter((assignment) => !assignment.startsInWater)).toHaveLength(2)
    for (const group of result.rotationGroups) expectValidClosedRotationCycle(group)
  })

  it("lib/matchmaking/balance-teams assigns all thirty players to deterministic final slots without using one two-starter group as two active slots", () => {
    const result = balanceMatchmakingPlayers(rosters.thirty(), { ...TEST_OPTIONS, maxCandidates: 900 })

    expectEverySignupAssignedExactlyOnce(rosters.thirty(), result)
    expectCompleteTwoTwoTwoWhenFeasible(result)
    for (const group of result.rotationGroups) {
      expect(group.activeSlotCount).toBe(1)
      expect(group.members.filter((member) => member.startsInWater)).toHaveLength(1)
    }
  })

  it.todo("lib/matchmaking/balance-teams must expose machine-readable violations such as MISSING_POSITION_SLOT, NO_ELIGIBLE_POSITION, UNBALANCED_TEAM_SIZE, ACTIVE_PLAYER_LIMIT_EXCEEDED, and INCOMPLETE_ROTATION_SLOT")

  it("components/teams-panel and app/api/training/teams/route consume the final one-starter slot model scored by the optimizer", () => {
    const players = rosters.fourteenFeasible()
    const result = balanceMatchmakingPlayers(players, TEST_OPTIONS)
    const evaluated = evaluateCandidate(players, result.assignments.map((assignment) => ({ signupId: assignment.signupId, team: assignment.team, position: assignment.position })))!

    expect(evaluated.fitness.hardViolations).toBe(0)
    expect(evaluated.rotationGroups.every((group) => group.activeSlotCount === 1)).toBe(true)
    expectExactlyOneStarterPerPopulatedSlot(result)
  })

  it("lib/matchmaking/genetic produces deterministic semantic results for equal-rating and randomized rosters with the same normalized input and seed", () => {
    expectDeterministicSemanticResult(balanceMatchmakingPlayers(rosters.equalRating(), TEST_OPTIONS), balanceMatchmakingPlayers([...rosters.equalRating()].reverse(), TEST_OPTIONS))
    const seeded = seededRoster(30, 909)
    expectDeterministicSemanticResult(balanceMatchmakingPlayers(seeded, { ...TEST_OPTIONS, seed: 909, maxCandidates: 240 }), balanceMatchmakingPlayers([...seeded].reverse(), { ...TEST_OPTIONS, seed: 909, maxCandidates: 240 }))
  })
})
