import { describe, expect, it } from "vitest"
import { PLAYER_POSITIONS, type PlayerPosition } from "@/lib/ratings/types"
import { balanceMatchmakingPlayers } from "../balance-teams"
import { candidateHash, type Candidate } from "../candidate"
import { evaluateCandidate } from "../fitness"
import { countSamePositionSwapPairs, runMandatorySamePositionLocalSearch } from "../genetic"
import type { MatchmakingPlayer } from "../types"

function player(id: number, position: PlayerPosition, rating: number): MatchmakingPlayer {
  return { signupId: id, playerId: id, name: `P${id}`, eligiblePositions: [position], positionPreferences: [{ position, order: 1 }], ratings: Object.fromEntries(PLAYER_POSITIONS.map((candidate) => [candidate, candidate === position ? rating : 1000])) as Record<PlayerPosition, number>, gamesPlayed: Object.fromEntries(PLAYER_POSITIONS.map((candidate) => [candidate, 20])) as Record<PlayerPosition, number>, confidence: Object.fromEntries(PLAYER_POSITIONS.map((candidate) => [candidate, 1])) as Record<PlayerPosition, number> }
}

function fixture() {
  const players = [player(1, "goalkeeper", 1200), player(2, "goalkeeper", 1000), player(3, "goalkeeper", 1180), player(4, "goalkeeper", 1020), player(5, "defender", 1300), player(6, "defender", 900), player(7, "defender", 1000), player(8, "defender", 1200), player(9, "forward", 1250), player(10, "forward", 950), player(11, "forward", 1050), player(12, "forward", 1150)]
  const candidate: Candidate = players.map((entry, index) => ({ signupId: entry.signupId, team: index % 2 === 0 ? 1 : 2, position: entry.eligiblePositions[0] }))
  return { players, candidate }
}

describe("optimizer consolidation", () => {
  it("reports a skipped zero-budget mandatory search honestly", () => {
    const { players } = fixture()
    const result = balanceMatchmakingPlayers(players, { seed: 1, maxCandidates: 0, maxGenerations: 0, maxComputationTimeMs: 0, populationSize: 0 })
    const diagnostics = result.diagnostics!
    expect(result.candidatesEvaluated).toBe(1)
    expect(diagnostics.totalCandidates).toBe(1)
    expect(diagnostics.geneticCandidates).toBe(1)
    expect(diagnostics.mandatorySamePositionCandidates).toBe(0)
    expect(diagnostics.mandatorySamePositionRequiredCandidates).toBeGreaterThan(0)
    expect(diagnostics.mandatorySamePositionAttempted).toBe(false)
    expect(diagnostics.mandatorySamePositionCompleted).toBe(false)
    expect(diagnostics.optionalLocalCandidates).toBe(0)
    expect(diagnostics.optionalLocalAttempted).toBe(false)
    expect(diagnostics.optionalLocalCompleted).toBe(false)
  })

  it("counts completed mandatory sweeps cumulatively", () => {
    const players = [player(1, "defender", 1300), player(2, "defender", 1200), player(3, "defender", 1000), player(4, "defender", 900)]
    const candidate: Candidate = [{ signupId: 1, team: 1, position: "defender" }, { signupId: 2, team: 1, position: "defender" }, { signupId: 3, team: 2, position: "defender" }, { signupId: 4, team: 2, position: "defender" }]
    const start = evaluateCandidate(players, candidate, "start")!
    const result = runMandatorySamePositionLocalSearch(players, start)
    expect(result.completed).toBe(true)
    expect(result.attempted).toBe(true)
    expect(result.firstSweepRequiredCandidates).toBe(countSamePositionSwapPairs(candidate))
    expect(result.candidatesEvaluated).toBe(result.requiredCandidates)
    expect(result.sweepsStarted).toBe(result.sweepsCompleted)
    expect(result.sweepsStarted).toBeGreaterThan(1)
  })

  it("evaluates exact same-position neighbors without changing unrelated genes", () => {
    const { players, candidate } = fixture()
    const start = evaluateCandidate(players, candidate, "start")!
    const observed: Candidate[] = []
    runMandatorySamePositionLocalSearch(players, start, 1, (raw) => { observed.push(raw.map((gene) => ({ ...gene }))); return evaluateCandidate(players, raw, candidateHash(raw)) })
    expect(observed.length).toBeGreaterThan(0)
    for (const neighbor of observed) {
      const changed = neighbor.filter((gene, index) => gene.team !== candidate[index].team || gene.position !== candidate[index].position)
      expect(changed).toHaveLength(2)
      expect(changed.every((gene) => gene.position === candidate.find((base) => base.signupId === gene.signupId)!.position)).toBe(true)
      expect(neighbor.map((gene) => gene.signupId)).toEqual(candidate.map((gene) => gene.signupId))
    }
  })
})

