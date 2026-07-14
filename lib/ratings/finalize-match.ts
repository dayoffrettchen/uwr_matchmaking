import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { matches, matchPlayers, playerPositionRatings } from "@/lib/db/schema"
import { applyRatingDelta, calculateEffectiveTeamRating, calculateExpectedScore, calculateRatingDelta } from "./elo"
import { calculateMarginMultiplier } from "./margin"

export async function finalizeMatch(matchId: number, tx: any = db): Promise<void> {
  const [match] = await tx.select().from(matches).where(eq(matches.id, matchId)).limit(1)
  if (!match) throw new Error("Spiel nicht gefunden")
  if (match.status === "finalized") throw new Error("Spiel wurde bereits finalisiert")
  if (match.team1Score == null || match.team2Score == null) throw new Error("Ergebnis fehlt")

  const participants = await tx.select().from(matchPlayers).where(eq(matchPlayers.matchId, matchId))
  const team1Players = participants.filter((player: any) => player.team === 1)
  const team2Players = participants.filter((player: any) => player.team === 2)
  if (!team1Players.length || !team2Players.length) throw new Error("Beide Teams benötigen Teilnehmer")

  const ratings = await tx.select().from(playerPositionRatings)
  const ratingFor = (mp: typeof participants[number]) => ratings.find((rating: any) => rating.playerId === mp.playerId && rating.position === mp.position)
  const toRatedPlayer = (mp: typeof participants[number]) => ({
    positionRating: ratingFor(mp)?.rating ?? 1000,
    lineupType: mp.lineupType,
  })

  const team1EffectiveRating = calculateEffectiveTeamRating(team1Players.map(toRatedPlayer))
  const team2EffectiveRating = calculateEffectiveTeamRating(team2Players.map(toRatedPlayer))
  const expectedTeam1 = calculateExpectedScore(team1EffectiveRating, team2EffectiveRating)
  const expectedTeam2 = 1 - expectedTeam1
  const actual1 = match.team1Score === match.team2Score ? 0.5 : match.team1Score > match.team2Score ? 1 : 0
  const actual2 = 1 - actual1
  const marginMultiplier = calculateMarginMultiplier({ team1Score: match.team1Score, team2Score: match.team2Score, expectedTeam1 })

  for (const matchPlayer of participants) {
    const current = ratingFor(matchPlayer)
    if (!current) throw new Error("Positionsrating fehlt")
    const expected = matchPlayer.team === 1 ? expectedTeam1 : expectedTeam2
    const actual = matchPlayer.team === 1 ? actual1 : actual2
    const delta = calculateRatingDelta({
      gamesPlayed: current.gamesPlayed,
      expectedResult: expected,
      actualResult: actual,
      marginMultiplier,
    })
    const after = applyRatingDelta(current.rating, delta)
    await tx.update(matchPlayers).set({ ratingBefore: current.rating, ratingDelta: delta, ratingAfter: after }).where(eq(matchPlayers.id, matchPlayer.id))
    await tx.update(playerPositionRatings).set({ rating: after, gamesPlayed: current.gamesPlayed + 1, wins: current.wins + (actual === 1 ? 1 : 0), draws: current.draws + (actual === 0.5 ? 1 : 0), losses: current.losses + (actual === 0 ? 1 : 0), updatedAt: new Date() }).where(eq(playerPositionRatings.id, current.id))
    current.rating = after
    current.gamesPlayed++
    current.wins += actual === 1 ? 1 : 0
    current.draws += actual === 0.5 ? 1 : 0
    current.losses += actual === 0 ? 1 : 0
  }

  await tx.update(matches).set({ status: "finalized", finalizedAt: new Date() }).where(eq(matches.id, matchId))
}
