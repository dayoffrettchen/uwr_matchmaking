"use client"

import { useState } from "react"
import { Waves } from "lucide-react"

import { signIn } from "@/lib/auth/client"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function SignInForm({
  hasError = false,
}: {
  hasError?: boolean
}) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(
    hasError ? "Anmeldung fehlgeschlagen. Bitte erneut versuchen." : null,
  )

  async function handleGoogleSignIn() {
    setIsLoading(true)
    setError(null)

    try {
      await signIn.social({
        provider: "google",
        callbackURL: window.location.origin,
      })
    } catch (cause) {
      console.error("Google login failed:", cause)
      setError("Die Google-Anmeldung konnte nicht gestartet werden.")
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="items-center text-center">
        <div className="mb-2 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Waves className="size-6" aria-hidden />
        </div>

        <CardTitle className="text-xl">UWR Matchmaking</CardTitle>

        <CardDescription>
          Melde dich an, um Trainings und Teams zu sehen.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <Button
          type="button"
          className="w-full"
          size="lg"
          disabled={isLoading}
          onClick={handleGoogleSignIn}
        >
          <GoogleMark />
          {isLoading ? "Anmeldung wird geöffnet …" : "Mit Google anmelden"}
        </Button>

        {error && (
          <p
            role="alert"
            className="text-center text-sm text-destructive"
          >
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function GoogleMark() {
  return (
    <svg
      className="size-4"
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M21.35 11.1H12v2.8h5.35c-.23 1.4-1.6 4.1-5.35 4.1a5.9 5.9 0 0 1 0-11.8c1.68 0 2.8.72 3.45 1.34l2.35-2.27C16.4 3.9 14.4 3 12 3a9 9 0 1 0 0 18c5.2 0 8.65-3.65 8.65-8.8 0-.6-.07-1.05-.3-2.1Z"
      />
    </svg>
  )
}
