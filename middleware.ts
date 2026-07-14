import { auth } from "@/lib/auth/server"

export default auth.middleware({ loginUrl: "/sign-in" })

export const config = {
  // Run on the Node.js runtime so the auth module can use Node built-ins (crypto).
  runtime: "nodejs",
  // Protect everything except: Next internals, the auth proxy, JSON routes
  // with their own server-side guards, the public WhatsApp webhook, and
  // static assets. API routes that stay outside this matcher must still
  // perform their own authorization checks.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/auth|api/training/teams|api/whatsapp|sign-in).*)",
  ],
}
