import { PLAYER_POSITIONS, type PlayerPosition, type TeamNumber } from "@/lib/ratings/types"

export type PersistedLineupStrengthRow = {
  signupId: number
  team: number | null
  position?: PlayerPosition | string | null
  assignedPosition?: PlayerPosition | string | null
  rotationGroupId: number | null
  assignedRating: number | null
  startsInWater: boolean | null
  rotationOrder: number | null
}

export type PersistedLineupDiagnostic =
  | { code: "INVALID_TEAM"; signupId: number; team: number | null }
  | { code: "INVALID_POSITION" | "MISSING_GROUP" | "INVALID_GROUP_ID" | "MISSING_RATING" | "INVALID_RATING" | "MISSING_START_STATE"; signupId: number }
  | { code: "INVALID_STARTER_COUNT" | "DUPLICATE_ROTATION_ORDER" | "INVALID_ROTATION_ORDER" | "MISSING_ROTATION_ORDER"; team: TeamNumber; position: PlayerPosition; rotationGroupId: number }
  | { code: "MIXED_POSITION_GROUP"; team: TeamNumber; rotationGroupId: number; positions: PlayerPosition[] }

export type PersistedTeamStrength = {
  complete: boolean
  effectiveStrength: number | null
  diagnostics: PersistedLineupDiagnostic[]
  missingRatingSignupIds: number[]
}

export type PersistedLineupStrengthSummary = {
  teams: Record<TeamNumber, PersistedTeamStrength>
}

type ValidRow = PersistedLineupStrengthRow & {
  team: TeamNumber
  normalizedPosition: PlayerPosition
  rotationGroupId: number
  assignedRating: number
  startsInWater: boolean
}

function isTeam(team: number | null): team is TeamNumber {
  return team === 1 || team === 2
}

function isPosition(position: unknown): position is PlayerPosition {
  return typeof position === "string" && PLAYER_POSITIONS.includes(position as PlayerPosition)
}

function summarizeTeam(rows: PersistedLineupStrengthRow[], team: TeamNumber): PersistedTeamStrength {
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

  const groups = new Map<number, ValidRow[]>()
  for (const row of valid) groups.set(row.rotationGroupId, [...(groups.get(row.rotationGroupId) ?? []), row])

  const slots: Array<{ members: Array<{ rating: number; startsInWater: boolean }> }> = []
  for (const members of groups.values()) {
    const first = members[0]
    const positions = [...new Set(members.map((member) => member.normalizedPosition))]
    if (positions.length > 1) diagnostics.push({ code: "MIXED_POSITION_GROUP", team, rotationGroupId: first.rotationGroupId, positions })
    const starterCount = members.filter((member) => member.startsInWater).length
    if (starterCount !== 1) diagnostics.push({ code: "INVALID_STARTER_COUNT", team, position: first.normalizedPosition, rotationGroupId: first.rotationGroupId })
    const orders = members.map((member) => member.rotationOrder)
    if (orders.some((order) => order === null || order === undefined)) diagnostics.push({ code: "MISSING_ROTATION_ORDER", team, position: first.normalizedPosition, rotationGroupId: first.rotationGroupId })
    const numericOrders = orders.filter((order): order is number => typeof order === "number")
    if (numericOrders.some((order) => !Number.isInteger(order) || order <= 0)) diagnostics.push({ code: "INVALID_ROTATION_ORDER", team, position: first.normalizedPosition, rotationGroupId: first.rotationGroupId })
    if (new Set(numericOrders).size !== numericOrders.length) diagnostics.push({ code: "DUPLICATE_ROTATION_ORDER", team, position: first.normalizedPosition, rotationGroupId: first.rotationGroupId })
    slots.push({ members: members.map((member) => ({ rating: member.assignedRating, startsInWater: member.startsInWater })) })
  }

  const complete = diagnostics.length === 0 && slots.length > 0
  const activeRatings = slots.flatMap((slot) => slot.members.filter((member) => member.startsInWater).map((member) => member.rating))
  const effectiveStrength = complete ? Math.round(activeRatings.reduce((sum, rating) => sum + rating, 0) / activeRatings.length) : null
  return { complete, effectiveStrength, diagnostics, missingRatingSignupIds }
}

export function summarizePersistedLineupStrength(rows: PersistedLineupStrengthRow[]): PersistedLineupStrengthSummary {
  const invalidTeamDiagnostics = rows.filter((row) => !isTeam(row.team)).map((row): PersistedLineupDiagnostic => ({ code: "INVALID_TEAM", signupId: row.signupId, team: row.team }))
  const teams: Record<TeamNumber, PersistedTeamStrength> = { 1: summarizeTeam(rows, 1), 2: summarizeTeam(rows, 2) }
  teams[1].diagnostics.unshift(...invalidTeamDiagnostics)
  teams[2].diagnostics.unshift(...invalidTeamDiagnostics)
  if (invalidTeamDiagnostics.length > 0) {
    teams[1].complete = false
    teams[1].effectiveStrength = null
    teams[2].complete = false
    teams[2].effectiveStrength = null
  }
  return { teams }
}
