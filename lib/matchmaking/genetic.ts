import { PLAYER_POSITIONS, type PlayerPosition } from "@/lib/ratings/types"
import { buildGreedySeed } from "./greedy"
import { candidateHash, canonicalizePlayers, fromDraftAssignments, stableInputSeed, type Candidate } from "./candidate"
import { createPrng, type RandomSource } from "./random"
import { repairCandidate } from "./repair"
import { compareEvaluatedCandidates, compareFitnessQuality, evaluateCandidate, type EvaluatedCandidate } from "./fitness"
import type { MatchmakingPlayer, MatchmakingResult } from "./types"

export type GeneticOptions = { seed?: number; maxCandidates: number; maxGenerations: number; maxComputationTimeMs: number; populationSize: number; now?: () => number }

type EvalFn = (candidate: Candidate) => EvaluatedCandidate | null

export function runGeneticOptimization(input: MatchmakingPlayer[], options: GeneticOptions, warnings: string[]): MatchmakingResult {
  const now = options.now ?? Date.now
  const started = now()
  const globalDeadline = options.maxComputationTimeMs > 0 ? started + options.maxComputationTimeMs : null
  const geneticDeadline = globalDeadline === null ? null : started + Math.floor(options.maxComputationTimeMs * 0.7)
  const players = canonicalizePlayers(input)
  const prng = createPrng(options.seed ?? stableInputSeed(players))
  const maxCandidates = Math.max(0, options.maxCandidates)
  const mandatorySamePositionReserve = estimateSamePositionSwapPairs(players)
  const requestedLocalCandidateBudget = Math.max(64, Math.ceil(maxCandidates * 0.25))
  const localCandidateBudget = maxCandidates > 0 ? Math.max(0, Math.min(requestedLocalCandidateBudget, maxCandidates - 1 - mandatorySamePositionReserve)) : 0
  const geneticCandidateBudget = maxCandidates > 0 ? Math.max(1, maxCandidates - localCandidateBudget - mandatorySamePositionReserve) : 1
  let geneticEvaluated = 0
  let mandatoryEvaluated = 0
  let optionalEvaluated = 0
  const seen = new Set<string>()
  const canEvaluate = (phaseDeadline: number | null = globalDeadline) => {
    if (maxCandidates > 0 && geneticEvaluated + mandatoryEvaluated + optionalEvaluated >= maxCandidates) return false
    if (phaseDeadline !== null && now() >= phaseDeadline) return false
    return true
  }
  const evalGenetic: EvalFn = (raw) => {
    if (geneticEvaluated >= geneticCandidateBudget || !canEvaluate(geneticDeadline)) return null
    const candidate = repairCandidate(players, raw)
    if (!candidate) return null
    const hash = candidateHash(candidate)
    const result = evaluateCandidate(players, candidate, hash)
    if (result) { geneticEvaluated++; seen.add(hash) }
    return result
  }
  const greedySeed = fromDraftAssignments(players, buildGreedySeed(players))
  const greedyCandidate = repairCandidate(players, greedySeed) ?? greedySeed
  const greedy = evaluateCandidate(players, greedyCandidate, "greedy")
  if (!greedy) throw new Error("Für diese Teilnehmer konnte keine gültige Team-Einteilung erstellt werden.")
  geneticEvaluated = 1
  seen.add(greedy.hash)
  let best = greedy

  if (maxCandidates > 0) {
    const pushEval = (arr: EvaluatedCandidate[], c: Candidate) => {
      const fixed = repairCandidate(players, c)
      if (!fixed) return
      const hash = candidateHash(fixed)
      if (seen.has(hash) && arr.some((e) => e.hash === hash)) return
      const ev = evalGenetic(fixed)
      if (!ev) return
      arr.push(ev)
      if (compareEvaluatedCandidates(ev, best) < 0) best = ev
    }
    let population: EvaluatedCandidate[] = [greedy]
    pushEval(population, fromDraftAssignments(players, buildGreedySeed(players, { reverseTeamPriority: true })))
    pushEval(population, snake(players))
    for (const pos of PLAYER_POSITIONS) pushEval(population, byPosition(players, pos))
    for (const candidate of enumerateSmallRosterCandidates(players)) pushEval(population, candidate)
    fillPopulation(population, options.populationSize, () => randomCandidate(players, prng), pushEval, () => geneticEvaluated, geneticCandidateBudget, now, geneticDeadline)
    for (let i = 0; i < Math.min(12, options.populationSize); i++) pushEval(population, mutate(players, greedy.candidate, prng, best))

    for (let gen = 0; gen < options.maxGenerations && geneticEvaluated < geneticCandidateBudget && canEvaluate(geneticDeadline); gen++) {
      population.sort(compareEvaluatedCandidates)
      const next = [greedy, best, ...population.slice(0, 4)].filter((v, i, a) => a.findIndex((x) => x.hash === v.hash) === i)
      fillPopulation(next, options.populationSize, () => {
        const a = tournament(population, prng), b = tournament(population, prng)
        let child = crossover(a.candidate, b.candidate, prng)
        if (prng.chance(0.85)) child = mutate(players, child, prng, best)
        return child
      }, pushEval, () => geneticEvaluated, geneticCandidateBudget, now, geneticDeadline)
      population = next
    }
  }

  let mandatory = { best, candidatesEvaluated: 0, completed: true, requiredCandidates: countSamePositionSwapPairs(best.candidate) }
  if (maxCandidates > 0) {
    const evalMandatory: EvalFn = (raw) => {
      if (!canEvaluate(globalDeadline)) return null
      const fixed = repairCandidate(players, raw)
      if (!fixed) return null
      const ev = evaluateCandidate(players, fixed, candidateHash(fixed))
      if (ev) mandatoryEvaluated++
      return ev
    }
    mandatory = runMandatorySamePositionLocalSearch(players, best, 30, evalMandatory)
    mandatoryEvaluated = mandatory.candidatesEvaluated
    best = mandatory.best
  }

  let optionalCompleted = true
  if (maxCandidates > 0) {
    const evalOptional: EvalFn = (raw) => {
      if (optionalEvaluated >= localCandidateBudget || !canEvaluate(globalDeadline)) { optionalCompleted = false; return null }
      const candidate = repairCandidate(players, raw)
      if (!candidate) return null
      const result = evaluateCandidate(players, candidate, candidateHash(candidate))
      if (result) optionalEvaluated++
      return result
    }
    best = optionalLocalImprove(players, best, evalOptional)
  }
  if (!mandatory.completed) warnings.push("Die verpflichtende gleiche-Position-Wechselsuche konnte nicht vollständig abgeschlossen werden.")
  if (!optionalCompleted) warnings.push("Die optionale lokale Suche konnte nicht vollständig abgeschlossen werden.")
  if (compareEvaluatedCandidates(best, greedy) > 0) best = greedy
  warnings.push(...best.warnings)
  const totalCandidates = geneticEvaluated + mandatoryEvaluated + optionalEvaluated
  return { assignments: best.assignments, rotationGroups: best.rotationGroups, team1: best.team1, team2: best.team2, warnings, computationTimeMs: now() - started, candidatesEvaluated: totalCandidates, optimality: "best-found", quality: "medium", diagnostics: { effectiveStrengthDifference: best.fitness.effectiveStrengthDifference, startingLineupDifference: best.fitness.startingLineupDifference, positionStrengthDifference: best.fitness.positionStrengthDifference, targetLineupPenalty: best.fitness.targetLineupPenalty, geneticCandidates: geneticEvaluated, mandatorySamePositionCandidates: mandatoryEvaluated, mandatorySamePositionRequiredCandidates: mandatory.requiredCandidates, mandatorySamePositionCompleted: mandatory.completed, optionalLocalCandidates: optionalEvaluated, optionalLocalCompleted: optionalCompleted, totalCandidates } }
}

