import "server-only"

import { and, eq } from "drizzle-orm"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import { signups, trainings } from "@/lib/db/schema"
import { requireCurrentPlayer } from "@/lib/players/current-player"
import { signUpPlayer } from "@/lib/signup"
import { applyRosterChangeTeamPolicy } from "@/lib/training/auto-teams"

async function requireOpenTraining(trainingId: number) {
  const [training] = await db.select().from(trainings).where(eq(trainings.id, trainingId)).limit(1)
  if (!training) throw new Error("Training nicht gefunden.")
  if (!training.isOpen) throw new Error("Die Anmeldung für dieses Training ist bereits geschlossen.")
  return training
}


export async function signUpCurrentPlayer(trainingId: number): Promise<void> {
  const currentPlayer = await requireCurrentPlayer()
  if (!currentPlayer.profileCompleted) redirect("/profil?error=profile-incomplete")

  const training = await requireOpenTraining(trainingId)

  const result = await signUpPlayer({
    playerId: currentPlayer.id,
    name: currentPlayer.name,
    phone: currentPlayer.phone,
    source: "self-service",
    trainingId: training.id,
  })

  if (!result.ok) throw new Error("Es gibt gerade kein offenes Training.")

  revalidatePath("/")
}

export async function withdrawCurrentPlayer(trainingId: number): Promise<void> {
  const currentPlayer = await requireCurrentPlayer()
  const training = await requireOpenTraining(trainingId)

  await db
    .delete(signups)
    .where(and(eq(signups.trainingId, trainingId), eq(signups.playerId, currentPlayer.id)))
  await applyRosterChangeTeamPolicy(training)

  revalidatePath("/")
}
