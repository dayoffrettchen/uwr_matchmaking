"use client"

import { FormEvent, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Check, Send } from "lucide-react"

type Msg = {
  id: number
  playerName: string
  body: string
  matched: boolean
  createdAt: Date | string
}

export function MessageFeed({ messages, canManage }: { messages: Msg[]; canManage: boolean }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  function handleSimulateMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)

    startTransition(async () => {
      setError(null)
      try {
        const response = await fetch("/api/training/messages/simulate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: String(formData.get("name") ?? ""),
            body: String(formData.get("body") ?? ""),
          }),
        })
        const data = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(
            typeof data?.error === "string" ? data.error : "Nachricht konnte nicht gesendet werden.",
          )
        }

        form.reset()
        router.refresh()
        await simulateMessage(formData)
        form.reset()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Nachricht konnte nicht gesendet werden.")
      }
    })
  }

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle className="text-lg">WhatsApp Gruppe</CardTitle>
        <p className="text-sm text-muted-foreground text-pretty">
          Wer &quot;bin da&quot; schreibt, wird automatisch für das nächste Training eingetragen.
        </p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto rounded-lg bg-muted p-3">
          {messages.length === 0 && (
            <p className="m-auto text-sm text-muted-foreground">Noch keine Nachrichten.</p>
          )}
          {messages.map((m) => (
            <div key={m.id} className="max-w-[85%] self-start rounded-lg rounded-tl-sm bg-card px-3 py-2 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-primary">{m.playerName}</span>
                {m.matched && (
                  <span className="flex items-center gap-0.5 text-[10px] font-medium text-primary">
                    <Check className="size-3" aria-hidden />
                    eingetragen
                  </span>
                )}
              </div>
              <p className="text-sm">{m.body}</p>
            </div>
          ))}
        </div>

        {canManage && (
          <form ref={formRef} onSubmit={handleSimulateMessage} className="flex flex-col gap-2 sm:flex-row">
            <Input name="name" placeholder="Name" aria-label="Name" required className="sm:max-w-[35%]" />
            <div className="flex flex-1 gap-2">
              <Input name="body" placeholder='z.B. "bin da"' aria-label="Nachricht" required />
              <Button type="submit" size="icon" disabled={isPending} aria-label="Senden">
                <Send className="size-4" aria-hidden />
              </Button>
            </div>
          </form>
        )}

        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
