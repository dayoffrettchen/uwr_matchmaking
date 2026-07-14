import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { requireOrganizer } from "@/lib/auth/server"
import { moveSignupToTeam, resetTeams } from "@/lib/teams"
import { assignBalancedTeams } from "@/lib/matchmaking/balance-teams"

type TeamActionRequest = {
  action?: "generate" | "clear" | "move"
  signupId?: number
  team?: number
  trainingId?: number
  signupId?: number
  team?: 1 | 2
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
    } else if (body?.action === "move" && Number.isInteger(body.signupId) && (body.team === 1 || body.team === 2)) {
      await moveSignupToTeam({ signupId: Number(body.signupId), team: body.team, trainingId })
    } else if (body?.action === "move") {
      if (!Number.isInteger(body.signupId) || (body.team !== 1 && body.team !== 2)) {
        return NextResponse.json({ error: "Ungültige Team-Zuordnung" }, { status: 400 })
      }

      await moveSignupToTeam({ signupId: body.signupId, team: body.team, trainingId })
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
