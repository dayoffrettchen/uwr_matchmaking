import { PLAYER_POSITIONS, type PlayerPosition, type TeamNumber } from "@/lib/ratings/types"
import { calculateEffectiveSlotRating, calculateEffectiveTeamStrength, calculateParticipantAverageRating, type RatedRotationSlot } from "@/lib/ratings/rotation-strength"

export type PersistedLineupStrengthRow = {
  signupId: number
  team: number | null
  position?: string | null | undefined
  assignedPosition?: string | null | undefined
  rotationGroupId?: number | null | undefined
  assignedRating?: number | null | undefined
  startsInWater?: boolean | null | undefined
  rotationOrder?: number | null | undefined
}

export type PersistedLineupDiagnostic =
  | { code: "INVALID_TEAM"; signupId: number; team: number | null }
  | { code: "INVALID_POSITION" | "MISSING_GROUP" | "INVALID_GROUP_ID" | "MISSING_RATING" | "INVALID_RATING" | "MISSING_START_STATE"; signupId: number }
  | { code: "INVALID_STARTER_COUNT" | "DUPLICATE_ROTATION_ORDER" | "INVALID_ROTATION_ORDER" | "MISSING_ROTATION_ORDER"; team: TeamNumber; position: PlayerPosition; rotationGroupId: number }
  | { code: "MIXED_POSITION_GROUP"; team: TeamNumber; rotationGroupId: number; positions: PlayerPosition[] }

export type PersistedTeamStrength = {
  team: TeamNumber
  effectiveStrength: number | null
  participantAverageRating: number | null
  activeCount: number
  substituteCount: number
  complete: boolean
  missingRatingSignupIds: number[]
  diagnostics: PersistedLineupDiagnostic[]
  slots: RatedRotationSlot[]
}

export type PersistedLineupStrengthSummary = { diagnostics: PersistedLineupDiagnostic[]; teams: Record<TeamNumber, PersistedTeamStrength>; strengthDifference: number | null }

function isPosition(value: string | null | undefined): value is PlayerPosition { return PLAYER_POSITIONS.includes(value as PlayerPosition) }

type ValidRow = PersistedLineupStrengthRow & { team: TeamNumber; normalizedPosition: PlayerPosition; rotationGroupId: number; assignedRating: number; startsInWater: boolean }

export function summarizePersistedLineupStrength(rows: PersistedLineupStrengthRow[]): PersistedLineupStrengthSummary {
  const diagnostics: PersistedLineupDiagnostic[] = []
  const invalidTeamRows = rows.filter((row) => row.team !== 1 && row.team !== 2)
  for (const row of invalidTeamRows) diagnostics.push({ code: "INVALID_TEAM", signupId: row.signupId, team: row.team })
  const validTeamRows = rows.filter((row) => row.team === 1 || row.team === 2)
  const teams = Object.fromEntries(([1, 2] as const).map((team) => [team, summarizeTeam(validTeamRows, team, diagnostics)])) as Record<TeamNumber, PersistedTeamStrength>
  if (diagnostics.length > 0) {
    for (const team of [1, 2] as const) {
      teams[team] = { ...teams[team], effectiveStrength: null, complete: false, diagnostics: [...teams[team].diagnostics, ...diagnostics] }
    }
  }
  const strengthDifference = teams[1].effectiveStrength === null || teams[2].effectiveStrength === null ? null : Math.abs(teams[1].effectiveStrength - teams[2].effectiveStrength)
  return { diagnostics, teams, strengthDifference }
}

