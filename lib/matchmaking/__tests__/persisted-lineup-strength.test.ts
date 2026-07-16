import { describe, expect, it } from "vitest"
import { calculatePersistedLineupStrength, type PersistedLineupRow } from "../persisted-lineup-strength"

const base: PersistedLineupRow[] = [
  { signupId: 1, team: 1, assignedPosition: "goalkeeper", rotationGroupId: 1, rotationOrder: 1, startsInWater: true, rating: 1200 },
  { signupId: 2, team: 1, assignedPosition: "goalkeeper", rotationGroupId: 1, rotationOrder: 2, startsInWater: false, rating: 1000 },
  { signupId: 3, team: 2, assignedPosition: "goalkeeper", rotationGroupId: 1, rotationOrder: 1, startsInWater: true, rating: 1100 },
]

describe("persisted lineup strength", () => {
  it("keeps active and substitute counts even when ratings are incomplete", () => {
    const result = calculatePersistedLineupStrength(base.map((row) => row.signupId === 2 ? { ...row, rating: null } : row))
    expect(result.teams[1].activeCount).toBe(1)
    expect(result.teams[1].substituteCount).toBe(1)
    expect(result.teams[1].complete).toBe(false)
    expect(result.teams[1].effectiveStrength).toBe(null)
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === "MISSING_RATING")).toBe(true)
  })

  it("reports invalid teams globally instead of silently omitting them", () => {
    const result = calculatePersistedLineupStrength([...base, { ...base[0], signupId: 9, team: 3 }])
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === "INVALID_TEAM")).toBe(true)
    expect(result.teams[1].complete).toBe(false)
    expect(result.teams[2].complete).toBe(false)
  })

  it("reports mixed positions inside the same team-local rotation group", () => {
    const result = calculatePersistedLineupStrength([{ ...base[0] }, { ...base[1], assignedPosition: "defender" }, base[2]])
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === "MIXED_POSITION_GROUP" && diagnostic.team === 1 && diagnostic.rotationGroupId === 1)).toBe(true)
    expect(result.teams[1].complete).toBe(false)
    expect(result.teams[1].effectiveStrength).toBe(null)
  })
})
