import { auth } from "@/lib/auth/server"

export default auth.middleware({ loginUrl: "/sign-in" })

export const config = {
  // Run on the Node.js runtime so the auth module can use Node built-ins (crypto).
  runtime: "nodejs",
  // Protect everything except: Next internals, the auth proxy, the public
  // WhatsApp webhook, and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth|api/whatsapp|sign-in).*)"],
}
