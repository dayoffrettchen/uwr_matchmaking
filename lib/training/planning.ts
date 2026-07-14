import { asc, desc, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { trainings } from "@/lib/db/schema"

const PLANNING_DEADLINE_HOUR = 15
const TRAINING_TIME_ZONE = "Europe/Berlin"
const NEXT_TRAINING_INTERVAL_DAYS = 7

function getZonedParts(date: Date) {
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

function zonedDateTimeToUtcDate(year: number, month: number, day: number, hour: number, minute = 0, second = 0) {
  let utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute, second))

  for (let i = 0; i < 3; i += 1) {
    const parts = getZonedParts(utcDate)
    const diffMs = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - Date.UTC(year, month - 1, day, hour, minute, second)
    if (diffMs === 0) break
    utcDate = new Date(utcDate.getTime() - diffMs)
  }

  return utcDate
}

function addDaysPreservingZonedTime(date: Date, days: number) {
  const parts = getZonedParts(date)
  const targetDay = Date.UTC(parts.year, parts.month - 1, parts.day + days)
  const targetDate = new Date(targetDay)

  return zonedDateTimeToUtcDate(targetDate.getUTCFullYear(), targetDate.getUTCMonth() + 1, targetDate.getUTCDate(), parts.hour, parts.minute, parts.second)
}

export function getNextTrainingDate(previousScheduledAt: Date, now = new Date()) {
  let nextScheduledAt = addDaysPreservingZonedTime(previousScheduledAt, NEXT_TRAINING_INTERVAL_DAYS)

  while (nextScheduledAt.getTime() < now.getTime()) {
    nextScheduledAt = addDaysPreservingZonedTime(nextScheduledAt, NEXT_TRAINING_INTERVAL_DAYS)
  }

  return nextScheduledAt
}

export async function ensureUpcomingTraining(now = new Date()) {
  const [existingUpcomingTraining] = await db
    .select()
    .from(trainings)
    .where(sql`${trainings.scheduledAt} >= ${now}`)
    .orderBy(asc(trainings.scheduledAt))
    .limit(1)

  if (existingUpcomingTraining) return existingUpcomingTraining

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('uwr_matchmaking:ensure_upcoming_training'))`)

    const [upcomingTraining] = await tx
      .select()
      .from(trainings)
      .where(sql`${trainings.scheduledAt} >= ${now}`)
      .orderBy(asc(trainings.scheduledAt))
      .limit(1)

    if (upcomingTraining) return upcomingTraining

    const [latestTraining] = await tx.select().from(trainings).orderBy(desc(trainings.scheduledAt)).limit(1)
    if (!latestTraining) return null

    const [createdTraining] = await tx
      .insert(trainings)
      .values({
        title: latestTraining.title,
        scheduledAt: getNextTrainingDate(latestTraining.scheduledAt, now),
        location: latestTraining.location,
        isOpen: true,
      })
      .returning()

    return createdTraining
  })
}

export function getTrainingPlanningDeadline(scheduledAt: Date) {
  const trainingDate = getZonedParts(scheduledAt)

  return zonedDateTimeToUtcDate(trainingDate.year, trainingDate.month, trainingDate.day, PLANNING_DEADLINE_HOUR)
}

export function canPlanTraining(scheduledAt: Date, now = new Date()) {
  return now.getTime() <= getTrainingPlanningDeadline(scheduledAt).getTime()
}

export function formatTrainingPlanningDeadline(scheduledAt: Date) {
  return getTrainingPlanningDeadline(scheduledAt).toLocaleString("de-DE", {
    timeZone: TRAINING_TIME_ZONE,
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  })
}
