import type { RatingStatus } from "./types"

export function getRatingStatus(gamesPlayed: number): RatingStatus {
  if (gamesPlayed < 5) return "unrated"
  if (gamesPlayed < 15) return "provisional"
  return "established"
}

export function getRatingConfidence(gamesPlayed: number): number {
  return Math.min(1, Math.max(0, gamesPlayed) / 15)
}

export function getRatingStatusLabel(gamesPlayed: number): string {
  const status = getRatingStatus(gamesPlayed)
  if (status === "unrated") return "Noch nicht eingestuft"
  if (status === "provisional") return "Vorläufig"
  return "Eingestuft"
}
