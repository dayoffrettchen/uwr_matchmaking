import { redirect } from "next/navigation"
import { getLocale } from "@/lib/i18n-server"
import { eq, asc } from "drizzle-orm"

import { AppNavigation } from "@/components/app-navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { db } from "@/lib/db"
import { playerPositionPreferences } from "@/lib/db/schema"
import { getSessionUser } from "@/lib/auth/server"
import { ensureCurrentPlayerProfile } from "@/lib/players/ensure-profile"
import { PLAYER_POSITIONS, POSITION_LABELS } from "@/lib/ratings/types"
import { saveOwnProfile } from "@/app/profil/actions"

export const dynamic = "force-dynamic"

export default async function ProfilePage() {
  const locale = await getLocale()
  const user = await getSessionUser()
  if (!user) redirect("/sign-in")

  const player = await ensureCurrentPlayerProfile(user)
  const preferences = await db
    .select()
    .from(playerPositionPreferences)
    .where(eq(playerPositionPreferences.playerId, player.id))
    .orderBy(asc(playerPositionPreferences.preferenceOrder))
  const selected = new Set(preferences.map((preference) => preference.position))

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-8">
      <AppNavigation role={user.role} locale={locale} />
      <Card>
        <CardHeader>
          <CardTitle>Mein Profil</CardTitle>
          <CardDescription>Pflege deine Kontaktdaten und Positionswünsche. E-Mail und Google-Konto werden über die Anmeldung verwaltet.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveOwnProfile} className="grid gap-5">
            <label className="grid gap-2 text-sm font-medium">Name<Input name="name" defaultValue={player.name} required /></label>
            <label className="grid gap-2 text-sm font-medium">E-Mail<Input value={player.email ?? user.email ?? ""} disabled /><span className="text-xs font-normal text-muted-foreground">Wird über Google verwaltet und kann hier nicht geändert werden.</span></label>
            <label className="grid gap-2 text-sm font-medium">Telefonnummer<Input name="phone" defaultValue={player.phone ?? ""} placeholder="optional" /></label>
            <fieldset className="grid gap-3 rounded-lg border p-4">
              <legend className="px-1 text-sm font-medium">Bevorzugte Positionen</legend>
              {PLAYER_POSITIONS.map((position) => (
                <label key={position} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="preferredPositions" value={position} defaultChecked={selected.has(position)} className="size-4" />
                  {POSITION_LABELS[position]}
                </label>
              ))}
            </fieldset>
            <label className="grid gap-2 text-sm font-medium">Persönliche Hinweise<textarea name="notes" defaultValue={player.notes ?? ""} maxLength={1000} className="min-h-24 rounded-md border bg-background px-3 py-2 text-sm" placeholder="optional" /></label>
            <Button type="submit">Profil speichern</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
