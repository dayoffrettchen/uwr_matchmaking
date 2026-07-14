import { asc, eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { matches, matchPlayers, playerPositionRatings } from "@/lib/db/schema"
import { finalizeMatch } from "./finalize-match"

export async function recalculateAllRatings(): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(playerPositionRatings).set({ rating: sql`${playerPositionRatings.initialRating}`, gamesPlayed: 0, wins: 0, draws: 0, losses: 0, updatedAt: new Date() })
    await tx.update(matchPlayers).set({ ratingBefore: null, ratingDelta: null, ratingAfter: null })
    const finalized = await tx.select().from(matches).where(eq(matches.status, "finalized")).orderBy(asc(matches.playedAt), asc(matches.id))
    for (const match of finalized) {
      await tx.update(matches).set({ status: "draft", finalizedAt: null }).where(eq(matches.id, match.id))
      await finalizeMatch(match.id, tx)
    }
  })
}
