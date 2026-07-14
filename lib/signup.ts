import { db } from "@/lib/db"
import { messages, players, signups, trainings } from "@/lib/db/schema"
import { initializePlayerRatings } from "@/lib/players/initialize-ratings"
import { ensureUpcomingTraining } from "@/lib/training/planning"
import { and, asc, eq, sql } from "drizzle-orm"

// Phrases that count as "I'm coming" / present.
const PRESENT_PATTERNS = [/\bbin\s*da\b/i, /\bdabei\b/i, /\bbin\s*dabei\b/i, /\bkomme\b/i, /\b\+1\b/]

export function isPresentMessage(body: string): boolean {
  return PRESENT_PATTERNS.some((p) => p.test(body))
}

export async function getOpenTraining() {
  await ensureUpcomingTraining()
  const [training] = await db.select().from(trainings).where(sql`${trainings.isOpen} = true and ${trainings.scheduledAt} >= ${new Date()}`).orderBy(asc(trainings.scheduledAt)).limit(1)
  return training ?? null
}

/**
 * Finds or creates a player, then signs them up for the open training.
 * Returns the result so callers (webhook, app) can react.
 */
export async function signUpPlayer(opts: {
  name: string
  phone?: string | null
  source?: string
}) {
  const training = await getOpenTraining()
  if (!training) return { ok: false as const, reason: "no_open_training" as const }

  // Find existing player by phone, otherwise by name, otherwise create.
  let player = null
  if (opts.phone) {
    ;[player] = await db.select().from(players).where(eq(players.phone, opts.phone)).limit(1)
  }
  if (!player) {
    ;[player] = await db.select().from(players).where(eq(players.name, opts.name)).limit(1)
  }
  if (!player) {
    ;[player] = await db
      .insert(players)
      .values({ name: opts.name, phone: opts.phone ?? null })
      .returning()
    await initializePlayerRatings(player.id)
  } else if (opts.phone && !player.phone) {
    await db.update(players).set({ phone: opts.phone }).where(eq(players.id, player.id))
  }

  // Already signed up?
  const [existing] = await db
    .select()
    .from(signups)
    .where(and(eq(signups.trainingId, training.id), eq(signups.playerId, player.id)))
    .limit(1)

  if (existing) {
    return { ok: true as const, alreadySignedUp: true, training, player }
  }

  await db.transaction(async (tx) => {
    await tx.insert(signups).values({
      trainingId: training.id,
      playerId: player.id,
      source: opts.source ?? "app",
    })
    await tx.update(signups).set({ team: null, assignedPosition: null, lineupType: null, rotationGroupId: null, rotationGroupType: null, rotationOrder: null, startsInWater: null }).where(eq(signups.trainingId, training.id))
  })

  return { ok: true as const, alreadySignedUp: false, training, player }
}

export async function logMessage(opts: {
  trainingId?: number | null
  playerName: string
  phone?: string | null
  body: string
  matched: boolean
}) {
  await db.insert(messages).values({
    trainingId: opts.trainingId ?? null,
    playerName: opts.playerName,
    phone: opts.phone ?? null,
    body: opts.body,
    matched: opts.matched,
  })
}
