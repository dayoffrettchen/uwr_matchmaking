import "server-only"

import { and, eq } from "drizzle-orm"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import { signups, trainings } from "@/lib/db/schema"
import { requireCurrentPlayer } from "@/lib/players/current-player"

async function requireOpenTraining(trainingId: number) {
  const [training] = await db.select().from(trainings).where(eq(trainings.id, trainingId)).limit(1)
  if (!training) throw new Error("Training nicht gefunden.")
  if (!training.isOpen) throw new Error("Die Anmeldung für dieses Training ist bereits geschlossen.")
  return training
}

async function resetCurrentLineup(trainingId: number, tx: Pick<typeof db, "update"> = db) {
  await tx
    .update(signups)
    .set({ team: null, assignedPosition: null, lineupType: null, rotationGroupId: null, rotationGroupType: null, rotationOrder: null, startsInWater: null })
    .where(eq(signups.trainingId, trainingId))
}

export async function signUpCurrentPlayer(trainingId: number): Promise<void> {
  const currentPlayer = await requireCurrentPlayer()
  if (!currentPlayer.profileCompleted) redirect("/profil?error=profile-incomplete")

  await requireOpenTraining(trainingId)

  await db.transaction(async (tx) => {
    await tx
      .insert(signups)
      .values({ trainingId, playerId: currentPlayer.id, source: "self-service" })
      .onConflictDoNothing()
    await resetCurrentLineup(trainingId, tx)
  })

  revalidatePath("/")
}

export async function withdrawCurrentPlayer(trainingId: number): Promise<void> {
  const currentPlayer = await requireCurrentPlayer()
  await requireOpenTraining(trainingId)

  await db.transaction(async (tx) => {
    await tx
      .delete(signups)
      .where(and(eq(signups.trainingId, trainingId), eq(signups.playerId, currentPlayer.id)))
    await resetCurrentLineup(trainingId, tx)
  })

  revalidatePath("/")
}
