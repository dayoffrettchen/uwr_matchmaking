import "server-only"

import { and, eq, isNull } from "drizzle-orm"

import { db } from "@/lib/db"
import { playerPositionRatings, players, type Player } from "@/lib/db/schema"
import { type SessionUser } from "@/lib/auth/server"
import { initializePlayerRatings } from "@/lib/players/initialize-ratings"
import { PLAYER_POSITIONS } from "@/lib/ratings/types"
import { DEFAULT_RATING } from "@/lib/ratings/constants"

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export async function ensureCurrentPlayerProfile(user: SessionUser): Promise<Player> {
  if (!user.email) {
    throw new Error("Das Google-Konto besitzt keine verwendbare E-Mail-Adresse.")
  }

  const normalizedEmail = normalizeEmail(user.email)

  const [byAuthUserId] = await db.select().from(players).where(eq(players.authUserId, user.id)).limit(1)
  if (byAuthUserId) return byAuthUserId

  const [unlinkedByEmail] = await db
    .select()
    .from(players)
    .where(and(eq(players.email, normalizedEmail), isNull(players.authUserId)))
    .limit(1)

  if (unlinkedByEmail) {
    const [linked] = await db
      .update(players)
      .set({ authUserId: user.id, email: normalizedEmail, updatedAt: new Date() })
      .where(eq(players.id, unlinkedByEmail.id))
      .returning()
    await initializePlayerRatings(linked.id)
    return linked
  }

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(players)
      .values({
        authUserId: user.id,
        email: normalizedEmail,
        name: user.name?.trim() || normalizedEmail.split("@")[0],
      })
      .returning()

    await tx
      .insert(playerPositionRatings)
      .values(
        PLAYER_POSITIONS.map((position) => ({
          playerId: created.id,
          position,
          rating: DEFAULT_RATING,
          initialRating: DEFAULT_RATING,
        })),
      )
      .onConflictDoNothing()
    return created
  })
}
