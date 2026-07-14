import { MAX_RATING_DELTA_IN_K_FACTORS, MINIMUM_RATING, ROTATION_BONUS_PER_SUBSTITUTE } from "./constants"
import type { LineupType } from "./types"
import { clamp } from "./utils"

export type RatedMatchPlayer = { positionRating: number; lineupType: LineupType }

export function calculateParticipantAverageRating(players: RatedMatchPlayer[]): number {
  if (players.length === 0) throw new Error("Team besitzt keine Teilnehmer")
  return players.reduce((total, player) => total + player.positionRating, 0) / players.length
}

export function calculateEffectiveTeamRating(players: RatedMatchPlayer[]): number {
  const averageRating = calculateParticipantAverageRating(players)
  const substituteCount = players.filter((player) => player.lineupType === "substitute").length
  return averageRating + substituteCount * ROTATION_BONUS_PER_SUBSTITUTE
}

export const calculateTeamRating = calculateParticipantAverageRating

export function calculateExpectedScore(ownRating: number, opponentRating: number): number {
  return 1 / (1 + Math.pow(10, (opponentRating - ownRating) / 400))
}

export function getKFactor(gamesPlayed: number): number {
  if (gamesPlayed < 5) return 40
  if (gamesPlayed < 20) return 24
  return 16
}

export function calculateRatingDelta(params: { gamesPlayed: number; expectedResult: number; actualResult: number; marginMultiplier?: number }): number {
  const kFactor = getKFactor(params.gamesPlayed)
  const rawDelta = kFactor * (params.actualResult - params.expectedResult) * (params.marginMultiplier ?? 1)
  const maximumAbsoluteDelta = kFactor * MAX_RATING_DELTA_IN_K_FACTORS
  return Math.round(clamp(rawDelta, -maximumAbsoluteDelta, maximumAbsoluteDelta))
}

export function applyRatingDelta(oldRating: number, delta: number): number {
  return Math.max(MINIMUM_RATING, oldRating + delta)
}
