import { TRAINING_TIME_ZONE } from "@/lib/training/schedule"
import { getTeamReassignmentDeadline } from "@/lib/training/auto-teams"

export function getTrainingPlanningDeadline(scheduledAt: Date) {
  return getTeamReassignmentDeadline(scheduledAt)
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
