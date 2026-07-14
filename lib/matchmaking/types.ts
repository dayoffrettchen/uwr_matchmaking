import type { LineupType, PlayerPosition, TeamNumber } from "@/lib/ratings/types"

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

export type MatchmakingAssignment = { signupId: number; playerId: number; team: TeamNumber; position: PlayerPosition; lineupType: LineupType }
export type TeamSummary = { activeCount: number; substituteCount: number; averageActiveRating: number; effectiveStrength: number; positionAverages: Record<PlayerPosition, number>; confidence: number }
export type MatchmakingQuality = "high" | "medium" | "low"
export type MatchmakingResult = { assignments: MatchmakingAssignment[]; team1: TeamSummary; team2: TeamSummary; warnings: string[]; computationTimeMs: number; candidatesEvaluated: number; optimality: "exact" | "best-found"; quality: MatchmakingQuality }
