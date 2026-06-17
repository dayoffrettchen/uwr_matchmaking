import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/**
 * Server-side Google sign-in kickoff.
 *
 * A plain <a href> to this route is a real user gesture and, with target="_top",
 * breaks out of the v0 preview iframe natively. This route asks Neon Auth for the
 * provider URL and issues a 302 redirect to it, avoiding client-side popup/redirect
 * logic that the browser blocks inside cross-origin iframes.
 */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin

  const res = await fetch(`${origin}/api/auth/sign-in/social`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider: "google", callbackURL: `${origin}/` }),
  })

  if (!res.ok) {
    return NextResponse.redirect(`${origin}/sign-in?error=1`)
  }

  const data = (await res.json()) as { url?: string }
  if (!data?.url) {
    return NextResponse.redirect(`${origin}/sign-in?error=1`)
  }

  // The internal sign-in/social call sets the OAuth challenge cookie
  // (e.g. __Secure-neon-auth.session_challange) needed to validate the
  // callback. We must forward those Set-Cookie headers onto the redirect,
  // otherwise the browser never stores them and the Google callback fails.
  const response = NextResponse.redirect(data.url)
  const setCookie = res.headers.getSetCookie?.() ?? []
  for (const cookie of setCookie) {
    response.headers.append("set-cookie", cookie)
  }
  // Fallback for runtimes without getSetCookie()
  if (setCookie.length === 0) {
    const single = res.headers.get("set-cookie")
    if (single) response.headers.append("set-cookie", single)
  }

  return response
}
