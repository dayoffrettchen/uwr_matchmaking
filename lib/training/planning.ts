const PLANNING_DEADLINE_HOUR = 15
const TRAINING_TIME_ZONE = "Europe/Berlin"

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
