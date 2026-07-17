import Link from "next/link"
import { Waves } from "lucide-react"
import { LanguageSwitcher } from "@/components/language-switcher"
import type { Locale } from "@/lib/i18n"
import type { AppRole } from "@/lib/auth/server"

const labels = {
  de: {
    players: "Spieler",
    results: "Spiele",
    profile: "Mein Profil",
    help: "Hilfe",
  },
  en: {
    players: "Players",
    results: "Games",
    profile: "My Profile",
    help: "Help",
  },
} satisfies Record<Locale, Record<string, string>>

export function AppNavigation({ role = "player", locale = "de" }: { role?: AppRole; locale?: Locale }) {
  const t = labels[locale]
  const organizerItems = [
    { href: "/", label: "Training" },
    { href: "/spieler", label: t.players },
    { href: "/ergebnisse", label: t.results },
    { href: "/ranking", label: "Ranking" },
    { href: "/hilfe", label: t.help },
    { href: "/einstellungen", label: "Einstellungen" },
    { href: "/profil", label: t.profile },
  ]
  const playerItems = [
    { href: "/", label: "Training" },
    { href: "/profil", label: t.profile },
    { href: "/ergebnisse", label: t.results },
    { href: "/hilfe", label: t.help },
  ]
  const items = role === "organizer" ? organizerItems : playerItems

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <nav className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2 text-sm">
        <Waves className="size-4 text-primary" aria-hidden />
        {items.map((item) => (
          <Link key={item.href} href={item.href} className="rounded-lg px-3 py-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground">
            {item.label}
          </Link>
        ))}
      </nav>
      <LanguageSwitcher locale={locale} />
    </div>
  )
}
