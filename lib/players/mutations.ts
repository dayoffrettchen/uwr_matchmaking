"use server"

import { revalidatePath } from "next/cache"
import { and, eq, ne } from "drizzle-orm"
import { db } from "@/lib/db"
import { playerPositionRatings } from "@/lib/db/schema"
import { requireOrganizer } from "@/lib/auth/server"
import { PLAYER_POSITIONS, type PlayerPosition } from "@/lib/ratings/types"

export type UpdatePlayerPositionRatingState = {
  ok: boolean
  message?: string
}

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

function parseRating(value: FormDataEntryValue | null, fallback: number): number {
  const raw = String(value ?? "")
  if (!raw) return fallback

  const rating = Number(raw)
  if (!Number.isInteger(rating) || rating < 100) throw new Error("Ratings müssen ganze Zahlen ab 100 sein")

  return rating
}

export async function updatePlayerPositionRating(
  _previousState: UpdatePlayerPositionRatingState,
  formData: FormData,
): Promise<UpdatePlayerPositionRatingState> {
  try {
    await requireOrganizer()

    const playerId = Number(formData.get("playerId"))
    const position = String(formData.get("position") ?? "")
    assertPosition(position)

    const preferenceOrder = parseNullablePreferenceOrder(formData.get("preferenceOrder"))
    const isEligible = formData.get("isEligible") === "on" || preferenceOrder !== null
    const savedPreferenceOrder = isEligible ? preferenceOrder : null
    const initialRating = parseRating(formData.get("initialRating"), 1000)
    const rating = parseRating(formData.get("rating"), initialRating)

    if (!Number.isInteger(playerId) || playerId <= 0) {
      throw new Error("Ungültiger Spieler")
    }

    await db.transaction(async (tx) => {
      if (savedPreferenceOrder) {
        await tx
          .update(playerPositionRatings)
          .set({ preferenceOrder: null, updatedAt: new Date() })
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

    return { ok: true, message: "Gespeichert" }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Rating konnte nicht gespeichert werden" }
  }
}