function estimateSamePositionSwapPairs(players: MatchmakingPlayer[]): number {
  return Math.floor(players.length * players.length / 4)
}

function countSamePositionSwapPairs(candidate: Candidate): number {
  return PLAYER_POSITIONS.reduce((sum, position) => {
    const team1 = candidate.filter((gene) => gene.team === 1 && gene.position === position).length
    const team2 = candidate.filter((gene) => gene.team === 2 && gene.position === position).length
    return sum + team1 * team2
  }, 0)
}

function fillPopulation(
  population: EvaluatedCandidate[],
  targetSize: number,
  createCandidate: () => Candidate,
  pushEval: (arr: EvaluatedCandidate[], c: Candidate) => void,
  getEvaluated: () => number,
  maxCandidates: number,
  now: () => number,
  deadline: number | null,
) {
  let attemptsWithoutGrowth = 0
  const maxAttemptsWithoutGrowth = Math.max(targetSize * 20, 100)

  while (population.length < targetSize && getEvaluated() < maxCandidates && attemptsWithoutGrowth < maxAttemptsWithoutGrowth) {
    if (deadline !== null && now() >= deadline) break

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
function tournament(pop: EvaluatedCandidate[], prng: RandomSource): EvaluatedCandidate { return Array.from({ length: 3 }, () => prng.pick(pop)).sort(compareEvaluatedCandidates)[0] }
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
export type SamePositionLocalSearchResult = { best: EvaluatedCandidate; candidatesEvaluated: number; completed: boolean; requiredCandidates: number }

export function runMandatorySamePositionLocalSearch(players: MatchmakingPlayer[], start: EvaluatedCandidate, safetyPassLimit = 30, evalOne?: EvalFn): SamePositionLocalSearchResult {
  let best = start
  let candidatesEvaluated = 0
  let completed = true
  let requiredCandidates = countSamePositionSwapPairs(best.candidate)
  const evaluate = evalOne ?? ((raw: Candidate) => {
    const fixed = repairCandidate(players, raw)
    if (!fixed) return null
    return evaluateCandidate(players, fixed, candidateHash(fixed))
  })

  for (let pass = 0; pass < safetyPassLimit; pass++) {
    requiredCandidates = countSamePositionSwapPairs(best.candidate)
    let sweepEvaluated = 0
    let bestImprovement: EvaluatedCandidate | null = null
    for (let i = 0; i < best.candidate.length; i++) for (let j = i + 1; j < best.candidate.length; j++) {
      const left = best.candidate[i], right = best.candidate[j]
      if (left.team === right.team || left.position !== right.position) continue
      const swapped = best.candidate.map((g) => ({ ...g })); [swapped[i].team, swapped[j].team] = [swapped[j].team, swapped[i].team]
      const before = candidatesEvaluated
      const ev = evaluate(swapped)
      if (!ev) { completed = false; continue }
      candidatesEvaluated++
      sweepEvaluated++
      if (candidatesEvaluated === before) candidatesEvaluated = before + 1
      if (compareFitnessQuality(ev.fitness, best.fitness) < 0 && (!bestImprovement || compareFitnessQuality(ev.fitness, bestImprovement.fitness) < 0 || (compareFitnessQuality(ev.fitness, bestImprovement.fitness) === 0 && ev.hash.localeCompare(bestImprovement.hash) < 0))) bestImprovement = ev
    }
    if (sweepEvaluated < requiredCandidates) {
      if (bestImprovement) best = bestImprovement
      return { best, candidatesEvaluated, completed: false, requiredCandidates }
    }
    if (!bestImprovement) return { best, candidatesEvaluated, completed, requiredCandidates }
    best = bestImprovement
  }
  return { best, candidatesEvaluated, completed: false, requiredCandidates }
}

function optionalLocalImprove(players: MatchmakingPlayer[], start: EvaluatedCandidate, evalOne: EvalFn): EvaluatedCandidate {
  let best = start
  const byId = new Map(players.map((p) => [p.signupId, p]))
  const tryCandidate = (candidate: Candidate): boolean => {
    const ev = evalOne(candidate)
    if (ev && compareFitnessQuality(ev.fitness, best.fitness) < 0) { best = ev; return true }
    return false
  }
  const passAnySwap = () => {
    for (let i = 0; i < best.candidate.length; i++) for (let j = i + 1; j < best.candidate.length; j++) {
      if (best.candidate[i].team === best.candidate[j].team) continue
      const swapped = best.candidate.map((g) => ({ ...g })); [swapped[i].team, swapped[j].team] = [swapped[j].team, swapped[i].team]
      if (tryCandidate(swapped)) return true
    }
    return false
  }
  const passPositionChange = () => {
    for (let i = 0; i < best.candidate.length; i++) for (const pos of byId.get(best.candidate[i].signupId)!.eligiblePositions) {
      if (pos === best.candidate[i].position) continue
      const changed = best.candidate.map((g) => ({ ...g })); changed[i].position = pos
      if (tryCandidate(changed)) return true
    }
    return false
  }
  while (passAnySwap() || passPositionChange()) { /* restart optional neighborhoods after each substantive improvement */ }
  return best
}
