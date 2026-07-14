import { describe, expect, it } from "vitest"
import { PLAYER_POSITIONS, type PlayerPosition } from "@/lib/ratings/types"
import { balanceMatchmakingPlayers } from "../balance-teams"
import { fromDraftAssignments } from "../candidate"
import { OBJECTIVE_WEIGHTS } from "../constants"
import { evaluateCandidate, getPositionPenalty } from "../fitness"
import { buildGreedySeed } from "../greedy"
import type { MatchmakingPlayer } from "../types"

function player(id: number, name: string, ratings: Partial<Record<PlayerPosition, number>>, eligiblePositions: PlayerPosition[] = [...PLAYER_POSITIONS], prefs: PlayerPosition[] = eligiblePositions): MatchmakingPlayer {
  return {
    signupId: id,
    playerId: id,
    name,
    eligiblePositions,
    positionPreferences: prefs.map((position, index) => ({ position, order: index + 1 })),
    ratings: Object.fromEntries(PLAYER_POSITIONS.map((pos) => [pos, ratings[pos] ?? 1000])) as Record<PlayerPosition, number>,
    gamesPlayed: Object.fromEntries(PLAYER_POSITIONS.map((pos) => [pos, 20])) as Record<PlayerPosition, number>,
    confidence: Object.fromEntries(PLAYER_POSITIONS.map((pos) => [pos, 1])) as Record<PlayerPosition, number>,
  }
}

const fairnessFixture = () => [
  player(1, "G1", { goalkeeper: 1300 }, ["goalkeeper"]),
  player(2, "G2", { goalkeeper: 1250 }, ["goalkeeper"]),
  player(3, "D1", { defender: 1700 }, ["defender"]),
  player(4, "D2", { defender: 1680 }, ["defender"]),
  player(5, "D3", { defender: 980 }, ["defender"]),
  player(6, "D4", { defender: 960 }, ["defender"]),
  player(7, "F1", { forward: 1320 }, ["forward"]),
  player(8, "F2", { forward: 1310 }, ["forward"]),
  player(9, "F3", { forward: 990 }, ["forward"]),
  player(10, "F4", { forward: 980 }, ["forward"]),
  player(11, "U1", { goalkeeper: 1000, defender: 1000, forward: 1000 }),
  player(12, "U2", { goalkeeper: 1010, defender: 1010, forward: 1010 }),
]

