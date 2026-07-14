import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { requireOrganizer } from "@/lib/auth/server"
import { moveSignupToTeam, resetTeams } from "@/lib/teams"
import { assignBalancedTeams } from "@/lib/matchmaking/balance-teams"
import { PLAYER_POSITIONS, type PlayerPosition } from "@/lib/ratings/types"

type TeamActionRequest = {
  action?: "generate" | "clear" | "move"
  signupId?: number
  team?: number
  position?: string
  trainingId?: number
}

export async function POST(request: Request) {
  try {
    await requireOrganizer()

    const body = (await request.json().catch(() => null)) as TeamActionRequest | null

    const trainingId = Number.isInteger(body?.trainingId) ? body?.trainingId : undefined

    if (body?.action === "generate") {
      await assignBalancedTeams(trainingId)
    } else if (body?.action === "clear") {
      await resetTeams(trainingId)
    } else if (body?.action === "move") {
      const signupId = body.signupId
      const team = body.team
      const position = typeof body.position === "string" && PLAYER_POSITIONS.includes(body.position as PlayerPosition) ? body.position as PlayerPosition : undefined

      if (typeof signupId !== "number" || !Number.isInteger(signupId) || (team !== 1 && team !== 2)) {
        return NextResponse.json({ error: "Ungültige Team-Zuordnung" }, { status: 400 })
      }

      await moveSignupToTeam({ signupId, team, position, trainingId })
    } else {
      return NextResponse.json({ error: "Unbekannte Team-Aktion" }, { status: 400 })
    }

    revalidatePath("/")

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Die Team-Aktion ist fehlgeschlagen"

    return NextResponse.json({ error: message }, { status: 403 })
  }
}
