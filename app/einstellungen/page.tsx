import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { SlidersHorizontal } from "lucide-react"
import { AppNavigation } from "@/components/app-navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { getSessionUser } from "@/lib/auth/server"
import { getLocale } from "@/lib/i18n-server"
import { MATCHMAKING_SETTING_FIELDS, MATCHMAKING_SETTINGS_COOKIE, parseMatchmakingSettingsCookie } from "@/lib/matchmaking/settings"
import { saveMatchmakingSettings } from "./actions"

export const dynamic = "force-dynamic"

export default async function EinstellungenPage() {
  const locale = await getLocale()
  const user = await getSessionUser()
  if (!user) redirect("/sign-in")

  const cookieStore = await cookies()
  const settings = parseMatchmakingSettingsCookie(cookieStore.get(MATCHMAKING_SETTINGS_COOKIE)?.value)
  const canManage = user.role === "organizer"

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-4 py-8">
      <AppNavigation role={user.role} locale={locale} />
      <div className="space-y-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <SlidersHorizontal className="size-6 text-primary" aria-hidden />
          Einstellungen für die Einteilung
        </h1>
        <p className="max-w-3xl text-muted-foreground text-pretty">
          Hier steuerst du, wie gründlich die automatische Team-Einteilung nach fairen Aufstellungen sucht. Die Werte gelten für den nächsten Klick auf „Teams fair einteilen“ in diesem Browser und werden als Cookie gespeichert.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Optimierungswerte</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={saveMatchmakingSettings} className="grid gap-5">
            {MATCHMAKING_SETTING_FIELDS.map((field) => (
              <label key={field.key} className="grid gap-2 rounded-lg border bg-card p-4 md:grid-cols-[minmax(0,1fr)_12rem] md:items-start">
                <span className="space-y-1">
                  <span className="block font-medium text-foreground">{field.label}</span>
                  <span className="block text-sm text-muted-foreground text-pretty">{field.explanation}</span>
                  <span className="block text-xs text-muted-foreground">
                    Erlaubt: {field.min.toLocaleString("de-DE")}–{field.max.toLocaleString("de-DE")} {field.unit}
                  </span>
                </span>
                <span className="grid gap-1">
                  <Input name={field.key} type="number" min={field.min} max={field.max} step={field.step} defaultValue={settings[field.key]} disabled={!canManage} />
                  <span className="text-xs text-muted-foreground">{field.unit}</span>
                </span>
              </label>
            ))}
            {!canManage && <p className="rounded-lg border border-muted bg-muted/40 px-3 py-2 text-sm text-muted-foreground">Nur Organisatoren können diese Werte ändern.</p>}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={!canManage}>Einstellungen speichern</Button>
              <Button type="reset" variant="outline" disabled={!canManage}>Änderungen verwerfen</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Wie die Werte zusammenwirken</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground text-pretty">
          <p>Die Einteilung bewertet viele mögliche Teamkombinationen nach Teamstärke, Positionsstärke, Wechselgruppen, Positionswünschen und Rating-Sicherheit.</p>
          <p>Mehr Kandidaten, Generationen oder Population erhöhen die Chance auf ein besseres Ergebnis, machen die Berechnung aber langsamer. Das Zeitlimit verhindert, dass die Seite zu lange wartet.</p>
          <p>Wenn du schnelle Einteilungen möchtest, reduziere vor allem Kandidaten und Zeitlimit. Wenn sehr viele Spieler angemeldet sind oder die Teams besonders knapp ausbalanciert werden sollen, erhöhe diese Werte vorsichtig.</p>
        </CardContent>
      </Card>
    </main>
  )
}
