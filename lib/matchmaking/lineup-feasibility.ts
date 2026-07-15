import { PLAYER_POSITIONS, type PlayerPosition } from "@/lib/ratings/types"
import type { MatchmakingPlayer } from "./types"

export type LineupTarget = Record<PlayerPosition, number>

const POSITION_TIE_BREAK: Record<PlayerPosition, number> = { goalkeeper: 0, defender: 1, forward: 2 }
const FULL_TARGET: LineupTarget = { goalkeeper: 2, defender: 2, forward: 2 }

export function targetTotal(target: LineupTarget): number {
  return PLAYER_POSITIONS.reduce((sum, position) => sum + target[position], 0)
}

export function getNominalLineupTarget(activePlayersPerTeam: number): LineupTarget {
  const limit = Math.max(0, Math.min(6, Math.floor(activePlayersPerTeam)))
  const target: LineupTarget = { goalkeeper: 0, defender: 0, forward: 0 }
  for (let assigned = 0; assigned < limit; assigned++) {
    const position = [...PLAYER_POSITIONS]
      .filter((candidate) => target[candidate] < FULL_TARGET[candidate])
      .sort((a, b) => target[a] - target[b] || POSITION_TIE_BREAK[a] - POSITION_TIE_BREAK[b])[0]
    if (!position) break
    target[position]++
  }
  return target
}

export function compareLineupTargets(a: LineupTarget, b: LineupTarget): number {
  const totalDiff = targetTotal(b) - targetTotal(a)
  if (totalDiff !== 0) return totalDiff
  const deviation = (target: LineupTarget) => PLAYER_POSITIONS.reduce((sum, position) => sum + Math.abs(FULL_TARGET[position] - target[position]), 0)
  const deviationDiff = deviation(a) - deviation(b)
  if (deviationDiff !== 0) return deviationDiff
  const spread = (target: LineupTarget) => Math.max(...PLAYER_POSITIONS.map((position) => target[position])) - Math.min(...PLAYER_POSITIONS.map((position) => target[position]))
  const spreadDiff = spread(a) - spread(b)
  if (spreadDiff !== 0) return spreadDiff
  const represented = (target: LineupTarget) => PLAYER_POSITIONS.filter((position) => target[position] > 0).length
  const representedDiff = represented(b) - represented(a)
  if (representedDiff !== 0) return representedDiff
  for (const position of PLAYER_POSITIONS) {
    const diff = b[position] - a[position]
    if (diff !== 0) return diff
  }
  return 0
}

export function isLineupTargetDistinctlyMatchable(players: MatchmakingPlayer[], target: LineupTarget): boolean {
  const slots = ([1, 2] as const).flatMap((team) => PLAYER_POSITIONS.flatMap((position) => Array.from({ length: target[position] }, (_, index) => `${team}-${position}-${index}` as const)))
  const slotPositions = slots.map((slot) => slot.split("-")[1] as PlayerPosition)
  const orderedPlayers = [...players].sort((a, b) => a.eligiblePositions.length - b.eligiblePositions.length || a.signupId - b.signupId)
  const matchForSlot = new Array<number>(slots.length).fill(-1)

  function assign(playerIndex: number, seen: boolean[]): boolean {
    const player = orderedPlayers[playerIndex]
    const eligibleSlots = slotPositions
      .map((position, slotIndex) => ({ position, slotIndex }))
      .filter(({ position }) => player.eligiblePositions.includes(position))
      .sort((a, b) => POSITION_TIE_BREAK[a.position] - POSITION_TIE_BREAK[b.position] || a.slotIndex - b.slotIndex)
    for (const { slotIndex } of eligibleSlots) {
      if (seen[slotIndex]) continue
      seen[slotIndex] = true
      if (matchForSlot[slotIndex] === -1 || assign(matchForSlot[slotIndex], seen)) {
        matchForSlot[slotIndex] = playerIndex
        return true
      }
    }
    return false
  }

  let matched = 0
  for (let playerIndex = 0; playerIndex < orderedPlayers.length && matched < slots.length; playerIndex++) {
    if (assign(playerIndex, new Array<boolean>(slots.length).fill(false))) matched++
  }
  return matched === slots.length
}

export function getFeasibleLineupTarget(players: MatchmakingPlayer[], activePlayersPerTeam: number): LineupTarget {
  const limit = Math.max(0, Math.min(6, Math.floor(activePlayersPerTeam)))
  let best: LineupTarget = { goalkeeper: 0, defender: 0, forward: 0 }
  for (let goalkeeper = 0; goalkeeper <= 2; goalkeeper++) for (let defender = 0; defender <= 2; defender++) for (let forward = 0; forward <= 2; forward++) {
    const candidate: LineupTarget = { goalkeeper, defender, forward }
    if (targetTotal(candidate) > limit) continue
    if (!isLineupTargetDistinctlyMatchable(players, candidate)) continue
    if (compareLineupTargets(candidate, best) < 0) best = candidate
  }
  return best
}
