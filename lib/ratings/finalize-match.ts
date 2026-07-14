import { and, eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { matches, matchPlayers, playerPositionRatings } from "@/lib/db/schema"
import { applyRatingDelta, calculateExpectedScore, calculateRatingDelta, calculateTeamRating } from "./elo"

export async function finalizeMatch(matchId: number, tx: any = db): Promise<void> {
  const [match] = await tx.select().from(matches).where(eq(matches.id, matchId)).limit(1)
  if (!match) throw new Error("Spiel nicht gefunden")
  if (match.status === "finalized") throw new Error("Spiel wurde bereits finalisiert")
  if (match.team1Score == null || match.team2Score == null) throw new Error("Ergebnis fehlt")
  const active = await tx.select().from(matchPlayers).where(and(eq(matchPlayers.matchId, matchId), eq(matchPlayers.lineupType, "active")))
  const team1 = active.filter((p: any) => p.team === 1), team2 = active.filter((p: any) => p.team === 2)
  if (!team1.length || !team2.length) throw new Error("Beide Teams benötigen aktive Spieler")
  const ratings = await tx.select().from(playerPositionRatings)
  const ratingFor = (mp: typeof active[number]) => ratings.find((r: any) => r.playerId === mp.playerId && r.position === mp.position)
  const team1Rating = calculateTeamRating(team1.map((p: any) => ({ positionRating: ratingFor(p)?.rating ?? 1000 })))
  const team2Rating = calculateTeamRating(team2.map((p: any) => ({ positionRating: ratingFor(p)?.rating ?? 1000 })))
  const actual1 = match.team1Score === match.team2Score ? 0.5 : match.team1Score > match.team2Score ? 1 : 0
  const actual2 = 1 - actual1
  for (const mp of active) {
    const current = ratingFor(mp)
    if (!current) throw new Error("Positionsrating fehlt")
    const expected = mp.team === 1 ? calculateExpectedScore(team1Rating, team2Rating) : calculateExpectedScore(team2Rating, team1Rating)
    const actual = mp.team === 1 ? actual1 : actual2
    const delta = calculateRatingDelta({ gamesPlayed: current.gamesPlayed, expectedResult: expected, actualResult: actual })
    const after = applyRatingDelta(current.rating, delta)
    await tx.update(matchPlayers).set({ ratingBefore: current.rating, ratingDelta: delta, ratingAfter: after }).where(eq(matchPlayers.id, mp.id))
    await tx.update(playerPositionRatings).set({ rating: after, gamesPlayed: current.gamesPlayed + 1, wins: current.wins + (actual === 1 ? 1 : 0), draws: current.draws + (actual === 0.5 ? 1 : 0), losses: current.losses + (actual === 0 ? 1 : 0), updatedAt: new Date() }).where(eq(playerPositionRatings.id, current.id))
    current.rating = after; current.gamesPlayed++; current.wins += actual === 1 ? 1 : 0; current.draws += actual === 0.5 ? 1 : 0; current.losses += actual === 0 ? 1 : 0
  }
  await tx.update(matches).set({ status: "finalized", finalizedAt: new Date() }).where(eq(matches.id, matchId))
}
