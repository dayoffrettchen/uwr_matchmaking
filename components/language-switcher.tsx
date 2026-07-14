"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Languages } from "lucide-react"

import { setLocale } from "@/app/actions/locale"
import { Button } from "@/components/ui/button"
import { languageNames, locales, type Locale } from "@/lib/i18n"

export function LanguageSwitcher({ locale }: { locale: Locale }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function changeLocale(nextLocale: Locale) {
    if (nextLocale === locale) return

    startTransition(async () => {
      await setLocale(nextLocale)
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-1 rounded-xl border bg-card p-1" aria-label={locale === "de" ? "Sprache wählen" : "Choose language"}>
      <Languages className="ml-2 size-4 text-muted-foreground" aria-hidden />
      {locales.map((item) => (
        <Button
          key={item}
          type="button"
          variant={item === locale ? "secondary" : "ghost"}
          size="sm"
          className="h-8 px-2"
          disabled={isPending}
          aria-pressed={item === locale}
          onClick={() => changeLocale(item)}
        >
          {languageNames[item]}
        </Button>
      ))}
    </div>
  )
}
