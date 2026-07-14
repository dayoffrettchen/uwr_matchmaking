import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"

import { requireOrganizer } from "@/lib/auth/server"
import { db } from "@/lib/db"
import { signups } from "@/lib/db/schema"
import { signUpPlayer } from "@/lib/signup"

type AddSignupRequest = {
  name?: string
}

type RemoveSignupRequest = {
  signupId?: number
}

export async function POST(request: Request) {
  try {
    await requireOrganizer()

    const body = (await request.json().catch(() => null)) as AddSignupRequest | null
    const name = body?.name?.trim()

    if (!name) {
      return NextResponse.json({ error: "Bitte gib einen Namen ein." }, { status: 400 })
    }

    const result = await signUpPlayer({ name, source: "app" })

    if (!result.ok) {
      return NextResponse.json(
        { error: "Es gibt gerade kein offenes Training." },
        { status: 409 },
      )
    }

    revalidatePath("/")

    return NextResponse.json({ ok: true, alreadySignedUp: result.alreadySignedUp })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Spieler konnte nicht hinzugefügt werden."

    return NextResponse.json({ error: message }, { status: 403 })
  }
}

export async function DELETE(request: Request) {
  try {
    await requireOrganizer()

    const body = (await request.json().catch(() => null)) as RemoveSignupRequest | null
    const signupId = body?.signupId

    if (!Number.isInteger(signupId)) {
      return NextResponse.json({ error: "Ungültige Anmeldung." }, { status: 400 })
    }

    await db.delete(signups).where(eq(signups.id, signupId as number))
    revalidatePath("/")

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Anmeldung konnte nicht entfernt werden."

    return NextResponse.json({ error: message }, { status: 403 })
  }
}
