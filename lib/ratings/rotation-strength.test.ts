import { describe, expect, it } from "vitest"
import { PRIMARY_ROTATION_PLAYER_SHARE, ROTATION_BONUS_PER_SUBSTITUTE, SUBSTITUTE_ROTATION_GROUP_SHARE } from "./constants"
import { calculateEffectiveSlotRating, calculateEffectiveTeamStrength, calculateParticipantAverageRating } from "./rotation-strength"

const m = (rating: number) => ({ rating, startsInWater: false })
const slot = (ratings: number[]) => ({ members: ratings.map(m) })

describe("rotation-strength", () => {
  it("keeps rotation participation shares complete", () => {
    expect(PRIMARY_ROTATION_PLAYER_SHARE + SUBSTITUTE_ROTATION_GROUP_SHARE).toBe(1)
  })

  it("scores effective slot ratings with a 60/40 participation model and substitute bonus", () => {
    expect(calculateEffectiveSlotRating(slot([1267]))).toBe(1267)
    expect(calculateEffectiveSlotRating(slot([1267, 1012]))).toBe(1195)
    expect(calculateEffectiveSlotRating(slot([1337, 1128]))).toBe(1283)
    expect(calculateEffectiveSlotRating(slot([1337, 999]))).toBe(1232)
    expect(calculateEffectiveSlotRating(slot([1267, 1012, 999]))).toBe(1222)
    expect(calculateEffectiveSlotRating(slot([1000, 1000]))).toBe(1030)
  })

  it("is independent of ordering and removes only one strongest rating", () => {
    expect(calculateEffectiveSlotRating(slot([1267, 1012]))).toBe(calculateEffectiveSlotRating(slot([1012, 1267])))
    expect(calculateEffectiveSlotRating(slot([1200, 1200, 900]))).toBe(1200)
  })

  it("documents semantic effects of substitute quality and collective 40% sharing", () => {
    expect(calculateEffectiveSlotRating(slot([1267, 1012]))).toBeLessThan(calculateEffectiveSlotRating(slot([1267])))
    expect(calculateEffectiveSlotRating(slot([1000, 1000]))).toBe(1000 + ROTATION_BONUS_PER_SUBSTITUTE)
    expect(calculateEffectiveSlotRating(slot([1337, 1128]))).toBeGreaterThan(calculateEffectiveSlotRating(slot([1337, 999])))
    expect(calculateEffectiveSlotRating(slot([1267, 1012, 999]))).toBe(Math.round(1267 * PRIMARY_ROTATION_PLAYER_SHARE + ((1012 + 999) / 2) * SUBSTITUTE_ROTATION_GROUP_SHARE + 2 * ROTATION_BONUS_PER_SUBSTITUTE))
    expect(calculateEffectiveSlotRating(slot([1267, 1012, 999]))).toBe(calculateEffectiveSlotRating(slot([999, 1267, 1012])))
  })

  it("calculates team effective strength and participant averages separately", () => {
    expect(calculateEffectiveTeamStrength([{ members: [m(1000)] }, { members: [m(1100), m(900)] }])).toBe(1025)
    expect(calculateParticipantAverageRating([m(1000), m(1100), m(900)])).toBe(1000)
  })
})
