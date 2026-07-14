import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { requireOrganizer } from "@/lib/auth/server"
import { resetTeams } from "@/lib/teams"
import { assignBalancedTeams } from "@/lib/matchmaking/balance-teams"

type TeamActionRequest = {
  action?: "generate" | "clear"
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
