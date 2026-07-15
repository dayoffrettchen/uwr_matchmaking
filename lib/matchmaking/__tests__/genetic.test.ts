import { describe, expect, it } from "vitest"
import { PLAYER_POSITIONS, type PlayerPosition } from "@/lib/ratings/types"
import { balanceMatchmakingPlayers, buildRotationSteps, finalizeUnderwaterRugbyLineup } from "../balance-teams"
import { fromDraftAssignments } from "../candidate"
import { OBJECTIVE_WEIGHTS } from "../constants"
import { evaluateCandidate, getPositionPenalty } from "../fitness"
import { buildGreedySeed } from "../greedy"
import { getTargetLineup } from "../target-lineup"
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
  it("plant die UWR-Startaufstellung als 1 Torwart, 2 Verteidiger und 3 Stürmer", () => {
    expect(getTargetLineup(6)).toEqual({ goalkeeper: 1, defender: 2, forward: 3 })
  })

  it("erfüllt Teamgrößen, Vollständigkeit und Positionsberechtigungen", () => {
    const result = balanceMatchmakingPlayers(fairnessFixture(), { seed: 7, maxCandidates: 300, maxGenerations: 12, maxComputationTimeMs: 0, populationSize: 24 })
    expect(result.assignments.filter((a) => a.team === 1)).toHaveLength(6)
    expect(result.assignments.filter((a) => a.team === 2)).toHaveLength(6)
    expect(new Set(result.assignments.map((a) => a.signupId)).size).toBe(12)
    const byId = new Map(fairnessFixture().map((p) => [p.signupId, p]))
    for (const assignment of result.assignments) expect(byId.get(assignment.signupId)!.eligiblePositions).toContain(assignment.position)
  })


  it("finalisiert Positionswechselgruppen mit zwei aktiven Spielern und gültiger Rotation", () => {
    const players = [
      ...[1, 2, 3, 4, 5].map((id) => player(id, `G${id}`, { goalkeeper: 1200 - id }, ["goalkeeper"])),
      ...[6, 7, 8].map((id) => player(id, `D${id}`, { defender: 1200 - id }, ["defender"])),
      ...[9, 10, 11].map((id) => player(id, `F${id}`, { forward: 1200 - id }, ["forward"])),
      player(12, "G6", { goalkeeper: 1100 }, ["goalkeeper"]),
      player(13, "D9", { defender: 1100 }, ["defender"]),
      player(14, "F9", { forward: 1100 }, ["forward"]),
    ]
    const assignments = [
      ...[1, 2, 3, 4, 5].map((signupId) => ({ signupId, playerId: signupId, team: 1 as const, position: "goalkeeper" as const })),
      ...[6, 7, 8].map((signupId) => ({ signupId, playerId: signupId, team: 1 as const, position: "defender" as const })),
      ...[9, 10, 11].map((signupId) => ({ signupId, playerId: signupId, team: 1 as const, position: "forward" as const })),
      { signupId: 12, playerId: 12, team: 2 as const, position: "goalkeeper" as const },
      { signupId: 13, playerId: 13, team: 2 as const, position: "defender" as const },
      { signupId: 14, playerId: 14, team: 2 as const, position: "forward" as const },
    ].map((assignment) => ({ ...assignment, rotationGroupId: 0, rotationGroupType: "single" as const, rotationOrder: 0, startsInWater: false, lineupType: "substitute" as const }))
    const result = finalizeUnderwaterRugbyLineup(players, assignments, [])

    for (const position of PLAYER_POSITIONS) {
      const positioned = result.assignments.filter((a) => a.team === 1 && a.position === position)
      expect(positioned.filter((a) => a.startsInWater)).toHaveLength(2)
      expect(new Set(positioned.map((a) => a.rotationGroupId)).size).toBe(1)
    }
    expect(result.assignments.filter((a) => a.team === 1 && a.startsInWater)).toHaveLength(6)
    expect(result.rotationGroups.find((group) => group.team === 1 && group.position === "goalkeeper")?.rotationSteps).toEqual([
      { outgoingSignupId: 1, incomingSignupId: 3 },
      { outgoingSignupId: 2, incomingSignupId: 4 },
      { outgoingSignupId: 3, incomingSignupId: 5 },
      { outgoingSignupId: 4, incomingSignupId: 1 },
      { outgoingSignupId: 5, incomingSignupId: 2 },
    ])
    expect(result.assignments.filter((a) => a.team === 2 && a.startsInWater)).toHaveLength(3)
  })

  it("erzeugt eine zyklisch gültige Rotationsreihenfolge für zwei aktive Plätze", () => {
    const members = [1, 2, 3, 4, 5].map((signupId, index) => ({ signupId, playerId: signupId, name: String(signupId), rating: 1000, rotationOrder: index + 1, startsInWater: index < 2 }))

    expect(buildRotationSteps(members, 2)).toEqual([
      { outgoingSignupId: 1, incomingSignupId: 3 },
      { outgoingSignupId: 2, incomingSignupId: 4 },
      { outgoingSignupId: 3, incomingSignupId: 5 },
      { outgoingSignupId: 4, incomingSignupId: 1 },
      { outgoingSignupId: 5, incomingSignupId: 2 },
    ])
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
    expect(a.assignments.map((x) => [x.signupId, x.team, x.position, x.startsInWater])).toEqual(b.assignments.map((x) => [x.signupId, x.team, x.position, x.startsInWater]))
  })

  it("balanciert kleine Runden auch dann fair, wenn alle Spieler aktiv starten", () => {
    const players = [
      player(1, "C2", { defender: 974 }, ["defender"]),
      player(2, "Jochen", { defender: 1074 }, ["defender"]),
      player(3, "Christoph Dume", { forward: 1280 }, ["forward"]),
      player(4, "Mo", { defender: 1026 }, ["defender"]),
      player(5, "Nocheiner", { defender: 918 }, ["defender"]),
      player(6, "Hannes", { forward: 966 }, ["forward"]),
    ]
    const result = balanceMatchmakingPlayers(players, { seed: 5, maxCandidates: 10_000, maxGenerations: 10, maxComputationTimeMs: 0, populationSize: 16 })

    expect(Math.abs(result.team1.effectiveStrength - result.team2.effectiveStrength)).toBeLessThanOrEqual(40)
    expect(Math.abs(result.team1.averageParticipantRating - result.team2.averageParticipantRating)).toBeLessThanOrEqual(40)
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

  it("liefert eine Best-Effort-Einteilung, wenn eine Zielposition pro Team unterbesetzt ist", () => {
    const players = [
      player(1, "F1", { forward: 1200 }, ["forward"]),
      player(2, "F2", { forward: 1190 }, ["forward"]),
      player(3, "F3", { forward: 1180 }, ["forward"]),
      player(4, "F4", { forward: 1170 }, ["forward"]),
      player(5, "F5", { forward: 1160 }, ["forward"]),
      player(6, "F6", { forward: 1150 }, ["forward"]),
    ]

    const result = balanceMatchmakingPlayers(players, { seed: 11, maxCandidates: 200, maxGenerations: 10, maxComputationTimeMs: 0, populationSize: 16 })

    expect(result.assignments).toHaveLength(players.length)
    expect(result.assignments.filter((assignment) => assignment.team === 1)).toHaveLength(3)
    expect(result.assignments.filter((assignment) => assignment.team === 2)).toHaveLength(3)
    expect(result.assignments.every((assignment) => assignment.position === "forward")).toBe(true)
    expect(result.warnings.some((warning) => warning.includes("Best-Effort"))).toBe(true)
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

  it("liefert auch bei erschöpftem Suchbudget eine Greedy-Einteilung", () => {
    const result = balanceMatchmakingPlayers(fairnessFixture(), { seed: 9, maxCandidates: 0, maxGenerations: 0, maxComputationTimeMs: -1, populationSize: 0 })
    expect(result.candidatesEvaluated).toBe(1)
    expect(result.assignments).toHaveLength(12)
    expect(result.assignments.some((assignment) => assignment.team === 1)).toBe(true)
    expect(result.assignments.some((assignment) => assignment.team === 2)).toBe(true)
  })

  it("bricht ab, wenn kaum eindeutige Kandidaten erzeugt werden können", () => {
    const players = Array.from({ length: 6 }, (_, index) => player(index + 1, `F${index + 1}`, { forward: 1000 }, ["forward"]))

    const result = balanceMatchmakingPlayers(players, { seed: 5, maxCandidates: 500, maxGenerations: 20, maxComputationTimeMs: 0, populationSize: 48 })

    expect(result.assignments).toHaveLength(players.length)
    expect(result.candidatesEvaluated).toBeLessThan(500)
    expect(result.assignments.every((assignment) => assignment.position === "forward")).toBe(true)
  })
})
