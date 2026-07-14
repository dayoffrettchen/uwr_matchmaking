import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"

import { requireOrganizer } from "@/lib/auth/server"
import { isPresentMessage, logMessage, signUpPlayer } from "@/lib/signup"

type SimulateMessageRequest = {
  name?: string
  body?: string
}

export async function POST(request: Request) {
  try {
    await requireOrganizer()

    const data = (await request.json().catch(() => null)) as SimulateMessageRequest | null
    const name = data?.name?.trim()
    const body = data?.body?.trim()

    if (!name || !body) {
      return NextResponse.json({ error: "Bitte gib Name und Nachricht ein." }, { status: 400 })
    }

    const matched = isPresentMessage(body)

    if (matched) {
      const result = await signUpPlayer({ name, source: "whatsapp" })
      await logMessage({
        trainingId: result.ok ? result.training.id : null,
        playerName: name,
        body,
        matched: true,
      })
    } else {
      await logMessage({ playerName: name, body, matched: false })
    }

    revalidatePath("/")

    return NextResponse.json({ ok: true, matched })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nachricht konnte nicht gesendet werden."

    return NextResponse.json({ error: message }, { status: 403 })
  }
}
