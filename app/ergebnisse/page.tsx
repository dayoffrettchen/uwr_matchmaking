import { redirect } from "next/navigation"
import { desc, eq, inArray, sql } from "drizzle-orm"
import { CheckCircle2, ClipboardCheck, ClipboardList, ShieldCheck, Trophy } from "lucide-react"
import { AppNavigation } from "@/components/app-navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { getSessionUser } from "@/lib/auth/server"
import { db } from "@/lib/db"
import { ensureDatabaseSchema } from "@/lib/db/ensure-schema"
import { matches, matchPlayers, players, signups, trainings } from "@/lib/db/schema"
import { POSITION_LABELS, type PlayerPosition } from "@/lib/ratings/types"
import { createMatchDraftAction, finalizeMatchAction, saveMatchScoreAction } from "./actions"

export const dynamic = "force-dynamic"

type MatchRow = {
  id: number
  trainingId: number | null
  trainingTitle: string | null
  playedAt: Date
  team1Score: number | null
  team2Score: number | null
  status: string
  playerCount: number
}

type MatchPlayerRow = {
  matchId: number
  playerId: number
  name: string
  team: number
  position: string
  lineupType: string
  ratingDelta: number | null
}

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function groupPlayers(playersForMatch: MatchPlayerRow[], team: 1 | 2) {
  return playersForMatch.filter((player) => player.team === team)
}

function pickDutyPlayer(players: MatchPlayerRow[], matchId: number, offset: number) {
  if (players.length === 0) return null

  const orderedPlayers = [...players].sort((a, b) => a.playerId - b.playerId)
  return orderedPlayers[(matchId + offset) % orderedPlayers.length]
}

function getMatchDuties(playersForMatch: MatchPlayerRow[], matchId: number) {
  const team1 = groupPlayers(playersForMatch, 1)
  const team2 = groupPlayers(playersForMatch, 2)
  const entryTeam = matchId % 2 === 0 ? 1 : 2
  const entryCandidates = entryTeam === 1 ? team1 : team2
  const checkerCandidates = entryTeam === 1 ? team2 : team1

  return {
    entryPlayer: pickDutyPlayer(entryCandidates, matchId, 0),
    checkerPlayer: pickDutyPlayer(checkerCandidates, matchId, 1),
  }
}

