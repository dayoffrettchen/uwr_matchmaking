import { getDashboardData } from "@/app/actions/training"
import { RosterPanel } from "@/components/roster-panel"
import { TeamsPanel } from "@/components/teams-panel"
import { MessageFeed } from "@/components/message-feed"
import { UserMenu } from "@/components/user-menu"
import { AppNavigation } from "@/components/app-navigation"
import { Card, CardContent } from "@/components/ui/card"
import { SelfServiceTrainingActions } from "@/components/self-service-training-actions"
import { getTrainingEndAt } from "@/lib/training/schedule"
import { CalendarDays, Clock, MapPin, Waves } from "lucide-react"
import { redirect } from "next/navigation"
import { getLocale } from "@/lib/i18n-server"

export const dynamic = "force-dynamic"

const TRAINING_START_TIME = "19:00"

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
  if (user.role === "player" && currentPlayer && !currentPlayer.profileCompleted) redirect("/profil")

  const trainingIsPast = training ? getTrainingEndAt(new Date(training.scheduledAt)).getTime() < Date.now() : false
  const dateLabel = training ? formatTrainingDate(training.scheduledAt, locale) : null
  const t = locale === "de" ? { subtitle: "Unterwasserrugby Training", schedule: "Montag 19:00–20:00 · Freitag 19:00–21:00", past: "Vergangenes Training", deadline: "Anmeldung offiziell bis 15:00, inoffiziell bis 16:00 · Einteilung jederzeit möglich", noTraining: "Aktuell ist kein Training zur Anmeldung geöffnet." } : { subtitle: "Underwater rugby training", schedule: "Monday 19:00–20:00 · Friday 19:00–21:00", past: "Past training", deadline: "Official signup until 15:00, unofficially until 16:00 · Teams can be assigned anytime", noTraining: "No training is currently open for signup." }

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
