"use client"

import { FormEvent, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Trash2, UserPlus, MessageCircle } from "lucide-react"
import type { Locale } from "@/lib/i18n"

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
  locale = "de",
}: {
  roster: RosterPlayer[]
  quickAddPlayers: QuickAddPlayer[]
  canManage: boolean
  locale?: Locale
}) {
  const router = useRouter()
  const t = locale === "de" ? { title: "Angemeldet", addName: "Name hinzufügen", playerName: "Spielername", add: "Hinzufügen", quickAdd: "Schnell hinzufügen", lastTrainings: "Letzte 3 Trainings", viaWhatsapp: "per WhatsApp", remove: "entfernen", empty: <>Noch niemand angemeldet. Schreibt &quot;bin da&quot; in WhatsApp.</>, addFailed: "Spieler konnte nicht hinzugefügt werden.", removeFailed: "Anmeldung konnte nicht entfernt werden." } : { title: "Signed up", addName: "Add name", playerName: "Player name", add: "Add", quickAdd: "Quick add", lastTrainings: "Last 3 trainings", viaWhatsapp: "via WhatsApp", remove: "remove", empty: <>Nobody has signed up yet. Write &quot;bin da&quot; in WhatsApp.</>, addFailed: "Could not add player.", removeFailed: "Could not remove signup." }
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
            typeof data?.error === "string" ? data.error : t.addFailed,
          )
        }

        onSuccess?.()
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : t.addFailed)
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
            typeof data?.error === "string" ? data.error : t.removeFailed,
          )
        }

        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : t.removeFailed)
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-lg">
          <span>{t.title}</span>
          <Badge variant="secondary" className="text-sm">
            {roster.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {canManage && (
          <form onSubmit={handleAddPlayer} className="flex gap-2">
            <Input name="name" placeholder={t.addName} aria-label={t.playerName} required />
            <Button type="submit" size="icon" disabled={isPending} aria-label={t.add}>
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
              <h3 className="text-sm font-medium">{t.quickAdd}</h3>
              <span className="text-xs text-muted-foreground">{t.lastTrainings}</span>
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
                  title={`${player.name} ${t.add.toLowerCase()}`}
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
                  <MessageCircle className="size-3.5 text-primary" aria-label={t.viaWhatsapp} />
                )}
              </span>
              {canManage && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-destructive"
                  disabled={isPending}
                  onClick={() => handleRemoveSignup(p.signupId)}
                  aria-label={`${p.name} ${t.remove}`}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              )}
            </li>
          ))}
          {roster.length === 0 && (
            <li className="px-3 py-4 text-center text-sm text-muted-foreground">
              {t.empty}
            </li>
          )}
        </ul>
      </CardContent>
    </Card>
  )
}
