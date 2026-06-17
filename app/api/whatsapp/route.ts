import { type NextRequest, NextResponse } from "next/server"
import { isPresentMessage, logMessage, signUpPlayer } from "@/lib/signup"

// WhatsApp Cloud API webhook.
// Set these env vars in your project:
//   WHATSAPP_VERIFY_TOKEN     – any string you also enter in the Meta webhook config
//   WHATSAPP_ACCESS_TOKEN     – permanent token for sending replies (optional)
//   WHATSAPP_PHONE_NUMBER_ID  – your WhatsApp Business phone number id (optional, for replies)

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const mode = params.get("hub.mode")
  const token = params.get("hub.verify_token")
  const challenge = params.get("hub.challenge")

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 })
  }
  return new NextResponse("Forbidden", { status: 403 })
}

async function sendReply(to: string, text: string) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID
  if (!token || !phoneId) return // replies are optional

  try {
    await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      }),
    })
  } catch (err) {
    console.log("[v0] WhatsApp reply failed:", (err as Error).message)
  }
}

export async function POST(req: NextRequest) {
  let payload: any
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ ok: true })
  }

  try {
    const entries = payload?.entry ?? []
    for (const entry of entries) {
      for (const change of entry?.changes ?? []) {
        const value = change?.value ?? {}
        const contacts = value?.contacts ?? []
        for (const message of value?.messages ?? []) {
          if (message.type !== "text") continue

          const body: string = message.text?.body ?? ""
          const phone: string = message.from ?? ""
          const contact = contacts.find((c: any) => c.wa_id === phone)
          const name: string = contact?.profile?.name?.trim() || `+${phone}`

          const matched = isPresentMessage(body)

          if (matched) {
            const result = await signUpPlayer({ name, phone, source: "whatsapp" })
            await logMessage({
              trainingId: result.ok ? result.training.id : null,
              playerName: name,
              phone,
              body,
              matched: true,
            })

            if (result.ok && !result.alreadySignedUp) {
              await sendReply(phone, `Eingetragen für ${result.training.title}. Bis dann!`)
            } else if (result.ok && result.alreadySignedUp) {
              await sendReply(phone, "Du stehst schon auf der Liste.")
            }
          } else {
            await logMessage({ playerName: name, phone, body, matched: false })
          }
        }
      }
    }
  } catch (err) {
    console.log("[v0] WhatsApp webhook error:", (err as Error).message)
  }

  // Always 200 so Meta does not retry.
  return NextResponse.json({ ok: true })
}
