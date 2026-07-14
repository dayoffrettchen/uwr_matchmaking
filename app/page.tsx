import { getDashboardData } from "@/app/actions/training"
import { RosterPanel } from "@/components/roster-panel"
import { TeamsPanel } from "@/components/teams-panel"
import { MessageFeed } from "@/components/message-feed"
import { UserMenu } from "@/components/user-menu"
import { AppNavigation } from "@/components/app-navigation"
import { Card, CardContent } from "@/components/ui/card"
import { SelfServiceTrainingActions } from "@/components/self-service-training-actions"
import { getTrainingEndAt } from "@/lib/training/schedule"
import { CalendarDays, Clock, MapPin, UserRoundCheck, Waves } from "lucide-react"
import { redirect } from "next/navigation"
import { getLocale } from "@/lib/i18n-server"
import { POSITION_LABELS, type PlayerPosition } from "@/lib/ratings/types"

export const dynamic = "force-dynamic"

const TRAINING_START_TIME = "19:00"

const TEAM_LABELS = {
  1: "Team Blau",
  2: "Team Weiß",
} as const

const ASSIGNMENT_CARD_STYLES = {
  1: {
    card: "border-primary/40 bg-primary/10",
    icon: "bg-primary text-primary-foreground",
    title: "text-muted-foreground",
    body: "text-foreground",
    team: "text-primary",
    pill: "bg-background text-foreground",
  },
  2: {
    card: "border-team-white-border bg-team-white text-team-white-foreground",
    icon: "border border-team-white-border bg-team-white text-team-white-foreground",
    title: "text-team-white-foreground/70",
    body: "text-team-white-foreground",
    team: "text-team-white-foreground",
    pill: "bg-background text-foreground",
  },
} as const

function isPlayerPosition(position: string | null | undefined): position is PlayerPosition {
  return position === "goalkeeper" || position === "defender" || position === "forward"
}

function formatTrainingDate(scheduledAt: Date, locale: "de" | "en") {
  const date = new Date(scheduledAt).toLocaleDateString(locale === "de" ? "de-DE" : "en-US", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  })

  return locale === "de" ? `${date} um ${TRAINING_START_TIME}` : `${date} at ${TRAINING_START_TIME}`
}

export default async function Page() {
  const locale = await getLocale()
  const { user, training, roster, quickAddPlayers, recentMessages, currentPlayer } = await getDashboardData()

  if (!user) redirect("/sign-in")

  const canManage = user.role === "organizer"
  if (currentPlayer && !currentPlayer.profileCompleted) redirect("/profil")

  const trainingIsPast = training ? getTrainingEndAt(new Date(training.scheduledAt)).getTime() < Date.now() : false
  const dateLabel = training ? formatTrainingDate(training.scheduledAt, locale) : null
  const currentAssignment = user.role === "player" && currentPlayer
    ? roster.find((player) => player.playerId === currentPlayer.id && (player.team === 1 || player.team === 2))
    : null
  const assignmentTeamLabel = currentAssignment?.team === 1 || currentAssignment?.team === 2 ? TEAM_LABELS[currentAssignment.team] : null
  const assignmentStyles = currentAssignment?.team === 1 || currentAssignment?.team === 2 ? ASSIGNMENT_CARD_STYLES[currentAssignment.team] : null
  const assignmentPositionLabel = isPlayerPosition(currentAssignment?.assignedPosition) ? POSITION_LABELS[currentAssignment.assignedPosition] : null
  const assignmentLineupLabel = currentAssignment
    ? (currentAssignment.startsInWater ?? currentAssignment.lineupType !== "substitute")
      ? (locale === "de" ? "Start im Wasser" : "Starts in the water")
      : (locale === "de" ? "Start draußen" : "Starts as substitute")
    : null
  const t = locale === "de" ? { subtitle: "Unterwasserrugby Training", schedule: "Montag 19:00–20:00 · Freitag 19:00–21:00", past: "Vergangenes Training", deadline: "Teams automatisch ab 16:00 · Neueinteilung bei Absagen bis 30 Min. vor Start", noTraining: "Aktuell ist kein Training zur Anmeldung geöffnet.", assignmentTitle: "Deine Einteilung", assignmentIntro: "Du bist für das nächste Training eingeteilt in" } : { subtitle: "Underwater rugby training", schedule: "Monday 19:00–20:00 · Friday 19:00–21:00", past: "Past training", deadline: "Teams auto-assigned from 16:00 · Reassigned for withdrawals until 30 min before start", noTraining: "No training is currently open for signup.", assignmentTitle: "Your assignment", assignmentIntro: "For the next training you are assigned to" }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Waves className="size-6" aria-hidden />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-balance">UWR Matchmaking</h1>
            <p className="text-sm text-muted-foreground">{t.subtitle}</p>
          </div>
        </div>
        <UserMenu name={user.name} email={user.email} role={user.role} locale={locale} />
      </header>
      <AppNavigation role={user.role} locale={locale} />

      {training ? (
        <Card className="bg-primary text-primary-foreground">
          <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 py-4">
            <span className="text-lg font-semibold">{training.title}</span>
            <span className="flex items-center gap-1.5 text-sm opacity-90">
              <CalendarDays className="size-4" aria-hidden />
              {dateLabel}
            </span>
            {training.location && (
              <span className="flex items-center gap-1.5 text-sm opacity-90">
                <MapPin className="size-4" aria-hidden />
                {training.location}
              </span>
            )}
            <span className="flex items-center gap-1.5 text-sm opacity-90">
              <Clock className="size-4" aria-hidden />
              {t.schedule}
            </span>
            {trainingIsPast && (
              <span className="rounded-full bg-primary-foreground/15 px-2 py-0.5 text-xs font-medium">
                {t.past}
              </span>
            )}
            <span className="rounded-full bg-primary-foreground/15 px-2 py-0.5 text-xs font-medium">
              {t.deadline}
            </span>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-6 text-center text-muted-foreground">
            {t.noTraining}
          </CardContent>
        </Card>
      )}


      {currentAssignment && assignmentTeamLabel && assignmentStyles && (
        <Card className={assignmentStyles.card}>
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex size-10 shrink-0 items-center justify-center rounded-full ${assignmentStyles.icon}`}>
                <UserRoundCheck className="size-5" aria-hidden />
              </div>
              <div>
                <p className={`text-sm font-medium ${assignmentStyles.title}`}>{t.assignmentTitle}</p>
                <p className={`text-lg font-semibold ${assignmentStyles.body}`}>
                  {t.assignmentIntro}{" "}
                  <span className={assignmentStyles.team}>{assignmentTeamLabel}</span>.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              {assignmentPositionLabel && (
                <span className={`rounded-full px-3 py-1 text-sm font-medium shadow-sm ${assignmentStyles.pill}`}>
                  {assignmentPositionLabel}
                </span>
              )}
              {assignmentLineupLabel && (
                <span className={`rounded-full px-3 py-1 text-sm font-medium shadow-sm ${assignmentStyles.pill}`}>
                  {assignmentLineupLabel}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {training && user.role === "player" && currentPlayer && (
        <SelfServiceTrainingActions
          locale={locale}
          trainingId={training.id}
          isOpen={training.isOpen}
          isSignedUp={roster.some((player) => player.playerId === currentPlayer.id)}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <RosterPanel roster={roster} quickAddPlayers={quickAddPlayers} canManage={canManage} locale={locale} />
        <MessageFeed messages={recentMessages} canManage={canManage} locale={locale} />
      </div>

      <TeamsPanel roster={roster} canManage={canManage && Boolean(training)} trainingId={training?.id} locale={locale} />
    </main>
  )
}
