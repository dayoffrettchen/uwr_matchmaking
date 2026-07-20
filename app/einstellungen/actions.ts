"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { and, eq, ne, sql } from "drizzle-orm"
import { requireOrganizer } from "@/lib/auth/server"
import { db } from "@/lib/db"
import { matches, matchPlayers, playerPositionPreferences, playerPositionRatings, players, signups } from "@/lib/db/schema"
import { MATCHMAKING_SETTINGS_COOKIE, normalizeMatchmakingSettings } from "@/lib/matchmaking/settings"
import { DELETE_CONFIRMATION, clearAppData, importAppData } from "@/lib/data-transfer"
import { importSampleTrainingData } from "@/lib/test-data"

export async function saveMatchmakingSettings(formData: FormData) {
  await requireOrganizer()
  const settings = normalizeMatchmakingSettings({
    maxCandidates: formData.get("maxCandidates"),
    maxGenerations: formData.get("maxGenerations"),
    populationSize: formData.get("populationSize"),
    maxComputationTimeMs: formData.get("maxComputationTimeMs"),
  })

  const cookieStore = await cookies()
  cookieStore.set(MATCHMAKING_SETTINGS_COOKIE, JSON.stringify(settings), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  })

  revalidatePath("/")
  revalidatePath("/einstellungen")
}

export async function importTestData() {
  await requireOrganizer()
  await importSampleTrainingData()

  revalidatePath("/")
  revalidatePath("/spieler")
  revalidatePath("/ranking")
  revalidatePath("/einstellungen")
}


export async function importJsonData(formData: FormData) {
  await requireOrganizer()
  const file = formData.get("jsonFile")
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Bitte wähle eine JSON-Datei aus.")
  }

  await importAppData(await file.text())

  revalidatePath("/")
  revalidatePath("/spieler")
  revalidatePath("/ranking")
  revalidatePath("/spiele")
  revalidatePath("/ergebnisse")
  revalidatePath("/einstellungen")
}

export async function deleteAllData(formData: FormData) {
  await requireOrganizer()
  if (formData.get("confirmation") !== DELETE_CONFIRMATION) {
    throw new Error(`Bitte bestätige das Löschen mit „${DELETE_CONFIRMATION}“.`)
  }

  await clearAppData()

  revalidatePath("/")
  revalidatePath("/spieler")
  revalidatePath("/ranking")
  revalidatePath("/spiele")
  revalidatePath("/ergebnisse")
  revalidatePath("/einstellungen")
}

export async function updateOrganizerRole(formData: FormData) {
  await requireOrganizer()
  const playerId = Number(formData.get("playerId"))
  if (!Number.isInteger(playerId)) throw new Error("Spieler nicht gefunden.")

  await db.update(players).set({ isOrganizer: formData.get("isOrganizer") === "on", updatedAt: new Date() }).where(eq(players.id, playerId))
  revalidatePath("/einstellungen")
}

export async function mergePlayerAccounts(formData: FormData) {
  await requireOrganizer()
  const sourcePlayerId = Number(formData.get("sourcePlayerId"))
  const targetPlayerId = Number(formData.get("targetPlayerId"))
  if (!Number.isInteger(sourcePlayerId) || !Number.isInteger(targetPlayerId) || sourcePlayerId === targetPlayerId) {
    throw new Error("Bitte wähle zwei unterschiedliche Spieler aus.")
  }

  await db.transaction(async (tx) => {
    const [source] = await tx.select().from(players).where(eq(players.id, sourcePlayerId)).limit(1)
    const [target] = await tx.select().from(players).where(eq(players.id, targetPlayerId)).limit(1)
    if (!source || !target) throw new Error("Spieler nicht gefunden.")

    await tx.delete(signups).where(and(eq(signups.playerId, sourcePlayerId), sql`exists (select 1 from ${signups} target_signup where target_signup.training_id = ${signups.trainingId} and target_signup.player_id = ${targetPlayerId})`))
    await tx.update(signups).set({ playerId: targetPlayerId }).where(eq(signups.playerId, sourcePlayerId))

    await tx.delete(matchPlayers).where(and(eq(matchPlayers.playerId, sourcePlayerId), sql`exists (select 1 from ${matchPlayers} target_match_player where target_match_player.match_id = ${matchPlayers.matchId} and target_match_player.player_id = ${targetPlayerId})`))
    await tx.update(matchPlayers).set({ playerId: targetPlayerId }).where(eq(matchPlayers.playerId, sourcePlayerId))

    await tx.delete(playerPositionPreferences).where(and(eq(playerPositionPreferences.playerId, sourcePlayerId), sql`exists (select 1 from ${playerPositionPreferences} target_preference where target_preference.position = ${playerPositionPreferences.position} and target_preference.player_id = ${targetPlayerId})`))
    await tx.update(playerPositionPreferences).set({ playerId: targetPlayerId, updatedAt: new Date() }).where(eq(playerPositionPreferences.playerId, sourcePlayerId))

    await tx.delete(playerPositionRatings).where(and(eq(playerPositionRatings.playerId, sourcePlayerId), sql`exists (select 1 from ${playerPositionRatings} target_rating where target_rating.position = ${playerPositionRatings.position} and target_rating.player_id = ${targetPlayerId})`))
    await tx.update(playerPositionRatings).set({ playerId: targetPlayerId, updatedAt: new Date() }).where(eq(playerPositionRatings.playerId, sourcePlayerId))

    await tx.update(matches).set({ createdBy: target.email ?? target.authUserId ?? target.name }).where(eq(matches.createdBy, source.email ?? source.authUserId ?? source.name))
    await tx.update(players).set({ authUserId: null, email: null, phone: null, updatedAt: new Date() }).where(eq(players.id, sourcePlayerId))
    await tx.update(players).set({
      authUserId: target.authUserId ?? source.authUserId,
      email: target.email ?? source.email,
      phone: target.phone ?? source.phone,
      profileCompleted: target.profileCompleted || source.profileCompleted,
      isOrganizer: target.isOrganizer || source.isOrganizer,
      notes: target.notes ?? source.notes,
      updatedAt: new Date(),
    }).where(eq(players.id, targetPlayerId))
    await tx.delete(players).where(and(eq(players.id, sourcePlayerId), ne(players.id, targetPlayerId)))
  })

  revalidatePath("/")
  revalidatePath("/spieler")
  revalidatePath("/ranking")
  revalidatePath("/einstellungen")
}
