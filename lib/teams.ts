import "server-only"

import { db } from "@/lib/db"
import { signups, trainings } from "@/lib/db/schema"
import { desc, eq } from "drizzle-orm"

async function getOpenTraining() {
  const [training] = await db
    .select()
    .from(trainings)
    .where(eq(trainings.isOpen, true))
    .orderBy(desc(trainings.scheduledAt))
    .limit(1)

  return training ?? null
}

/** Randomly splits all signed-up players into two balanced-size teams. */
export async function assignRandomTeams() {
  const training = await getOpenTraining()
  if (!training) return

  const rows = await db
    .select({ id: signups.id })
    .from(signups)
    .where(eq(signups.trainingId, training.id))

  // Fisher-Yates shuffle.
  const ids = rows.map((r) => r.id)
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
  }

  const half = Math.ceil(ids.length / 2)
  for (let i = 0; i < ids.length; i++) {
    const team = i < half ? 1 : 2
    await db.update(signups).set({ team }).where(eq(signups.id, ids[i]))
  }
}

export async function resetTeams() {
  const training = await getOpenTraining()
  if (!training) return

  await db.update(signups).set({ team: null, assignedPosition: null, lineupType: null }).where(eq(signups.trainingId, training.id))
}
