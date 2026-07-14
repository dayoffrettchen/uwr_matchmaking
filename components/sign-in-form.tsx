"use client"

import { FormEvent, useState } from "react"
import { Mail, Waves } from "lucide-react"

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
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"

type EmailMode = "sign-in" | "register" | "verify"

export function SignInForm({
  hasError = false,
  locale = "de",
}: {
  hasError?: boolean
  locale?: Locale
}) {
  const t =
    locale === "de"
      ? {
          failed: "Anmeldung fehlgeschlagen. Bitte erneut versuchen.",
          title: "Anmelden",
          description:
            "Melde dich mit Google oder mit E-Mail und Passwort an, um dein Spielerprofil zu verwalten und dich zu Trainings anzumelden.",
          googleLoading: "Google-Anmeldung wird gestartet …",
          googleSignIn: "Mit Google anmelden",
          email: "E-Mail",
          name: "Name",
          password: "Passwort",
          code: "Bestätigungscode",
          signIn: "Mit E-Mail anmelden",
          register: "Registrieren",
          registering: "Registrierung wird erstellt …",
          signingIn: "Anmeldung läuft …",
          verifyTitle: "E-Mail bestätigen",
          verifyDescription:
            "Wir haben dir einen Code per E-Mail gesendet. Gib ihn ein, um die Registrierung abzuschließen.",
          verify: "Code bestätigen",
          verifying: "Code wird geprüft …",
          resend: "Code erneut senden",
          resendLoading: "Code wird gesendet …",
          showRegister: "Noch kein Konto? Registrieren",
          showSignIn: "Schon registriert? Anmelden",
          codeSent: "Bestätigungscode wurde gesendet.",
          verified: "E-Mail bestätigt. Du wirst weitergeleitet …",
          emailSeparator: "oder per E-Mail",
          passwordHint: "Mindestens 8 Zeichen.",
        }
      : {
          failed: "Sign-in failed. Please try again.",
          title: "Sign in",
          description:
            "Sign in with Google or with email and password to manage your player profile and sign up for training sessions.",
          googleLoading: "Starting Google sign-in …",
          googleSignIn: "Sign in with Google",
          email: "Email",
          name: "Name",
          password: "Password",
          code: "Verification code",
          signIn: "Sign in with email",
          register: "Register",
          registering: "Creating account …",
          signingIn: "Signing in …",
          verifyTitle: "Verify email",
          verifyDescription:
            "We sent you a code by email. Enter it to finish registration.",
          verify: "Verify code",
          verifying: "Checking code …",
          resend: "Resend code",
          resendLoading: "Sending code …",
          showRegister: "No account yet? Register",
          showSignIn: "Already registered? Sign in",
          codeSent: "Verification code sent.",
          verified: "Email verified. Redirecting …",
          emailSeparator: "or use email",
          passwordHint: "At least 8 characters.",
        }

  const [mode, setMode] = useState<EmailMode>("sign-in")
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const [loadingAction, setLoadingAction] = useState<
    "google" | "email" | "verify" | "resend" | null
  >(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(
    hasError ? t.failed : null,
  )

  const isLoading = loadingAction !== null

  async function handleGoogleSignIn() {
    setLoadingAction("google")
    setErrorMessage(null)
    setInfoMessage(null)

    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/",
      })

      if (result?.error) {
        logAuthError("Google login failed", result.error)
        setErrorMessage(formatAuthError(result.error, "google"))
        setLoadingAction(null)
      }
    } catch (error) {
      logAuthError("Google login failed", error)
      setErrorMessage(formatAuthError(error, "google"))
      setLoadingAction(null)
    }
  }

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoadingAction(mode === "verify" ? "verify" : "email")
    setErrorMessage(null)
    setInfoMessage(null)

    try {
      if (mode === "register") {
        const result = await authClient.signUp.email({
          email,
          password,
          name,
          callbackURL: "/",
        })

        if (result?.error) {
          setErrorMessage(formatAuthError(result.error, "email"))
          return
        }

        await sendVerificationCode()
        setMode("verify")
        setInfoMessage(t.codeSent)
        return
      }

      if (mode === "verify") {
        const result = await authClient.emailOtp.verifyEmail({
          email,
          otp: code,
        })

        if (result?.error) {
          setErrorMessage(formatAuthError(result.error, "email"))
          return
        }

        setInfoMessage(t.verified)
        window.location.assign("/")
        return
      }

      const result = await authClient.signIn.email({
        email,
        password,
        callbackURL: "/",
      })

      if (result?.error) {
        setErrorMessage(formatAuthError(result.error, "email"))
        return
      }

      window.location.assign("/")
    } catch (error) {
      logAuthError("Email auth failed", error)
      setErrorMessage(formatAuthError(error, "email"))
    } finally {
      setLoadingAction(null)
    }
  }

  async function handleResendCode() {
    setLoadingAction("resend")
    setErrorMessage(null)
    setInfoMessage(null)

    try {
      await sendVerificationCode()
      setInfoMessage(t.codeSent)
    } catch (error) {
      logAuthError("Verification code failed", error)
      setErrorMessage(formatAuthError(error, "email"))
    } finally {
      setLoadingAction(null)
    }
  }

  async function sendVerificationCode() {
    const result = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "email-verification",
    })

    if (result?.error) {
      throw result.error
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="items-center text-center">
        <div className="mb-2 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Waves className="size-6" aria-hidden />
        </div>

        <CardTitle className="text-xl">
          {mode === "verify" ? t.verifyTitle : t.title}
        </CardTitle>

        <CardDescription>
          {mode === "verify" ? t.verifyDescription : t.description}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {mode !== "verify" && (
          <Button
            type="button"
            className="w-full"
            size="lg"
            disabled={isLoading}
            onClick={handleGoogleSignIn}
          >
            <GoogleMark />
            {loadingAction === "google" ? t.googleLoading : t.googleSignIn}
          </Button>
        )}

        {mode !== "verify" && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <Separator className="flex-1" />
            <span>{t.emailSeparator}</span>
            <Separator className="flex-1" />
          </div>
        )}

        <form className="flex flex-col gap-3" onSubmit={handleEmailSubmit}>
          {mode === "register" && (
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              {t.name}
              <Input
                autoComplete="name"
                disabled={isLoading}
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
          )}

          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {t.email}
            <Input
              type="email"
              autoComplete="email"
              disabled={isLoading || mode === "verify"}
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          {mode !== "verify" ? (
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              {t.password}
              <Input
                type="password"
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                disabled={isLoading}
                minLength={8}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              {mode === "register" && (
                <span className="text-xs font-normal text-muted-foreground">
                  {t.passwordHint}
                </span>
              )}
            </label>
          ) : (
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              {t.code}
              <Input
                autoComplete="one-time-code"
                disabled={isLoading}
                inputMode="numeric"
                required
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </label>
          )}

          <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
            <Mail className="size-4" aria-hidden />
            {submitLabel(mode, loadingAction, t)}
          </Button>
        </form>

        {mode === "verify" && (
          <Button
            type="button"
            variant="ghost"
            disabled={isLoading}
            onClick={handleResendCode}
          >
            {loadingAction === "resend" ? t.resendLoading : t.resend}
          </Button>
        )}

        {mode !== "verify" && (
          <Button
            type="button"
            variant="ghost"
            disabled={isLoading}
            onClick={() => {
              setMode(mode === "sign-in" ? "register" : "sign-in")
              setErrorMessage(null)
              setInfoMessage(null)
            }}
          >
            {mode === "sign-in" ? t.showRegister : t.showSignIn}
          </Button>
        )}

        {infoMessage && (
          <p className="text-center text-sm text-muted-foreground">{infoMessage}</p>
        )}

        {errorMessage && (
          <p role="alert" className="text-center text-sm text-destructive">
            {errorMessage}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function submitLabel(
  mode: EmailMode,
  loadingAction: "google" | "email" | "verify" | "resend" | null,
  t: Record<string, string>,
) {
  if (mode === "register") {
    return loadingAction === "email" ? t.registering : t.register
  }

  if (mode === "verify") {
    return loadingAction === "verify" ? t.verifying : t.verify
  }

  return loadingAction === "email" ? t.signingIn : t.signIn
}

function formatAuthError(error: unknown, provider: "google" | "email" = "google"): string {
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
    return provider === "google"
    ? "Google-Anmeldung ist in Neon Auth für Produktion nicht vollständig konfiguriert."
    : "E-Mail-Anmeldung ist in Neon Auth nicht vollständig aktiviert."
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

  return provider === "google"
    ? "Die Google-Anmeldung konnte nicht gestartet werden."
    : "Die Anmeldung mit E-Mail konnte nicht abgeschlossen werden. Prüfe E-Mail, Passwort und Bestätigungscode."
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
