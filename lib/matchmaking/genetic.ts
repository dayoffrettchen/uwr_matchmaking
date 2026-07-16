import { PLAYER_POSITIONS, type PlayerPosition } from "@/lib/ratings/types"
import { buildGreedySeed } from "./greedy"
import { candidateHash, canonicalizePlayers, fromDraftAssignments, stableInputSeed, type Candidate } from "./candidate"
import { createPrng, type RandomSource } from "./random"
import { repairCandidate } from "./repair"
import { compareBreakdowns, compareFitnessQuality, evaluateCandidate, type EvaluatedCandidate } from "./fitness"
import type { MatchmakingPlayer, MatchmakingResult } from "./types"

export type GeneticOptions = { seed?: number; maxCandidates: number; maxGenerations: number; maxComputationTimeMs: number; populationSize: number; now?: () => number }

type EvalFn = (candidate: Candidate) => EvaluatedCandidate | null

export function runGeneticOptimization(input: MatchmakingPlayer[], options: GeneticOptions, warnings: string[]): MatchmakingResult {
  const now = options.now ?? Date.now
  const started = now()
  const globalDeadline = options.maxComputationTimeMs > 0 ? started + options.maxComputationTimeMs : null
  const geneticDeadline = globalDeadline === null ? null : started + Math.floor(options.maxComputationTimeMs * 0.7)
  const players = canonicalizePlayers(input)
  const mandatoryReserve = options.maxCandidates > 1 ? Math.min(Math.floor(players.length * players.length / 4), options.maxCandidates - 1) : 0
  const geneticCandidateLimit = options.maxCandidates > 0 ? Math.max(1, options.maxCandidates - mandatoryReserve) : 1
  const prng = createPrng(options.seed ?? stableInputSeed(players))
  let evaluated = 0
  let geneticCandidates = 0
  let mandatorySamePositionCandidates = 0
  let optionalLocalCandidates = 0
  const seen = new Set<string>()
  const evalOne: EvalFn = (raw) => {
    if (options.maxCandidates <= 0 || evaluated >= options.maxCandidates) return null
    if (globalDeadline !== null && now() >= globalDeadline) return null
    const candidate = repairCandidate(players, raw)
    if (!candidate) return null
    const hash = candidateHash(candidate)
    const result = evaluateCandidate(players, candidate, hash)
    if (result) { evaluated++; seen.add(hash) }
    return result
  }
  const greedySeed = fromDraftAssignments(players, buildGreedySeed(players))
  const greedyCandidate = repairCandidate(players, greedySeed) ?? greedySeed
  const greedy = evaluateCandidate(players, greedyCandidate, "greedy")
  if (!greedy) throw new Error("Für diese Teilnehmer konnte keine gültige Team-Einteilung erstellt werden.")
  evaluated = 1
  geneticCandidates = 1
  seen.add(greedy.hash)
  let best = greedy
  const pushEval = (arr: EvaluatedCandidate[], c: Candidate) => {
    if (evaluated >= geneticCandidateLimit) return
    if (geneticDeadline !== null && now() >= geneticDeadline) return
    const fixed = repairCandidate(players, c)
    if (!fixed) return
    const hash = candidateHash(fixed)
    if (seen.has(hash) && arr.some((e) => e.hash === hash)) return
    const ev = evalOne(fixed)
    if (!ev) return
    arr.push(ev)
    geneticCandidates++
    if (compareBreakdowns(ev.fitness, best.fitness, ev.hash, best.hash) < 0) best = ev
  }
  let population: EvaluatedCandidate[] = [greedy]
  pushEval(population, fromDraftAssignments(players, buildGreedySeed(players, { reverseTeamPriority: true })))
  pushEval(population, snake(players))
  for (const pos of PLAYER_POSITIONS) pushEval(population, byPosition(players, pos))
  for (const candidate of enumerateSmallRosterCandidates(players)) pushEval(population, candidate)
  fillPopulation(population, options.populationSize, () => randomCandidate(players, prng), pushEval, () => evaluated, options.maxCandidates, () => geneticDeadline !== null && now() >= geneticDeadline)
  for (let i = 0; i < Math.min(12, options.populationSize); i++) pushEval(population, mutate(players, greedy.candidate, prng, best))

  for (let gen = 0; gen < options.maxGenerations && evaluated < geneticCandidateLimit; gen++) {
    population.sort((a, b) => compareBreakdowns(a.fitness, b.fitness, a.hash, b.hash))
    const next = [greedy, best, ...population.slice(0, 4)].filter((v, i, a) => a.findIndex((x) => x.hash === v.hash) === i)
    fillPopulation(
      next,
      options.populationSize,
      () => {
        const a = tournament(population, prng), b = tournament(population, prng)
        let child = crossover(a.candidate, b.candidate, prng)
        if (prng.chance(0.85)) child = mutate(players, child, prng, best)
        return child
      },
      pushEval,
      () => evaluated,
      options.maxCandidates,
      () => geneticDeadline !== null && now() >= geneticDeadline,
    )
    population = next
  }
  const mandatory = mandatorySamePositionImprove(players, best, evalOne)
  best = mandatory.best
  mandatorySamePositionCandidates = mandatory.evaluated
  const optional = optionalImprove(players, best, evalOne)
  best = optional.best
  optionalLocalCandidates = optional.evaluated
  if (compareBreakdowns(best.fitness, greedy.fitness, best.hash, greedy.hash) > 0) best = greedy
  warnings.push(...best.warnings)
  return { assignments: best.assignments, rotationGroups: best.rotationGroups, team1: best.team1, team2: best.team2, warnings: [], computationTimeMs: now() - started, candidatesEvaluated: evaluated, optimality: "best-found", quality: "medium", diagnostics: { effectiveStrengthDifference: best.fitness.effectiveStrengthDifference, startingLineupDifference: best.fitness.startingLineupDifference, positionStrengthDifference: best.fitness.positionStrengthDifference, targetLineupPenalty: best.fitness.targetLineupPenalty, geneticCandidates, mandatorySamePositionCandidates, mandatorySamePositionRequiredCandidates: mandatory.required, mandatorySamePositionCompleted: mandatory.completed, optionalLocalCandidates, optionalLocalCompleted: optional.completed, totalCandidates: evaluated } }
}