function summarizeTeam(rows: PersistedLineupStrengthRow[], team: TeamNumber, summaryDiagnostics: PersistedLineupDiagnostic[] = []): PersistedTeamStrength {
  const diagnostics: PersistedLineupDiagnostic[] = []
  const missingRatingSignupIds: number[] = []
  const valid: ValidRow[] = []
  const teamRows = rows.filter((row) => row.team === team)
  for (const row of teamRows) {
    const position = row.position ?? row.assignedPosition
    if (!isPosition(position)) { diagnostics.push({ code: "INVALID_POSITION", signupId: row.signupId }); continue }
    if (row.rotationGroupId === null || row.rotationGroupId === undefined) { diagnostics.push({ code: "MISSING_GROUP", signupId: row.signupId }); continue }
    if (!Number.isInteger(row.rotationGroupId) || row.rotationGroupId <= 0) { diagnostics.push({ code: "INVALID_GROUP_ID", signupId: row.signupId }); continue }
    if (row.assignedRating === null || row.assignedRating === undefined) { diagnostics.push({ code: "MISSING_RATING", signupId: row.signupId }); missingRatingSignupIds.push(row.signupId); continue }
    if (!Number.isFinite(row.assignedRating)) { diagnostics.push({ code: "INVALID_RATING", signupId: row.signupId }); missingRatingSignupIds.push(row.signupId); continue }
    if (typeof row.startsInWater !== "boolean") { diagnostics.push({ code: "MISSING_START_STATE", signupId: row.signupId }); continue }
    valid.push({ ...row, team, normalizedPosition: position, rotationGroupId: row.rotationGroupId, assignedRating: row.assignedRating, startsInWater: row.startsInWater })
  }
  const grouped = new Map<string, ValidRow[]>()
  for (const row of valid.sort((a, b) => a.normalizedPosition.localeCompare(b.normalizedPosition) || a.rotationGroupId - b.rotationGroupId || (a.rotationOrder ?? 0) - (b.rotationOrder ?? 0) || a.signupId - b.signupId)) {
    const key = `${team}:${row.rotationGroupId}`
    grouped.set(key, [...(grouped.get(key) ?? []), row])
  }
  const slots: RatedRotationSlot[] = []
  for (const members of grouped.values()) {
    const first = members[0]
    const positions = [...new Set(members.map((member) => member.normalizedPosition))]
    if (positions.length > 1) { diagnostics.push({ code: "MIXED_POSITION_GROUP", team, rotationGroupId: first.rotationGroupId, positions }); continue }
    const starterCount = members.filter((member) => member.startsInWater).length
    if (starterCount !== 1) diagnostics.push({ code: "INVALID_STARTER_COUNT", team, position: first.normalizedPosition, rotationGroupId: first.rotationGroupId })
    const orders = members.map((member) => member.rotationOrder)
    if (orders.some((order) => order === null || order === undefined)) diagnostics.push({ code: "MISSING_ROTATION_ORDER", team, position: first.normalizedPosition, rotationGroupId: first.rotationGroupId })
    const numericOrders = orders.filter((order): order is number => typeof order === "number")
    if (numericOrders.some((order) => !Number.isInteger(order) || order <= 0)) diagnostics.push({ code: "INVALID_ROTATION_ORDER", team, position: first.normalizedPosition, rotationGroupId: first.rotationGroupId })
    if (new Set(numericOrders).size !== numericOrders.length) diagnostics.push({ code: "DUPLICATE_ROTATION_ORDER", team, position: first.normalizedPosition, rotationGroupId: first.rotationGroupId })
    slots.push({ members: members.map((member) => ({ rating: member.assignedRating, startsInWater: member.startsInWater })) })
  }
  const participantAverageRating = valid.length ? Math.round(calculateParticipantAverageRating(valid.map((member) => ({ rating: member.assignedRating })))) : null
  const complete = diagnostics.length === 0 && summaryDiagnostics.length === 0 && slots.length > 0
  return { team, effectiveStrength: complete ? Math.round(calculateEffectiveTeamStrength(slots)) : null, participantAverageRating, activeCount: valid.filter((row) => row.startsInWater).length, substituteCount: valid.filter((row) => !row.startsInWater).length, complete, missingRatingSignupIds, diagnostics, slots }
}

export { calculateEffectiveSlotRating }
