import { PLAYER_POSITIONS, type PlayerPosition } from "@/lib/ratings/types"

export function getTargetLineup(activePlayersPerTeam: number, availability?: Record<PlayerPosition, number>): Record<PlayerPosition, number> {
  const target = Object.fromEntries(PLAYER_POSITIONS.map((p) => [p, Math.floor(activePlayersPerTeam / 3)])) as Record<PlayerPosition, number>
  let remaining = activePlayersPerTeam % 3
  const order = [...PLAYER_POSITIONS].sort((a, b) => (availability?.[b] ?? 0) - (availability?.[a] ?? 0) || a.localeCompare(b))
  for (const position of order) {
    if (remaining <= 0) break
    target[position]++
    remaining--
  }
  return target
}