function fillPopulation(
  population: EvaluatedCandidate[],
  targetSize: number,
  createCandidate: () => Candidate,
  pushEval: (arr: EvaluatedCandidate[], c: Candidate) => void,
  getEvaluated: () => number,
  maxCandidates: number,
  shouldStop: () => boolean,
) {
  let attemptsWithoutGrowth = 0
  const maxAttemptsWithoutGrowth = Math.max(targetSize * 20, 100)

  while (population.length < targetSize && getEvaluated() < maxCandidates && attemptsWithoutGrowth < maxAttemptsWithoutGrowth) {
    if (shouldStop()) break

    const beforeLength = population.length
    const beforeEvaluated = getEvaluated()
    pushEval(population, createCandidate())

    if (population.length === beforeLength && getEvaluated() === beforeEvaluated) attemptsWithoutGrowth++
    else attemptsWithoutGrowth = 0
  }
}

function enumerateSmallRosterCandidates(players: MatchmakingPlayer[]): Candidate[] {
  if (players.length > 10) return []
  const targetTeam1Size = Math.ceil(players.length / 2)
  const candidates: Candidate[] = []
  const current: Candidate = []

  function visit(index: number, team1Count: number) {
    if (candidates.length >= 20_000) return
    if (index === players.length) {
      if (team1Count === targetTeam1Size) candidates.push(current.map((gene) => ({ ...gene })))
      return
    }

    const remaining = players.length - index - 1
    for (const team of [1, 2] as const) {
      const nextTeam1Count = team1Count + (team === 1 ? 1 : 0)
      if (nextTeam1Count > targetTeam1Size) continue
      if (nextTeam1Count + remaining < targetTeam1Size) continue

      for (const position of players[index].eligiblePositions) {
        current.push({ signupId: players[index].signupId, team, position })
        visit(index + 1, nextTeam1Count)
        current.pop()
      }
    }
  }

  visit(0, 0)
  return candidates
}

