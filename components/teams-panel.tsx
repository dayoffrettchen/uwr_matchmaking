"use client"

import { useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { generateTeams, clearTeams } from "@/app/actions/training"
import { Shuffle, Users, X } from "lucide-react"

type RosterPlayer = {
  signupId: number
  name: string
  team: number | null
  source: string
}

export function TeamsPanel({ roster, canManage }: { roster: RosterPlayer[]; canManage: boolean }) {
  const [isPending, startTransition] = useTransition()

  const teamsAssigned = roster.some((p) => p.team !== null)
  const team1 = roster.filter((p) => p.team === 1)
  const team2 = roster.filter((p) => p.team === 2)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="size-5 text-primary" aria-hidden />
          Teams
        </CardTitle>
        {canManage && (
          <div className="flex gap-2">
            {teamsAssigned && (
              <Button
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={() => startTransition(() => clearTeams())}
              >
                <X className="size-4" aria-hidden />
                Zurücksetzen
              </Button>
            )}
            <Button
              size="sm"
              disabled={isPending || roster.length < 2}
              onClick={() => startTransition(() => generateTeams())}
            >
              <Shuffle className="size-4" aria-hidden />
              Auslosen
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {!teamsAssigned ? (
          <p className="text-sm text-muted-foreground text-pretty">
            {roster.length < 2
              ? "Mindestens 2 Anmeldungen nötig, um Teams auszulosen."
              : "Noch keine Teams ausgelost. Tippe auf \u201eAuslosen\u201c, um die angemeldeten Spieler zufällig auf zwei Teams zu verteilen."}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <TeamColumn label="Team 1" players={team1} variant="primary" />
            <TeamColumn label="Team 2" players={team2} variant="accent" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function TeamColumn({
  label,
  players,
  variant,
}: {
  label: string
  players: RosterPlayer[]
  variant: "primary" | "accent"
}) {
  return (
    <div className="rounded-lg border bg-card">
      <div
        className={`flex items-center justify-between rounded-t-lg px-4 py-2 ${
          variant === "primary"
            ? "bg-primary text-primary-foreground"
            : "bg-accent text-accent-foreground"
        }`}
      >
        <span className="font-semibold">{label}</span>
        <Badge variant="secondary">{players.length}</Badge>
      </div>
      <ul className="divide-y">
        {players.map((p) => (
          <li key={p.signupId} className="px-4 py-2 text-sm">
            {p.name}
          </li>
        ))}
        {players.length === 0 && (
          <li className="px-4 py-2 text-sm text-muted-foreground">Leer</li>
        )}
      </ul>
    </div>
  )
}
