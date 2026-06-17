"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Waves } from "lucide-react"

export function SignInForm() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGoogle() {
    setLoading(true)
    setError(null)
    try {
      // Ask the auth backend for the Google provider URL. The SDK does not
      // reliably redirect inside the v0 preview iframe, so we fetch the URL
      // and navigate to it ourselves.
      const res = await fetch(`${window.location.origin}/api/auth/sign-in/social`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "google", callbackURL: `${window.location.origin}/` }),
      })

      if (!res.ok) throw new Error(`sign-in failed: ${res.status}`)

      const data = (await res.json()) as { url?: string }
      if (!data?.url) throw new Error("no redirect url returned")

      // Google refuses to render inside an iframe. If we are embedded (e.g. the
      // v0 preview), break out to the top-level window; if that is blocked by
      // cross-origin rules, open the consent screen in a new tab instead.
      const embedded = window.self !== window.top
      if (embedded) {
        try {
          window.top!.location.href = data.url
        } catch {
          window.open(data.url, "_blank", "noopener,noreferrer")
          setLoading(false)
        }
      } else {
        window.location.href = data.url
      }
    } catch {
      setError("Anmeldung fehlgeschlagen. Bitte erneut versuchen.")
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="items-center text-center">
        <div className="mb-2 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Waves className="size-6" aria-hidden />
        </div>
        <CardTitle className="text-xl">UWR Matchmaking</CardTitle>
        <CardDescription>Melde dich an, um Trainings und Teams zu sehen.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Button onClick={handleGoogle} disabled={loading} className="w-full" size="lg">
          <GoogleMark />
          {loading ? "Wird angemeldet…" : "Mit Google anmelden"}
        </Button>
        {error && (
          <p role="alert" className="text-center text-sm text-destructive">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function GoogleMark() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" aria-hidden focusable="false">
      <path
        fill="currentColor"
        d="M21.35 11.1H12v2.8h5.35c-.23 1.4-1.6 4.1-5.35 4.1a5.9 5.9 0 0 1 0-11.8c1.68 0 2.8.72 3.45 1.34l2.35-2.27C16.4 3.9 14.4 3 12 3a9 9 0 1 0 0 18c5.2 0 8.65-3.65 8.65-8.8 0-.6-.07-1.05-.3-2.1Z"
      />
    </svg>
  )
}
