import { PLAYER_POSITIONS, type PlayerPosition } from "@/lib/ratings/types"

export const TEAM_NUMBERS = [1, 2] as const

export const MAX_ACTIVE_PLAYERS_PER_TEAM = 6

export const ACTIVE_SLOTS_PER_POSITION = {
  goalkeeper: 2,
  defender: 2,
  forward: 2,
} as const satisfies Record<PlayerPosition, number>

export function getActivePlayersPerTeamLimit(playerCount: number): number {
  return Math.min(MAX_ACTIVE_PLAYERS_PER_TEAM, Math.floor(playerCount / TEAM_NUMBERS.length))
}
