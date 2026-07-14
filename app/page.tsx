import { getDashboardData } from "@/app/actions/training"
import { RosterPanel } from "@/components/roster-panel"
import { TeamsPanel } from "@/components/teams-panel"
import { MessageFeed } from "@/components/message-feed"
import { UserMenu } from "@/components/user-menu"
import { AppNavigation } from "@/components/app-navigation"
import { Card, CardContent } from "@/components/ui/card"
import { CalendarDays, MapPin, Waves } from "lucide-react"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function Page() {
  const { user, training, roster, recentMessages } = await getDashboardData()

  if (!user) redirect("/sign-in")

  const canManage = user.role === "organizer"

  const dateLabel = training
    ? new Date(training.scheduledAt).toLocaleString("de-DE", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null

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
      <AppNavigation />

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
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-6 text-center text-muted-foreground">
            Kein offenes Training. Lege eins in der Datenbank an.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="flex flex-col gap-6">
          <RosterPanel roster={roster} canManage={canManage} />
          <TeamsPanel roster={roster} canManage={canManage} />
        </div>
        <MessageFeed messages={recentMessages} canManage={canManage} />
      </div>
    </main>
  )
}
