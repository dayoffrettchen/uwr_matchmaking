import { CheckCircle2, LogIn, LogOut } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { signUpCurrentPlayer, withdrawCurrentPlayer } from "@/lib/training/self-service"

export function SelfServiceTrainingActions({
  trainingId,
  isSignedUp,
  isOpen,
}: {
  trainingId: number
  isSignedUp: boolean
  isOpen: boolean
}) {
  async function signUp() {
    "use server"
    await signUpCurrentPlayer(trainingId)
  }

  async function withdraw() {
    "use server"
    await withdrawCurrentPlayer(trainingId)
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <CheckCircle2 className="size-5 text-primary" aria-hidden />
          Deine Anmeldung
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {isOpen ? (
          isSignedUp ? (
            <>
              <p className="text-sm text-muted-foreground">
                Du bist für das nächste Training angemeldet. Wenn du doch nicht kannst, melde dich bitte wieder ab.
              </p>
              <form action={withdraw}>
                <Button type="submit" variant="outline" className="w-full gap-2 sm:w-auto">
                  <LogOut className="size-4" aria-hidden />
                  Wieder abmelden
                </Button>
              </form>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Melde dich hier verbindlich für das nächste Training an.
              </p>
              <form action={signUp}>
                <Button type="submit" className="w-full gap-2 sm:w-auto">
                  <LogIn className="size-4" aria-hidden />
                  Für Training anmelden
                </Button>
              </form>
            </>
          )
        ) : (
          <p className="text-sm text-muted-foreground">Die Anmeldung für dieses Training ist bereits geschlossen.</p>
        )}
      </CardContent>
    </Card>
  )
}
