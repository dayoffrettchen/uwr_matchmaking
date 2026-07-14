import { db } from "@/lib/db"
import { matches, matchPlayers, players, playerPositionRatings } from "@/lib/db/schema"
import { asc, desc, eq, sql } from "drizzle-orm"
import { PLAYER_POSITIONS, type PlayerPosition } from "@/lib/ratings/types"
import { DEFAULT_RATING } from "@/lib/ratings/constants"
import { getRatingConfidence } from "@/lib/ratings/confidence"

function toTime(value: Date | string | null | undefined) {
  if (!value) return 0
  const date = value instanceof Date ? value : new Date(value)
  const time = date.getTime()
  return Number.isFinite(time) ? time : 0
}

function shouldReviewMainPosition(player: { ratings: Record<PlayerPosition, any> }) {
  const mainPosition = PLAYER_POSITIONS.find((position) => player.ratings[position].preferenceOrder === 1)
  if (!mainPosition) return false

  const mainRating = player.ratings[mainPosition]
  return PLAYER_POSITIONS.some((position) => {
    const rating = player.ratings[position]
    return position !== mainPosition && rating.isEligible && getRatingConfidence(rating.gamesPlayed) === 1 && rating.rating > mainRating.rating
  })
}

export async function listPlayersWithRatings() {
  const rows = await db
    .select({
      playerId: players.id,
      name: players.name,
      phone: players.phone,
      ratingId: playerPositionRatings.id,
      position: playerPositionRatings.position,
      rating: playerPositionRatings.rating,
      initialRating: playerPositionRatings.initialRating,
      gamesPlayed: playerPositionRatings.gamesPlayed,
      wins: playerPositionRatings.wins,
      draws: playerPositionRatings.draws,
      losses: playerPositionRatings.losses,
      isEligible: playerPositionRatings.isEligible,
      preferenceOrder: playerPositionRatings.preferenceOrder,
    })
    .from(players)
    .leftJoin(playerPositionRatings, eq(playerPositionRatings.playerId, players.id))
    .orderBy(desc(players.createdAt), asc(players.name), asc(playerPositionRatings.preferenceOrder), asc(playerPositionRatings.position))

  const lastMatches = await db
    .select({
      playerId: matchPlayers.playerId,
      lastMatchAt: sql<Date | null>`max(${matches.playedAt})`,
    })
    .from(matchPlayers)
    .innerJoin(matches, eq(matches.id, matchPlayers.matchId))
    .where(eq(matches.status, "finalized"))
    .groupBy(matchPlayers.playerId)

  const lastMatchByPlayer = new Map(lastMatches.map((match) => [match.playerId, match.lastMatchAt]))

  const grouped = new Map<number, { id: number; name: string; phone: string | null; lastMatchAt: Date | null; ratings: Record<PlayerPosition, any> }>()
  for (const row of rows) {
    if (!grouped.has(row.playerId)) {
      grouped.set(row.playerId, { id: row.playerId, name: row.name, phone: row.phone, lastMatchAt: lastMatchByPlayer.get(row.playerId) ?? null, ratings: {} as Record<PlayerPosition, any> })
    }
    if (row.position && PLAYER_POSITIONS.includes(row.position as PlayerPosition)) {
      grouped.get(row.playerId)!.ratings[row.position as PlayerPosition] = row
    }
  }
  for (const player of grouped.values()) {
    for (const position of PLAYER_POSITIONS) {
      player.ratings[position] ??= { position, rating: DEFAULT_RATING, initialRating: DEFAULT_RATING, gamesPlayed: 0, wins: 0, draws: 0, losses: 0, isEligible: false, preferenceOrder: null }
    }
  }
  return [...grouped.values()].sort((a, b) => {
    const aHasPosition = PLAYER_POSITIONS.some((position) => a.ratings[position].isEligible)
    const bHasPosition = PLAYER_POSITIONS.some((position) => b.ratings[position].isEligible)

    const aNeedsReview = shouldReviewMainPosition(a)
    const bNeedsReview = shouldReviewMainPosition(b)

    if (aNeedsReview !== bNeedsReview) return aNeedsReview ? -1 : 1
    if (aHasPosition !== bHasPosition) return aHasPosition ? 1 : -1

    const aLastMatch = toTime(a.lastMatchAt)
    const bLastMatch = toTime(b.lastMatchAt)
    if (aLastMatch !== bLastMatch) return aLastMatch - bLastMatch

    return a.name.localeCompare(b.name, "de")
  })
}

export async function listRanking(position: PlayerPosition) {
  return db
    .select({ playerId: players.id, name: players.name, rating: playerPositionRatings.rating, gamesPlayed: playerPositionRatings.gamesPlayed, wins: playerPositionRatings.wins, draws: playerPositionRatings.draws, losses: playerPositionRatings.losses, isEligible: playerPositionRatings.isEligible })
    .from(playerPositionRatings)
    .innerJoin(players, eq(players.id, playerPositionRatings.playerId))
    .where(eq(playerPositionRatings.position, position))
    .orderBy(sql`${playerPositionRatings.isEligible} desc`, sql`case when ${playerPositionRatings.gamesPlayed} = 0 then 1 else 0 end`, sql`${playerPositionRatings.rating} desc`, sql`${playerPositionRatings.gamesPlayed} desc`, asc(players.name))
}
