"use server"

import { revalidatePath } from "next/cache"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { ensureDatabaseSchema } from "@/lib/db/ensure-schema"
import { requireOrganizer } from "@/lib/auth/server"
import { matches, matchPlayers, players, signups, trainings } from "@/lib/db/schema"
import { finalizeMatch } from "@/lib/ratings/finalize-match"

function readPositiveInt(formData: FormData, key: string): number {
  const value = Number(formData.get(key))
  if (!Number.isInteger(value) || value < 1) throw new Error("Ungültige ID")
  return value
}

function readScore(formData: FormData, key: string): number {
  const value = Number(formData.get(key))
  if (!Number.isInteger(value) || value < 0) throw new Error("Ergebnis muss eine ganze Zahl ab 0 sein")
  return value
}

export async function createMatchDraftAction(formData: FormData) {
  const user = await requireOrganizer()
  await ensureDatabaseSchema()
  const trainingId = readPositiveInt(formData, "trainingId")

  const [training] = await db.select().from(trainings).where(eq(trainings.id, trainingId)).limit(1)
  if (!training) throw new Error("Training nicht gefunden")

  const assignedPlayers = await db
    .select({
      playerId: players.id,
      team: signups.team,
      position: signups.assignedPosition,
      lineupType: signups.lineupType,
      rotationGroupId: signups.rotationGroupId,
      rotationGroupType: signups.rotationGroupType,
      rotationOrder: signups.rotationOrder,
      startsInWater: signups.startsInWater,
    })
    .from(signups)
    .innerJoin(players, eq(players.id, signups.playerId))
    .where(eq(signups.trainingId, trainingId))

  const playablePlayers = assignedPlayers.filter((player) => player.team && player.position)
  if (playablePlayers.length < 2) throw new Error("Erst Teams einteilen, dann Match-Entwurf erstellen")
  if (!playablePlayers.some((player) => player.team === 1) || !playablePlayers.some((player) => player.team === 2)) {
    throw new Error("Beide Teams brauchen Spieler")
  }

  await db.transaction(async (tx) => {
    const [match] = await tx
      .insert(matches)
      .values({ trainingId, playedAt: training.scheduledAt, createdBy: user.email ?? user.id })
      .returning()

    await tx.insert(matchPlayers).values(
      playablePlayers.map((player) => ({
        matchId: match.id,
        playerId: player.playerId,
        team: player.team!,
        position: player.position!,
        lineupType: player.lineupType ?? "active",
        rotationGroupId: player.rotationGroupId,
        rotationGroupType: player.rotationGroupType,
        rotationOrder: player.rotationOrder,
        startsInWater: player.startsInWater,
      })),
    )
  })

  revalidatePath("/ergebnisse")
}

export async function saveMatchScoreAction(formData: FormData) {
  await requireOrganizer()
  await ensureDatabaseSchema()
  const matchId = readPositiveInt(formData, "matchId")
  const team1Score = readScore(formData, "team1Score")
  const team2Score = readScore(formData, "team2Score")

  await db.update(matches).set({ team1Score, team2Score }).where(and(eq(matches.id, matchId), eq(matches.status, "draft")))
  revalidatePath("/ergebnisse")
}

export async function finalizeMatchAction(formData: FormData) {
  await requireOrganizer()
  await ensureDatabaseSchema()
  const matchId = readPositiveInt(formData, "matchId")
  await finalizeMatch(matchId)
  revalidatePath("/ergebnisse")
  revalidatePath("/ranking")
  revalidatePath("/spieler")
}
