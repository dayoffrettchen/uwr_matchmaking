import { MAX_CANDIDATES, MAX_COMPUTATION_TIME_MS } from "@/lib/matchmaking/constants"

export const MATCHMAKING_SETTINGS_COOKIE = "uwr-matchmaking-settings"

export type MatchmakingSettings = {
  maxCandidates: number
  maxGenerations: number
  populationSize: number
  maxComputationTimeMs: number
}

export const DEFAULT_MATCHMAKING_SETTINGS: MatchmakingSettings = {
  maxCandidates: MAX_CANDIDATES,
  maxGenerations: 80,
  populationSize: 48,
  maxComputationTimeMs: MAX_COMPUTATION_TIME_MS,
}

export const MATCHMAKING_SETTING_FIELDS: Array<{
  key: keyof MatchmakingSettings
  label: string
  unit: string
  min: number
  max: number
  step: number
  explanation: string
}> = [
  {
    key: "maxCandidates",
    label: "Maximale Kandidaten",
    unit: "Aufstellungen",
    min: 500,
    max: 50_000,
    step: 500,
    explanation: "Begrenzt, wie viele mögliche Teamaufteilungen bewertet werden. Höhere Werte suchen länger nach faireren Teams.",
  },
  {
    key: "maxGenerations",
    label: "Generationen",
    unit: "Runden",
    min: 10,
    max: 300,
    step: 5,
    explanation: "Bestimmt, wie viele Optimierungsrunden der genetische Algorithmus maximal durchläuft.",
  },
  {
    key: "populationSize",
    label: "Population",
    unit: "Kandidaten je Runde",
    min: 12,
    max: 200,
    step: 4,
    explanation: "Legt fest, wie viele Aufstellungen pro Runde parallel verglichen und weiterentwickelt werden.",
  },
  {
    key: "maxComputationTimeMs",
    label: "Zeitlimit",
    unit: "Millisekunden",
    min: 50,
    max: 2_000,
    step: 50,
    explanation: "Bricht die Suche nach dieser Zeit ab. Das beste bis dahin gefundene Ergebnis wird verwendet.",
  },
]

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function normalizeMatchmakingSettings(input: Partial<Record<keyof MatchmakingSettings, unknown>>): MatchmakingSettings {
  return Object.fromEntries(
    MATCHMAKING_SETTING_FIELDS.map((field) => {
      const raw = input[field.key]
      const parsed = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN
      const fallback = DEFAULT_MATCHMAKING_SETTINGS[field.key]
      return [field.key, clamp(Number.isFinite(parsed) ? Math.round(parsed) : fallback, field.min, field.max)]
    }),
  ) as MatchmakingSettings
}

export function parseMatchmakingSettingsCookie(value: string | undefined): MatchmakingSettings {
  if (!value) return DEFAULT_MATCHMAKING_SETTINGS
  try {
    return normalizeMatchmakingSettings(JSON.parse(value) as Partial<Record<keyof MatchmakingSettings, unknown>>)
  } catch {
    return DEFAULT_MATCHMAKING_SETTINGS
  }
}
