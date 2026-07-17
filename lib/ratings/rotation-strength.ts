import { PRIMARY_ROTATION_PLAYER_SHARE, ROTATION_BONUS_PER_SUBSTITUTE, SUBSTITUTE_ROTATION_GROUP_SHARE } from "./constants"

export type RatedRotationMember = {
  rating: number
  startsInWater: boolean
}

export type RatedRotationSlot = {
  members: RatedRotationMember[]
}

export function calculateEffectiveSlotRating(slot: RatedRotationSlot): number {
  if (slot.members.length === 0) throw new Error("Rotation slot must contain at least one rated member")
  const ratings = slot.members.map((member) => member.rating)
  if (ratings.length === 1) return ratings[0]

  const strongestRating = Math.max(...ratings)
  const strongestIndex = ratings.indexOf(strongestRating)
  const remainingRatings = ratings.filter((_, index) => index !== strongestIndex)
  const substituteAverage = remainingRatings.reduce((sum, rating) => sum + rating, 0) / remainingRatings.length

  return Math.round(
    strongestRating * PRIMARY_ROTATION_PLAYER_SHARE
      + substituteAverage * SUBSTITUTE_ROTATION_GROUP_SHARE
      + remainingRatings.length * ROTATION_BONUS_PER_SUBSTITUTE,
  )
}

export function calculateEffectiveTeamStrength(slots: RatedRotationSlot[]): number {
  if (slots.length === 0) throw new Error("Team must contain at least one rated rotation slot")
  return slots.reduce((sum, slot) => sum + calculateEffectiveSlotRating(slot), 0) / slots.length
}

export function calculateParticipantAverageRating(members: Array<{ rating: number }>): number {
  if (members.length === 0) throw new Error("Team must contain at least one rated participant")
  return members.reduce((sum, member) => sum + member.rating, 0) / members.length
}
