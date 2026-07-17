import { describe, expect, it } from "vitest"
import { ROTATION_BONUS_PER_SUBSTITUTE } from "@/lib/ratings/constants"
import { ACTIVE_SLOTS_PER_POSITION, MAX_ACTIVE_PLAYERS_PER_TEAM } from "../rules"
import { DEFAULT_MATCHMAKING_SETTINGS } from "../settings"
import { MATCHMAKING_QUALITY_THRESHOLDS, POSITION_PREFERENCE_PENALTIES } from "../constants"
import { buildMatchmakingHelpTables } from "../help-tables"

function row(locale: "de" | "en", tableId: string, label: string) {
  const table = buildMatchmakingHelpTables(locale).find((item) => item.id === tableId)
  const found = table?.rows.find((item) => item.label === label)
  if (!found) throw new Error(`Missing ${tableId} row ${label}`)
  return found
}

function allNumericValues(locale: "de" | "en") {
  return buildMatchmakingHelpTables(locale).map((table) => table.rows.map((item) => item.numericValues)).flat(2)
}

describe("matchmaking help table data", () => {
  it("shows the production substitute bonus", () => {
    expect(row("de", "lineup", "Wechselspieler-Bonus").numericValues).toContain(ROTATION_BONUS_PER_SUBSTITUTE)
    expect(row("en", "lineup", "Substitute bonus").numericValues).toContain(ROTATION_BONUS_PER_SUBSTITUTE)
  })

  it("shows the 2/2/2 target lineup and maximum active count", () => {
    expect(row("de", "lineup", "Torwart-Slots").numericValues).toEqual([ACTIVE_SLOTS_PER_POSITION.goalkeeper])
    expect(row("de", "lineup", "Verteidiger-Slots").numericValues).toEqual([ACTIVE_SLOTS_PER_POSITION.defender])
    expect(row("de", "lineup", "Stürmer-Slots").numericValues).toEqual([ACTIVE_SLOTS_PER_POSITION.forward])
    expect(row("en", "lineup", "Active players per complete team").numericValues).toEqual([MAX_ACTIVE_PLAYERS_PER_TEAM])
  })

  it("shows default search settings from production defaults", () => {
    expect(row("en", "search", "Maximum candidates").numericValues[0]).toBe(DEFAULT_MATCHMAKING_SETTINGS.maxCandidates)
    expect(row("en", "search", "Generations").numericValues[0]).toBe(DEFAULT_MATCHMAKING_SETTINGS.maxGenerations)
    expect(row("en", "search", "Population").numericValues[0]).toBe(DEFAULT_MATCHMAKING_SETTINGS.populationSize)
    expect(row("en", "search", "Time limit").numericValues[0]).toBe(DEFAULT_MATCHMAKING_SETTINGS.maxComputationTimeMs)
  })

  it("shows position preference values without calling them MMR", () => {
    const preferenceRows = buildMatchmakingHelpTables("en").find((table) => table.id === "preferences")!.rows
    expect(preferenceRows.map((item) => item.numericValues[0])).toEqual([
      POSITION_PREFERENCE_PENALTIES.main,
      POSITION_PREFERENCE_PENALTIES.secondaryRank2,
      POSITION_PREFERENCE_PENALTIES.secondaryRank3,
      POSITION_PREFERENCE_PENALTIES.eligibleUnranked,
      POSITION_PREFERENCE_PENALTIES.ineligible,
    ])
    expect(preferenceRows.map((item) => `${item.label} ${item.value} ${item.meaning}`).join(" ").includes("MMR")).toBe(false)
  })

  it("shows rating status ranges", () => {
    expect(row("de", "ratings", "Noch nicht eingestuft").numericValues).toEqual([0, 4])
    expect(row("de", "ratings", "Vorläufig").numericValues).toEqual([5, 14])
    expect(row("de", "ratings", "Eingestuft").numericValues).toEqual([15])
  })

  it("shows quality thresholds", () => {
    expect(row("en", "quality", "High").numericValues).toEqual([
      MATCHMAKING_QUALITY_THRESHOLDS.highMaximumStrengthDifference,
      MATCHMAKING_QUALITY_THRESHOLDS.maximumUnstableFraction,
    ])
    expect(row("en", "quality", "Low").numericValues).toEqual([MATCHMAKING_QUALITY_THRESHOLDS.lowAboveStrengthDifference])
  })

  it("keeps German and English tables numerically equivalent", () => {
    expect(allNumericValues("de")).toEqual(allNumericValues("en"))
  })
})
