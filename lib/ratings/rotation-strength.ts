import { ROTATION_BONUS_PER_SUBSTITUTE } from "./constants"

export function calculateRotationStrength(memberRatings: number[], activeSlotCount = 1): { averageMemberRating: number; effectiveRating: number; substituteCount: number } {
  if (memberRatings.length === 0) throw new Error("Rotation group requires at least one member")
  const highestMemberRating = Math.max(...memberRatings)
  const averageMemberRating = Math.round(memberRatings.reduce((sum, rating) => sum + rating, 0) / memberRatings.length)
  const substituteCount = Math.max(0, memberRatings.length - activeSlotCount)
  return { averageMemberRating, effectiveRating: Math.round(highestMemberRating + substituteCount * ROTATION_BONUS_PER_SUBSTITUTE), substituteCount }
}
