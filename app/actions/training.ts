"use server"

import { db } from "@/lib/db"
import { messages, players, signups, trainings } from "@/lib/db/schema"
import { signUpPlayer } from "@/lib/signup"
import { getSessionUser, requireOrganizer } from "@/lib/auth/server"
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

/** Randomly splits all signed-up players into two balanced-size teams. */
export async function generateTeams() {
  await requireOrganizer()
  const [training] = await db
    .select()
    .from(trainings)
    .where(eq(trainings.isOpen, true))
    .orderBy(desc(trainings.scheduledAt))
    .limit(1)
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

  revalidatePath("/")
}

export async function clearTeams() {
  await requireOrganizer()
  const [training] = await db
    .select()
    .from(trainings)
    .where(eq(trainings.isOpen, true))
    .orderBy(desc(trainings.scheduledAt))
    .limit(1)
  if (!training) return
  await db.update(signups).set({ team: null }).where(eq(signups.trainingId, training.id))
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
