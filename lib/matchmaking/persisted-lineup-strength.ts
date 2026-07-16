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
  | { code: "INVALID_TEAM" | "INVALID_POSITION" | "MISSING_GROUP" | "MISSING_RATING" | "MISSING_START_STATE"; signupId: number }
  | { code: "INVALID_STARTER_COUNT" | "DUPLICATE_ROTATION_ORDER" | "INVALID_ROTATION_ORDER"; team: TeamNumber; position: PlayerPosition; rotationGroupId: number }

export type PersistedTeamStrength = {
  team: TeamNumber
  complete: boolean
  missingRatingSignupIds: number[]
  diagnostics: PersistedLineupDiagnostic[]
  effectiveStrength: number | null
  participantAverageRating: number | null
  activeCount: number
  substituteCount: number
  slots: RatedRotationSlot[]
}

export type PersistedLineupStrengthSummary = {
  teams: Record<TeamNumber, PersistedTeamStrength>
  strengthDifference: number | null
}

function isTeam(value: number | null): value is TeamNumber { return value === 1 || value === 2 }
function isPosition(value: string | null | undefined): value is PlayerPosition { return PLAYER_POSITIONS.includes(value as PlayerPosition) }

export function summarizePersistedLineupStrength(rows: PersistedLineupStrengthRow[]): PersistedLineupStrengthSummary {
  const teams = Object.fromEntries(([1, 2] as const).map((team) => [team, summarizeTeam(rows, team)])) as Record<TeamNumber, PersistedTeamStrength>
  const strengthDifference = teams[1].effectiveStrength === null || teams[2].effectiveStrength === null ? null : Math.abs(teams[1].effectiveStrength - teams[2].effectiveStrength)
  return { teams, strengthDifference }
}

function summarizeTeam(rows: PersistedLineupStrengthRow[], team: TeamNumber): PersistedTeamStrength {
  const teamRows = rows.filter((row) => row.team === team)
  const diagnostics: PersistedLineupDiagnostic[] = []
  const missingRatingSignupIds: number[] = []
  const valid: Array<PersistedLineupStrengthRow & { team: TeamNumber; normalizedPosition: PlayerPosition; rotationGroupId: number; assignedRating: number; startsInWater: boolean }> = []

  for (const row of teamRows) {
    const position = row.position ?? row.assignedPosition
    if (!isTeam(row.team)) { diagnostics.push({ code: "INVALID_TEAM", signupId: row.signupId }); continue }
    if (!isPosition(position)) { diagnostics.push({ code: "INVALID_POSITION", signupId: row.signupId }); continue }
    if (typeof row.rotationGroupId !== "number") { diagnostics.push({ code: "MISSING_GROUP", signupId: row.signupId }); continue }
    if (typeof row.assignedRating !== "number") { diagnostics.push({ code: "MISSING_RATING", signupId: row.signupId }); missingRatingSignupIds.push(row.signupId); continue }
    if (typeof row.startsInWater !== "boolean") { diagnostics.push({ code: "MISSING_START_STATE", signupId: row.signupId }); continue }
    valid.push({ ...row, team: row.team, normalizedPosition: position, rotationGroupId: row.rotationGroupId, assignedRating: row.assignedRating, startsInWater: row.startsInWater })
  }

  const grouped = new Map<string, typeof valid>()
  for (const row of valid.sort((a, b) => a.normalizedPosition.localeCompare(b.normalizedPosition) || a.rotationGroupId - b.rotationGroupId || (a.rotationOrder ?? 0) - (b.rotationOrder ?? 0) || a.signupId - b.signupId)) {
    const key = `${row.team}:${row.normalizedPosition}:${row.rotationGroupId}`
    grouped.set(key, [...(grouped.get(key) ?? []), row])
  }

  const slots: RatedRotationSlot[] = []
  for (const members of grouped.values()) {
    const first = members[0]
    const starterCount = members.filter((member) => member.startsInWater).length
    if (starterCount !== 1) diagnostics.push({ code: "INVALID_STARTER_COUNT", team, position: first.normalizedPosition, rotationGroupId: first.rotationGroupId })
    const orders = members.map((member) => member.rotationOrder).filter((order): order is number => typeof order === "number")
    if (orders.some((order) => order <= 0)) diagnostics.push({ code: "INVALID_ROTATION_ORDER", team, position: first.normalizedPosition, rotationGroupId: first.rotationGroupId })
    if (new Set(orders).size !== orders.length) diagnostics.push({ code: "DUPLICATE_ROTATION_ORDER", team, position: first.normalizedPosition, rotationGroupId: first.rotationGroupId })
    slots.push({ members: members.map((member) => ({ rating: member.assignedRating, startsInWater: member.startsInWater })) })
  }

  const complete = diagnostics.length === 0 && teamRows.length === valid.length && slots.length > 0
  const members = valid.map((member) => ({ rating: member.assignedRating }))
  return {
    team,
    complete,
    missingRatingSignupIds,
    diagnostics,
    effectiveStrength: complete ? Math.round(calculateEffectiveTeamStrength(slots)) : null,
    participantAverageRating: complete && members.length ? Math.round(calculateParticipantAverageRating(members)) : null,
    activeCount: teamRows.filter((row) => row.startsInWater === true).length,
    substituteCount: teamRows.filter((row) => row.startsInWater === false).length,
    slots,
  }
}

export { calculateEffectiveSlotRating }
