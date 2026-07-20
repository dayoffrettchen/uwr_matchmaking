import "server-only"

import { createHash, createHmac, timingSafeEqual } from "crypto"
import { cookies } from "next/headers"
import { eq, or } from "drizzle-orm"
import { createNeonAuth } from "@neondatabase/auth/next/server"
import { db } from "@/lib/db"
import { players } from "@/lib/db/schema"

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
  return `${process.env.ORGANIZER_EMAILS ?? ""},dayoffrettchen@gmail.com`
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

export type AppRole = "organizer" | "player"

const NEON_AUTH_SESSION_DATA_COOKIE_NAME = "__Secure-neon-auth.local.session_data"

type NeonSessionCookiePayload = {
  exp?: number
  user?: {
    id?: unknown
    name?: unknown
    email?: unknown
    image?: unknown
  } | null
}

export type SessionUser = {
  id: string
  name: string | null
  email: string | null
  image: string | null
  role: AppRole
}

function base64UrlToBuffer(value: string): Buffer {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64")
}

function verifySessionDataCookie(value: string): NeonSessionCookiePayload | null {
  const [encodedHeader, encodedPayload, encodedSignature] = value.split(".")

  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    return null
  }

  const signedValue = `${encodedHeader}.${encodedPayload}`
  const expectedSignature = createHmac("sha256", cookieSecret()).update(signedValue).digest()
  const actualSignature = base64UrlToBuffer(encodedSignature)

  if (
    expectedSignature.length !== actualSignature.length ||
    !timingSafeEqual(expectedSignature, actualSignature)
  ) {
    return null
  }

  const payload = JSON.parse(base64UrlToBuffer(encodedPayload).toString("utf8")) as NeonSessionCookiePayload

  if (payload.exp && payload.exp * 1000 <= Date.now()) {
    return null
  }

  return payload
}

async function getSessionDataCookieUser(): Promise<NeonSessionCookiePayload["user"] | null> {
  const cookieStore = await cookies()
  const sessionDataCookie = cookieStore.get(NEON_AUTH_SESSION_DATA_COOKIE_NAME)?.value

  if (!sessionDataCookie) {
    return null
  }

  try {
    return verifySessionDataCookie(sessionDataCookie)?.user ?? null
  } catch {
    return null
  }
}

async function toSessionUser(sessionUser: NonNullable<NeonSessionCookiePayload["user"]>): Promise<SessionUser | null> {
  if (typeof sessionUser.id !== "string") {
    return null
  }

  const email = typeof sessionUser.email === "string" ? sessionUser.email : null
  const normalizedEmail = email?.toLowerCase() ?? null
  const [storedPlayer] = await db
    .select({ isOrganizer: players.isOrganizer })
    .from(players)
    .where(normalizedEmail ? or(eq(players.authUserId, sessionUser.id), eq(players.email, normalizedEmail)) : eq(players.authUserId, sessionUser.id))
    .limit(1)
  const role: AppRole =
    (normalizedEmail && organizerEmails().includes(normalizedEmail)) || storedPlayer?.isOrganizer
      ? "organizer"
      : "player"

  return {
    id: sessionUser.id,
    name: typeof sessionUser.name === "string" ? sessionUser.name : null,
    email,
    image: typeof sessionUser.image === "string" ? sessionUser.image : null,
    role,
  }
}

type GetSessionUserOptions = {
  /**
   * Neon Auth may refresh its local session-data cookie when `auth.getSession()`
   * misses the cache. Cookie writes are only allowed in Server Actions and Route
   * Handlers, so Server Components use the signed local cache only.
   */
  allowCookieMutation?: boolean
}

/**
 * Reads the current Neon Auth session and resolves the application role.
 */
export async function getSessionUser(options: GetSessionUserOptions = {}): Promise<SessionUser | null> {
  const cachedUser = await getSessionDataCookieUser()
  const resolvedCachedUser = cachedUser ? await toSessionUser(cachedUser) : null

  if (resolvedCachedUser || !options.allowCookieMutation) {
    return resolvedCachedUser
  }

  const { data: session } = await auth.getSession()

  if (!session?.user) {
    return null
  }

  return toSessionUser(session.user)
}

/**
 * Requires an authenticated organizer.
 */
export async function requireOrganizer(): Promise<SessionUser> {
  const user = await getSessionUser({ allowCookieMutation: true })

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
  const user = await getSessionUser({ allowCookieMutation: true })

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
