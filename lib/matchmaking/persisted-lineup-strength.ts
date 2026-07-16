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

export type PersistedTeamStrength = {
  team: TeamNumber
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

function isPosition(value: string | null | undefined): value is PlayerPosition {
  return PLAYER_POSITIONS.includes(value as PlayerPosition)
}

export function summarizePersistedLineupStrength(rows: PersistedLineupStrengthRow[]): PersistedLineupStrengthSummary {
  const teams = Object.fromEntries(([1, 2] as const).map((team) => [team, summarizeTeam(rows, team)])) as Record<TeamNumber, PersistedTeamStrength>
  const strengthDifference = teams[1].effectiveStrength === null || teams[2].effectiveStrength === null ? null : Math.abs(teams[1].effectiveStrength - teams[2].effectiveStrength)
  return { teams, strengthDifference }
}

function summarizeTeam(rows: PersistedLineupStrengthRow[], team: TeamNumber): PersistedTeamStrength {
  const valid = rows
    .filter((row) => row.team === team && isPosition(row.position ?? row.assignedPosition) && typeof row.rotationGroupId === "number" && typeof row.assignedRating === "number")
    .sort((a, b) => ((a.position ?? a.assignedPosition) as string).localeCompare((b.position ?? b.assignedPosition) as string) || (a.rotationGroupId ?? 0) - (b.rotationGroupId ?? 0) || (a.rotationOrder ?? 0) - (b.rotationOrder ?? 0) || a.signupId - b.signupId)
  const grouped = new Map<string, PersistedLineupStrengthRow[]>()
  for (const row of valid) {
    const key = `${team}:${row.position ?? row.assignedPosition}:${row.rotationGroupId}`
    grouped.set(key, [...(grouped.get(key) ?? []), row])
  }
  const slots = [...grouped.values()].map((members) => ({ members: members.map((member) => ({ rating: member.assignedRating!, startsInWater: Boolean(member.startsInWater) })) }))
  const members = valid.map((member) => ({ rating: member.assignedRating! }))
  return {
    team,
    effectiveStrength: slots.length ? Math.round(calculateEffectiveTeamStrength(slots)) : null,
    participantAverageRating: members.length ? Math.round(calculateParticipantAverageRating(members)) : null,
    activeCount: valid.filter((row) => Boolean(row.startsInWater)).length,
    substituteCount: valid.filter((row) => !Boolean(row.startsInWater)).length,
    slots,
  }
}

export { calculateEffectiveSlotRating }
