import { redirect } from "next/navigation"
import { AppNavigation } from "@/components/app-navigation"
import { getSessionUser } from "@/lib/auth/server"

export const dynamic = "force-dynamic"

export default async function ErgebnissePage() {
  const user = await getSessionUser(); if (!user) redirect("/sign-in")
  return <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-4 py-8"><AppNavigation /><div><h1 className="text-2xl font-bold">Ergebnisse</h1><p className="text-muted-foreground">Match-Entwürfe, Finalisierung und historische Rating-Neuberechnung sind serverseitig vorbereitet. Die vollständige Eingabemaske folgt auf dieser Seite.</p></div></main>
}
