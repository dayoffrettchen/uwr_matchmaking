"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { signOut } from "@/lib/auth/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { LogOut } from "lucide-react"

type SignOutResult = Awaited<ReturnType<typeof signOut>>

function getSignOutError(result: SignOutResult) {
  if (!result) {
    return null
  }

  const response = result as {
    data?: { success?: boolean }
    error?: { message?: string } | null
  }

  if (response.error) {
    return response.error.message ?? "Abmeldung fehlgeschlagen."
  }

  if (response.data && response.data.success === false) {
    return "Abmeldung fehlgeschlagen."
  }

  return null
}

export function UserMenu({
  name,
  email,
  role,
}: {
  name: string | null
  email: string | null
  role: "organizer" | "player"
}) {
  const router = useRouter()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)

  async function handleSignOut() {
    setIsSigningOut(true)
    setSignOutError(null)

    try {
      const callbackURL = new URL("/sign-in", window.location.origin).toString()
      const result = await signOut({
        callbackURL,
      } as Parameters<typeof signOut>[0] & { callbackURL: string })
      const error = getSignOutError(result)

      if (error) {
        console.error("Sign-out failed", error)
        setSignOutError(error)
        return
      }

      router.push("/sign-in")
      router.refresh()
    } catch (error) {
      console.error("Sign-out failed", error)
      setSignOutError(error instanceof Error ? error.message : "Abmeldung fehlgeschlagen.")
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
          {role === "organizer" ? "Organisator" : "Spieler"}
        </Badge>
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={handleSignOut}
        aria-label="Abmelden"
        disabled={isSigningOut}
      >
        <LogOut className="size-4" aria-hidden />
      </Button>
    </div>
  )
}
