"use server"

import { db } from "@/lib/db"
import { messages, playerPositionRatings, players, signups, trainings } from "@/lib/db/schema"
import { getSessionUser } from "@/lib/auth/server"
import { ensureCurrentPlayerProfile } from "@/lib/players/ensure-profile"
import { ensureDatabaseSchema } from "@/lib/db/ensure-schema"
import { ensureNextRegularTraining } from "@/lib/training/schedule"
import { asc, desc, eq, inArray, sql } from "drizzle-orm"

export async function getDashboardData() {
  const user = await getSessionUser()
  await ensureDatabaseSchema()

  const currentPlayer = user ? await ensureCurrentPlayerProfile(user) : null

  const now = new Date()
  const training = await ensureNextRegularTraining(now)

  if (!training) {
    return { user, training: null, roster: [], quickAddPlayers: [], recentMessages: [], currentPlayer }
  }

  const roster = await db
    .select({
      signupId: signups.id,
      playerId: players.id,
      name: players.name,
      phone: players.phone,
      team: signups.team,
      assignedPosition: signups.assignedPosition,
      lineupType: signups.lineupType,
      rotationGroupId: signups.rotationGroupId,
      rotationGroupType: signups.rotationGroupType,
      rotationOrder: signups.rotationOrder,
      startsInWater: signups.startsInWater,
      source: signups.source,
      createdAt: signups.createdAt,
    })
    .from(signups)
    .innerJoin(players, eq(players.id, signups.playerId))
    .where(eq(signups.trainingId, training.id))
    .orderBy(asc(signups.createdAt))

  const previousTrainings = await db
    .select({ id: trainings.id })
    .from(trainings)
    .where(sql`${trainings.scheduledAt} < ${training.scheduledAt}`)
    .orderBy(desc(trainings.scheduledAt))
    .limit(3)

  const previousTrainingIds = previousTrainings.map((previousTraining) => previousTraining.id)

  const [allPlayers, previousSignups, rosterRatings] = await Promise.all([
    db.select({ id: players.id, name: players.name }).from(players).orderBy(asc(players.name)),
    previousTrainingIds.length > 0
      ? db
          .select({ playerId: signups.playerId })
          .from(signups)
          .where(inArray(signups.trainingId, previousTrainingIds))
      : Promise.resolve([]),
    roster.length > 0
      ? db
          .select({
            playerId: playerPositionRatings.playerId,
            position: playerPositionRatings.position,
            rating: playerPositionRatings.rating,
          })
          .from(playerPositionRatings)
          .where(inArray(playerPositionRatings.playerId, roster.map((player) => player.playerId)))
      : Promise.resolve([]),
  ])

  const ratingsByPlayerAndPosition = new Map<string, number>()
  for (const rating of rosterRatings) {
    ratingsByPlayerAndPosition.set(`${rating.playerId}:${rating.position}`, rating.rating)
  }

  const rosterWithRatings = roster.map((player) => ({
    ...player,
    phone: user?.role === "organizer" ? player.phone : null,
    assignedRating: user?.role === "organizer" && player.assignedPosition
      ? (ratingsByPlayerAndPosition.get(`${player.playerId}:${player.assignedPosition}`) ?? null)
      : null,
  }))

  const currentRosterPlayerIds = new Set(roster.map((player) => player.playerId))
  const attendanceByPlayerId = new Map<number, number>()
  for (const signup of previousSignups) {
    attendanceByPlayerId.set(signup.playerId, (attendanceByPlayerId.get(signup.playerId) ?? 0) + 1)
  }

  const quickAddPlayers = allPlayers
    .filter((player) => !currentRosterPlayerIds.has(player.id))
    .map((player) => ({
      id: player.id,
      name: player.name,
      recentAttendanceCount: attendanceByPlayerId.get(player.id) ?? 0,
    }))
    .sort((a, b) => b.recentAttendanceCount - a.recentAttendanceCount || a.name.localeCompare(b.name, "de"))

  const recentMessages = await db
    .select()
    .from(messages)
    .orderBy(desc(messages.createdAt))
    .limit(20)

  return { user, training, roster: rosterWithRatings, quickAddPlayers, recentMessages: recentMessages.reverse(), currentPlayer }
}
