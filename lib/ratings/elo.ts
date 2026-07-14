import { MINIMUM_RATING } from "./constants"

export type RatedMatchPlayer = { positionRating: number }

export function calculateTeamRating(players: RatedMatchPlayer[]): number {
  if (players.length === 0) throw new Error("Team besitzt keine aktiven Spieler")
  return players.reduce((total, player) => total + player.positionRating, 0) / players.length
}

export function calculateExpectedScore(ownRating: number, opponentRating: number): number {
  return 1 / (1 + Math.pow(10, (opponentRating - ownRating) / 400))
}

export function getKFactor(gamesPlayed: number): number {
  if (gamesPlayed < 5) return 40
  if (gamesPlayed < 20) return 24
  return 16
}

export function calculateRatingDelta(params: { gamesPlayed: number; expectedResult: number; actualResult: number }): number {
  return Math.round(getKFactor(params.gamesPlayed) * (params.actualResult - params.expectedResult))
}

export function applyRatingDelta(oldRating: number, delta: number): number {
  return Math.max(MINIMUM_RATING, oldRating + delta)
}
