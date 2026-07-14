// lib/auth/client.ts
"use client"

import { createAuthClient } from "@neondatabase/auth/next"

export const authClient = createAuthClient()

export const { signIn, signOut, useSession } = authClient
