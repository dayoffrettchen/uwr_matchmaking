import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/auth/server"
import { SignInForm } from "@/components/sign-in-form"
import { getLocale } from "@/lib/i18n-server"
import { LanguageSwitcher } from "@/components/language-switcher"

export const dynamic = "force-dynamic"

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const locale = await getLocale()
  const user = await getSessionUser()
  if (user) redirect("/")

  const { error } = await searchParams

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 py-12">
      <LanguageSwitcher locale={locale} />
      <SignInForm hasError={error === "1"} locale={locale} />
    </main>
  )
}
