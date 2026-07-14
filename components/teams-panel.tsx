"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Shuffle, Users, X } from "lucide-react"

type RosterPlayer = {
  signupId: number
  name: string
  team: number | null
  source: string
}

type TeamAction = "generate" | "clear"

export function TeamsPanel({ roster, canManage }: { roster: RosterPlayer[]; canManage: boolean }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [pendingAction, setPendingAction] = useState<TeamAction | null>(null)
  const [error, setError] = useState<string | null>(null)

  const teamsAssigned = roster.some((p) => p.team !== null)
  const team1 = roster.filter((p) => p.team === 1)
  const team2 = roster.filter((p) => p.team === 2)
  const isMutating = isPending || pendingAction !== null

  async function runTeamAction(action: TeamAction) {
    setPendingAction(action)
    setError(null)

    try {
      const response = await fetch("/api/training/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
        redirect: "manual",
      })

      if (!response.ok || response.type === "opaqueredirect") {
        const data = await response.json().catch(() => null)
        const message =
          typeof data?.error === "string"
            ? data.error
            : "Die Team-Aktion ist fehlgeschlagen. Bitte versuche es erneut."
        throw new Error(message)
      }

      startTransition(() => {
        router.refresh()
      })
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Die Team-Aktion ist fehlgeschlagen. Bitte versuche es erneut.",
      )
    } finally {
      setPendingAction(null)
    }
  }

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
                type="button"
                variant="ghost"
                size="sm"
                disabled={isMutating}
                onClick={() => void runTeamAction("clear")}
              >
                <X className="size-4" aria-hidden />
                {pendingAction === "clear" ? "Setze zurück …" : "Zurücksetzen"}
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              disabled={isMutating || roster.length < 2}
              onClick={() => void runTeamAction("generate")}
            >
              <Shuffle className="size-4" aria-hidden />
              {pendingAction === "generate" ? "Lose aus …" : "Auslosen"}
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {error && (
          <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
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
