import { getDashboardData } from "@/app/actions/training"
import { RosterPanel } from "@/components/roster-panel"
import { TeamsPanel } from "@/components/teams-panel"
import { MessageFeed } from "@/components/message-feed"
import { UserMenu } from "@/components/user-menu"
import { AppNavigation } from "@/components/app-navigation"
import { Card, CardContent } from "@/components/ui/card"
import { SelfServiceTrainingActions } from "@/components/self-service-training-actions"
import { CalendarDays, Clock, MapPin, Waves } from "lucide-react"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

const TRAINING_START_TIME = "19:00"

function formatTrainingDate(scheduledAt: Date) {
  const date = new Date(scheduledAt).toLocaleDateString("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  })

  return `${date} um ${TRAINING_START_TIME}`
}

export default async function Page() {
  const { user, training, roster, quickAddPlayers, recentMessages, currentPlayer } = await getDashboardData()

  if (!user) redirect("/sign-in")

  const canManage = user.role === "organizer"
  if (user.role === "player" && currentPlayer && !currentPlayer.profileCompleted) redirect("/profil")

  const trainingIsPast = training ? new Date(training.scheduledAt).getTime() < Date.now() : false

  const dateLabel = training ? formatTrainingDate(training.scheduledAt) : null

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Waves className="size-6" aria-hidden />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-balance">UWR Matchmaking</h1>
            <p className="text-sm text-muted-foreground">Unterwasserrugby Training</p>
          </div>
        </div>
        <UserMenu name={user.name} email={user.email} role={user.role} />
      </header>
      <AppNavigation role={user.role} />

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
              Montag 19:00–20:00 · Freitag 19:00–21:00
            </span>
            {user.role === "player" && currentPlayer && (
              <SelfServiceTrainingActions trainingId={training.id} isOpen={training.isOpen} isSignedUp={roster.some((player) => player.playerId === currentPlayer.id)} />
            )}
            {trainingIsPast && (
              <span className="rounded-full bg-primary-foreground/15 px-2 py-0.5 text-xs font-medium">
                Vergangenes Training · Aufstellung weiterhin möglich
              </span>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-6 text-center text-muted-foreground">
            Aktuell ist kein Training zur Anmeldung geöffnet.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <RosterPanel roster={roster} quickAddPlayers={quickAddPlayers} canManage={canManage} />
        <MessageFeed messages={recentMessages} canManage={canManage} />
      </div>

      <TeamsPanel roster={roster} canManage={canManage} trainingId={training?.id} />
    </main>
  )
}
