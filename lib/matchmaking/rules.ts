import { PLAYER_POSITIONS, type PlayerPosition } from "@/lib/ratings/types"

export const TEAM_NUMBERS = [1, 2] as const

export const MAX_ACTIVE_PLAYERS_PER_TEAM = 6

export const ACTIVE_SLOTS_PER_POSITION = {
  goalkeeper: 2,
  defender: 2,
  forward: 2,
} as const satisfies Record<PlayerPosition, number>

export function getFeasibleActiveSlotsPerTeam(availability?: Partial<Record<PlayerPosition, number>>): Record<PlayerPosition, number> {
  return Object.fromEntries(PLAYER_POSITIONS.map((position) => {
    const availablePerTeam = Math.floor((availability?.[position] ?? TEAM_NUMBERS.length * ACTIVE_SLOTS_PER_POSITION[position]) / TEAM_NUMBERS.length)
    return [position, Math.min(ACTIVE_SLOTS_PER_POSITION[position], Math.max(0, availablePerTeam))]
  })) as Record<PlayerPosition, number>
}
