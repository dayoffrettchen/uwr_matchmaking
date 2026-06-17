"use client"

import { useRouter } from "next/navigation"
import { signOut } from "@/lib/auth/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { LogOut } from "lucide-react"

export function UserMenu({
  name,
  email,
  role,
}: {
  name: string | null
  email: string | null
  role: "organizer" | "viewer"
}) {
  const router = useRouter()

  async function handleSignOut() {
    await signOut()
    router.push("/sign-in")
    router.refresh()
  }

  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right sm:block">
        <p className="text-sm font-medium leading-tight">{name ?? email}</p>
        <Badge variant={role === "organizer" ? "default" : "secondary"} className="mt-0.5">
          {role === "organizer" ? "Organisator" : "Zuschauer"}
        </Badge>
      </div>
      <Button variant="outline" size="icon" onClick={handleSignOut} aria-label="Abmelden">
        <LogOut className="size-4" aria-hidden />
      </Button>
    </div>
  )
}
