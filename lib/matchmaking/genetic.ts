import { PLAYER_POSITIONS, type PlayerPosition } from "@/lib/ratings/types"
import { buildGreedySeed } from "./greedy"
import { candidateHash, canonicalizePlayers, fromDraftAssignments, stableInputSeed, type Candidate } from "./candidate"
import { createPrng, type RandomSource } from "./random"
import { repairCandidate } from "./repair"
import { compareBreakdowns, evaluateCandidate, type EvaluatedCandidate } from "./fitness"
import type { MatchmakingPlayer, MatchmakingResult } from "./types"

export type GeneticOptions = { seed?: number; maxCandidates: number; maxGenerations: number; maxComputationTimeMs: number; populationSize: number }

type EvalFn = (candidate: Candidate) => EvaluatedCandidate | null

export function runGeneticOptimization(input: MatchmakingPlayer[], options: GeneticOptions, warnings: string[]): MatchmakingResult {
  const started = Date.now()
  const players = canonicalizePlayers(input)
  const prng = createPrng(options.seed ?? stableInputSeed(players))
  let evaluated = 0
  const seen = new Set<string>()
  const evalOne: EvalFn = (raw) => {
    if (evaluated >= options.maxCandidates) return null
    if (options.maxComputationTimeMs > 0 && Date.now() - started > options.maxComputationTimeMs) return null
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
  evaluated = Math.max(evaluated, 1)
  seen.add(greedy.hash)
  let best = greedy
  const pushEval = (arr: EvaluatedCandidate[], c: Candidate) => {
    const fixed = repairCandidate(players, c)
    if (!fixed) return
    const hash = candidateHash(fixed)
    if (seen.has(hash) && arr.some((e) => e.hash === hash)) return
    const ev = evalOne(fixed)
    if (!ev) return
    arr.push(ev)
    if (compareBreakdowns(ev.fitness, best.fitness, ev.hash, best.hash) < 0) best = ev
  }
  let population: EvaluatedCandidate[] = [greedy]
  pushEval(population, fromDraftAssignments(players, buildGreedySeed(players, { reverseTeamPriority: true })))
  pushEval(population, snake(players))
  for (const pos of PLAYER_POSITIONS) pushEval(population, byPosition(players, pos))
  while (population.length < options.populationSize && evaluated < options.maxCandidates) pushEval(population, randomCandidate(players, prng))
  for (let i = 0; i < Math.min(12, options.populationSize); i++) pushEval(population, mutate(players, greedy.candidate, prng, best))

  for (let gen = 0; gen < options.maxGenerations && evaluated < options.maxCandidates; gen++) {
    population.sort((a, b) => compareBreakdowns(a.fitness, b.fitness, a.hash, b.hash))
    const next = [greedy, best, ...population.slice(0, 4)].filter((v, i, a) => a.findIndex((x) => x.hash === v.hash) === i)
    while (next.length < options.populationSize && evaluated < options.maxCandidates) {
      const a = tournament(population, prng), b = tournament(population, prng)
      let child = crossover(a.candidate, b.candidate, prng)
      if (prng.chance(0.85)) child = mutate(players, child, prng, best)
      pushEval(next, child)
      if (Date.now() - started > options.maxComputationTimeMs && options.maxComputationTimeMs > 0) break
    }
    population = next
  }
  best = localImprove(players, best, evalOne)
  if (compareBreakdowns(best.fitness, greedy.fitness, best.hash, greedy.hash) > 0) best = greedy
  warnings.push(...best.warnings)
  return { assignments: best.assignments, rotationGroups: best.rotationGroups, team1: best.team1, team2: best.team2, warnings: [], computationTimeMs: Date.now() - started, candidatesEvaluated: evaluated, optimality: "best-found", quality: "medium" }
}

function snake(players: MatchmakingPlayer[]): Candidate {
  return [...players].sort((a, b) => Math.max(...Object.values(b.ratings)) - Math.max(...Object.values(a.ratings)) || a.signupId - b.signupId).map((p, i) => ({ signupId: p.signupId, team: i % 4 < 2 ? 1 : 2, position: bestPosition(p) }))
}
function byPosition(players: MatchmakingPlayer[], focus: PlayerPosition): Candidate {
  return [...players].sort((a, b) => (b.ratings[focus] - a.ratings[focus]) || a.signupId - b.signupId).map((p, i) => ({ signupId: p.signupId, team: i % 2 === 0 ? 1 : 2, position: p.eligiblePositions.includes(focus) ? focus : bestPosition(p) }))
}
function randomCandidate(players: MatchmakingPlayer[], prng: RandomSource): Candidate {
  return players.map((p, i) => ({ signupId: p.signupId, team: i < Math.ceil(players.length / 2) ? 1 : 2, position: prng.pick(p.eligiblePositions) })).sort(() => prng.next() - 0.5).map((g, i) => ({ ...g, team: i < Math.ceil(players.length / 2) ? 1 : 2 }))
}
function bestPosition(p: MatchmakingPlayer): PlayerPosition { return [...p.eligiblePositions].sort((a, b) => (p.positionPreferences.find((x) => x.position === a)?.order ?? 99) - (p.positionPreferences.find((x) => x.position === b)?.order ?? 99) || b.localeCompare(a))[0] }
function tournament(pop: EvaluatedCandidate[], prng: RandomSource): EvaluatedCandidate { return Array.from({ length: 3 }, () => prng.pick(pop)).sort((a, b) => compareBreakdowns(a.fitness, b.fitness, a.hash, b.hash))[0] }
function crossover(a: Candidate, b: Candidate, prng: RandomSource): Candidate { return a.map((gene, i) => prng.chance(0.5) ? { ...gene } : { ...b[i] }) }
function mutate(players: MatchmakingPlayer[], candidate: Candidate, prng: RandomSource, best?: EvaluatedCandidate): Candidate {
  const out = candidate.map((g) => ({ ...g })); const byId = new Map(players.map((p) => [p.signupId, p])); const kind = prng.int(6)
  if (kind === 5 && best) {
    const pos = PLAYER_POSITIONS.sort((a, b) => Math.abs(best.team1.positionAverages[b] - best.team2.positionAverages[b]) - Math.abs(best.team1.positionAverages[a] - best.team2.positionAverages[a]))[0]
    const a = out.find((g) => g.team === 1 && g.position === pos), b = out.find((g) => g.team === 2 && g.position !== pos && byId.get(g.signupId)!.eligiblePositions.includes(pos)); if (a && b) [a.position, b.position] = [b.position, a.position]
  } else if (kind === 0) { const g = prng.pick(out); g.position = prng.pick(byId.get(g.signupId)!.eligiblePositions) }
  else if (kind === 1) { const a = prng.pick(out.filter((g) => g.team === 1)), b = prng.pick(out.filter((g) => g.team === 2)); if (a && b) [a.team, b.team] = [b.team, a.team] }
  else if (kind === 2) { const g = prng.pick(out); g.team = g.team === 1 ? 2 : 1 }
  else if (kind === 3) { const a = prng.pick(out), b = prng.pick(out); if (a && b && byId.get(a.signupId)!.eligiblePositions.includes(b.position) && byId.get(b.signupId)!.eligiblePositions.includes(a.position)) [a.position, b.position] = [b.position, a.position] }
  else { const pos = prng.pick(PLAYER_POSITIONS); const a = out.find((g) => g.team === 1 && g.position === pos), b = out.find((g) => g.team === 2 && g.position === pos); if (a && b) [a.team, b.team] = [b.team, a.team] }
  return out
}
function localImprove(players: MatchmakingPlayer[], start: EvaluatedCandidate, evalOne: EvalFn): EvaluatedCandidate {
  let best = start
  for (let i = 0; i < best.candidate.length; i++) for (let j = i + 1; j < best.candidate.length; j++) {
    const swapped = best.candidate.map((g) => ({ ...g })); [swapped[i].team, swapped[j].team] = [swapped[j].team, swapped[i].team]
    const ev = evalOne(swapped); if (ev && compareBreakdowns(ev.fitness, best.fitness, ev.hash, best.hash) < 0) best = ev
  }
  const byId = new Map(players.map((p) => [p.signupId, p]))
  for (let i = 0; i < best.candidate.length; i++) for (const pos of byId.get(best.candidate[i].signupId)!.eligiblePositions) {
    const changed = best.candidate.map((g) => ({ ...g })); changed[i].position = pos
    const ev = evalOne(changed); if (ev && compareBreakdowns(ev.fitness, best.fitness, ev.hash, best.hash) < 0) best = ev
  }
  return best
}
