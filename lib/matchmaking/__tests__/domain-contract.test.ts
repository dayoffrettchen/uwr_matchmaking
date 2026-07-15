import { describe, expect, it } from "vitest"
import { PLAYER_POSITIONS } from "@/lib/ratings/types"
import { balanceMatchmakingPlayers, buildRotationSteps } from "../balance-teams"
import { getFeasibleLineupTarget, getNominalLineupTarget, getTargetLineup, isLineupTargetDistinctlyMatchable, targetTotal } from "../target-lineup"
import { calculateTargetLineupPenalty, evaluateCandidate } from "../fitness"
import {
  player,
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


describe("matchmaking domain contract: target feasibility", () => {
  for (const value of [0, 1, 3, 5]) it(`caps nominal target total for ${value} active players per team`, () => {
    expect(targetTotal(getNominalLineupTarget(value))).toBeLessThanOrEqual(value)
  })

  it("returns full nominal target at six and still caps larger values", () => {
    expect(getNominalLineupTarget(6)).toEqual({ goalkeeper: 2, defender: 2, forward: 2 })
    expect(targetTotal(getNominalLineupTarget(30))).toBe(6)
  })

  it("uses distinct-player matching for full, odd, missing, single-position, and overlapping rosters", () => {
    expect(getFeasibleLineupTarget(rosters.twelveFeasible(), 6)).toEqual({ goalkeeper: 2, defender: 2, forward: 2 })
    expect(targetTotal(getFeasibleLineupTarget(rosters.allFlexible11(), 5))).toBeLessThanOrEqual(5)
    for (const fixture of [rosters.missingGoalkeeper(), rosters.missingDefender(), rosters.missingForward(), rosters.singlePosition(), rosters.odd()]) {
      const target = getFeasibleLineupTarget(fixture, Math.min(6, Math.floor(fixture.length / 2)))
      expect(isLineupTargetDistinctlyMatchable(fixture, target)).toBe(true)
    }
    const overlap = rosters.overlapGoalkeeperDefender()
    const target = getFeasibleLineupTarget(overlap, 6)
    expect(targetTotal(target)).toBeLessThanOrEqual(6)
    expect(isLineupTargetDistinctlyMatchable(overlap, { goalkeeper: 2, defender: 2, forward: 2 })).toBe(false)
    expect(isLineupTargetDistinctlyMatchable(overlap, target)).toBe(true)
    expect(getFeasibleLineupTarget(overlap, 6)).toEqual(target)
  })
})

describe("matchmaking domain contract: target penalty", () => {
  function assignment(id: number, team: 1 | 2, position: (typeof PLAYER_POSITIONS)[number], startsInWater = true) {
    return { signupId: id, playerId: id, team, position, rotationGroupId: id, rotationGroupType: "single" as const, rotationOrder: 1, startsInWater, lineupType: startsInWater ? "active" as const : "substitute" as const }
  }

  it("penalizes missing partially feasible targets and accepts satisfied zero/one/two targets", () => {
    expect(calculateTargetLineupPenalty([], { goalkeeper: 1, defender: 0, forward: 0 })).toBeGreaterThan(0)
    expect(calculateTargetLineupPenalty([assignment(1, 1, "goalkeeper"), assignment(2, 2, "goalkeeper")], { goalkeeper: 1, defender: 0, forward: 0 })).toBe(0)
    expect(calculateTargetLineupPenalty([assignment(1, 1, "defender"), assignment(2, 2, "defender")], { goalkeeper: 0, defender: 2, forward: 0 })).toBeGreaterThan(0)
    expect(calculateTargetLineupPenalty([], { goalkeeper: 0, defender: 0, forward: 0 })).toBe(0)
    expect(calculateTargetLineupPenalty([1,2].flatMap((team) => PLAYER_POSITIONS.flatMap((position) => [assignment(team * 10 + position.length, team as 1 | 2, position), assignment(team * 20 + position.length, team as 1 | 2, position)])), { goalkeeper: 2, defender: 2, forward: 2 })).toBe(0)
  })
})

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

  // TODO: team persistence and TeamsPanel rendering consume the final slot model.
  it("the optimizer returns the same final one-starter slot model that fitness evaluates", () => {
    const players = rosters.fourteenFeasible()
    const result = balanceMatchmakingPlayers(players, TEST_OPTIONS)
    const evaluated = evaluateCandidate(players, result.assignments.map((assignment) => ({ signupId: assignment.signupId, team: assignment.team, position: assignment.position })))!

    expect(evaluated.fitness.hardViolations).toBe(0)
    expect(evaluated.rotationGroups.every((group) => group.activeSlotCount === 1)).toBe(true)
    expectExactlyOneStarterPerPopulatedSlot(result)
  })

  it("does not duplicate warning strings for infeasible rosters", () => {
    const result = balanceMatchmakingPlayers(rosters.missingGoalkeeper(), TEST_OPTIONS)
    expect(new Set(result.warnings).size).toBe(result.warnings.length)
  })

  it("lib/matchmaking/genetic produces deterministic semantic results for equal-rating and randomized rosters with the same normalized input and seed", () => {
    expectDeterministicSemanticResult(balanceMatchmakingPlayers(rosters.equalRating(), TEST_OPTIONS), balanceMatchmakingPlayers([...rosters.equalRating()].reverse(), TEST_OPTIONS))
    const seeded = seededRoster(30, 909)
    expectDeterministicSemanticResult(balanceMatchmakingPlayers(seeded, { ...TEST_OPTIONS, seed: 909, maxCandidates: 240 }), balanceMatchmakingPlayers([...seeded].reverse(), { ...TEST_OPTIONS, seed: 909, maxCandidates: 240 }))
  })
})


describe("matchmaking domain contract: final group semantics", () => {
  it("materializes one-, two-, and three-member final slots with per-substitute effective rating", () => {
    const players = [
      ...Array.from({ length: 5 }, (_, index) => player({ id: index + 1, eligible: ["goalkeeper"], rating: 1000 })),
      player({ id: 100, eligible: ["forward"], rating: 1000 }),
    ]
    const assignments = [
      ...players.slice(0, 5).map((p) => ({ signupId: p.signupId, playerId: p.playerId, team: 1 as const, position: "goalkeeper" as const, rotationGroupId: 0, rotationGroupType: "single" as const, rotationOrder: 0, startsInWater: false, lineupType: "substitute" as const })),
      { signupId: 100, playerId: 100, team: 2 as const, position: "forward" as const, rotationGroupId: 0, rotationGroupType: "single" as const, rotationOrder: 0, startsInWater: false, lineupType: "substitute" as const },
    ]
    const { finalizeUnderwaterRugbyLineup } = require("../balance-teams") as typeof import("../balance-teams")
    const result = finalizeUnderwaterRugbyLineup(players, assignments, [])
    for (const size of [1, 2, 3]) {
      const group = result.rotationGroups.find((candidate) => candidate.members.length === size)!
      expect(group.type).toBe(size === 1 ? "single" : size === 2 ? "pair" : "position")
      expect(group.members.filter((member) => member.startsInWater)).toHaveLength(1)
      expect(group.activeSlotCount).toBe(1)
      expect(group.effectiveRating).toBe(group.averageMemberRating + (size - 1) * 30)
      expectValidClosedRotationCycle(group)
    }
  })
})
