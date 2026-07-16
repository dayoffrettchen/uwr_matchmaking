import { ROTATION_BONUS_PER_SUBSTITUTE } from "./constants"

export type RatedRotationMember = {
  rating: number
  startsInWater: boolean
}

export type RatedRotationSlot = {
  members: RatedRotationMember[]
}

/**
 * Intentional first effective-strength model: every legal substitute currently
 * contributes the same flat availability/rest bonus. Substitute quality below the
 * strongest slot member does not change this slot rating; a quality-sensitive
 * but still monotonic contribution can be calibrated in a later product pass.
 * This metric is not an expected-minutes-played model.
 */
export function calculateEffectiveSlotRating(slot: RatedRotationSlot): number {
  if (slot.members.length === 0) throw new Error("Rotation slot must contain at least one rated member")
  const highestMemberRating = Math.max(...slot.members.map((member) => member.rating))
  return highestMemberRating + Math.max(0, slot.members.length - 1) * ROTATION_BONUS_PER_SUBSTITUTE
}

export function calculateEffectiveTeamStrength(slots: RatedRotationSlot[]): number {
  if (slots.length === 0) throw new Error("Team must contain at least one rated rotation slot")
  return slots.reduce((sum, slot) => sum + calculateEffectiveSlotRating(slot), 0) / slots.length
}

export function calculateParticipantAverageRating(members: Array<{ rating: number }>): number {
  if (members.length === 0) throw new Error("Team must contain at least one rated participant")
  return members.reduce((sum, member) => sum + member.rating, 0) / members.length
}
