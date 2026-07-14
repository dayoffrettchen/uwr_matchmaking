"use server"

import { cookies } from "next/headers"
import { auth } from "@/lib/auth/server"

const NEON_AUTH_COOKIE_PREFIX = "__Secure-neon-auth"

/**
 * Signs the current user out of Neon Auth and removes local auth cookies.
 *
 * Local cookie cleanup is kept as a fallback because managed Neon Auth rejects
 * requests from domains that are not allowlisted; in that case the app should
 * still be able to clear its own session and return the user to the sign-in
 * page.
 */
export async function signOutUser() {
  let signOutError: unknown = null

  try {
    await auth.signOut()
  } catch (error) {
    signOutError = error
  }

  const cookieStore = await cookies()

  for (const cookie of cookieStore.getAll()) {
    if (cookie.name.startsWith(NEON_AUTH_COOKIE_PREFIX)) {
      cookieStore.delete(cookie.name)
    }
  }

  if (signOutError) {
    console.warn("Neon Auth sign-out failed; cleared local auth cookies instead", signOutError)
  }
}
