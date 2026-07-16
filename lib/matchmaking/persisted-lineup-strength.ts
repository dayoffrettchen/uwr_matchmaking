import { PLAYER_POSITIONS, type PlayerPosition, type TeamNumber } from "@/lib/ratings/types"
import { calculateRotationStrength } from "@/lib/ratings/rotation-strength"

export type PersistedLineupRow = { signupId: number; team: number | null; assignedPosition: PlayerPosition | null; rotationGroupId: number | null; rotationOrder: number | null; startsInWater: boolean | null; rating: number | null }
export type PersistedLineupDiagnostic =
  | { code: "INVALID_TEAM"; signupId: number; team: number | null }
  | { code: "MIXED_POSITION_GROUP"; team: TeamNumber; rotationGroupId: number; positions: PlayerPosition[] }
  | { code: "AMBIGUOUS_ROTATION_GROUP"; team: TeamNumber; rotationGroupId: number | null }
  | { code: "MISSING_RATING"; signupId: number }
  | { code: "INVALID_ROTATION_ORDER"; team: TeamNumber; rotationGroupId: number; rotationOrder: number | null }
  | { code: "DUPLICATE_ROTATION_ORDER"; team: TeamNumber; rotationGroupId: number; rotationOrder: number }
  | { code: "INVALID_STARTER_COUNT"; team: TeamNumber; rotationGroupId: number; starters: number }

export type PersistedTeamStrength = { team: TeamNumber; complete: boolean; activeCount: number; substituteCount: number; effectiveStrength: number | null; averagePlayerRating: number | null; diagnostics: PersistedLineupDiagnostic[] }
export type PersistedLineupStrength = { complete: boolean; teams: Record<TeamNumber, PersistedTeamStrength>; diagnostics: PersistedLineupDiagnostic[] }

function emptyTeam(team: TeamNumber): PersistedTeamStrength { return { team, complete: true, activeCount: 0, substituteCount: 0, effectiveStrength: null, averagePlayerRating: null, diagnostics: [] } }

export function calculatePersistedLineupStrength(rows: PersistedLineupRow[]): PersistedLineupStrength {
  const diagnostics: PersistedLineupDiagnostic[] = []
  for (const row of rows) if (row.team !== 1 && row.team !== 2) diagnostics.push({ code: "INVALID_TEAM", signupId: row.signupId, team: row.team })
  const teams: Record<TeamNumber, PersistedTeamStrength> = { 1: emptyTeam(1), 2: emptyTeam(2) }
  for (const team of [1, 2] as const) {
    const mine = rows.filter((row) => row.team === team)
    const groups = new Map<number, PersistedLineupRow[]>()
    for (const row of mine) {
      if (row.rotationGroupId === null || row.rotationGroupId <= 0) { diagnostics.push({ code: "AMBIGUOUS_ROTATION_GROUP", team, rotationGroupId: row.rotationGroupId }); continue }
      const groupRows = groups.get(row.rotationGroupId) ?? []
      groupRows.push(row); groups.set(row.rotationGroupId, groupRows)
    }
    let complete = true
    let weighted = 0
    let activeSlots = 0
    const ratings: number[] = []
    for (const [rotationGroupId, groupRows] of groups) {
      const positions = [...new Set(groupRows.map((row) => row.assignedPosition).filter((position): position is PlayerPosition => position !== null && PLAYER_POSITIONS.includes(position)))]
      if (positions.length !== 1) { diagnostics.push({ code: "MIXED_POSITION_GROUP", team, rotationGroupId, positions }); complete = false }
      const orders = new Set<number>()
      for (const row of groupRows) {
        if (row.rotationOrder === null || row.rotationOrder <= 0) { diagnostics.push({ code: "INVALID_ROTATION_ORDER", team, rotationGroupId, rotationOrder: row.rotationOrder }); complete = false }
        else if (orders.has(row.rotationOrder)) { diagnostics.push({ code: "DUPLICATE_ROTATION_ORDER", team, rotationGroupId, rotationOrder: row.rotationOrder }); complete = false }
        else orders.add(row.rotationOrder)
        if (row.rating === null) { diagnostics.push({ code: "MISSING_RATING", signupId: row.signupId }); complete = false } else ratings.push(row.rating)
      }
      const starters = groupRows.filter((row) => row.startsInWater).length
      if (starters !== 1) { diagnostics.push({ code: "INVALID_STARTER_COUNT", team, rotationGroupId, starters }); complete = false }
      const groupRatings = groupRows.map((row) => row.rating).filter((rating): rating is number => rating !== null)
      if (groupRatings.length === groupRows.length && starters === 1 && positions.length === 1) {
        const strength = calculateRotationStrength(groupRatings, 1).effectiveRating
        weighted += strength
        activeSlots += 1
      }
    }
    const invalidGlobal = diagnostics.some((diagnostic) => diagnostic.code === "INVALID_TEAM")
    complete = complete && !invalidGlobal
    teams[team] = { team, complete, activeCount: mine.filter((row) => row.startsInWater).length, substituteCount: mine.filter((row) => !row.startsInWater).length, effectiveStrength: complete && activeSlots > 0 ? Math.round(weighted / activeSlots) : null, averagePlayerRating: ratings.length ? Math.round(ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) : null, diagnostics: diagnostics.filter((diagnostic) => "team" in diagnostic ? diagnostic.team === team : false) }
  }
  return { complete: teams[1].complete && teams[2].complete && diagnostics.length === 0, teams, diagnostics }
}
