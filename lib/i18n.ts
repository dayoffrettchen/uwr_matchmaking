export const locales = ["de", "en"] as const
export type Locale = (typeof locales)[number]

export const localeCookieName = "uwr-locale"

export function isLocale(value: string | undefined): value is Locale {
  return value === "de" || value === "en"
}

export const languageNames: Record<Locale, string> = {
  de: "Deutsch",
  en: "English",
}
