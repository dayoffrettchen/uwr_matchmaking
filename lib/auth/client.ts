// lib/auth/client.ts
"use client"

import { createAuthClient } from "@neondatabase/auth"
import { BetterAuthReactAdapter } from "@neondatabase/auth/react"

function getAuthBaseUrl() {
  if (typeof window !== "undefined") {
    return new URL("/api/auth", window.location.origin).toString()
  }

  return "http://localhost/api/auth"
}

export const authClient = createAuthClient(getAuthBaseUrl(), {
  adapter: BetterAuthReactAdapter(),
})

export const { signIn, signOut, useSession } = authClient
