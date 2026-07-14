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

export async function updatePlayerPositionRating(formData: FormData) {
  await requireOrganizer()
  const playerId = Number(formData.get("playerId"))
  const position = String(formData.get("position") ?? "")
  assertPosition(position)
  const isEligible = formData.get("isEligible") === "on"
  const preferenceOrderRaw = String(formData.get("preferenceOrder") ?? "")
  const preferenceOrder = preferenceOrderRaw ? Number(preferenceOrderRaw) : null
  const initialRating = Number(formData.get("initialRating") ?? 1000)
  if (!Number.isInteger(playerId) || playerId <= 0 || !Number.isInteger(initialRating) || initialRating < 100) throw new Error("Ungültige Eingabe")

  await db.transaction(async (tx) => {
    if (preferenceOrder) {
      await tx.update(playerPositionRatings).set({ preferenceOrder: null }).where(and(eq(playerPositionRatings.playerId, playerId), eq(playerPositionRatings.preferenceOrder, preferenceOrder), ne(playerPositionRatings.position, position)))
    }
    await tx
      .insert(playerPositionRatings)
      .values({ playerId, position, initialRating, rating: initialRating, isEligible, preferenceOrder })
      .onConflictDoUpdate({ target: [playerPositionRatings.playerId, playerPositionRatings.position], set: { initialRating, isEligible, preferenceOrder, updatedAt: new Date() } })
  })
  revalidatePath("/spieler")
  revalidatePath("/ranking")
}
