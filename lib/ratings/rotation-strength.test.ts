import { describe, expect, it } from "vitest"
import { calculateEffectiveSlotRating, calculateEffectiveTeamStrength, calculateParticipantAverageRating } from "./rotation-strength"

const m = (rating: number) => ({ rating, startsInWater: false })

describe("rotation-strength", () => {
  it("scores one player as their rating and substitutes monotonically", () => {
    expect(calculateEffectiveSlotRating({ members: [m(1267)] })).toBe(1267)
    expect(calculateEffectiveSlotRating({ members: [m(1267), m(1012)] })).toBe(1297)
    expect(calculateEffectiveSlotRating({ members: [m(1267), m(1267)] })).toBe(1297)
    expect(calculateEffectiveSlotRating({ members: [m(1267), m(1400)] })).toBe(1430)
    expect(calculateEffectiveSlotRating({ members: [m(1267), m(1012), m(999)] })).toBe(1327)
    expect(calculateEffectiveSlotRating({ members: [m(1267), m(1012), m(999), m(1400)] })).toBe(1490)
  })

  it("calculates team effective strength and participant averages separately", () => {
    expect(calculateEffectiveTeamStrength([{ members: [m(1000)] }, { members: [m(1100), m(900)] }])).toBe(1065)
    expect(calculateParticipantAverageRating([m(1000), m(1100), m(900)])).toBe(1000)
  })
})
