"use server"

import { revalidatePath } from "next/cache"
import { and, eq, ne } from "drizzle-orm"
import { db } from "@/lib/db"
import { playerPositionRatings } from "@/lib/db/schema"
import { requireOrganizer } from "@/lib/auth/server"
import { PLAYER_POSITIONS, type PlayerPosition } from "@/lib/ratings/types"

function assertPosition(position: string): asserts position is PlayerPosition {
  if (!PLAYER_POSITIONS.includes(position as PlayerPosition)) throw new Error("Ungültige Position")
}

function parseNullablePreferenceOrder(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "")
  if (!raw) return null

  const preferenceOrder = Number(raw)
  if (![1, 2, 3].includes(preferenceOrder)) throw new Error("Ungültige Präferenz")

  return preferenceOrder
}

export async function updatePlayerPositionRating(formData: FormData) {
  await requireOrganizer()

  const playerId = Number(formData.get("playerId"))
  const position = String(formData.get("position") ?? "")
  assertPosition(position)

  const preferenceOrder = parseNullablePreferenceOrder(formData.get("preferenceOrder"))
  const isEligible = formData.get("isEligible") === "on" || preferenceOrder !== null
  const savedPreferenceOrder = isEligible ? preferenceOrder : null
  const rating = Number(formData.get("rating") ?? formData.get("initialRating") ?? 1000)
  const initialRating = Number(formData.get("initialRating") ?? rating)

  if (
    !Number.isInteger(playerId) ||
    playerId <= 0 ||
    !Number.isInteger(rating) ||
    rating < 100 ||
    !Number.isInteger(initialRating) ||
    initialRating < 100
  ) {
    throw new Error("Ungültige Eingabe")
  }

  await db.transaction(async (tx) => {
    if (savedPreferenceOrder) {
      await tx
        .update(playerPositionRatings)
        .set({ preferenceOrder: null })
        .where(
          and(
            eq(playerPositionRatings.playerId, playerId),
            eq(playerPositionRatings.preferenceOrder, savedPreferenceOrder),
            ne(playerPositionRatings.position, position),
          ),
        )
    }

    await tx
      .insert(playerPositionRatings)
      .values({ playerId, position, initialRating, rating, isEligible, preferenceOrder: savedPreferenceOrder })
      .onConflictDoUpdate({
        target: [playerPositionRatings.playerId, playerPositionRatings.position],
        set: { initialRating, rating, isEligible, preferenceOrder: savedPreferenceOrder, updatedAt: new Date() },
      })
  })

  revalidatePath("/spieler")
  revalidatePath("/ranking")
}