export default async function ErgebnissePage() {
  const user = await getSessionUser()
  if (!user) redirect("/sign-in")

  await ensureDatabaseSchema()
  const canManage = user.role === "organizer"

  const [openTraining] = await db
    .select()
    .from(trainings)
    .where(eq(trainings.isOpen, true))
    .orderBy(desc(trainings.scheduledAt))
    .limit(1)

  const [latestTraining] = openTraining
    ? [openTraining]
    : await db.select().from(trainings).orderBy(desc(trainings.scheduledAt)).limit(1)

  const training = latestTraining ?? null
  const assignedRoster = training
    ? await db
        .select({
          signupId: signups.id,
          name: players.name,
          team: signups.team,
          assignedPosition: signups.assignedPosition,
          lineupType: signups.lineupType,
        })
        .from(signups)
        .innerJoin(players, eq(players.id, signups.playerId))
        .where(eq(signups.trainingId, training.id))
    : []

  const matchRows = (await db
    .select({
      id: matches.id,
      trainingId: matches.trainingId,
      trainingTitle: trainings.title,
      playedAt: matches.playedAt,
      team1Score: matches.team1Score,
      team2Score: matches.team2Score,
      status: matches.status,
      playerCount: sql<number>`count(${matchPlayers.id})::int`,
    })
    .from(matches)
    .leftJoin(trainings, eq(trainings.id, matches.trainingId))
    .leftJoin(matchPlayers, eq(matchPlayers.matchId, matches.id))
    .groupBy(matches.id, trainings.title)
    .orderBy(desc(matches.playedAt), desc(matches.id))
    .limit(20)) as MatchRow[]

  const matchPlayerRows = matchRows.length
    ? await db
        .select({
          matchId: matchPlayers.matchId,
          playerId: players.id,
          name: players.name,
          team: matchPlayers.team,
          position: matchPlayers.position,
          lineupType: matchPlayers.lineupType,
          ratingDelta: canManage ? matchPlayers.ratingDelta : sql<number | null>`null`,
        })
        .from(matchPlayers)
        .innerJoin(players, eq(players.id, matchPlayers.playerId))
        .where(inArray(matchPlayers.matchId, matchRows.map((match) => match.id)))
    : []

  const hasAssignedTeams = assignedRoster.some((player) => player.team && player.assignedPosition)
  const hasDraftForTraining = training
    ? matchRows.some((match) => match.status === "draft" && match.trainingId === training.id)
    : false

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-4 py-8">
      <AppNavigation role={user.role} />
      <div>
        <h1 className="text-2xl font-bold">Ergebnisse</h1>
        <p className="text-muted-foreground">
          Lege aus der aktuellen Team-Einteilung einen Match-Entwurf an, trage das Ergebnis ein und
          finalisiere die Ratingwertung.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="size-5 text-primary" aria-hidden />
            Aktuelles Training
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {training ? (
            <>
              <div>
                <p className="font-medium">{training.title}</p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(training.scheduledAt)} · {assignedRoster.length} Anmeldungen · {hasAssignedTeams ? "Teams eingeteilt" : "Noch keine Teams eingeteilt"}
                </p>
              </div>
              {canManage && (
                <form action={createMatchDraftAction}>
                  <input type="hidden" name="trainingId" value={training.id} />
                  <Button type="submit" disabled={!hasAssignedTeams || hasDraftForTraining}>
                    {hasDraftForTraining ? "Entwurf vorhanden" : "Match-Entwurf aus Teams erstellen"}
                  </Button>
                </form>
              )}
              {!canManage && <p className="text-sm text-muted-foreground">Nur Organisatoren können Ergebnisse eintragen.</p>}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Kein Training vorhanden.</p>
          )}
        </CardContent>
      </Card>

      <section className="grid gap-4">
        {matchRows.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-muted-foreground">
              Noch keine Match-Entwürfe oder Ergebnisse vorhanden.
            </CardContent>
          </Card>
        ) : (
          matchRows.map((match) => {
            const playersForMatch = matchPlayerRows.filter((player) => player.matchId === match.id)
            const finalized = match.status === "finalized"
            const duties = getMatchDuties(playersForMatch, match.id)

            return (
              <Card key={match.id}>
                <CardHeader className="flex flex-row items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="size-5 text-primary" aria-hidden />
                    {match.trainingTitle ?? "Training"}
                  </CardTitle>
                  <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium">
                    {finalized ? "Finalisiert" : "Entwurf"}
                  </span>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span>{formatDate(match.playedAt)}</span>
                    <span>{match.playerCount} Spieler</span>
                    {match.team1Score !== null && match.team2Score !== null && (
                      <span className="font-semibold text-foreground">
                        Team 1 {match.team1Score}:{match.team2Score} Team 2
                      </span>
                    )}
                  </div>
                  <MatchDuties entryPlayer={duties.entryPlayer} checkerPlayer={duties.checkerPlayer} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <ResultTeam label="Team 1" players={groupPlayers(playersForMatch, 1)} showRatingDelta={canManage} />
                    <ResultTeam label="Team 2" players={groupPlayers(playersForMatch, 2)} showRatingDelta={canManage} />
                  </div>
                  {canManage && !finalized && (
                    <form action={saveMatchScoreAction} className="flex flex-wrap items-end gap-3 rounded-lg border p-3">
                      <input type="hidden" name="matchId" value={match.id} />
                      <label className="grid gap-1 text-sm font-medium">
                        Team 1
                        <Input name="team1Score" type="number" min="0" required defaultValue={match.team1Score ?? ""} className="w-24" />
                      </label>
                      <label className="grid gap-1 text-sm font-medium">
                        Team 2
                        <Input name="team2Score" type="number" min="0" required defaultValue={match.team2Score ?? ""} className="w-24" />
                      </label>
                      <Button type="submit" variant="outline">Speichern</Button>
                    </form>
                  )}
                  {canManage && !finalized && match.team1Score !== null && match.team2Score !== null && (
                    <form action={finalizeMatchAction}>
                      <input type="hidden" name="matchId" value={match.id} />
                      <Button type="submit">
                        <CheckCircle2 className="size-4" aria-hidden />
                        Finalisieren
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>
            )
          })
        )}
      </section>
    </main>
  )
}


function MatchDuties({ entryPlayer, checkerPlayer }: { entryPlayer: MatchPlayerRow | null; checkerPlayer: MatchPlayerRow | null }) {
  return (
    <div className="grid gap-3 rounded-lg border bg-muted/40 p-3 sm:grid-cols-2">
      <div className="flex items-start gap-2">
        <ClipboardCheck className="mt-0.5 size-4 text-primary" aria-hidden />
        <div>
          <p className="text-sm font-semibold">Eintragen</p>
          <p className="text-sm text-muted-foreground">
            {entryPlayer ? `${entryPlayer.name} aus Team ${entryPlayer.team}` : "Noch kein Spieler zugeteilt"}
          </p>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <ShieldCheck className="mt-0.5 size-4 text-primary" aria-hidden />
        <div>
          <p className="text-sm font-semibold">Kontrollieren</p>
          <p className="text-sm text-muted-foreground">
            {checkerPlayer ? `${checkerPlayer.name} aus Team ${checkerPlayer.team}` : "Noch kein Gegenspieler zugeteilt"}
          </p>
        </div>
      </div>
    </div>
  )
}

function ResultTeam({ label, players, showRatingDelta }: { label: string; players: MatchPlayerRow[]; showRatingDelta: boolean }) {
  return (
    <div className="rounded-lg border">
      <div className="bg-muted px-3 py-2 font-semibold">{label}</div>
      <ul className="divide-y">
        {players.map((player) => (
          <li key={`${player.matchId}-${player.team}-${player.name}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
            <span>
              {player.name}
              <span className="text-muted-foreground">
                · {POSITION_LABELS[player.position as PlayerPosition] ?? player.position}
                {player.lineupType === "substitute" ? " · Wechsel" : ""}
              </span>
            </span>
            {showRatingDelta && player.ratingDelta !== null && (
              <span className={player.ratingDelta >= 0 ? "text-primary" : "text-destructive"}>
                {player.ratingDelta >= 0 ? "+" : ""}
                {player.ratingDelta}
              </span>
            )}
          </li>
        ))}
        {players.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">Keine Spieler</li>}
      </ul>
    </div>
  )
}
