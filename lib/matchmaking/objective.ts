import { PLAYER_POSITIONS } from "@/lib/ratings/types"
import { OBJECTIVE_WEIGHTS } from "./constants"
import type { MatchmakingAssignment, MatchmakingPlayer } from "./types"

export function getPositionPenalty(player: MatchmakingPlayer, position: string): number {
  const pref = player.positionPreferences.find((entry) => entry.position === position)
  if (!pref) return Number.POSITIVE_INFINITY
  if (pref.order === 1) return 0
  if (pref.order === 2) return 20
  return 40
}

export function scoreAssignments(players: MatchmakingPlayer[], assignments: MatchmakingAssignment[], target: Record<string, number>): number {
  const byId = new Map(players.map((p) => [p.signupId, p]))
  const active = assignments.filter((a) => a.lineupType === "active")
  const team = (n: 1 | 2) => active.filter((a) => a.team === n)
  const rating = (items: MatchmakingAssignment[]) => items.reduce((sum, a) => sum + (byId.get(a.signupId)?.ratings[a.position] ?? 1000), 0) / Math.max(1, items.length)
  let score = Math.abs(team(1).length - team(2).length) * OBJECTIVE_WEIGHTS.activePlayerCountDifference
  score += Math.abs(rating(team(1)) - rating(team(2))) * OBJECTIVE_WEIGHTS.activeTeamRatingDifference
  for (const position of PLAYER_POSITIONS) {
    const diff = Math.abs(team(1).filter((a) => a.position === position).length - target[position]) + Math.abs(team(2).filter((a) => a.position === position).length - target[position])
    score += diff * OBJECTIVE_WEIGHTS.positionCountDifference
    const r1 = rating(team(1).filter((a) => a.position === position))
    const r2 = rating(team(2).filter((a) => a.position === position))
    score += Math.abs(r1 - r2) * (position === "goalkeeper" ? OBJECTIVE_WEIGHTS.goalkeeperRatingDifference : position === "defender" ? OBJECTIVE_WEIGHTS.defenderRatingDifference : OBJECTIVE_WEIGHTS.forwardRatingDifference)
  }
  for (const a of assignments) score += getPositionPenalty(byId.get(a.signupId)!, a.position)
  return score
}
