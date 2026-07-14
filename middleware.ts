import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth/server"

const authMiddleware = auth.middleware({ loginUrl: "/sign-in" })

export default function middleware(request: NextRequest) {
  // React server actions are POSTed back to the current route. Let the action
  // execute so its own server-side guard can read the session and return the
  // German form error instead of the middleware converting the POST to /sign-in.
  if (request.method === "POST" && request.headers.has("next-action")) {
    return NextResponse.next()
  }

  return authMiddleware(request)
}

export const config = {
  // Run on the Node.js runtime so the auth module can use Node built-ins (crypto).
  runtime: "nodejs",
  // Protect everything except: Next internals, the auth proxy, training JSON routes
  // with their own server-side guards, the public WhatsApp webhook, and
  // static assets. API routes that stay outside this matcher must still
  // perform their own authorization checks.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/auth|api/training|api/whatsapp|sign-in).*)",
  ],
}
