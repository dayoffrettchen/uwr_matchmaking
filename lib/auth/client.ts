"use client"

import { createAuthClient } from "@neondatabase/auth"
import { BetterAuthReactAdapter } from "@neondatabase/auth/react"

/**
 * Client auth instance. Talks to the local proxy route at /api/auth,
 * which forwards to the managed Neon Auth server. Better Auth requires an
 * absolute base URL, so we build it from the current origin in the browser.
 */
const baseUrl =
  typeof window !== "undefined" ? `${window.location.origin}/api/auth` : "http://localhost:3000/api/auth"

export const authClient = createAuthClient(baseUrl, {
  adapter: BetterAuthReactAdapter(),
})

export const { signIn, signOut, useSession } = authClient
