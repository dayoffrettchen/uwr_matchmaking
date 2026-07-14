"use server"

import { revalidatePath } from "next/cache"
import { and, eq, inArray, ne } from "drizzle-orm"
import { db } from "@/lib/db"
import { playerPositionRatings } from "@/lib/db/schema"
import { requireOrganizer } from "@/lib/auth/server"
import { DEFAULT_RATING } from "@/lib/ratings/constants"
import { PLAYER_POSITIONS, type PlayerPosition } from "@/lib/ratings/types"

export type UpdatePlayerPositionRatingState = {
  ok: boolean
  message?: string
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

function fieldName(position: PlayerPosition, name: string) {
  return `${position}:${name}`
}

export async function updatePlayerPositionRating(
  _previousState: UpdatePlayerPositionRatingState,
  formData: FormData,
): Promise<UpdatePlayerPositionRatingState> {
  try {
    await requireOrganizer()

    const playerId = Number(formData.get("playerId"))
    if (!Number.isInteger(playerId) || playerId <= 0) {
      throw new Error("Ungültiger Spieler")
    }

    const submittedPositions = formData.getAll("positions").map(String)
    if (
      submittedPositions.length !== PLAYER_POSITIONS.length ||
      new Set(submittedPositions).size !== submittedPositions.length ||
      submittedPositions.some((position) => !PLAYER_POSITIONS.includes(position as PlayerPosition))
    ) {
      throw new Error("Ungültige Position")
    }

    const existingRatings = await db
      .select({
        position: playerPositionRatings.position,
        initialRating: playerPositionRatings.initialRating,
        gamesPlayed: playerPositionRatings.gamesPlayed,
      })
      .from(playerPositionRatings)
      .where(and(eq(playerPositionRatings.playerId, playerId), inArray(playerPositionRatings.position, submittedPositions)))

    const existingByPosition = new Map(
      existingRatings.map((rating) => [
        rating.position as PlayerPosition,
        { initialRating: rating.initialRating, gamesPlayed: rating.gamesPlayed },
      ]),
    )

    const updates = PLAYER_POSITIONS.map((position) => {
      const existing = existingByPosition.get(position)
      const initialRating = existing?.gamesPlayed
        ? (existing.initialRating ?? DEFAULT_RATING)
        : parseRating(formData.get(fieldName(position, "initialRating")), existing?.initialRating ?? DEFAULT_RATING)
      const rating = parseRating(formData.get(fieldName(position, "rating")), initialRating)
      const preferenceOrder = parseNullablePreferenceOrder(formData.get(fieldName(position, "preferenceOrder")))
      const isEligible = formData.get(fieldName(position, "isEligible")) === "on" || preferenceOrder !== null

      return { position, initialRating, rating, isEligible, preferenceOrder: isEligible ? preferenceOrder : null }
    })

    const preferenceOrders = updates
      .map((update) => update.preferenceOrder)
      .filter((preferenceOrder): preferenceOrder is number => preferenceOrder !== null)
    if (new Set(preferenceOrders).size !== preferenceOrders.length) {
      throw new Error("Jede Präferenz darf nur einmal vergeben werden")
    }

    await db.transaction(async (tx) => {
      for (const update of updates) {
        if (update.preferenceOrder) {
          await tx
            .update(playerPositionRatings)
            .set({ preferenceOrder: null, updatedAt: new Date() })
            .where(
              and(
                eq(playerPositionRatings.playerId, playerId),
                eq(playerPositionRatings.preferenceOrder, update.preferenceOrder),
                ne(playerPositionRatings.position, update.position),
              ),
            )
        }

        await tx
          .insert(playerPositionRatings)
          .values({ playerId, ...update })
          .onConflictDoUpdate({
            target: [playerPositionRatings.playerId, playerPositionRatings.position],
            set: { ...update, updatedAt: new Date() },
          })
      }
    })

    revalidatePath("/spieler")
    revalidatePath("/ranking")

    return { ok: true, message: "Gespeichert" }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Rating konnte nicht gespeichert werden" }
  }
}
