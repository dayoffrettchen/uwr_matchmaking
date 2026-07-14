export const MAX_COMPUTATION_TIME_MS = 250
export const MAX_CANDIDATES = 10_000

export const MAX_ACTIVE_PLAYERS_PER_TEAM = 6

export const MAX_ACTIVE_PLAYERS_VIOLATION = 1_000_000
export const MISSING_ACTIVE_SLOT_PENALTY = 1_000_000
export const INVALID_ROTATION_GROUP_PENALTY = 1_000_000
export const INVALID_STARTING_COUNT_PENALTY = 1_000_000

export const TEAM_EFFECTIVE_STRENGTH_WEIGHT = 10
export const STARTING_LINEUP_STRENGTH_WEIGHT = 8
export const POSITION_STRENGTH_WEIGHT = 6
export const ROTATION_GROUP_MATCH_WEIGHT = 6
export const ROTATION_SPREAD_WEIGHT = 3
export const POSITION_PREFERENCE_WEIGHT = 20

export const OBJECTIVE_WEIGHTS = {
  activePlayerCountDifference: 100_000,
  positionCountDifference: 10_000,
  invalidPositionPenalty: 100_000,
  activeTeamRatingDifference: TEAM_EFFECTIVE_STRENGTH_WEIGHT,
  goalkeeperRatingDifference: POSITION_STRENGTH_WEIGHT,
  defenderRatingDifference: POSITION_STRENGTH_WEIGHT,
  forwardRatingDifference: POSITION_STRENGTH_WEIGHT,
  confidenceDifference: 20,
  unratedPlayerDifference: 30,
  substituteAdvantagePenalty: 10,
  rotationGroupMatchDifference: ROTATION_GROUP_MATCH_WEIGHT,
  rotationSpread: ROTATION_SPREAD_WEIGHT,
  positionPreference: POSITION_PREFERENCE_WEIGHT,
} as const
