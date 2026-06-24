import { NextResponse } from "next/server"
import { auth } from "@/lib/auth/server"

export const dynamic = "force-dynamic"

/**
 * Server-side Google sign-in kickoff.
 *
 * Calls the Neon Auth SDK directly (no HTTP self-fetch) to get the Google
 * provider URL, then 302-redirects the browser to it. Self-fetching the app's
 * own origin fails inside the preview because the external HTTPS host loops
 * back to the plain-HTTP dev server (ERR_SSL_PACKET_LENGTH_TOO_LONG).
 */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin

  try {
    const { data, error } = await auth.signIn.social({
      provider: "google",
      callbackURL: `${origin}/`,
      newUserCallbackURL: `${origin}/`,
      errorCallbackURL: `${origin}/sign-in?error=1`,
    })

    if (error || !data?.url) {
      return NextResponse.redirect(`${origin}/sign-in?error=1`)
    }

    return NextResponse.redirect(data.url)
  } catch {
    return NextResponse.redirect(`${origin}/sign-in?error=1`)
  }
}
