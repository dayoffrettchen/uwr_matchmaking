import { getZonedParts, TRAINING_TIME_ZONE, zonedDateTimeToUtcDate } from "@/lib/training/schedule"

const PLANNING_DEADLINE_HOUR = 15

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
