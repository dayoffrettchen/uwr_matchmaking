import {
  DOMINANCE_BASE_FACTOR,
  DOMINANCE_RATIO_FACTOR,
  FAVORITE_ADJUSTMENT_STRENGTH,
  MARGIN_LOG_FACTOR,
  MAX_FAVORITE_FACTOR,
  MAX_MARGIN_MULTIPLIER,
  MAX_RATING_GOAL_DIFFERENCE,
  MIN_FAVORITE_FACTOR,
} from "./constants"
import { clamp } from "./utils"

export type MarginMultiplierInput = {
  team1Score: number
  team2Score: number
  expectedTeam1: number
}

export function calculateMarginMultiplier({ team1Score, team2Score, expectedTeam1 }: MarginMultiplierInput): number {
  if (team1Score === team2Score) return 1

  const goalDifference = Math.abs(team1Score - team2Score)
  if (goalDifference <= 1) return 1

  const team1Won = team1Score > team2Score
  const winnerExpectedScore = team1Won ? expectedTeam1 : 1 - expectedTeam1
  const cappedGoalDifference = Math.min(goalDifference, MAX_RATING_GOAL_DIFFERENCE)
  const totalGoals = team1Score + team2Score
  const dominanceRatio = goalDifference / Math.max(1, totalGoals)
  const dominanceWeight = DOMINANCE_BASE_FACTOR + dominanceRatio * DOMINANCE_RATIO_FACTOR
  const favoriteFactor = clamp(
    1 + (0.5 - winnerExpectedScore) * FAVORITE_ADJUSTMENT_STRENGTH,
    MIN_FAVORITE_FACTOR,
    MAX_FAVORITE_FACTOR,
  )
  const marginExtra = MARGIN_LOG_FACTOR * Math.log2(cappedGoalDifference) * dominanceWeight * favoriteFactor

  return clamp(1 + marginExtra, 1, MAX_MARGIN_MULTIPLIER)
}