describe("search budget guarantees", () => {
  function flexible(id: number): MatchmakingPlayer {
    return { signupId: id, playerId: id, name: `F${id}`, eligiblePositions: [...PLAYER_POSITIONS], positionPreferences: PLAYER_POSITIONS.map((position, index) => ({ position, order: index + 1 })), ratings: Object.fromEntries(PLAYER_POSITIONS.map((position, index) => [position, 900 + ((id * 37 + index * 53) % 350)])) as Record<PlayerPosition, number>, gamesPlayed: Object.fromEntries(PLAYER_POSITIONS.map((position) => [position, 20])) as Record<PlayerPosition, number>, confidence: Object.fromEntries(PLAYER_POSITIONS.map((position) => [position, 1])) as Record<PlayerPosition, number> }
  }

  it("reserves enough capacity for a 30-player mandatory first sweep", () => {
    const players = Array.from({ length: 30 }, (_, index) => flexible(index + 1))
    const result = balanceMatchmakingPlayers(players, { seed: 100, maxCandidates: 500, maxGenerations: 20, maxComputationTimeMs: 0, populationSize: 24 })
    const diagnostics = result.diagnostics!
    expect(diagnostics.totalCandidates).toBeLessThanOrEqual(500)
    expect(diagnostics.totalCandidates).toBe(result.candidatesEvaluated)
    expect(diagnostics.geneticCandidates).toBeGreaterThan(1)
    expect(diagnostics.mandatorySamePositionFirstSweepRequiredCandidates).toBeLessThanOrEqual(225)
    expect(diagnostics.mandatorySamePositionReservedCandidates).toBeGreaterThanOrEqual(diagnostics.mandatorySamePositionFirstSweepRequiredCandidates)
    expect(diagnostics.mandatorySamePositionSweepsCompleted).toBeGreaterThanOrEqual(1)
    expect(diagnostics.geneticCandidates + diagnostics.mandatorySamePositionCandidates + diagnostics.optionalLocalCandidates).toBe(diagnostics.totalCandidates)
  })

  it("preserves minimum genetic budget and reports partial mandatory search with tiny limits", () => {
    const players = Array.from({ length: 30 }, (_, index) => flexible(index + 1))
    const result = balanceMatchmakingPlayers(players, { seed: 101, maxCandidates: 20, maxGenerations: 20, maxComputationTimeMs: 0, populationSize: 24 })
    const diagnostics = result.diagnostics!
    expect(diagnostics.totalCandidates).toBeLessThanOrEqual(20)
    expect(diagnostics.geneticCandidateBudget).toBeGreaterThanOrEqual(2)
    expect(diagnostics.geneticCandidates).toBeGreaterThanOrEqual(2)
    expect(diagnostics.mandatorySamePositionCompleted).toBe(false)
    expect(diagnostics.mandatorySamePositionCandidates).toBeLessThan(diagnostics.mandatorySamePositionRequiredCandidates)
  })

  it("uses injected deadlines so mandatory search can run after the genetic cutoff", () => {
    let tick = 0
    const players = Array.from({ length: 12 }, (_, index) => flexible(index + 1))
    const result = balanceMatchmakingPlayers(players, { seed: 3, maxCandidates: 200, maxGenerations: 100, maxComputationTimeMs: 100, populationSize: 30, now: () => tick++ })
    const diagnostics = result.diagnostics!
    expect(result.computationTimeMs).toBeGreaterThanOrEqual(100)
    expect(diagnostics.geneticCandidates).toBeLessThan(diagnostics.geneticCandidateBudget)
    expect(diagnostics.mandatorySamePositionCandidates + diagnostics.optionalLocalCandidates).toBeGreaterThan(0)
    expect(diagnostics.totalCandidates).toBeLessThanOrEqual(200)
  })
})
