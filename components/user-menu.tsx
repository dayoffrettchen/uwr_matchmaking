"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { signOutUser } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { LogOut } from "lucide-react"
import type { Locale } from "@/lib/i18n"

export function UserMenu({
  name,
  email,
  role,
  locale = "de",
}: {
  name: string | null
  email: string | null
  role: "organizer" | "player"
  locale?: Locale
}) {
  const router = useRouter()
  const t = locale === "de" ? { organizer: "Organisator", player: "Spieler", signOut: "Abmelden", failed: "Abmeldung fehlgeschlagen." } : { organizer: "Organizer", player: "Player", signOut: "Sign out", failed: "Sign-out failed." }
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)

  async function handleSignOut() {
    setIsSigningOut(true)
    setSignOutError(null)

    try {
      await signOutUser()
      router.push("/sign-in")
      router.refresh()
    } catch (error) {
      console.error("Sign-out failed", error)
      setSignOutError(error instanceof Error ? error.message : t.failed)
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right sm:block">
        <p className="text-sm font-medium leading-tight">{name ?? email}</p>
        {signOutError ? <p className="text-destructive text-xs">{signOutError}</p> : null}
        <Badge variant={role === "organizer" ? "default" : "secondary"} className="mt-0.5">
          {role === "organizer" ? t.organizer : t.player}
        </Badge>
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={handleSignOut}
        aria-label={t.signOut}
        disabled={isSigningOut}
      >
        <LogOut className="size-4" aria-hidden />
      </Button>
    </div>
  )
}
