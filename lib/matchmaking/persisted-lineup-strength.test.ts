import { describe, expect, it } from "vitest"
import { summarizePersistedLineupStrength } from "./persisted-lineup-strength"

function row(signupId: number, team: 1 | 2, position: "defender" | "goalkeeper" | "forward", group: number, rating: number | null, startsInWater = true, rotationOrder = 1) {
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

  it("does not report complete effective MMR when an active player is missing a rating", () => {
    const summary = summarizePersistedLineupStrength([
      row(1, 1, "goalkeeper", 1, null, true),
      ...[2, 3, 4, 5, 6].map((id) => row(id, 1, id % 2 ? "defender" : "forward", id, 1000, true)),
      row(7, 1, "forward", 7, 1000, false),
    ])
    expect(summary.teams[1].activeCount).toBe(6)
    expect(summary.teams[1].substituteCount).toBe(1)
    expect(summary.teams[1].complete).toBe(false)
    expect(summary.teams[1].effectiveStrength).toBe(null)
    expect(summary.teams[1].missingRatingSignupIds).toEqual([1])
  })

  it("returns diagnostics for invalid persisted rotation slots", () => {
    const zeroStarter = summarizePersistedLineupStrength([row(1, 1, "defender", 1, 1000, false)])
    expect(zeroStarter.teams[1].diagnostics.map((d) => d.code)).toContain("INVALID_STARTER_COUNT")
    const twoStarters = summarizePersistedLineupStrength([row(1, 1, "defender", 1, 1000, true), row(2, 1, "defender", 1, 990, true, 2)])
    expect(twoStarters.teams[1].diagnostics.map((d) => d.code)).toContain("INVALID_STARTER_COUNT")
    const duplicateOrder = summarizePersistedLineupStrength([row(1, 1, "defender", 1, 1000, true), row(2, 1, "defender", 1, 990, false, 1)])
    expect(duplicateOrder.teams[1].diagnostics.map((d) => d.code)).toContain("DUPLICATE_ROTATION_ORDER")
    const invalidOrder = summarizePersistedLineupStrength([row(1, 1, "defender", 1, 1000, true, 0)])
    expect(invalidOrder.teams[1].diagnostics.map((d) => d.code)).toContain("INVALID_ROTATION_ORDER")
    const missingStart = summarizePersistedLineupStrength([{ signupId: 1, team: 1, position: "defender", rotationGroupId: 1, assignedRating: 1000, startsInWater: null, rotationOrder: 1 }])
    expect(missingStart.teams[1].diagnostics.map((d) => d.code)).toContain("MISSING_START_STATE")
  })
})

  it("marks invalid team rows globally incomplete instead of omitting them", () => {
    const summary = summarizePersistedLineupStrength([
      row(1, 1, "defender", 1, 1000, true),
      row(2, 2, "defender", 1, 1000, true),
      { signupId: 3, team: null, position: "forward", rotationGroupId: 2, assignedRating: 1000, startsInWater: true, rotationOrder: 1 },
      { signupId: 4, team: 0, position: "forward", rotationGroupId: 2, assignedRating: 1000, startsInWater: true, rotationOrder: 1 },
      { signupId: 5, team: 3, position: "forward", rotationGroupId: 2, assignedRating: 1000, startsInWater: true, rotationOrder: 1 },
    ])
    expect(summary.strengthDifference).toBe(null)
    expect(summary.teams[1].complete).toBe(false)
    expect(summary.teams[2].complete).toBe(false)
    expect(summary.teams[1].effectiveStrength).toBe(null)
    expect(summary.teams[2].effectiveStrength).toBe(null)
    expect(summary.teams[1].diagnostics.filter((d) => d.code === "INVALID_TEAM")).toHaveLength(3)
  })

  it("marks mixed-position rotation groups incomplete per team while allowing id reuse", () => {
    const summary = summarizePersistedLineupStrength([
      row(1, 1, "defender", 1, 1000, true),
      row(2, 1, "forward", 1, 990, false, 2),
      row(3, 2, "defender", 1, 1000, true),
    ])
    expect(summary.teams[1].complete).toBe(false)
    expect(summary.teams[1].effectiveStrength).toBe(null)
    expect(summary.teams[1].diagnostics.some((d) => d.code === "MIXED_POSITION_GROUP" && d.team === 1 && d.rotationGroupId === 1 && d.positions.join(",") === "defender,forward")).toBe(true)
    expect(summary.teams[2].diagnostics.some((d) => d.code === "MIXED_POSITION_GROUP")).toBe(false)
  })
