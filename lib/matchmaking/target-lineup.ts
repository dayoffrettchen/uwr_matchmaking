import { PLAYER_POSITIONS, type PlayerPosition } from "@/lib/ratings/types"

const PREFERRED_ACTIVE_LINEUP: Record<PlayerPosition, number> = {
  goalkeeper: 1,
  defender: 2,
  forward: 3,
}

export function getTargetLineup(activePlayersPerTeam: number, availability?: Record<PlayerPosition, number>): Record<PlayerPosition, number> {
  const target = Object.fromEntries(PLAYER_POSITIONS.map((p) => [p, 0])) as Record<PlayerPosition, number>
  let remaining = activePlayersPerTeam

  for (const position of PLAYER_POSITIONS) {
    const availablePerTeam = Math.floor((availability?.[position] ?? Number.POSITIVE_INFINITY) / 2)
    const wanted = Math.min(PREFERRED_ACTIVE_LINEUP[position], availablePerTeam, remaining)
    target[position] = wanted
    remaining -= wanted
  }

  const fallbackOrder = [...PLAYER_POSITIONS].sort((a, b) => (availability?.[b] ?? 0) - (availability?.[a] ?? 0) || PREFERRED_ACTIVE_LINEUP[b] - PREFERRED_ACTIVE_LINEUP[a] || a.localeCompare(b))
  while (remaining > 0) {
    const position = fallbackOrder.find((pos) => target[pos] < (availability?.[pos] ?? Number.POSITIVE_INFINITY))
    if (!position) break
    target[position]++
    remaining--
  }

  return target
}