function snake(players: MatchmakingPlayer[]): Candidate {
  return [...players].sort((a, b) => Math.max(...Object.values(b.ratings)) - Math.max(...Object.values(a.ratings)) || a.signupId - b.signupId).map((p, i) => ({ signupId: p.signupId, team: i % 4 < 2 ? 1 : 2, position: bestPosition(p) }))
}
function byPosition(players: MatchmakingPlayer[], focus: PlayerPosition): Candidate {
  return [...players].sort((a, b) => (b.ratings[focus] - a.ratings[focus]) || a.signupId - b.signupId).map((p, i) => ({ signupId: p.signupId, team: i % 2 === 0 ? 1 : 2, position: p.eligiblePositions.includes(focus) ? focus : bestPosition(p) }))
}
function randomCandidate(players: MatchmakingPlayer[], prng: RandomSource): Candidate {
  const shuffled = players.map((p) => ({ signupId: p.signupId, team: 1 as const, position: prng.pick(p.eligiblePositions), sortKey: prng.next() }))
    .sort((a, b) => a.sortKey - b.sortKey || a.signupId - b.signupId)
  return shuffled.map((g, i) => ({ signupId: g.signupId, team: i < Math.ceil(players.length / 2) ? 1 : 2, position: g.position }))
}
function bestPosition(p: MatchmakingPlayer): PlayerPosition { return [...p.eligiblePositions].sort((a, b) => (p.positionPreferences.find((x) => x.position === a)?.order ?? 99) - (p.positionPreferences.find((x) => x.position === b)?.order ?? 99) || b.localeCompare(a))[0] }
function tournament(pop: EvaluatedCandidate[], prng: RandomSource): EvaluatedCandidate { return Array.from({ length: 3 }, () => prng.pick(pop)).sort((a, b) => compareBreakdowns(a.fitness, b.fitness, a.hash, b.hash))[0] }
function crossover(a: Candidate, b: Candidate, prng: RandomSource): Candidate { return a.map((gene, i) => prng.chance(0.5) ? { ...gene } : { ...b[i] }) }
function mutate(players: MatchmakingPlayer[], candidate: Candidate, prng: RandomSource, best?: EvaluatedCandidate): Candidate {
  const out = candidate.map((g) => ({ ...g })); const byId = new Map(players.map((p) => [p.signupId, p])); const kind = prng.int(6)
  if (kind === 5 && best) {
    const pos = [...PLAYER_POSITIONS].sort((a, b) => Math.abs(best.team1.positionAverages[b] - best.team2.positionAverages[b]) - Math.abs(best.team1.positionAverages[a] - best.team2.positionAverages[a]) || a.localeCompare(b))[0]
    const a = out.find((g) => g.team === 1 && g.position === pos), b = out.find((g) => g.team === 2 && g.position !== pos && byId.get(g.signupId)!.eligiblePositions.includes(pos)); if (a && b) [a.position, b.position] = [b.position, a.position]
  } else if (kind === 0) { const g = prng.pick(out); g.position = prng.pick(byId.get(g.signupId)!.eligiblePositions) }
  else if (kind === 1) { const a = prng.pick(out.filter((g) => g.team === 1)), b = prng.pick(out.filter((g) => g.team === 2)); if (a && b) [a.team, b.team] = [b.team, a.team] }
  else if (kind === 2) { const g = prng.pick(out); g.team = g.team === 1 ? 2 : 1 }
  else if (kind === 3) { const a = prng.pick(out), b = prng.pick(out); if (a && b && byId.get(a.signupId)!.eligiblePositions.includes(b.position) && byId.get(b.signupId)!.eligiblePositions.includes(a.position)) [a.position, b.position] = [b.position, a.position] }
  else { const pos = prng.pick(PLAYER_POSITIONS); const a = out.find((g) => g.team === 1 && g.position === pos), b = out.find((g) => g.team === 2 && g.position === pos); if (a && b) [a.team, b.team] = [b.team, a.team] }
  return out
}
function mandatorySamePositionImprove(players: MatchmakingPlayer[], start: EvaluatedCandidate, evalOne: EvalFn): { best: EvaluatedCandidate; evaluated: number; required: number; completed: boolean } {
  let current = start
  let evaluated = 0
  let required = 0
  let completed = true
  for (;;) {
    const pairs: Array<[number, number]> = []
    for (let i = 0; i < current.candidate.length; i++) for (let j = i + 1; j < current.candidate.length; j++) {
      const a = current.candidate[i], b = current.candidate[j]
      if (a.team !== b.team && a.position === b.position) pairs.push([i, j])
    }
    required = pairs.length
    let best = current
    let sweepComplete = true
    for (const [i, j] of pairs) {
      const swapped = current.candidate.map((g) => ({ ...g })); [swapped[i].team, swapped[j].team] = [swapped[j].team, swapped[i].team]
      const ev = evalOne(swapped)
      if (!ev) { sweepComplete = false; break }
      evaluated++
      if (compareFitnessQuality(ev.fitness, best.fitness) < 0) best = ev
    }
    if (!sweepComplete) { completed = false; current = best; break }
    if (best === current) break
    current = best
  }
  return { best: current, evaluated, required, completed }
}

function optionalImprove(players: MatchmakingPlayer[], start: EvaluatedCandidate, evalOne: EvalFn): { best: EvaluatedCandidate; evaluated: number; completed: boolean } {
  let best = start
  let evaluated = 0
  let completed = true
  for (let i = 0; i < best.candidate.length; i++) for (let j = i + 1; j < best.candidate.length; j++) {
    const swapped = best.candidate.map((g) => ({ ...g })); [swapped[i].team, swapped[j].team] = [swapped[j].team, swapped[i].team]
    const ev = evalOne(swapped); if (!ev) { completed = false; return { best, evaluated, completed } }
    evaluated++; if (compareFitnessQuality(ev.fitness, best.fitness) < 0) best = ev
  }
  const byId = new Map(players.map((p) => [p.signupId, p]))
  for (let i = 0; i < best.candidate.length; i++) for (const pos of byId.get(best.candidate[i].signupId)!.eligiblePositions) {
    const changed = best.candidate.map((g) => ({ ...g })); changed[i].position = pos
    const ev = evalOne(changed); if (!ev) { completed = false; return { best, evaluated, completed } }
    evaluated++; if (compareFitnessQuality(ev.fitness, best.fitness) < 0) best = ev
  }
  return { best, evaluated, completed }
}
