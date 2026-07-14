"use server"

import { db } from "@/lib/db"
import { messages, players, signups, trainings } from "@/lib/db/schema"
import { signUpPlayer } from "@/lib/signup"
import { getSessionUser, requireOrganizer } from "@/lib/auth/server"
import { assignRandomTeams, resetTeams } from "@/lib/teams"
import { and, asc, desc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export async function getDashboardData() {
  const user = await getSessionUser()

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

export async function addPlayerToTraining(formData: FormData) {
  await requireOrganizer()
  const name = String(formData.get("name") ?? "").trim()
  if (!name) return
  await signUpPlayer({ name, source: "app" })
  revalidatePath("/")
}

export async function removeSignup(signupId: number) {
  await requireOrganizer()
  await db.delete(signups).where(eq(signups.id, signupId))
  revalidatePath("/")
}

export async function generateTeams() {
  await requireOrganizer()
  await assignRandomTeams()
  revalidatePath("/")
}

export async function clearTeams() {
  await requireOrganizer()
  await resetTeams()
  revalidatePath("/")
}

/** Simulate an incoming WhatsApp message (useful before the real webhook is wired up). */
export async function simulateMessage(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim()
  const body = String(formData.get("body") ?? "").trim()
  if (!name || !body) return

  const { isPresentMessage, logMessage } = await import("@/lib/signup")
  const matched = isPresentMessage(body)

  if (matched) {
    const result = await signUpPlayer({ name, source: "whatsapp" })
    await logMessage({
      trainingId: result.ok ? result.training.id : null,
      playerName: name,
      body,
      matched: true,
    })
  } else {
    await logMessage({ playerName: name, body, matched: false })
  }
  revalidatePath("/")
}
