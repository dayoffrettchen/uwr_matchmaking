import { PLAYER_POSITIONS, type PlayerPosition, type TeamNumber } from "@/lib/ratings/types"
import { getTargetLineup } from "./target-lineup"
import { MAX_ACTIVE_PLAYERS_PER_TEAM } from "./constants"
import { type Candidate } from "./candidate"
import { getPositionPenalty } from "./fitness"
import type { MatchmakingPlayer } from "./types"

export function repairCandidate(players: MatchmakingPlayer[], candidate: Candidate): Candidate | null {
  const byId = new Map(candidate.map((g) => [g.signupId, g]))
  const repaired: Candidate = players.map((p, index) => {
    const gene = byId.get(p.signupId)
    const position = gene && p.eligiblePositions.includes(gene.position) ? gene.position : [...p.eligiblePositions].sort((a, b) => getPositionPenalty(p, a) - getPositionPenalty(p, b) || a.localeCompare(b))[0]
    if (!position) return { signupId: p.signupId, team: index % 2 === 0 ? 1 : 2, position: PLAYER_POSITIONS[0] }
    return { signupId: p.signupId, team: gene?.team === 2 ? 2 : 1, position }
  })
  const minTeam1 = Math.floor(players.length / 2), maxTeam1 = Math.ceil(players.length / 2)
  while (repaired.filter((g) => g.team === 1).length < minTeam1) moveBest(players, repaired, 2, 1)
  while (repaired.filter((g) => g.team === 1).length > maxTeam1) moveBest(players, repaired, 1, 2)

  const availability = Object.fromEntries(PLAYER_POSITIONS.map((pos) => [pos, players.filter((p) => p.eligiblePositions.includes(pos)).length])) as Record<PlayerPosition, number>
  const target = getTargetLineup(MAX_ACTIVE_PLAYERS_PER_TEAM, availability)
  const playerById = new Map(players.map((p) => [p.signupId, p]))
  for (const team of [1, 2] as const) for (const pos of PLAYER_POSITIONS) {
    const feasible = Math.min(target[pos], players.filter((p) => p.eligiblePositions.includes(pos)).length)
    while (repaired.filter((g) => g.team === team && g.position === pos).length < Math.min(target[pos], feasible)) {
      const swap = repaired.filter((g) => g.team === team && g.position !== pos && playerById.get(g.signupId)!.eligiblePositions.includes(pos))
        .sort((a, b) => getPositionPenalty(playerById.get(a.signupId)!, pos) - getPositionPenalty(playerById.get(b.signupId)!, pos))[0]
      if (!swap) break
      swap.position = pos
    }
  }
  return repaired.every((g) => playerById.get(g.signupId)?.eligiblePositions.includes(g.position)) ? repaired : null
}

function moveBest(players: MatchmakingPlayer[], candidate: Candidate, from: TeamNumber, to: TeamNumber) {
  const playerById = new Map(players.map((p) => [p.signupId, p]))
  const best = candidate.filter((g) => g.team === from).sort((a, b) => getPositionPenalty(playerById.get(a.signupId)!, a.position) - getPositionPenalty(playerById.get(b.signupId)!, b.position) || a.signupId - b.signupId)[0]
  if (best) best.team = to
}
