"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { requireOrganizer } from "@/lib/auth/server"
import { MATCHMAKING_SETTINGS_COOKIE, normalizeMatchmakingSettings } from "@/lib/matchmaking/settings"

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
