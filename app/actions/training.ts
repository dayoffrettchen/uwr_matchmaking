"use server"

import { db } from "@/lib/db"
import { messages, players, signups, trainings } from "@/lib/db/schema"
import { getSessionUser } from "@/lib/auth/server"
import { ensureDatabaseSchema } from "@/lib/db/ensure-schema"
import { asc, desc, eq } from "drizzle-orm"

export async function getDashboardData() {
  const user = await getSessionUser()
  await ensureDatabaseSchema()

  const [training] = await db
    .select()
    .from(trainings)
    .where(eq(trainings.isOpen, true))
    .orderBy(desc(trainings.scheduledAt))
    .limit(1)

  if (!training) {
    return { user, training: null, roster: [], recentMessages: [] }
  }

  const roster = await db
    .select({
      signupId: signups.id,
      playerId: players.id,
      name: players.name,
      phone: players.phone,
      team: signups.team,
      assignedPosition: signups.assignedPosition,
      lineupType: signups.lineupType,
      source: signups.source,
      createdAt: signups.createdAt,
    })
    .from(signups)
    .innerJoin(players, eq(players.id, signups.playerId))
    .where(eq(signups.trainingId, training.id))
    .orderBy(asc(signups.createdAt))

  const recentMessages = await db
    .select()
    .from(messages)
    .orderBy(desc(messages.createdAt))
    .limit(20)

  return { user, training, roster, recentMessages: recentMessages.reverse() }
}
