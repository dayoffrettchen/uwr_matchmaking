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
  // Build the origin from the proxy's forwarded headers. Inside the preview the
  // dev server only sees the internal http://localhost:3000 host on request.url,
  // so using that would make Google return the user to localhost after sign-in.
  const headers = request.headers
  const forwardedHost = headers.get("x-forwarded-host") ?? headers.get("host")
  const forwardedProto = headers.get("x-forwarded-proto") ?? "https"
  const origin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : new URL(request.url).origin

  try {
    const { data, error } = await auth.signIn.social({
      provider: "google",
      callbackURL: `${origin}/`,
      newUserCallbackURL: `${origin}/`,
      errorCallbackURL: `${origin}/sign-in?error=1`,
    })

    if (error || !data?.url) {
      console.log("[v0] google social error", { origin, error: JSON.stringify(error), data })
      return NextResponse.redirect(`${origin}/sign-in?error=1`)
    }

    return NextResponse.redirect(data.url)
  } catch (err) {
    console.log("[v0] google social threw", { origin, err: String(err) })
    return NextResponse.redirect(`${origin}/sign-in?error=1`)
  }
}
