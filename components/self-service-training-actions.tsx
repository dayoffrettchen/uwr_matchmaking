import { CheckCircle2, LogIn, LogOut } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { signUpCurrentPlayer, withdrawCurrentPlayer } from "@/lib/training/self-service"
import type { Locale } from "@/lib/i18n"

export function SelfServiceTrainingActions({
  trainingId,
  isSignedUp,
  isOpen,
  locale = "de",
}: {
  trainingId: number
  isSignedUp: boolean
  isOpen: boolean
  locale?: Locale
}) {
  async function signUp() {
    "use server"
    await signUpCurrentPlayer(trainingId)
  }

  async function withdraw() {
    "use server"
    await withdrawCurrentPlayer(trainingId)
  }

  const t = locale === "de" ? { title: "Deine Anmeldung", signed: "Du bist für das nächste Training angemeldet. Wenn du doch nicht kannst, melde dich bitte wieder ab.", withdraw: "Wieder abmelden", unsigned: "Melde dich hier verbindlich für das nächste Training an.", signup: "Für Training anmelden", closed: "Die Anmeldung für dieses Training ist bereits geschlossen." } : { title: "Your signup", signed: "You are signed up for the next training. If you cannot make it, please withdraw your signup.", withdraw: "Withdraw signup", unsigned: "Sign up here for the next training.", signup: "Sign up for training", closed: "Signup for this training is already closed." }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <CheckCircle2 className="size-5 text-primary" aria-hidden />
          {t.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {isOpen ? (
          isSignedUp ? (
            <>
              <p className="text-sm text-muted-foreground">
                {t.signed}
              </p>
              <form action={withdraw}>
                <Button type="submit" variant="outline" className="w-full gap-2 sm:w-auto">
                  <LogOut className="size-4" aria-hidden />
                  {t.withdraw}
                </Button>
              </form>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {t.unsigned}
              </p>
              <form action={signUp}>
                <Button type="submit" className="w-full gap-2 sm:w-auto">
                  <LogIn className="size-4" aria-hidden />
                  {t.signup}
                </Button>
              </form>
            </>
          )
        ) : (
          <p className="text-sm text-muted-foreground">{t.closed}</p>
        )}
      </CardContent>
    </Card>
  )
}
