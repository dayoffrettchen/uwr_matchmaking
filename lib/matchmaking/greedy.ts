import { PLAYER_POSITIONS, type PlayerPosition, type TeamNumber } from "@/lib/ratings/types"
import { getActivePlayersPerTeamLimit } from "./rules"
import { canonicalizePlayers, type DraftAssignment } from "./candidate"
import { getFeasibleLineupTarget } from "./target-lineup"
import type { MatchmakingPlayer } from "./types"

export function getPreferenceOrder(player: MatchmakingPlayer, position: PlayerPosition): number {
  const explicitOrder = player.positionPreferences.find((entry) => entry.position === position)?.order
  if (explicitOrder) return explicitOrder
  const eligibleIndex = player.eligiblePositions.indexOf(position)
  return eligibleIndex === -1 ? PLAYER_POSITIONS.length + 1 : PLAYER_POSITIONS.length + eligibleIndex + 1
}

export function buildGreedySeed(players: MatchmakingPlayer[], options?: { reverseTeamPriority?: boolean }): DraftAssignment[] {
  const target = getFeasibleLineupTarget(players, getActivePlayersPerTeamLimit(players.length))
  const ordered = canonicalizePlayers(players).sort((a, b) => a.eligiblePositions.length - b.eligiblePositions.length || a.signupId - b.signupId)
  const drafts: DraftAssignment[] = []
  const positionCounts = { 1: { goalkeeper: 0, defender: 0, forward: 0 }, 2: { goalkeeper: 0, defender: 0, forward: 0 } } as Record<TeamNumber, Record<PlayerPosition, number>>
  const teamCounts = { 1: 0, 2: 0 } as Record<TeamNumber, number>
  const maxTeamSize = Math.ceil(players.length / 2)
  const teams = (options?.reverseTeamPriority ? [2, 1] : [1, 2]) as TeamNumber[]
  for (const p of ordered) {
    const choices: DraftAssignment[] = []
    for (const position of p.eligiblePositions) for (const team of teams) {
      if (teamCounts[team] >= maxTeamSize) continue
      const createsSubstitute = positionCounts[team][position] >= target[position]
      const teamHasCompleteStartingLineup = PLAYER_POSITIONS.every((candidate) => positionCounts[team][candidate] >= target[candidate])
      if (!createsSubstitute || teamHasCompleteStartingLineup) choices.push({ signupId: p.signupId, playerId: p.playerId, team, position })
    }
    if (choices.length === 0) for (const position of p.eligiblePositions) for (const team of teams) if (teamCounts[team] < maxTeamSize) choices.push({ signupId: p.signupId, playerId: p.playerId, team, position })
    choices.sort((a, b) => {
      const teamSizeBias = (teamCounts[a.team] - teamCounts[b.team]) * 100000
      const preferenceBias = (getPreferenceOrder(p, a.position) - getPreferenceOrder(p, b.position)) * 10000
      const overUsefulSlotsBias = (Math.max(0, positionCounts[a.team][a.position] - target[a.position]) - Math.max(0, positionCounts[b.team][b.position] - target[b.position])) * 5000
      const slotBias = (positionCounts[a.team][a.position] - positionCounts[b.team][b.position]) * 1000
      const ratingBias = p.ratings[b.position] - p.ratings[a.position]
      return teamSizeBias + preferenceBias + overUsefulSlotsBias + slotBias + ratingBias || teams.indexOf(a.team) - teams.indexOf(b.team) || a.position.localeCompare(b.position)
    })
    const chosen = choices[0]
    drafts.push(chosen); teamCounts[chosen.team]++; positionCounts[chosen.team][chosen.position]++
  }
  return drafts
}
