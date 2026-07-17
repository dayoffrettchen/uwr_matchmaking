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
  const players = canonicalizePlayers(input)
  const prng = createPrng(options.seed ?? stableInputSeed(players))
  const maxCandidates = Math.max(0, options.maxCandidates)
  const budgetPlan = planSearchBudgets(players.length, maxCandidates)
  const { geneticCandidateBudget } = budgetPlan
  const globalDeadline = options.maxComputationTimeMs > 0 ? started + options.maxComputationTimeMs : null
  const geneticDeadline = globalDeadline === null ? null : started + Math.floor(options.maxComputationTimeMs * 0.7)
  let geneticEvaluated = 0
  let mandatoryEvaluated = 0
  let optionalEvaluated = 0
  const seen = new Set<string>()
  const canStart = (deadline: number | null) => deadline === null || now() < deadline
  const evalOne: EvalFn = (raw) => {
    if (geneticEvaluated >= geneticCandidateBudget || !canStart(geneticDeadline)) return null
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
  geneticEvaluated = Math.max(geneticEvaluated, 1)
  seen.add(greedy.hash)
  let best = greedy
  const pushEval = (arr: EvaluatedCandidate[], c: Candidate) => {
    if (!canStart(geneticDeadline) || geneticEvaluated >= geneticCandidateBudget) return
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
  for (const pos of PLAYER_POSITIONS) { if (!canStart(geneticDeadline) || geneticEvaluated >= geneticCandidateBudget) break; pushEval(population, byPosition(players, pos)) }
  for (const candidate of enumerateSmallRosterCandidates(players, () => !canStart(geneticDeadline) || geneticEvaluated >= geneticCandidateBudget, geneticCandidateBudget)) pushEval(population, candidate)
  fillPopulation(population, options.populationSize, () => randomCandidate(players, prng), pushEval, () => geneticEvaluated, geneticCandidateBudget, geneticDeadline, now)
  for (let i = 0; i < Math.min(12, options.populationSize) && canStart(geneticDeadline) && geneticEvaluated < geneticCandidateBudget; i++) pushEval(population, mutate(players, greedy.candidate, prng, best))
  for (let gen = 0; gen < options.maxGenerations && geneticEvaluated < geneticCandidateBudget && canStart(geneticDeadline); gen++) {
    population.sort((a, b) => compareBreakdowns(a.fitness, b.fitness, a.hash, b.hash))
    const next = [greedy, best, ...population.slice(0, 4)].filter((v, i, a) => a.findIndex((x) => x.hash === v.hash) === i)
    fillPopulation(next, options.populationSize, () => { const a = tournament(population, prng), b = tournament(population, prng); let child = crossover(a.candidate, b.candidate, prng); if (prng.chance(0.85)) child = mutate(players, child, prng, best); return child }, pushEval, () => geneticEvaluated, geneticCandidateBudget, geneticDeadline, now)
    population = next
  }
  const firstSweepRequiredCandidates = countSamePositionSwapPairs(best.candidate)
  let mandatory: SamePositionLocalSearchResult = { best, candidatesEvaluated: 0, firstSweepRequiredCandidates, requiredCandidates: firstSweepRequiredCandidates, completed: firstSweepRequiredCandidates === 0, attempted: false, sweepsStarted: 0, sweepsCompleted: 0 }
  if (maxCandidates > 0) {
    const evalMandatory: EvalFn = (raw) => {
      if (geneticEvaluated + mandatoryEvaluated + optionalEvaluated >= maxCandidates || !canStart(globalDeadline)) return null
      const ev = evaluateCandidate(players, raw, candidateHash(raw))
      if (ev) mandatoryEvaluated++
      return ev
    }
    mandatory = runMandatorySamePositionLocalSearch(players, best, 30, evalMandatory)
    best = mandatory.best
  }
  let optional: OptionalLocalSearchResult = { best, completed: false, attempted: false }
  if (maxCandidates > 0 && canStart(globalDeadline) && geneticEvaluated + mandatoryEvaluated + optionalEvaluated < maxCandidates) {
    const evalOptional: EvalFn = (raw) => {
      if (geneticEvaluated + mandatoryEvaluated + optionalEvaluated >= maxCandidates || !canStart(globalDeadline)) return null
      const result = evaluateCandidate(players, raw, candidateHash(raw))
      if (result) optionalEvaluated++
      return result
    }
    optional = optionalLocalImprove(players, best, evalOptional)
    best = optional.best
  }
  if (!mandatory.completed && (mandatory.attempted || maxCandidates > 0)) warnings.push("Die verpflichtende gleiche-Position-Wechselsuche konnte nicht vollständig abgeschlossen werden.")
  if (!optional.completed && optional.attempted) warnings.push("Die optionale lokale Suche konnte nicht vollständig abgeschlossen werden.")
  if (compareBreakdowns(best.fitness, greedy.fitness, best.hash, greedy.hash) > 0) best = greedy
  warnings.push(...best.warnings)
  const totalCandidates = geneticEvaluated + mandatoryEvaluated + optionalEvaluated
  return { assignments: best.assignments, rotationGroups: best.rotationGroups, team1: best.team1, team2: best.team2, warnings, computationTimeMs: now() - started, candidatesEvaluated: totalCandidates, optimality: "best-found", quality: "medium", diagnostics: { geneticCandidateBudget: budgetPlan.geneticCandidateBudget, mandatorySamePositionReservedCandidates: budgetPlan.mandatoryFirstSweepReserve, optionalLocalReservedCandidates: budgetPlan.optionalLocalReserve, effectiveStrengthDifference: best.fitness.effectiveStrengthDifference, startingLineupDifference: best.fitness.startingLineupDifference, positionStrengthDifference: best.fitness.positionStrengthDifference, targetLineupPenalty: best.fitness.targetLineupPenalty, geneticCandidates: geneticEvaluated, mandatorySamePositionCandidates: mandatoryEvaluated, mandatorySamePositionFirstSweepRequiredCandidates: mandatory.firstSweepRequiredCandidates, mandatorySamePositionRequiredCandidates: mandatory.requiredCandidates, mandatorySamePositionCompleted: mandatory.completed, mandatorySamePositionAttempted: mandatory.attempted, mandatorySamePositionSweepsStarted: mandatory.sweepsStarted, mandatorySamePositionSweepsCompleted: mandatory.sweepsCompleted, optionalLocalCandidates: optionalEvaluated, optionalLocalCompleted: optional.completed, optionalLocalAttempted: optional.attempted, totalCandidates } }
}

export type SearchBudgetPlan = { maxCandidates: number; geneticCandidateBudget: number; mandatoryFirstSweepReserve: number; optionalLocalReserve: number }

export function planSearchBudgets(playerCount: number, maxCandidates: number): SearchBudgetPlan {
  const normalizedMax = Math.max(0, maxCandidates)
  if (normalizedMax === 0) return { maxCandidates: 0, geneticCandidateBudget: 1, mandatoryFirstSweepReserve: 0, optionalLocalReserve: 0 }
  const minimumGeneticBudget = normalizedMax > 1 ? 2 : 1
  const mandatoryUpperBound = Math.floor((playerCount * playerCount) / 4)
  const desiredOptionalReserve = normalizedMax >= 100 ? Math.min(64, Math.floor(normalizedMax * 0.1)) : 0
  const optionalLocalReserve = Math.min(desiredOptionalReserve, Math.max(0, normalizedMax - minimumGeneticBudget - mandatoryUpperBound))
  const mandatoryFirstSweepReserve = Math.min(mandatoryUpperBound, Math.max(0, normalizedMax - minimumGeneticBudget - optionalLocalReserve))
  const geneticCandidateBudget = normalizedMax - mandatoryFirstSweepReserve - optionalLocalReserve
  return { maxCandidates: normalizedMax, geneticCandidateBudget, mandatoryFirstSweepReserve, optionalLocalReserve }
}

function fillPopulation(
  population: EvaluatedCandidate[],
  targetSize: number,
  createCandidate: () => Candidate,
  pushEval: (arr: EvaluatedCandidate[], c: Candidate) => void,
  getEvaluated: () => number,
  maxCandidates: number,
  deadline: number | null,
  now: () => number = Date.now,
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

function enumerateSmallRosterCandidates(players: MatchmakingPlayer[], shouldStop: () => boolean = () => false, maxOutput = 20_000): Candidate[] {
  if (players.length > 10) return []
  const targetTeam1Size = Math.ceil(players.length / 2)
  const candidates: Candidate[] = []
  const current: Candidate = []

  function visit(index: number, team1Count: number) {
    if (shouldStop() || candidates.length >= maxOutput) return
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
        if (shouldStop() || candidates.length >= maxOutput) return
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
export function countSamePositionSwapPairs(candidate: Candidate): number {
  return PLAYER_POSITIONS.reduce((sum, position) => {
    const team1 = candidate.filter((gene) => gene.team === 1 && gene.position === position).length
    const team2 = candidate.filter((gene) => gene.team === 2 && gene.position === position).length
    return sum + team1 * team2
  }, 0)
}

export type SamePositionLocalSearchResult = { best: EvaluatedCandidate; candidatesEvaluated: number; firstSweepRequiredCandidates: number; requiredCandidates: number; completed: boolean; attempted: boolean; sweepsStarted: number; sweepsCompleted: number }
type OptionalLocalSearchResult = { best: EvaluatedCandidate; completed: boolean; attempted: boolean }

export function runMandatorySamePositionLocalSearch(players: MatchmakingPlayer[], start: EvaluatedCandidate, safetyPassLimit = 30, evalOne?: EvalFn): SamePositionLocalSearchResult {
  let best = start
  let candidatesEvaluated = 0
  let requiredCandidates = 0
  let sweepsStarted = 0
  let sweepsCompleted = 0
  const firstSweepRequiredCandidates = countSamePositionSwapPairs(best.candidate)
  const evaluate = evalOne ?? ((raw: Candidate) => evaluateCandidate(players, raw, candidateHash(raw)))
  if (firstSweepRequiredCandidates === 0) return { best, candidatesEvaluated, firstSweepRequiredCandidates, requiredCandidates, completed: true, attempted: false, sweepsStarted, sweepsCompleted }
  for (let pass = 0; pass < safetyPassLimit; pass++) {
    const sweepRequired = countSamePositionSwapPairs(best.candidate)
    if (sweepRequired === 0) return { best, candidatesEvaluated, firstSweepRequiredCandidates, requiredCandidates, completed: true, attempted: candidatesEvaluated > 0, sweepsStarted, sweepsCompleted }
    requiredCandidates += sweepRequired
    sweepsStarted++
    let sweepEvaluated = 0
    let bestImprovement: EvaluatedCandidate | null = null
    for (let i = 0; i < best.candidate.length; i++) for (let j = i + 1; j < best.candidate.length; j++) {
      const left = best.candidate[i], right = best.candidate[j]
      if (left.team === right.team || left.position !== right.position) continue
      const swapped = best.candidate.map((g) => ({ ...g })); [swapped[i].team, swapped[j].team] = [swapped[j].team, swapped[i].team]
      const ev = evaluate(swapped)
      if (!ev) { if (bestImprovement) best = bestImprovement; return { best, candidatesEvaluated, firstSweepRequiredCandidates, requiredCandidates, completed: false, attempted: candidatesEvaluated > 0, sweepsStarted, sweepsCompleted } }
      candidatesEvaluated++; sweepEvaluated++
      if (compareFitnessQuality(ev.fitness, best.fitness) < 0 && (!bestImprovement || compareFitnessQuality(ev.fitness, bestImprovement.fitness) < 0 || (compareFitnessQuality(ev.fitness, bestImprovement.fitness) === 0 && ev.hash.localeCompare(bestImprovement.hash) < 0))) bestImprovement = ev
    }
    if (sweepEvaluated !== sweepRequired) { if (bestImprovement) best = bestImprovement; return { best, candidatesEvaluated, firstSweepRequiredCandidates, requiredCandidates, completed: false, attempted: candidatesEvaluated > 0, sweepsStarted, sweepsCompleted } }
    sweepsCompleted++
    if (!bestImprovement) return { best, candidatesEvaluated, firstSweepRequiredCandidates, requiredCandidates, completed: true, attempted: true, sweepsStarted, sweepsCompleted }
    best = bestImprovement
  }
  return { best, candidatesEvaluated, firstSweepRequiredCandidates, requiredCandidates, completed: false, attempted: candidatesEvaluated > 0, sweepsStarted, sweepsCompleted }
}

function optionalLocalImprove(players: MatchmakingPlayer[], start: EvaluatedCandidate, evalOne: EvalFn): OptionalLocalSearchResult {
  let best = start, attempted = false, completed = true, halted = false
  const byId = new Map(players.map((p) => [p.signupId, p]))
  const tryCandidate = (candidate: Candidate): boolean => { attempted = true; const ev = evalOne(candidate); if (!ev) { completed = false; halted = true; return false }; if (compareFitnessQuality(ev.fitness, best.fitness) < 0) { best = ev; return true }; return false }
  const passAnySwap = () => { for (let i = 0; i < best.candidate.length; i++) for (let j = i + 1; j < best.candidate.length; j++) { if (best.candidate[i].team === best.candidate[j].team) continue; const swapped = best.candidate.map((g) => ({ ...g })); [swapped[i].team, swapped[j].team] = [swapped[j].team, swapped[i].team]; if (tryCandidate(swapped) || halted) return !halted } return false }
  const passPositionChange = () => { for (let i = 0; i < best.candidate.length; i++) for (const pos of byId.get(best.candidate[i].signupId)!.eligiblePositions) { if (pos === best.candidate[i].position) continue; const changed = best.candidate.map((g) => ({ ...g })); changed[i].position = pos; if (tryCandidate(changed) || halted) return !halted } return false }
  while (!halted) { if (passAnySwap()) continue; if (halted) break; if (passPositionChange()) continue; break }
  return { best, completed, attempted }
}
