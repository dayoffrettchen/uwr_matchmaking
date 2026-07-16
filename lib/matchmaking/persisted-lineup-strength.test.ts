import { describe, expect, it } from "vitest"
import { summarizePersistedLineupStrength } from "./persisted-lineup-strength"

function row(signupId: number, team: 1 | 2, position: "defender" | "goalkeeper" | "forward", group: number, rating: number, startsInWater = true, rotationOrder = 1) {
  return { signupId, team, position, rotationGroupId: group, assignedRating: rating, startsInWater, rotationOrder }
}

describe("persisted-lineup-strength", () => {
  it("uses effective slot strength for Hecke/Holger regression while participant averages reproduce screenshot arithmetic", () => {
    const fillerBlueRatings = [1076, 1076, 1076, 1076, 1076, 1076, 1076, 1073]
    const fillerWhiteRatings = [1063, 1063, 1063, 1063, 1063, 1063, 1062]
    const fillerBlue = fillerBlueRatings.map((rating, i) => row(100 + i, 1, i % 2 ? "goalkeeper" : "forward", 10 + i, rating, true))
    const fillerWhite = fillerWhiteRatings.map((rating, i) => row(200 + i, 2, i % 2 ? "goalkeeper" : "forward", 20 + i, rating, true))
    const auto = summarizePersistedLineupStrength([
      row(1, 1, "defender", 1, 1131), row(2, 1, "defender", 1, 991, false, 2), row(3, 1, "defender", 2, 999),
      row(4, 2, "defender", 1, 1337), row(5, 2, "defender", 1, 1128, false, 2), row(6, 2, "defender", 2, 1157), row(7, 2, "defender", 2, 972, false, 2),
      ...fillerBlue, ...fillerWhite,
    ])
    const manual = summarizePersistedLineupStrength([
      row(1, 1, "defender", 1, 1131), row(2, 1, "defender", 1, 991, false, 2), row(5, 1, "defender", 2, 1128),
      row(4, 2, "defender", 1, 1337), row(3, 2, "defender", 1, 999, false, 2), row(6, 2, "defender", 2, 1157), row(7, 2, "defender", 2, 972, false, 2),
      ...fillerBlue, ...fillerWhite,
    ])
    expect(manual.strengthDifference!).toBeLessThan(auto.strengthDifference!)
    expect(auto.teams[1].participantAverageRating).toBe(1066)
    expect(auto.teams[2].participantAverageRating).toBe(1094)
    expect(manual.teams[1].participantAverageRating).toBe(1078)
    expect(manual.teams[2].participantAverageRating).toBe(1082)
  })
})