describe("genetisches Matchmaking", () => {
  it("erfüllt Teamgrößen, Vollständigkeit und Positionsberechtigungen", () => {
    const result = balanceMatchmakingPlayers(fairnessFixture(), { seed: 7, maxCandidates: 300, maxGenerations: 12, maxComputationTimeMs: 0, populationSize: 24 })
    expect(result.assignments.filter((a) => a.team === 1)).toHaveLength(6)
    expect(result.assignments.filter((a) => a.team === 2)).toHaveLength(6)
    expect(new Set(result.assignments.map((a) => a.signupId)).size).toBe(12)
    const byId = new Map(fairnessFixture().map((p) => [p.signupId, p]))
    for (const assignment of result.assignments) expect(byId.get(assignment.signupId)!.eligiblePositions).toContain(assignment.position)
  })

  it("liefert keine schlechtere Lösung als die Greedy-Baseline und verbessert effektive Stärke", () => {
    const players = fairnessFixture()
    const greedy = evaluateCandidate(players, fromDraftAssignments(players, buildGreedySeed(players)))!
    const result = balanceMatchmakingPlayers(players, { seed: 42, maxCandidates: 800, maxGenerations: 25, maxComputationTimeMs: 0, populationSize: 32 })
    const genetic = evaluateCandidate(players, result.assignments.map((a) => ({ signupId: a.signupId, team: a.team, position: a.position })))!
    expect(genetic.fitness.total).toBeLessThanOrEqual(greedy.fitness.total)
    expect(genetic.fitness.effectiveStrengthDifference).toBeLessThan(greedy.fitness.effectiveStrengthDifference)
  })

  it("ist bei gleichem Seed und Budget stabil und unabhängig von Eingabereihenfolge", () => {
    const players = fairnessFixture()
    const a = balanceMatchmakingPlayers(players, { seed: 123, maxCandidates: 400, maxGenerations: 12, maxComputationTimeMs: 0, populationSize: 24 })
    const b = balanceMatchmakingPlayers([...players].reverse(), { seed: 123, maxCandidates: 400, maxGenerations: 12, maxComputationTimeMs: 0, populationSize: 24 })
    expect(a.assignments.map((x) => [x.signupId, x.team, x.position, x.rotationGroupId, x.startsInWater])).toEqual(b.assignments.map((x) => [x.signupId, x.team, x.position, x.rotationGroupId, x.startsInWater]))
  })


  it("verteilt zusätzliche Wechselspieler einer Position auf beide Teams", () => {
    const players = [
      player(1, "G1", { goalkeeper: 1100 }, ["goalkeeper"]),
      player(2, "G2", { goalkeeper: 1090 }, ["goalkeeper"]),
      player(3, "G3", { goalkeeper: 1080 }, ["goalkeeper"]),
      player(4, "G4", { goalkeeper: 1070 }, ["goalkeeper"]),
      player(5, "G5", { goalkeeper: 1060 }, ["goalkeeper"]),
      player(6, "G6", { goalkeeper: 1050 }, ["goalkeeper"]),
      player(7, "D1", { defender: 1100 }, ["defender"]),
      player(8, "D2", { defender: 1090 }, ["defender"]),
      player(9, "D3", { defender: 1080 }, ["defender"]),
      player(10, "D4", { defender: 1070 }, ["defender"]),
      player(11, "F1", { forward: 1100 }, ["forward"]),
      player(12, "F2", { forward: 1090 }, ["forward"]),
      player(13, "F3", { forward: 1080 }, ["forward"]),
      player(14, "F4", { forward: 1070 }, ["forward"]),
    ]

    const result = balanceMatchmakingPlayers(players, { seed: 21, maxCandidates: 1200, maxGenerations: 30, maxComputationTimeMs: 0, populationSize: 32 })
    const goalkeeperCounts = [1, 2].map((team) => result.assignments.filter((a) => a.team === team && a.position === "goalkeeper").length)

    expect(Math.abs(goalkeeperCounts[0] - goalkeeperCounts[1])).toBeLessThanOrEqual(1)
    expect(Math.max(...goalkeeperCounts)).toBeLessThanOrEqual(3)
  })

  it("bewertet Präferenzen endlich und nicht eligible Positionen dominierend", () => {
    const p = player(99, "Flex", { goalkeeper: 1000, defender: 1000, forward: 1000 }, ["goalkeeper", "defender", "forward"], ["goalkeeper", "defender"])
    expect(getPositionPenalty(p, "goalkeeper")).toBe(0)
    expect(getPositionPenalty(p, "defender")).toBeGreaterThan(0)
    expect(Number.isFinite(getPositionPenalty(p, "forward"))).toBe(true)
    expect(getPositionPenalty({ ...p, eligiblePositions: ["goalkeeper"] }, "forward")).toBeGreaterThan(100_000)
  })

  it("gewichtet die Hauptposition stärker als kleine Rating-Vorteile auf Nebenpositionen", () => {
    const p = player(100, "Flex", { goalkeeper: 1000, defender: 1008, forward: 1015 }, ["goalkeeper", "defender", "forward"], ["goalkeeper", "defender", "forward"])
    const mainPositionCost = getPositionPenalty(p, "goalkeeper") * OBJECTIVE_WEIGHTS.positionPreference - p.ratings.goalkeeper
    const secondaryPositionCost = getPositionPenalty(p, "defender") * OBJECTIVE_WEIGHTS.positionPreference - p.ratings.defender
    const tertiaryPositionCost = getPositionPenalty(p, "forward") * OBJECTIVE_WEIGHTS.positionPreference - p.ratings.forward

    expect(mainPositionCost).toBeLessThan(secondaryPositionCost)
    expect(mainPositionCost).toBeLessThan(tertiaryPositionCost)
  })

  it("hält Kandidatenlimit und best-found Optimalität ein", () => {
    const result = balanceMatchmakingPlayers(fairnessFixture(), { seed: 9, maxCandidates: 20, maxGenerations: 100, maxComputationTimeMs: 0, populationSize: 16 })
    expect(result.candidatesEvaluated).toBeLessThanOrEqual(20)
    expect(result.optimality).toBe("best-found")
    expect(result.assignments).toHaveLength(12)
  })
})
