// lib/auth/client.ts
"use client"

import { createAuthClient } from "@neondatabase/auth/next"

export const authClient = createAuthClient({
  baseUrl: typeof window === "undefined" ? undefined : window.location.origin,
})

export const { signIn, signOut, useSession } = authClient
