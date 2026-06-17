"use client"

import { useRef, useTransition } from "react"
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
  const formRef = useRef<HTMLFormElement>(null)

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
          <form
            ref={formRef}
            action={(formData) => {
              startTransition(async () => {
                await addPlayerToTraining(formData)
                formRef.current?.reset()
              })
            }}
            className="flex gap-2"
          >
            <Input name="name" placeholder="Name hinzufügen" aria-label="Spielername" required />
            <Button type="submit" size="icon" disabled={isPending} aria-label="Hinzufügen">
              <UserPlus className="size-4" aria-hidden />
            </Button>
          </form>
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
                  onClick={() => startTransition(() => removeSignup(p.signupId))}
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
