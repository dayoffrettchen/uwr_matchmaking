import "server-only"

import { createHash } from "crypto"
import { createNeonAuth } from "@neondatabase/auth/next/server"

/**
 * Neon Auth requires the cookie secret to be at least 32 characters.
 *
 * For shorter configured values, derive a deterministic 64-character
 * SHA-256 value. The same configured value therefore always produces
 * the same cookie secret.
 */
function cookieSecret(): string {
  const raw = process.env.NEON_AUTH_COOKIE_SECRET ?? ""

  if (raw.length >= 32) {
    return raw
  }

  return createHash("sha256").update(raw).digest("hex")
}

/**
 * Managed Neon Auth server instance.
 */
export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: {
    secret: cookieSecret(),

    /**
     * Required for OAuth:
     *
     * The OAuth callback navigates from the Neon Auth domain back to
     * this application. SameSite "lax" allows the challenge cookie to
     * be sent on this top-level cross-site navigation.
     */
    sameSite: "lax",
  },
})

/**
 * Email addresses from ORGANIZER_EMAILS that receive organizer access.
 */
function organizerEmails(): string[] {
  return (process.env.ORGANIZER_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

export type AppRole = "organizer" | "player"

export type SessionUser = {
  id: string
  name: string | null
  email: string | null
  image: string | null
  role: AppRole
}

/**
 * Reads the current Neon Auth session and resolves the application role.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const { data: session } = await auth.getSession()

  if (!session?.user) {
    return null
  }

  const email = (session.user.email ?? "").toLowerCase()

  const role: AppRole =
    email && organizerEmails().includes(email)
      ? "organizer"
      : "player"

  return {
    id: session.user.id,
    name: session.user.name ?? null,
    email: session.user.email ?? null,
    image: session.user.image ?? null,
    role,
  }
}

/**
 * Requires an authenticated organizer.
 */
export async function requireOrganizer(): Promise<SessionUser> {
  const user = await getSessionUser()

  if (!user) {
    throw new Error("Nicht angemeldet")
  }

  if (user.role !== "organizer") {
    throw new Error("Nur Organisatoren dürfen das")
  }

  return user
}


/**
 * Requires any authenticated Google user.
 */
export async function requireAuthenticatedUser(): Promise<SessionUser> {
  const user = await getSessionUser()

  if (!user) {
    throw new Error("Nicht angemeldet")
  }

  return user
}

/**
 * Requires an authenticated user with the player role.
 */
export async function requirePlayer(): Promise<SessionUser> {
  const user = await requireAuthenticatedUser()

  if (user.role !== "player") {
    throw new Error("Nur Spieler dürfen das")
  }

  return user
}
