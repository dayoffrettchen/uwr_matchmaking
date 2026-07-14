"use client"

import { useState } from "react"
import { Waves } from "lucide-react"

import { authClient } from "@/lib/auth/client"
import type { Locale } from "@/lib/i18n"
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
  locale = "de",
}: {
  hasError?: boolean
  locale?: Locale
}) {
  const t = locale === "de" ? { failed: "Anmeldung fehlgeschlagen. Bitte erneut versuchen.", title: "Mit Google anmelden", description: "Melde dich mit deinem Google-Konto an, um dein Spielerprofil zu verwalten und dich zu Trainings anzumelden.", loading: "Anmeldung wird gestartet …", signIn: "Mit Google anmelden" } : { failed: "Sign-in failed. Please try again.", title: "Sign in with Google", description: "Sign in with your Google account to manage your player profile and sign up for training sessions.", loading: "Starting sign-in …", signIn: "Sign in with Google" }
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(
    hasError ? t.failed : null,
  )

  async function handleGoogleSignIn() {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/",
        prompt: "select_account",
      })

      if (result?.error) {
        logAuthError("Google login failed", result.error)
        setErrorMessage(formatAuthError(result.error))
        setIsLoading(false)
      }
    } catch (error) {
      logAuthError("Google login failed", error)
      setErrorMessage(formatAuthError(error))
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="items-center text-center">
        <div className="mb-2 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Waves className="size-6" aria-hidden />
        </div>

        <CardTitle className="text-xl">{t.title}</CardTitle>

        <CardDescription>
          {t.description}
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

          {isLoading
            ? t.loading
            : t.signIn}
        </Button>

        {errorMessage && (
          <p
            role="alert"
            className="text-center text-sm text-destructive"
          >
            {errorMessage}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function formatAuthError(error: unknown): string {
  const details = getAuthErrorDetails(error)
  const searchableText = [
    details.code,
    details.message,
    details.status,
    details.statusCode,
    details.responseBody,
    details.raw,
  ]
    .filter(Boolean)
    .join(" ")
    .toUpperCase()

  if (
    searchableText.includes("INVALID_ORIGIN") ||
    searchableText.includes("ORIGIN")
  ) {
    return authDomainConfigMessage()
  }

  if (
    searchableText.includes("INVALID_CALLBACK_URL") ||
    searchableText.includes("INVALID_CALLBACKURL") ||
    searchableText.includes("CALLBACK")
  ) {
    return authDomainConfigMessage()
  }

  if (
    searchableText.includes("FEATURE_NOT_SUPPORTED") ||
    searchableText.includes("PROVIDER_DISABLED") ||
    searchableText.includes("PROVIDER_NOT_ENABLED") ||
    searchableText.includes("SOCIAL_PROVIDER_DISABLED") ||
    searchableText.includes("OAUTH_PROVIDER_DISABLED") ||
    (searchableText.includes("PROVIDER") && searchableText.includes("DISABLED"))
  ) {
    return "Google-Anmeldung ist in Neon Auth für Produktion nicht vollständig konfiguriert."
  }

  if (
    details.status === 403 ||
    details.statusCode === 403 ||
    searchableText.includes("FORBIDDEN")
  ) {
    return "Neon Auth hat die Anmeldung abgelehnt. Bitte Domains und Google-OAuth in Neon prüfen."
  }

  if (
    searchableText.includes("GOOGLE") ||
    searchableText.includes("OAUTH")
  ) {
    return "Google-Anmeldung fehlgeschlagen. Bitte Konfiguration prüfen."
  }

  return "Die Google-Anmeldung konnte nicht gestartet werden."
}

function authDomainConfigMessage(): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "diese Domain"

  return `${origin} ist in Neon Auth nicht als vertrauenswürdige Domain freigegeben.`
}

function logAuthError(label: string, error: unknown) {
  const details = getAuthErrorDetails(error)

  console.error(label, {
    status: details.status,
    statusCode: details.statusCode,
    code: details.code,
    message: details.message,
    responseBody: details.responseBody,
    raw: error,
  })
}

function getAuthErrorDetails(error: unknown) {
  if (!isRecord(error)) {
    return {
      message: error instanceof Error ? error.message : String(error),
      raw: String(error),
    }
  }

  const response = isRecord(error.response) ? error.response : undefined

  return {
    status: getNumber(error.status) ?? getNumber(response?.status),
    statusCode: getNumber(error.statusCode) ?? getNumber(response?.statusCode),
    code: getString(error.code) ?? getString(error.error),
    message: getString(error.message) ?? getString(error.statusText),
    responseBody: getResponseBody(error, response),
    raw: stringifyForSearch(error),
  }
}

function getResponseBody(
  error: Record<string, unknown>,
  response?: Record<string, unknown>,
) {
  return stringifyForSearch(
    error.body ??
      error.data ??
      error.responseBody ??
      response?.body ??
      response?.data,
  )
}

function stringifyForSearch(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined
  }

  if (typeof value === "string") {
    return value
  }

  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined
}

function getNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
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
