import "server-only"

import { and, eq, gte, lte, sql } from "drizzle-orm"

import { db } from "@/lib/db"
import { signups, trainings, type Training } from "@/lib/db/schema"
import { assignBalancedTeams } from "@/lib/matchmaking/balance-teams"
import { getZonedParts, zonedDateTimeToUtcDate } from "@/lib/training/schedule"

const AUTO_TEAM_ASSIGNMENT_HOUR = 16
const REASSIGNMENT_CUTOFF_MINUTES_BEFORE_TRAINING = 30

export function getAutoTeamAssignmentStart(scheduledAt: Date) {
  const trainingDate = getZonedParts(scheduledAt)

  return zonedDateTimeToUtcDate(trainingDate.year, trainingDate.month, trainingDate.day, AUTO_TEAM_ASSIGNMENT_HOUR)
}

export function getTeamReassignmentDeadline(scheduledAt: Date) {
  return new Date(scheduledAt.getTime() - REASSIGNMENT_CUTOFF_MINUTES_BEFORE_TRAINING * 60 * 1000)
}

export function isAutomaticTeamAssignmentWindow(scheduledAt: Date, now = new Date()) {
  return now.getTime() >= getAutoTeamAssignmentStart(scheduledAt).getTime()
    && now.getTime() <= getTeamReassignmentDeadline(scheduledAt).getTime()
}

export function isBeforeAutomaticTeamAssignment(scheduledAt: Date, now = new Date()) {
  return now.getTime() < getAutoTeamAssignmentStart(scheduledAt).getTime()
}

export async function clearTrainingLineup(trainingId: number, tx: Pick<typeof db, "update"> = db) {
  await tx
    .update(signups)
    .set({ team: null, assignedPosition: null, lineupType: null, rotationGroupId: null, rotationGroupType: null, rotationOrder: null, startsInWater: null })
    .where(eq(signups.trainingId, trainingId))
}

async function getSignupAssignmentSummary(trainingId: number) {
  const [summary] = await db
    .select({
      total: sql<number>`count(*)::int`,
      assigned: sql<number>`count(${signups.team})::int`,
    })
    .from(signups)
    .where(eq(signups.trainingId, trainingId))

  return summary ?? { total: 0, assigned: 0 }
}

export async function assignTeamsForTraining(trainingId: number, { force = false }: { force?: boolean } = {}) {
  const summary = await getSignupAssignmentSummary(trainingId)
  if (summary.total < 2) {
    await clearTrainingLineup(trainingId)
    return false
  }

  if (!force && summary.assigned > 0) return false

  await assignBalancedTeams(trainingId)
  return true
}

export async function applyRosterChangeTeamPolicy(training: Pick<Training, "id" | "scheduledAt">, now = new Date()) {
  if (isBeforeAutomaticTeamAssignment(training.scheduledAt, now)) {
    await clearTrainingLineup(training.id)
    return "cleared" as const
  }

  if (isAutomaticTeamAssignmentWindow(training.scheduledAt, now)) {
    return await assignTeamsForTraining(training.id, { force: true }) ? "assigned" as const : "cleared" as const
  }

  return "unchanged" as const
}

export async function processDueAutomaticTeamAssignments(now = new Date()) {
  const candidates = await db
    .select()
    .from(trainings)
    .where(and(eq(trainings.isOpen, true), gte(trainings.scheduledAt, now), lte(trainings.scheduledAt, new Date(now.getTime() + 12 * 60 * 60 * 1000))))

  const assignedTrainingIds: number[] = []
  for (const training of candidates) {
    if (!isAutomaticTeamAssignmentWindow(training.scheduledAt, now)) continue
    const assigned = await assignTeamsForTraining(training.id)
    if (assigned) assignedTrainingIds.push(training.id)
  }

  return { checked: candidates.length, assignedTrainingIds }
}
