import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { asc } from "drizzle-orm"
import { Database, SlidersHorizontal } from "lucide-react"
import { AppNavigation } from "@/components/app-navigation"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { getSessionUser } from "@/lib/auth/server"
import { db } from "@/lib/db"
import { players } from "@/lib/db/schema"
import { getLocale } from "@/lib/i18n-server"
import { MATCHMAKING_SETTING_FIELDS, MATCHMAKING_SETTINGS_COOKIE, parseMatchmakingSettingsCookie } from "@/lib/matchmaking/settings"
import { DELETE_CONFIRMATION } from "@/lib/data-transfer"
import { deleteAllData, importJsonData, importTestData, mergePlayerAccounts, saveMatchmakingSettings, updateOrganizerRole } from "./actions"

export const dynamic = "force-dynamic"

export default async function EinstellungenPage() {
  const locale = await getLocale()
  const user = await getSessionUser()
  if (!user) redirect("/sign-in")

  const cookieStore = await cookies()
  const settings = parseMatchmakingSettingsCookie(cookieStore.get(MATCHMAKING_SETTINGS_COOKIE)?.value)
  const canManage = user.role === "organizer"
  const playerAccounts = canManage
    ? await db.select({ id: players.id, name: players.name, email: players.email, authUserId: players.authUserId, isOrganizer: players.isOrganizer }).from(players).orderBy(asc(players.name))
    : []

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
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="size-5 text-primary" aria-hidden />
            Testdaten importieren
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-pretty">
            Importiert zehn realistische Beispielspieler mit Telefonnummern, Positionswünschen, Ratings, WhatsApp-Nachrichten und acht Anmeldungen für das aktuell offene Training. Der Import ist wiederholbar: vorhandene Testspieler werden aktualisiert, Duplikate werden vermieden.
          </p>
          {!canManage && (
            <p className="rounded-lg border border-muted bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              Nur Organisatoren können Testdaten importieren.
            </p>
          )}
          <form action={importTestData}>
            <Button type="submit" disabled={!canManage}>Testdaten importieren</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Organisatoren und Accounts</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6">
          <section className="space-y-3">
            <h2 className="font-semibold text-foreground">Organisatoren verwalten</h2>
            <p className="text-sm text-muted-foreground text-pretty">
              Aktiviere Organisator-Rechte für angemeldete Spieler. dayoffrettchen@gmail.com bleibt zusätzlich immer als Organisator zugelassen.
            </p>
            <div className="grid gap-2">
              {playerAccounts.map((player) => (
                <form key={player.id} action={updateOrganizerRole} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3 text-sm">
                  <input type="hidden" name="playerId" value={player.id} />
                  <label className="flex items-center gap-3">
                    <input name="isOrganizer" type="checkbox" defaultChecked={player.isOrganizer} disabled={!canManage} />
                    <span>
                      <span className="block font-medium text-foreground">{player.name}</span>
                      <span className="text-muted-foreground">{player.email ?? "Kein verknüpftes Login"}</span>
                    </span>
                  </label>
                  <Button type="submit" variant="outline" size="sm" disabled={!canManage}>Speichern</Button>
                </form>
              ))}
              {playerAccounts.length === 0 && <p className="text-sm text-muted-foreground">Keine Spieler vorhanden.</p>}
            </div>
          </section>

          <section className="space-y-3 rounded-lg border bg-card p-4">
            <h2 className="font-semibold text-foreground">Doppelte Spieler zusammenführen</h2>
            <p className="text-sm text-muted-foreground text-pretty">
              Verbinde einen neu angemeldeten Account mit einem bereits manuell angelegten Spieler. Anmeldungen, Spiele, Positionen und Ratings werden auf den Ziel-Spieler verschoben; der Quell-Spieler wird gelöscht.
            </p>
            <form action={mergePlayerAccounts} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
              <label className="grid gap-2 text-sm font-medium text-foreground">
                Quelle löschen
                <select name="sourcePlayerId" className="h-10 rounded-md border bg-background px-3 text-sm" disabled={!canManage} required>
                  <option value="">Spieler wählen</option>
                  {playerAccounts.map((player) => <option key={player.id} value={player.id}>{player.name} {player.email ? `(${player.email})` : ""}</option>)}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium text-foreground">
                Ziel behalten
                <select name="targetPlayerId" className="h-10 rounded-md border bg-background px-3 text-sm" disabled={!canManage} required>
                  <option value="">Spieler wählen</option>
                  {playerAccounts.map((player) => <option key={player.id} value={player.id}>{player.name} {player.email ? `(${player.email})` : ""}</option>)}
                </select>
              </label>
              <Button type="submit" disabled={!canManage}>Accounts verbinden</Button>
            </form>
          </section>
        </CardContent>
      </Card>


      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="size-5 text-primary" aria-hidden />
            Daten sichern, wiederherstellen und löschen
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6">
          <section className="space-y-3">
            <h2 className="font-semibold text-foreground">JSON exportieren</h2>
            <p className="text-sm text-muted-foreground text-pretty">
              Lade alle App-Daten als JSON-Datei herunter: Trainings, Spieler, Positionswünsche, Ratings, Spiele, Anmeldungen und Nachrichten.
            </p>
            {canManage ? (
              <a className={buttonVariants()} href="/api/data/export">Daten als JSON exportieren</a>
            ) : (
              <Button type="button" disabled>Daten als JSON exportieren</Button>
            )}
          </section>

          <section className="space-y-3 rounded-lg border bg-card p-4">
            <h2 className="font-semibold text-foreground">JSON importieren</h2>
            <p className="text-sm text-muted-foreground text-pretty">
              Importiert einen zuvor exportierten Stand. Dabei werden die aktuellen App-Daten ersetzt, damit IDs und Zuordnungen exakt zum Export passen.
            </p>
            <form action={importJsonData} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <label className="grid gap-2 text-sm font-medium text-foreground">
                JSON-Datei
                <Input name="jsonFile" type="file" accept="application/json,.json" disabled={!canManage} required />
              </label>
              <Button type="submit" disabled={!canManage}>JSON importieren</Button>
            </form>
          </section>

          <section className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <h2 className="font-semibold text-destructive">Alle App-Daten löschen</h2>
            <p className="text-sm text-muted-foreground text-pretty">
              Löscht Trainings, Spieler, Ratings, Spiele, Anmeldungen und Nachrichten unwiderruflich. Zum Schutz muss die Bestätigung exakt schriftlich eingegeben werden: <span className="font-mono text-foreground">{DELETE_CONFIRMATION}</span>
            </p>
            <form action={deleteAllData} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <label className="grid gap-2 text-sm font-medium text-foreground">
                Schriftliche Bestätigung
                <Input name="confirmation" placeholder={DELETE_CONFIRMATION} disabled={!canManage} required />
              </label>
              <Button type="submit" variant="destructive" disabled={!canManage}>Alle Daten löschen</Button>
            </form>
          </section>

          {!canManage && (
            <p className="rounded-lg border border-muted bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              Nur Organisatoren können Daten exportieren, importieren oder löschen.
            </p>
          )}
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
