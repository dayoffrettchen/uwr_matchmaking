import { PLAYER_POSITIONS, type PlayerPosition } from "@/lib/ratings/types"
import { buildGreedySeed } from "./greedy"
import { candidateHash, canonicalizePlayers, fromDraftAssignments, stableInputSeed, type Candidate } from "./candidate"
import { createPrng, type RandomSource } from "./random"
import { repairCandidate } from "./repair"
import { compareBreakdowns, evaluateCandidate, type EvaluatedCandidate } from "./fitness"
import type { CandidateDiagnostics, MatchmakingPlayer, MatchmakingResult } from "./types"

export type GeneticOptions = { seed?: number; maxCandidates: number; maxGenerations: number; maxComputationTimeMs: number; populationSize: number }

type EvalFn = (candidate: Candidate) => EvaluatedCandidate | null

export function runGeneticOptimization(input: MatchmakingPlayer[], options: GeneticOptions, warnings: string[]): MatchmakingResult {
  const started = Date.now()
  const deadline = options.maxComputationTimeMs > 0 ? started + options.maxComputationTimeMs : null
  const players = canonicalizePlayers(input)
  const prng = createPrng(options.seed ?? stableInputSeed(players))
  let evaluated = 0
  const phaseCounts: CandidateDiagnostics = {
    geneticCandidates: 0,
    mandatorySamePositionCandidates: 0,
    mandatorySamePositionRequiredCandidates: 0,
    mandatorySamePositionCompleted: false,
    optionalLocalCandidates: 0,
    optionalLocalCompleted: true,
    totalCandidates: 0,
  }
  let phase: "genetic" | "mandatory" | "optional" = "genetic"
  const countPhase = () => {
    if (phase === "genetic") phaseCounts.geneticCandidates++
    else if (phase === "mandatory") phaseCounts.mandatorySamePositionCandidates++
    else phaseCounts.optionalLocalCandidates++
    phaseCounts.totalCandidates = evaluated
  }
  const hasBudget = () => evaluated < options.maxCandidates && (!deadline || Date.now() < deadline)
  const evalOne: EvalFn = (raw) => {
    if (!hasBudget()) return null
    const candidate = repairCandidate(players, raw)
    if (!candidate) return null
    const hash = candidateHash(candidate)
    const result = evaluateCandidate(players, candidate, hash)
    if (result) { evaluated++; countPhase() }
    return result
  }
  const greedySeed = fromDraftAssignments(players, buildGreedySeed(players))
  const greedyCandidate = repairCandidate(players, greedySeed) ?? greedySeed
  const greedy = evaluateCandidate(players, greedyCandidate, "greedy")
  if (!greedy) throw new Error("Für diese Teilnehmer konnte keine gültige Team-Einteilung erstellt werden.")
  evaluated = 1
  phaseCounts.geneticCandidates = 1
  phaseCounts.totalCandidates = 1
  phaseCounts.mandatorySamePositionRequiredCandidates = countSamePositionSwapPairs(greedy.candidate)
  if (options.maxCandidates === 0) {
    return { assignments: greedy.assignments, rotationGroups: greedy.rotationGroups, team1: greedy.team1, team2: greedy.team2, warnings: [], computationTimeMs: Date.now() - started, candidatesEvaluated: 1, optimality: "best-found", quality: "medium", diagnostics: phaseCounts }
  }
  const seen = new Set<string>([greedy.hash])
  let best = greedy
  const mandatoryReserve = Math.min(phaseCounts.mandatorySamePositionRequiredCandidates, Math.max(0, options.maxCandidates - evaluated))
  const geneticLimit = Math.max(evaluated, options.maxCandidates - mandatoryReserve)
  const geneticHasBudget = () => evaluated < geneticLimit && (!deadline || Date.now() < deadline)
  const pushEval = (arr: EvaluatedCandidate[], c: Candidate) => {
    if (!geneticHasBudget()) return
    const fixed = repairCandidate(players, c)
    if (!fixed) return
    const hash = candidateHash(fixed)
    if (seen.has(hash) && arr.some((e) => e.hash === hash)) return
    const ev = evalOne(fixed)
    if (!ev) return
    seen.add(ev.hash)
    arr.push(ev)
    if (compareBreakdowns(ev.fitness, best.fitness, ev.hash, best.hash) < 0) best = ev
  }
  let population: EvaluatedCandidate[] = [greedy]
  pushEval(population, fromDraftAssignments(players, buildGreedySeed(players, { reverseTeamPriority: true })))
  pushEval(population, snake(players))
  for (const pos of PLAYER_POSITIONS) pushEval(population, byPosition(players, pos))
  for (const candidate of enumerateSmallRosterCandidates(players)) pushEval(population, candidate)
  fillPopulation(population, options.populationSize, () => randomCandidate(players, prng), pushEval, () => evaluated, geneticLimit, started, options.maxComputationTimeMs)
  for (let i = 0; i < Math.min(12, options.populationSize); i++) pushEval(population, mutate(players, greedy.candidate, prng, best))

  for (let gen = 0; gen < options.maxGenerations && geneticHasBudget(); gen++) {
    population.sort((a, b) => compareBreakdowns(a.fitness, b.fitness, a.hash, b.hash))
    const next = [greedy, best, ...population.slice(0, 4)].filter((v, i, a) => a.findIndex((x) => x.hash === v.hash) === i)
    fillPopulation(next, options.populationSize, () => {
      const a = tournament(population, prng), b = tournament(population, prng)
      let child = crossover(a.candidate, b.candidate, prng)
      if (prng.chance(0.85)) child = mutate(players, child, prng, best)
      return child
    }, pushEval, () => evaluated, geneticLimit, started, options.maxComputationTimeMs)
    population = next
  }

  phase = "mandatory"
  phaseCounts.mandatorySamePositionRequiredCandidates = countSamePositionSwapPairs(best.candidate)
  const mandatory = samePositionSweep(best, evalOne)
  phaseCounts.mandatorySamePositionCompleted = mandatory.completed
  if (mandatory.completed) {
    if (compareBreakdowns(mandatory.best.fitness, best.fitness, mandatory.best.hash, best.hash) < 0) best = mandatory.best
  } else {
    warnings.push(`Die verpflichtende Gleichpositions-Suche wurde wegen Kandidaten- oder Zeitbudget nur teilweise ausgeführt (${phaseCounts.mandatorySamePositionCandidates}/${phaseCounts.mandatorySamePositionRequiredCandidates}).`)
  }

  phase = "optional"
  while (phaseCounts.mandatorySamePositionCompleted && hasBudget()) {
    const beforeBest = best.hash
    const sweep = samePositionSweep(best, evalOne)
    if (!sweep.completed) { phaseCounts.optionalLocalCompleted = false; warnings.push("Die optionale lokale Gleichpositions-Suche wurde wegen Kandidaten- oder Zeitbudget abgebrochen."); break }
    if (compareBreakdowns(sweep.best.fitness, best.fitness, sweep.best.hash, best.hash) < 0) best = sweep.best
    if (best.hash === beforeBest) break
  }
  phaseCounts.totalCandidates = evaluated
  if (compareBreakdowns(best.fitness, greedy.fitness, best.hash, greedy.hash) > 0) best = greedy
  warnings.push(...best.warnings)
  return { assignments: best.assignments, rotationGroups: best.rotationGroups, team1: best.team1, team2: best.team2, warnings: [], computationTimeMs: Date.now() - started, candidatesEvaluated: evaluated, optimality: "best-found", quality: "medium", diagnostics: phaseCounts }
}
function fillPopulation(
  population: EvaluatedCandidate[],
  targetSize: number,
  createCandidate: () => Candidate,
  pushEval: (arr: EvaluatedCandidate[], c: Candidate) => void,
  getEvaluated: () => number,
  maxCandidates: number,
  started: number,
  maxComputationTimeMs: number,
) {
  let attemptsWithoutGrowth = 0
  const maxAttemptsWithoutGrowth = Math.max(targetSize * 20, 100)

  while (population.length < targetSize && getEvaluated() < maxCandidates && attemptsWithoutGrowth < maxAttemptsWithoutGrowth) {
    if (maxComputationTimeMs > 0 && Date.now() - started > maxComputationTimeMs) break

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
function countSamePositionSwapPairs(candidate: Candidate): number {
  return PLAYER_POSITIONS.reduce((sum, position) => {
    const team1 = candidate.filter((g) => g.team === 1 && g.position === position).length
    const team2 = candidate.filter((g) => g.team === 2 && g.position === position).length
    return sum + team1 * team2
  }, 0)
}

function samePositionSweep(start: EvaluatedCandidate, evalOne: EvalFn): { best: EvaluatedCandidate; completed: boolean } {
  let best = start
  for (const position of PLAYER_POSITIONS) {
    const team1 = start.candidate.map((g, index) => ({ g, index })).filter(({ g }) => g.team === 1 && g.position === position)
    const team2 = start.candidate.map((g, index) => ({ g, index })).filter(({ g }) => g.team === 2 && g.position === position)
    for (const a of team1) for (const b of team2) {
      const swapped = start.candidate.map((g) => ({ ...g }))
      ;[swapped[a.index].team, swapped[b.index].team] = [swapped[b.index].team, swapped[a.index].team]
      const ev = evalOne(swapped)
      if (!ev) return { best, completed: false }
      if (compareBreakdowns(ev.fitness, best.fitness, ev.hash, best.hash) < 0) best = ev
    }
  }
  return { best, completed: true }
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
