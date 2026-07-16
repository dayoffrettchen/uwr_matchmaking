import { describe, expect, it } from "vitest"
import { summarizePersistedLineupStrength, type PersistedLineupRow } from "../persisted-lineup"

const row = (team: unknown, assignedPosition: "goalkeeper" | "defender" | "forward", rotationGroupId: number, signupId = rotationGroupId): PersistedLineupRow => ({ signupId, team, assignedPosition, rotationGroupId, rating: 1000, startsInWater: true })
const completeRows = (): PersistedLineupRow[] => [1, 2].flatMap((team) => [row(team, "goalkeeper", team * 10 + 1), row(team, "defender", team * 10 + 2), row(team, "forward", team * 10 + 3)])

describe("persisted lineup integrity diagnostics", () => {
  for (const team of [null, 0, 3]) it(`reports invalid team ${String(team)}`, () => {
    const summary = summarizePersistedLineupStrength([...completeRows(), row(team, "goalkeeper", 99, 99)])
    expect(summary.diagnostics.some((diagnostic) => diagnostic.code === "INVALID_TEAM")).toBe(true)
    expect(summary.teams[1].complete).toBe(false)
    expect(summary.teams[2].complete).toBe(false)
  })

  it("reports goalkeeper/defender mixed rotation groups", () => {
    const summary = summarizePersistedLineupStrength([...completeRows(), row(1, "goalkeeper", 77, 77), row(1, "defender", 77, 78)])
    expect(summary.diagnostics.some((diagnostic) => diagnostic.code === "MIXED_POSITION_GROUP" && diagnostic.team === 1 && diagnostic.rotationGroupId === 77 && diagnostic.positions.join(",") === "defender,goalkeeper")).toBe(true)
    expect(summary.teams[1].complete).toBe(false)
  })

  it("reports defender/forward mixed rotation groups", () => {
    const summary = summarizePersistedLineupStrength([...completeRows(), row(2, "defender", 88, 88), row(2, "forward", 88, 89)])
    expect(summary.diagnostics.some((diagnostic) => diagnostic.code === "MIXED_POSITION_GROUP" && diagnostic.team === 2 && diagnostic.rotationGroupId === 88 && diagnostic.positions.join(",") === "defender,forward")).toBe(true)
    expect(summary.teams[2].complete).toBe(false)
  })

  it("allows cross-team reuse of group ids when each team group has one position", () => {
    const summary = summarizePersistedLineupStrength([row(1, "goalkeeper", 5, 1), row(2, "goalkeeper", 5, 2), ...completeRows()])
    expect(summary.diagnostics.filter((diagnostic) => diagnostic.code === "MIXED_POSITION_GROUP")).toHaveLength(0)
  })

  it("keeps normal generated lineups complete", () => {
    const summary = summarizePersistedLineupStrength(completeRows())
    expect(summary.diagnostics).toHaveLength(0)
    expect(summary.teams[1].complete).toBe(true)
    expect(summary.teams[2].complete).toBe(true)
  })
})
