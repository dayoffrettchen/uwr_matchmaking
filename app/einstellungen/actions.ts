"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { requireOrganizer } from "@/lib/auth/server"
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
