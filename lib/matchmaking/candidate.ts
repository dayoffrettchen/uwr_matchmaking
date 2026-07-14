import { PLAYER_POSITIONS, type PlayerPosition, type TeamNumber } from "@/lib/ratings/types"
import type { MatchmakingPlayer } from "./types"

export type DraftAssignment = {
  signupId: number
  playerId: number
  team: TeamNumber
  position: PlayerPosition
}

export type Gene = { signupId: number; team: TeamNumber; position: PlayerPosition }
export type Candidate = Gene[]

export function canonicalizePlayers(players: MatchmakingPlayer[]): MatchmakingPlayer[] {
  return [...players].sort((a, b) => a.signupId - b.signupId || a.playerId - b.playerId || a.name.localeCompare(b.name))
}

export function toDraftAssignments(players: MatchmakingPlayer[], candidate: Candidate): DraftAssignment[] {
  const byId = new Map(players.map((p) => [p.signupId, p]))
  return candidate.map((gene) => ({ signupId: gene.signupId, playerId: byId.get(gene.signupId)!.playerId, team: gene.team, position: gene.position }))
}

export function fromDraftAssignments(players: MatchmakingPlayer[], drafts: DraftAssignment[]): Candidate {
  const byId = new Map(drafts.map((d) => [d.signupId, d]))
  return canonicalizePlayers(players).map((p) => {
    const draft = byId.get(p.signupId)
    return { signupId: p.signupId, team: draft?.team === 2 ? 2 : 1, position: draft?.position && PLAYER_POSITIONS.includes(draft.position) ? draft.position : p.eligiblePositions[0] }
  })
}

export function candidateHash(candidate: Candidate): string {
  return candidate.map((g) => `${g.signupId}:${g.team}:${g.position}`).join("|")
}

export function stableInputSeed(players: MatchmakingPlayer[]): number {
  let hash = 2166136261
  const push = (value: string) => {
    for (let i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i)
      hash = Math.imul(hash, 16777619)
    }
  }
  for (const p of canonicalizePlayers(players)) {
    push(`${p.signupId}/${p.playerId}/${p.eligiblePositions.join(",")}/`)
    for (const pref of [...p.positionPreferences].sort((a, b) => a.order - b.order || a.position.localeCompare(b.position))) push(`${pref.position}:${pref.order};`)
    for (const pos of PLAYER_POSITIONS) push(`${pos}:${p.ratings[pos]}:${p.gamesPlayed[pos]}:${p.confidence[pos]};`)
  }
  return hash >>> 0
}
