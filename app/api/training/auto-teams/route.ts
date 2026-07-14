import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"

import { processDueAutomaticTeamAssignments } from "@/lib/training/auto-teams"

export const runtime = "nodejs"

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true

  return request.headers.get("authorization") === `Bearer ${secret}`
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 })
  }

  const result = await processDueAutomaticTeamAssignments()
  if (result.assignedTrainingIds.length > 0) revalidatePath("/")

  return NextResponse.json({ ok: true, ...result })
}
