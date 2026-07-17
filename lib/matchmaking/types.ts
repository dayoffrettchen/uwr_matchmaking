import type { LineupType, PlayerPosition, TeamNumber } from "@/lib/ratings/types"

export type RotationGroupType = "single" | "pair" | "triple" | "position"

export type MatchmakingPlayer = {
  signupId: number
  playerId: number
  name: string
  eligiblePositions: PlayerPosition[]
  positionPreferences: Array<{ position: PlayerPosition; order: number }>
  ratings: Record<PlayerPosition, number>
  gamesPlayed: Record<PlayerPosition, number>
  confidence: Record<PlayerPosition, number>
}

export type MatchmakingAssignment = {
  signupId: number
  playerId: number
  team: TeamNumber
  position: PlayerPosition
  rotationGroupId: number
  rotationGroupType: RotationGroupType
  rotationOrder: number
  startsInWater: boolean
  lineupType: LineupType
}

export type RotationStep = {
  incomingSignupId: number
  outgoingSignupId: number
}

export type RotationGroupMember = {
  signupId: number
  playerId: number
  name: string
  rating: number
  rotationOrder: number
  startsInWater: boolean
}

export type RotationGroup = {
  id: number
  team: TeamNumber
  position: PlayerPosition
  type: RotationGroupType
  activeSlotCount: 1 | 2
  members: RotationGroupMember[]
  averageMemberRating: number
  effectiveRating: number
  ratingSpread: number
  activePairRatings?: number[]
  rotationSteps?: RotationStep[]
}

export type TeamSummary = {
  activeCount: number
  substituteCount: number
  averageParticipantRating: number
  rotationBonus: number
  effectiveStrength: number
  startingLineupStrength: number
  positionAverages: Record<PlayerPosition, number>
  confidence: number
}
export type MatchmakingQuality = "high" | "medium" | "low"
export type MatchmakingDiagnostics = {
  effectiveStrengthDifference: number
  startingLineupDifference: number
  positionStrengthDifference: number
  targetLineupPenalty: number
  /** Planned successful candidate evaluations reserved for the genetic phase. */
  geneticCandidateBudget: number
  /** Planned reserve for the exact first same-position cross-team mandatory sweep. */
  mandatorySamePositionReservedCandidates: number
  /** Planned reserve for optional local search after minimum genetic and mandatory reserves. */
  optionalLocalReservedCandidates: number
  geneticCandidates: number
  mandatorySamePositionCandidates: number
  mandatorySamePositionFirstSweepRequiredCandidates: number
  mandatorySamePositionRequiredCandidates: number
  mandatorySamePositionCompleted: boolean
  mandatorySamePositionAttempted: boolean
  mandatorySamePositionSweepsStarted: number
  mandatorySamePositionSweepsCompleted: number
  optionalLocalCandidates: number
  optionalLocalCompleted: boolean
  optionalLocalAttempted: boolean
  totalCandidates: number
}
export type MatchmakingResult = { assignments: MatchmakingAssignment[]; rotationGroups: RotationGroup[]; team1: TeamSummary; team2: TeamSummary; warnings: string[]; computationTimeMs: number; candidatesEvaluated: number; optimality: "exact" | "best-found"; quality: MatchmakingQuality; diagnostics?: MatchmakingDiagnostics }
