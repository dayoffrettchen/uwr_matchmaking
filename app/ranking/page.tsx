import { redirect } from "next/navigation"
import { AppNavigation } from "@/components/app-navigation"
import { RankingTable } from "@/components/ranking-table"
import { getSessionUser } from "@/lib/auth/server"
import { listRanking } from "@/lib/players/queries"
import { PLAYER_POSITIONS, POSITION_LABELS } from "@/lib/ratings/types"

export const dynamic = "force-dynamic"

export default async function RankingPage() {
  const user = await getSessionUser(); if (!user) redirect("/sign-in")
  if (user.role !== "organizer") redirect("/")
  const data = await Promise.all(PLAYER_POSITIONS.map(async (p) => [p, await listRanking(p)] as const))
  return <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-4 py-8"><AppNavigation role={user.role} /><div><h1 className="text-2xl font-bold">Ranking</h1><p className="text-muted-foreground">Positionsbezogene Ratings nach Torwart, Verteidiger und Stürmer.</p></div>{data.map(([position, rows]) => <section key={position} className="grid gap-3"><h2 className="text-xl font-semibold">{POSITION_LABELS[position]}</h2><RankingTable rows={rows} /></section>)}</main>
}
