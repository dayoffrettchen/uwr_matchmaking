"use client"

import { FormEvent, useRef, useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { addPlayerToTraining, removeSignup } from "@/app/actions/training"
import { Trash2, UserPlus, MessageCircle } from "lucide-react"

type RosterPlayer = {
  signupId: number
  name: string
  source: string
}

export function RosterPanel({ roster, canManage }: { roster: RosterPlayer[]; canManage: boolean }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  function handleAddPlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)

    startTransition(async () => {
      setError(null)
      try {
        await addPlayerToTraining(formData)
        form.reset()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Spieler konnte nicht hinzugefügt werden.")
      }
    })
  }

  function handleRemoveSignup(signupId: number) {
    startTransition(async () => {
      setError(null)
      try {
        await removeSignup(signupId)
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
          <form ref={formRef} onSubmit={handleAddPlayer} className="flex gap-2">
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
