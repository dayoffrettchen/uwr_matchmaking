"use client"

import { useRef, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { simulateMessage } from "@/app/actions/training"
import { Check, Send } from "lucide-react"

type Msg = {
  id: number
  playerName: string
  body: string
  matched: boolean
  createdAt: Date | string
}

export function MessageFeed({ messages }: { messages: Msg[] }) {
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

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

        <form
          ref={formRef}
          action={(formData) => {
            startTransition(async () => {
              await simulateMessage(formData)
              formRef.current?.reset()
            })
          }}
          className="flex flex-col gap-2 sm:flex-row"
        >
          <Input name="name" placeholder="Name" aria-label="Name" required className="sm:max-w-[35%]" />
          <div className="flex flex-1 gap-2">
            <Input name="body" placeholder='z.B. "bin da"' aria-label="Nachricht" required />
            <Button type="submit" size="icon" disabled={isPending} aria-label="Senden">
              <Send className="size-4" aria-hidden />
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
