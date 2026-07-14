import { redirect } from "next/navigation"
import { getLocale } from "@/lib/i18n-server"
import { getSessionUser } from "@/lib/auth/server"
import { ensureDatabaseSchema } from "@/lib/db/ensure-schema"
import { listPlayersWithRatings } from "@/lib/players/queries"
import { PlayerRatingCard } from "@/components/player-rating-card"
import { AppNavigation } from "@/components/app-navigation"
import { EloScaleTable } from "@/components/elo-scale-table"

export const dynamic = "force-dynamic"

export default async function SpielerPage() {
  const locale = await getLocale()
  const user = await getSessionUser()
  if (!user) redirect("/sign-in")
  await ensureDatabaseSchema()
  const players = await listPlayersWithRatings()
  return <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-4 py-8"><AppNavigation role={user.role} locale={locale} /><div><h1 className="text-2xl font-bold">Spieler</h1><p className="text-muted-foreground">Positionsfreigaben, Anfangsratings und Ratingqualität.</p></div><EloScaleTable />{players.map((player) => <PlayerRatingCard key={player.id} player={player} canManage={user.role === "organizer"} />)}</main>
}
