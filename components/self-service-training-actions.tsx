import { Button } from "@/components/ui/button"
import { signUpCurrentPlayer, withdrawCurrentPlayer } from "@/lib/training/self-service"

export function SelfServiceTrainingActions({ trainingId, isSignedUp, isOpen }: { trainingId: number; isSignedUp: boolean; isOpen: boolean }) {
  async function signUp() {
    "use server"
    await signUpCurrentPlayer(trainingId)
  }

  async function withdraw() {
    "use server"
    await withdrawCurrentPlayer(trainingId)
  }

  if (!isOpen) return <p className="text-sm text-muted-foreground">Die Anmeldung für dieses Training ist bereits geschlossen.</p>

  return isSignedUp ? (
    <form action={withdraw} className="grid gap-2">
      <p className="text-sm font-medium text-primary">Du bist für dieses Training angemeldet.</p>
      <Button type="submit" variant="outline">Wieder abmelden</Button>
    </form>
  ) : (
    <form action={signUp}>
      <Button type="submit">Ich bin dabei</Button>
    </form>
  )
}
