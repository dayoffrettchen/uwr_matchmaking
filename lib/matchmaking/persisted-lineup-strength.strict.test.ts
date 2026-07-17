import { describe, expect, it } from "vitest"
import { PLAYER_POSITIONS } from "@/lib/ratings/types"
import { summarizePersistedLineupStrength, type PersistedLineupStrengthRow } from "./persisted-lineup-strength"

function row(overrides: Partial<PersistedLineupStrengthRow> = {}): PersistedLineupStrengthRow {
  return { signupId: 1, team: 1, position: "defender", rotationGroupId: 1, assignedRating: 1000, startsInWater: true, rotationOrder: 1, ...overrides }
}

function codes(rows: PersistedLineupStrengthRow[]) {
  return summarizePersistedLineupStrength(rows).teams[1].diagnostics.map((diagnostic) => diagnostic.code)
}

describe("strict persisted lineup validation", () => {
  it("rejects malformed rotation group ids", () => {
    expect(codes([row({ rotationGroupId: 0 })])).toContain("INVALID_GROUP_ID")
    expect(codes([row({ rotationGroupId: -1 })])).toContain("INVALID_GROUP_ID")
    expect(codes([row({ rotationGroupId: 1.5 })])).toContain("INVALID_GROUP_ID")
    expect(codes([row({ rotationGroupId: Number.NaN })])).toContain("INVALID_GROUP_ID")
    expect(codes([row({ rotationGroupId: null })])).toContain("MISSING_GROUP")
  })

  it("rejects missing, malformed, and duplicate rotation orders", () => {
    expect(codes([row({ rotationOrder: null })])).toContain("MISSING_ROTATION_ORDER")
    expect(codes([row({ rotationOrder: 0 })])).toContain("INVALID_ROTATION_ORDER")
    expect(codes([row({ rotationOrder: -1 })])).toContain("INVALID_ROTATION_ORDER")
    expect(codes([row({ rotationOrder: 1.5 })])).toContain("INVALID_ROTATION_ORDER")
    expect(codes([row(), row({ signupId: 2, startsInWater: false })])).toContain("DUPLICATE_ROTATION_ORDER")
  })

  it("rejects non-finite ratings", () => {
    const summary = summarizePersistedLineupStrength([row({ assignedRating: Number.NaN })])
    expect(summary.teams[1].diagnostics.map((diagnostic) => diagnostic.code)).toContain("INVALID_RATING")
    expect(summary.teams[1].complete).toBe(false)
    expect(summary.teams[1].effectiveStrength).toBe(null)
  })

  it("keeps a valid generated-style lineup complete", () => {
    const rows: PersistedLineupStrengthRow[] = [1, 2].flatMap((team) => PLAYER_POSITIONS.map((position, index) => ({ signupId: team * 10 + index, team, position, rotationGroupId: team * 10 + index + 1, assignedRating: 1000 + index, startsInWater: true, rotationOrder: 1 })))
    const summary = summarizePersistedLineupStrength(rows)
    expect(summary.teams[1].complete).toBe(true)
    expect(summary.teams[2].complete).toBe(true)
  })
})
