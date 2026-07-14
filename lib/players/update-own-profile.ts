import "server-only"

import { eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { playerPositionPreferences, players } from "@/lib/db/schema"
import { requireCurrentPlayer } from "@/lib/players/current-player"
import { PLAYER_POSITIONS, type PlayerPosition } from "@/lib/ratings/types"

export type UpdateOwnProfileInput = {
  name: string
  phone?: string | null
  preferredPositions: PlayerPosition[]
  notes?: string | null
}

function isPlayerPosition(value: string): value is PlayerPosition {
  return PLAYER_POSITIONS.includes(value as PlayerPosition)
}

export async function updateOwnProfile(input: UpdateOwnProfileInput): Promise<void> {
  const currentPlayer = await requireCurrentPlayer()
  const name = input.name.trim()
  const phone = input.phone?.trim() || null
  const notes = input.notes?.trim().slice(0, 1000) || null
  const preferredPositions = [...new Set(input.preferredPositions)].filter(isPlayerPosition)

  if (!name) throw new Error("Name ist erforderlich.")
  if (preferredPositions.length === 0) throw new Error("Bitte wähle mindestens eine bevorzugte Position.")

  await db.transaction(async (tx) => {
    await tx
      .update(players)
      .set({ name, phone, notes, profileCompleted: true, updatedAt: new Date() })
      .where(eq(players.id, currentPlayer.id))

    await tx.delete(playerPositionPreferences).where(eq(playerPositionPreferences.playerId, currentPlayer.id))

    await tx.insert(playerPositionPreferences).values(
      preferredPositions.map((position, index) => ({
        playerId: currentPlayer.id,
        position,
        preferenceOrder: index + 1,
      })),
    )
  })
}
