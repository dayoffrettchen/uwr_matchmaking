export const MAX_COMPUTATION_TIME_MS = 250
export const MAX_CANDIDATES = 10_000

export { MAX_ACTIVE_PLAYERS_PER_TEAM } from "./rules"

export const MAX_ACTIVE_PLAYERS_VIOLATION = 1_000_000
export const MISSING_ACTIVE_SLOT_PENALTY = 1_000_000
export const INVALID_ROTATION_GROUP_PENALTY = 1_000_000
export const INVALID_STARTING_COUNT_PENALTY = 1_000_000

export const POSITION_PREFERENCE_PENALTIES = {
  main: 0,
  secondaryRank2: 40,
  secondaryRank3: 120,
  eligibleUnranked: 180,
  ineligible: 1_000_000,
} as const

export const MATCHMAKING_QUALITY_THRESHOLDS = {
  highMaximumStrengthDifference: 25,
  lowAboveStrengthDifference: 80,
  maximumUnstableFraction: 1 / 3,
} as const

export const GENETIC_TIME_SHARE = 0.7
export const OPTIONAL_LOCAL_CANDIDATE_SHARE = 0.1
export const MAX_OPTIONAL_LOCAL_CANDIDATES = 64

export const TEAM_EFFECTIVE_STRENGTH_WEIGHT = 100
export const STARTING_LINEUP_STRENGTH_WEIGHT = 8
export const POSITION_STRENGTH_WEIGHT = 6
export const ROTATION_GROUP_MATCH_WEIGHT = 6
export const ROTATION_SPREAD_WEIGHT = 3
export const POSITION_PREFERENCE_WEIGHT = 200

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
  positionCrowdingPenalty: 50_000,
  rotationSpread: ROTATION_SPREAD_WEIGHT,
  positionPreference: POSITION_PREFERENCE_WEIGHT,
} as const
