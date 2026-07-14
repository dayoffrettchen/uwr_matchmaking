export type PlayerPosition = "goalkeeper" | "defender" | "forward"
export type RatingStatus = "unrated" | "provisional" | "established"
export type LineupType = "active" | "substitute"
export type TeamNumber = 1 | 2

export const PLAYER_POSITIONS: PlayerPosition[] = ["goalkeeper", "defender", "forward"]
export const POSITION_LABELS: Record<PlayerPosition, string> = {
  goalkeeper: "Torwart",
  defender: "Verteidiger",
  forward: "Stürmer",
}
