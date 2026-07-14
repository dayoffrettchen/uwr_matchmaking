"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { localeCookieName, type Locale } from "@/lib/i18n"

export async function setLocale(locale: Locale) {
  const cookieStore = await cookies()
  cookieStore.set(localeCookieName, locale, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  })

  revalidatePath("/", "layout")
}
