import { PLAYER_POSITIONS, type PlayerPosition } from "@/lib/ratings/types"
import { buildGreedySeed } from "./greedy"
import { candidateHash, canonicalizePlayers, fromDraftAssignments, stableInputSeed, type Candidate } from "./candidate"
import { createPrng, type RandomSource } from "./random"
import { repairCandidate } from "./repair"
import { compareEvaluatedCandidates, compareFitnessQuality, evaluateCandidate, type EvaluatedCandidate } from "./fitness"
import type { MatchmakingPlayer, MatchmakingResult } from "./types"

export type GeneticOptions = { seed?: number; maxCandidates: number; maxGenerations: number; maxComputationTimeMs: number; populationSize: number }

type EvalFn = (candidate: Candidate) => EvaluatedCandidate | null

export function runGeneticOptimization(input: MatchmakingPlayer[], options: GeneticOptions, warnings: string[]): MatchmakingResult {
  const started = Date.now()
  const globalDeadlineMs = options.maxComputationTimeMs > 0 ? started + options.maxComputationTimeMs : null
  const players = canonicalizePlayers(input)
  const prng = createPrng(options.seed ?? stableInputSeed(players))
  const mandatorySamePositionReserve = estimateSamePositionSwapPairs(players)
  const requestedLocalCandidateBudget = Math.max(64, Math.ceil(options.maxCandidates * 0.25))
  const localCandidateBudget = Math.max(0, Math.min(requestedLocalCandidateBudget, options.maxCandidates - 1 - mandatorySamePositionReserve))
  const geneticCandidateBudget = options.maxCandidates > 1 ? Math.max(2, options.maxCandidates - localCandidateBudget - mandatorySamePositionReserve) : 1
  const localTimeBudgetMs = options.maxComputationTimeMs > 0 ? Math.max(25, Math.ceil(options.maxComputationTimeMs * 0.25)) : 0
  const geneticTimeBudgetMs = options.maxComputationTimeMs > 0 ? Math.max(1, options.maxComputationTimeMs - localTimeBudgetMs) : 0
  let evaluated = 0
  const seen = new Set<string>()
  const evalOne: EvalFn = (raw) => {
    if (evaluated >= geneticCandidateBudget) return null
    if ((geneticTimeBudgetMs > 0 && Date.now() - started > geneticTimeBudgetMs) || (globalDeadlineMs !== null && Date.now() > globalDeadlineMs)) return null
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
    if (compareEvaluatedCandidates(ev, best) < 0) best = ev
  }
  let population: EvaluatedCandidate[] = [greedy]
  pushEval(population, fromDraftAssignments(players, buildGreedySeed(players, { reverseTeamPriority: true })))
  pushEval(population, snake(players))
  for (const pos of PLAYER_POSITIONS) pushEval(population, byPosition(players, pos))
  for (const candidate of enumerateSmallRosterCandidates(players)) pushEval(population, candidate)
  fillPopulation(population, options.populationSize, () => randomCandidate(players, prng), pushEval, () => evaluated, geneticCandidateBudget, started, geneticTimeBudgetMs)
  for (let i = 0; i < Math.min(12, options.populationSize); i++) pushEval(population, mutate(players, greedy.candidate, prng, best))

  for (let gen = 0; gen < options.maxGenerations && evaluated < geneticCandidateBudget; gen++) {
    population.sort(compareEvaluatedCandidates)
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
      geneticCandidateBudget,
      started,
      geneticTimeBudgetMs,
    )
    population = next
  }
  const remainingAfterGenetic = Math.max(0, options.maxCandidates - evaluated)
  const mandatory = runMandatorySamePositionLocalSearch(players, best, { maxCandidates: remainingAfterGenetic, deadlineMs: globalDeadlineMs })
  best = mandatory.best
  let localEvaluated = 0
  const localStarted = Date.now()
  let localCompleted = true
  const evalLocal: EvalFn = (raw) => {
    if (localEvaluated >= localCandidateBudget) { localCompleted = false; return null }
    if ((localTimeBudgetMs > 0 && Date.now() - localStarted > localTimeBudgetMs) || (globalDeadlineMs !== null && Date.now() > globalDeadlineMs)) { localCompleted = false; return null }
    const result = evaluateCandidate(players, raw, candidateHash(raw))
    if (result) localEvaluated++
    return result
  }
  best = optionalLocalImprove(players, best, evalLocal)
  if (!mandatory.completed) warnings.push("Die verpflichtende gleiche-Position-Wechselsuche konnte nicht vollständig abgeschlossen werden.")
  if (compareEvaluatedCandidates(best, greedy) > 0) best = greedy
  warnings.push(...best.warnings)
  return { assignments: best.assignments, rotationGroups: best.rotationGroups, team1: best.team1, team2: best.team2, warnings: [], computationTimeMs: Date.now() - started, candidatesEvaluated: options.maxCandidates <= 0 ? 1 : Math.min(options.maxCandidates, evaluated + mandatory.candidatesEvaluated + localEvaluated), optimality: "best-found", quality: "medium", diagnostics: { effectiveStrengthDifference: best.fitness.effectiveStrengthDifference, startingLineupDifference: best.fitness.startingLineupDifference, positionStrengthDifference: best.fitness.positionStrengthDifference, targetLineupPenalty: best.fitness.targetLineupPenalty, mandatorySamePositionCandidates: mandatory.candidatesEvaluated, mandatorySamePositionCompleted: mandatory.completed, optionalLocalCandidates: localEvaluated, optionalLocalCompleted: localCompleted, mandatorySamePositionRequiredCandidates: mandatory.requiredCandidates, mandatorySamePositionAttempted: mandatory.attempted, optionalLocalAttempted: localEvaluated > 0, mandatorySamePositionSweepsStarted: mandatory.sweepsStarted, mandatorySamePositionSweepsCompleted: mandatory.sweepsCompleted } }
}

