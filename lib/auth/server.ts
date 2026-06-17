import "server-only"
import { createHash } from "crypto"
import { createNeonAuth } from "@neondatabase/auth/next/server"

/**
 * Neon Auth requires the cookie secret to be at least 32 characters.
 * To tolerate short user-provided values, we deterministically derive a
 * 64-char hex secret by hashing the input. The same input always yields
 * the same secret, so existing sessions stay valid across restarts.
 */
function cookieSecret(): string {
  const raw = process.env.NEON_AUTH_COOKIE_SECRET ?? ""
  if (raw.length >= 32) return raw
  return createHash("sha256").update(raw).digest("hex")
}

/**
 * Managed Neon Auth server instance.
 * Google OAuth is enabled in the Neon Auth dashboard (shared mode),
 * so no Google client credentials are needed here.
 */
export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: {
    secret: cookieSecret(),
    // Neon Auth cookies default to SameSite=Strict. The Google OAuth callback
    // is a cross-site, top-level navigation, and the app also renders inside a
    // cross-site preview iframe — in both cases the browser drops Strict cookies,
    // so the short-lived OAuth challenge cookie never comes back and sign-in
    // fails. "none" (always Secure) lets the challenge + session cookies survive
    // the cross-site round-trip.
    sameSite: "none",
  },
})

/** Email addresses (comma-separated env var) that are granted organizer access. */
function organizerEmails(): string[] {
  return (process.env.ORGANIZER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

export type AppRole = "organizer" | "viewer"

export type SessionUser = {
  id: string
  name: string | null
  email: string | null
  image: string | null
  role: AppRole
}

/** Reads the current session and resolves the app role from the organizer allowlist. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const { data: session } = await auth.getSession()
  if (!session?.user) return null

  const email = (session.user.email ?? "").toLowerCase()
  const role: AppRole = email && organizerEmails().includes(email) ? "organizer" : "viewer"

  return {
    id: session.user.id,
    name: session.user.name ?? null,
    email: session.user.email ?? null,
    image: session.user.image ?? null,
    role,
  }
}

/** Throws unless the current user is an organizer. Use to guard mutating server actions. */
export async function requireOrganizer(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) throw new Error("Nicht angemeldet")
  if (user.role !== "organizer") throw new Error("Nur Organisatoren dürfen das")
  return user
}
