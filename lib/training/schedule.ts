import { asc, eq, sql } from "drizzle-orm"

import { db } from "@/lib/db"
import { trainings } from "@/lib/db/schema"

export const TRAINING_TIME_ZONE = "Europe/Berlin"

type RegularTrainingSlot = {
  weekday: number
  title: string
  startHour: number
  startMinute: number
  location: string
}

const REGULAR_TRAININGS: RegularTrainingSlot[] = [
  { weekday: 1, title: "Training Montag 19:00–20:00", startHour: 19, startMinute: 0, location: "Schwimmbad" },
  { weekday: 5, title: "Training Freitag 19:00–21:00", startHour: 19, startMinute: 0, location: "Schwimmbad" },
]

export function getZonedParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TRAINING_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)

  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]))

  return {
    year: Number(byType.year),
    month: Number(byType.month),
    day: Number(byType.day),
    hour: Number(byType.hour),
    minute: Number(byType.minute),
    second: Number(byType.second),
  }
}

export function zonedDateTimeToUtcDate(year: number, month: number, day: number, hour: number, minute = 0, second = 0) {
  let utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute, second))

  for (let i = 0; i < 3; i += 1) {
    const parts = getZonedParts(utcDate)
    const diffMs = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - Date.UTC(year, month - 1, day, hour, minute, second)
    if (diffMs === 0) break
    utcDate = new Date(utcDate.getTime() - diffMs)
  }

  return utcDate
}

function getNextRegularTrainingSlot(now = new Date()) {
  const today = getZonedParts(now)

  for (let offset = 0; offset <= 7; offset += 1) {
    const localDate = new Date(Date.UTC(today.year, today.month - 1, today.day + offset))
    const weekday = localDate.getUTCDay()
    const slot = REGULAR_TRAININGS.find((training) => training.weekday === weekday)
    if (!slot) continue

    const scheduledAt = zonedDateTimeToUtcDate(
      localDate.getUTCFullYear(),
      localDate.getUTCMonth() + 1,
      localDate.getUTCDate(),
      slot.startHour,
      slot.startMinute,
    )

    if (scheduledAt.getTime() >= now.getTime()) return { ...slot, scheduledAt }
  }

  throw new Error("Kein regulärer Trainingstermin gefunden.")
}

export async function ensureNextRegularTraining(now = new Date()) {
  const nextRegularTraining = getNextRegularTrainingSlot(now)
  const existingFutureTraining = await db
    .select()
    .from(trainings)
    .where(sql`${trainings.scheduledAt} >= ${now} and ${trainings.scheduledAt} <= ${nextRegularTraining.scheduledAt}`)
    .orderBy(asc(trainings.scheduledAt))
    .limit(1)

  if (existingFutureTraining[0]) return existingFutureTraining[0]

  const [existingRegularTraining] = await db
    .select()
    .from(trainings)
    .where(eq(trainings.scheduledAt, nextRegularTraining.scheduledAt))
    .limit(1)

  if (existingRegularTraining) return existingRegularTraining

  const [createdTraining] = await db
    .insert(trainings)
    .values({
      title: nextRegularTraining.title,
      scheduledAt: nextRegularTraining.scheduledAt,
      location: nextRegularTraining.location,
      isOpen: true,
    })
    .returning()

  return createdTraining
}
