import Link from "next/link"
import { Waves } from "lucide-react"
import type { AppRole } from "@/lib/auth/server"

const organizerItems = [
  { href: "/", label: "Training" },
  { href: "/spieler", label: "Spieler" },
  { href: "/ergebnisse", label: "Ergebnisse" },
  { href: "/ranking", label: "Ranking" },
  { href: "/profil", label: "Mein Profil" },
]

const playerItems = [
  { href: "/", label: "Training" },
  { href: "/profil", label: "Mein Profil" },
  { href: "/ergebnisse", label: "Ergebnisse" },
]

export function AppNavigation({ role = "player" }: { role?: AppRole }) {
  const items = role === "organizer" ? organizerItems : playerItems
  return <nav className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2 text-sm"><Waves className="size-4 text-primary" aria-hidden />{items.map((item) => <Link key={item.href} href={item.href} className="rounded-lg px-3 py-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground">{item.label}</Link>)}</nav>
}
