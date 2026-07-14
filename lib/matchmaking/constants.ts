export const MAX_COMPUTATION_TIME_MS = 250
export const MAX_CANDIDATES = 10_000
export const OBJECTIVE_WEIGHTS = {
  activePlayerCountDifference: 100_000,
  positionCountDifference: 10_000,
  invalidPositionPenalty: 100_000,
  activeTeamRatingDifference: 10,
  goalkeeperRatingDifference: 6,
  defenderRatingDifference: 5,
  forwardRatingDifference: 5,
  confidenceDifference: 20,
  unratedPlayerDifference: 30,
  substituteAdvantagePenalty: 10,
} as const
