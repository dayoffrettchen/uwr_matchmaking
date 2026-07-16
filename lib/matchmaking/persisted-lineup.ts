import { ROTATION_BONUS_PER_SUBSTITUTE } from "@/lib/ratings/constants"
import { PLAYER_POSITIONS, type PlayerPosition, type TeamNumber } from "@/lib/ratings/types"

export type PersistedLineupDiagnostic =
  | { code: "INVALID_TEAM"; signupId?: number; team: unknown }
  | { code: "MIXED_POSITION_GROUP"; team: TeamNumber; rotationGroupId: number; positions: PlayerPosition[] }
  | { code: "AMBIGUOUS_TEAM_GROUP"; rotationGroupId: number; teams: unknown[] }

export type PersistedLineupRow = {
  signupId?: number
  team: unknown
  assignedPosition?: unknown
  position?: unknown
  rotationGroupId?: number | null
  rating?: number | null
  mmr?: number | null
  startsInWater?: boolean | null
}

export type PersistedTeamSummary = { team: TeamNumber; complete: boolean; effectiveStrength: number | null }
export type PersistedLineupStrengthSummary = { diagnostics: PersistedLineupDiagnostic[]; teams: Record<TeamNumber, PersistedTeamSummary> }

export function summarizePersistedLineupStrength(rows: PersistedLineupRow[]): PersistedLineupStrengthSummary {
  const diagnostics: PersistedLineupDiagnostic[] = []
  const validRows = rows.filter((row) => {
    if (row.team === 1 || row.team === 2) return true
    diagnostics.push({ code: "INVALID_TEAM", signupId: row.signupId, team: row.team })
    return false
  })

  const byGroupGlobal = new Map<number, Set<unknown>>()
  for (const row of rows) if (row.rotationGroupId != null) {
    const teams = byGroupGlobal.get(row.rotationGroupId) ?? new Set<unknown>()
    teams.add(row.team)
    byGroupGlobal.set(row.rotationGroupId, teams)
  }
  for (const [rotationGroupId, teams] of byGroupGlobal) {
    const normalized = [...teams]
    if (normalized.some((team) => team !== 1 && team !== 2)) diagnostics.push({ code: "AMBIGUOUS_TEAM_GROUP", rotationGroupId, teams: normalized })
  }

  for (const team of [1, 2] as const) {
    const byGroup = new Map<number, Set<PlayerPosition>>()
    for (const row of validRows.filter((r) => r.team === team && r.rotationGroupId != null)) {
      const position = (row.assignedPosition ?? row.position) as PlayerPosition
      if (!PLAYER_POSITIONS.includes(position)) continue
      const positions = byGroup.get(row.rotationGroupId!) ?? new Set<PlayerPosition>()
      positions.add(position)
      byGroup.set(row.rotationGroupId!, positions)
    }
    for (const [rotationGroupId, positions] of byGroup) if (positions.size > 1) diagnostics.push({ code: "MIXED_POSITION_GROUP", team, rotationGroupId, positions: [...positions].sort() })
  }

  const invalid = diagnostics.length > 0
  const teams = Object.fromEntries(([1, 2] as const).map((team) => {
    const mine = validRows.filter((row) => row.team === team)
    const complete = !invalid && PLAYER_POSITIONS.every((position) => mine.some((row) => (row.assignedPosition ?? row.position) === position && row.startsInWater))
    const groups = new Map<number, PersistedLineupRow[]>()
    for (const row of mine) groups.set(row.rotationGroupId ?? row.signupId ?? groups.size + 1, [...(groups.get(row.rotationGroupId ?? row.signupId ?? groups.size + 1) ?? []), row])
    const effectiveRatings = [...groups.values()].map((members) => {
      const ratings = members.map((row) => row.rating ?? row.mmr ?? 1000)
      return ratings.reduce((sum, rating) => sum + rating, 0) / Math.max(1, ratings.length) + Math.max(0, members.length - 1) * ROTATION_BONUS_PER_SUBSTITUTE
    })
    const effectiveStrength = complete && effectiveRatings.length ? Math.round(effectiveRatings.reduce((sum, rating) => sum + rating, 0) / effectiveRatings.length) : null
    return [team, { team, complete, effectiveStrength }]
  })) as Record<TeamNumber, PersistedTeamSummary>
  return { diagnostics, teams }
}
