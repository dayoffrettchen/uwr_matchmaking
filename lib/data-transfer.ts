import "server-only"

import { db, pool } from "@/lib/db"
import {
  matchPlayers,
  matches,
  messages,
  playerPositionPreferences,
  playerPositionRatings,
  players,
  signups,
  trainings,
} from "@/lib/db/schema"

const EXPORT_VERSION = 1
export const DELETE_CONFIRMATION = "ALLE DATEN LÖSCHEN"

const TABLES = [
  "trainings",
  "players",
  "player_position_preferences",
  "player_position_ratings",
  "matches",
  "match_players",
  "signups",
  "messages",
] as const

const DELETE_ORDER = [
  messages,
  signups,
  matchPlayers,
  matches,
  playerPositionRatings,
  playerPositionPreferences,
  players,
  trainings,
] as const

type TableName = (typeof TABLES)[number]
type ExportData = Record<TableName, unknown[]>
const TABLE_COLUMNS: Record<TableName, string[]> = {
  trainings: ["id", "title", "scheduledAt", "location", "isOpen", "createdAt"],
  players: ["id", "authUserId", "email", "name", "phone", "profileCompleted", "notes", "skillRating", "initialRatingConfigured", "createdAt", "updatedAt"],
  player_position_preferences: ["id", "playerId", "position", "preferenceOrder", "createdAt", "updatedAt"],
  player_position_ratings: ["id", "playerId", "position", "rating", "initialRating", "gamesPlayed", "wins", "draws", "losses", "isEligible", "preferenceOrder", "updatedAt"],
  matches: ["id", "trainingId", "playedAt", "team1Score", "team2Score", "status", "createdBy", "createdAt", "finalizedAt"],
  match_players: ["id", "matchId", "playerId", "team", "position", "lineupType", "rotationGroupId", "rotationGroupType", "rotationOrder", "startsInWater", "ratingBefore", "ratingAfter", "ratingDelta", "goals", "createdAt"],
  signups: ["id", "trainingId", "playerId", "team", "assignedPosition", "lineupType", "rotationGroupId", "rotationGroupType", "rotationOrder", "startsInWater", "source", "createdAt"],
  messages: ["id", "trainingId", "playerName", "phone", "body", "matched", "createdAt"],
}


export type AppDataExport = {
  app: "uwr-matchmaking"
  version: typeof EXPORT_VERSION
  exportedAt: string
  data: ExportData
}

export async function exportAppData(): Promise<AppDataExport> {
  const [trainingRows, playerRows, preferenceRows, ratingRows, matchRows, matchPlayerRows, signupRows, messageRows] = await Promise.all([
    db.select().from(trainings),
    db.select().from(players),
    db.select().from(playerPositionPreferences),
    db.select().from(playerPositionRatings),
    db.select().from(matches),
    db.select().from(matchPlayers),
    db.select().from(signups),
    db.select().from(messages),
  ])

  return {
    app: "uwr-matchmaking",
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      trainings: trainingRows,
      players: playerRows,
      player_position_preferences: preferenceRows,
      player_position_ratings: ratingRows,
      matches: matchRows,
      match_players: matchPlayerRows,
      signups: signupRows,
      messages: messageRows,
    },
  }
}

export async function importAppData(jsonText: string) {
  const parsed = JSON.parse(jsonText) as Partial<AppDataExport>
  if (parsed.app !== "uwr-matchmaking" || parsed.version !== EXPORT_VERSION || !parsed.data) {
    throw new Error("Die JSON-Datei ist kein gültiger UWR-Matchmaking-Export.")
  }

  for (const table of TABLES) {
    if (!Array.isArray(parsed.data[table])) {
      throw new Error(`Im Export fehlt die Tabelle „${table}“.`)
    }
  }

  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    for (const table of ["messages", "signups", "match_players", "matches", "player_position_ratings", "player_position_preferences", "players", "trainings"]) {
      await client.query(`DELETE FROM "${table}"`)
    }

    for (const table of TABLES) {
      const rows = parsed.data[table]
      if (rows.length === 0) continue

      const columns = TABLE_COLUMNS[table]
      const quotedColumns = columns.map((column) => `"${toSnakeCase(column)}"`).join(", ")
      const values = rows.map((row) => columns.map((column) => normalizeValue((row as Record<string, unknown>)[column])))
      const placeholders = values
        .map((row, rowIndex) => `(${row.map((_, columnIndex) => `$${rowIndex * columns.length + columnIndex + 1}`).join(", ")})`)
        .join(", ")

      await client.query(
        `INSERT INTO "${table}" (${quotedColumns}) VALUES ${placeholders}`,
        values.flat(),
      )
    }

    for (const table of TABLES) {
      await client.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 1), true)`)
    }
    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

export async function clearAppData() {
  for (const table of DELETE_ORDER) {
    await db.delete(table)
  }
}

function normalizeValue(value: unknown) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(value)
  return value
}

function toSnakeCase(value: string) {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
}
