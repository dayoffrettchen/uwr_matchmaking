"use client"

import { FormEvent, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Trash2, UserPlus, MessageCircle } from "lucide-react"

type RosterPlayer = {
  signupId: number
  name: string
  source: string
}

type QuickAddPlayer = {
  id: number
  name: string
  recentAttendanceCount: number
}

export function RosterPanel({
  roster,
  quickAddPlayers,
  canManage,
}: {
  roster: RosterPlayer[]
  quickAddPlayers: QuickAddPlayer[]
  canManage: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  function handleAddPlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)

    addPlayerByName(String(formData.get("name") ?? ""), () => form.reset())
  }

  function addPlayerByName(name: string, onSuccess?: () => void) {
    startTransition(async () => {
      setError(null)
      try {
        const response = await fetch("/api/training/signups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        })
        const data = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(
            typeof data?.error === "string" ? data.error : "Spieler konnte nicht hinzugefügt werden.",
          )
        }

        onSuccess?.()
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Spieler konnte nicht hinzugefügt werden.")
      }
    })
  }

  function handleRemoveSignup(signupId: number) {
    startTransition(async () => {
      setError(null)
      try {
        const response = await fetch("/api/training/signups", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ signupId }),
        })
        const data = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(
            typeof data?.error === "string" ? data.error : "Anmeldung konnte nicht entfernt werden.",
          )
        }

        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Anmeldung konnte nicht entfernt werden.")
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-lg">
          <span>Angemeldet</span>
          <Badge variant="secondary" className="text-sm">
            {roster.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {canManage && (
          <form onSubmit={handleAddPlayer} className="flex gap-2">
            <Input name="name" placeholder="Name hinzufügen" aria-label="Spielername" required />
            <Button type="submit" size="icon" disabled={isPending} aria-label="Hinzufügen">
              <UserPlus className="size-4" aria-hidden />
            </Button>
          </form>
        )}

        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {canManage && quickAddPlayers.length > 0 && (
          <section className="rounded-lg border bg-muted/30 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium">Schnell hinzufügen</h3>
              <span className="text-xs text-muted-foreground">Letzte 3 Trainings</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {quickAddPlayers.map((player) => (
                <Button
                  key={player.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-auto justify-start gap-2 py-1.5"
                  disabled={isPending}
                  onClick={() => addPlayerByName(player.name)}
                  title={`${player.name} hinzufügen`}
                >
                  <UserPlus className="size-3.5" aria-hidden />
                  <span>{player.name}</span>
                  <Badge variant="secondary" className="ml-1">
                    {player.recentAttendanceCount}/3
                  </Badge>
                </Button>
              ))}
            </div>
          </section>
        )}

        <ul className="divide-y rounded-lg border">
          {roster.map((p) => (
            <li key={p.signupId} className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="flex items-center gap-2 text-sm">
                {p.name}
                {p.source === "whatsapp" && (
                  <MessageCircle className="size-3.5 text-primary" aria-label="per WhatsApp" />
                )}
              </span>
              {canManage && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-destructive"
                  disabled={isPending}
                  onClick={() => handleRemoveSignup(p.signupId)}
                  aria-label={`${p.name} entfernen`}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              )}
            </li>
          ))}
          {roster.length === 0 && (
            <li className="px-3 py-4 text-center text-sm text-muted-foreground">
              Noch niemand angemeldet. Schreibt &quot;bin da&quot; in WhatsApp.
            </li>
          )}
        </ul>
      </CardContent>
    </Card>
  )
}