function estimateSamePositionSwapPairs(players: MatchmakingPlayer[]): number {
  return PLAYER_POSITIONS.reduce((sum, position) => {
    const count = players.filter((player) => player.eligiblePositions.includes(position)).length
    const team1 = Math.ceil(count / 2)
    const team2 = Math.floor(count / 2)
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
export type SamePositionLocalSearchResult = { best: EvaluatedCandidate; candidatesEvaluated: number; requiredCandidates: number; completed: boolean; attempted: boolean; sweepsStarted: number; sweepsCompleted: number }

type SamePositionLocalSearchOptions = { safetyPassLimit?: number; maxCandidates?: number; deadlineMs?: number | null }

export function countSamePositionSwapPairs(candidate: Candidate): number {
  let count = 0
  for (let i = 0; i < candidate.length; i++) for (let j = i + 1; j < candidate.length; j++) {
    if (candidate[i].team !== candidate[j].team && candidate[i].position === candidate[j].position) count++
  }
  return count
}

export function runMandatorySamePositionLocalSearch(players: MatchmakingPlayer[], start: EvaluatedCandidate, options: SamePositionLocalSearchOptions | number = {}): SamePositionLocalSearchResult {
  const safetyPassLimit = typeof options === "number" ? options : options.safetyPassLimit ?? 30
  const maxCandidates = typeof options === "number" ? Number.POSITIVE_INFINITY : options.maxCandidates ?? Number.POSITIVE_INFINITY
  const deadlineMs = typeof options === "number" ? null : options.deadlineMs ?? null
  let best = start
  let candidatesEvaluated = 0
  let requiredCandidates = 0
  let sweepsStarted = 0
  let sweepsCompleted = 0
  for (let pass = 0; pass < safetyPassLimit; pass++) {
    const sweepRequired = countSamePositionSwapPairs(best.candidate)
    requiredCandidates += sweepRequired
    sweepsStarted++
    if (sweepRequired > 0 && (candidatesEvaluated >= maxCandidates || (deadlineMs !== null && Date.now() > deadlineMs))) return { best, candidatesEvaluated, requiredCandidates, completed: false, attempted: candidatesEvaluated > 0, sweepsStarted, sweepsCompleted }
    let bestImprovement: EvaluatedCandidate | null = null
    for (let i = 0; i < best.candidate.length; i++) for (let j = i + 1; j < best.candidate.length; j++) {
      const left = best.candidate[i], right = best.candidate[j]
      if (left.team === right.team || left.position !== right.position) continue
      if (candidatesEvaluated >= maxCandidates || (deadlineMs !== null && Date.now() > deadlineMs)) return { best, candidatesEvaluated, requiredCandidates, completed: false, attempted: candidatesEvaluated > 0, sweepsStarted, sweepsCompleted }
      const swapped = best.candidate.map((g) => ({ ...g })); [swapped[i].team, swapped[j].team] = [swapped[j].team, swapped[i].team]
      const ev = evaluateCandidate(players, swapped, candidateHash(swapped))
      if (!ev) continue
      candidatesEvaluated++
      if (compareFitnessQuality(ev.fitness, best.fitness) < 0 && (!bestImprovement || compareFitnessQuality(ev.fitness, bestImprovement.fitness) < 0 || (compareFitnessQuality(ev.fitness, bestImprovement.fitness) === 0 && ev.hash.localeCompare(bestImprovement.hash) < 0))) bestImprovement = ev
    }
    sweepsCompleted++
    if (!bestImprovement) return { best, candidatesEvaluated, requiredCandidates, completed: true, attempted: candidatesEvaluated > 0, sweepsStarted, sweepsCompleted }
    best = bestImprovement
  }
  return { best, candidatesEvaluated, requiredCandidates, completed: false, attempted: candidatesEvaluated > 0, sweepsStarted, sweepsCompleted }
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
