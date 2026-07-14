import "server-only"

import { and, eq, isNull } from "drizzle-orm"

import { db } from "@/lib/db"
import { players, type Player } from "@/lib/db/schema"
import { getSessionUser, requireAuthenticatedUser, type SessionUser } from "@/lib/auth/server"
import { ensureCurrentPlayerProfile } from "@/lib/players/ensure-profile"

export async function getCurrentPlayerForUser(user: SessionUser): Promise<Player | null> {
  if (!user.email) return null

  const normalizedEmail = user.email.trim().toLowerCase()

  const [byAuthUserId] = await db.select().from(players).where(eq(players.authUserId, user.id)).limit(1)
  if (byAuthUserId) return byAuthUserId

  const [byEmail] = await db
    .select()
    .from(players)
    .where(and(eq(players.email, normalizedEmail), isNull(players.authUserId)))
    .limit(1)

  return byEmail ?? null
}

export async function getCurrentPlayer(): Promise<Player | null> {
  const user = await getSessionUser()
  if (!user) return null
  return getCurrentPlayerForUser(user)
}

export async function requireCurrentPlayer(): Promise<Player> {
  const user = await requireAuthenticatedUser()
  return ensureCurrentPlayerProfile(user)
}
