import type { PlayerPosition } from "@/lib/ratings/types"
import { getFeasibleActiveSlotsPerTeam } from "./rules"

export function getTargetLineup(_activePlayersPerTeam: number, availability?: Record<PlayerPosition, number>): Record<PlayerPosition, number> {
  return getFeasibleActiveSlotsPerTeam(availability)
}
