import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/auth/server"
import { SignInForm } from "@/components/sign-in-form"

export const dynamic = "force-dynamic"

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const user = await getSessionUser()
  if (user) redirect("/")

  const { error } = await searchParams

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <SignInForm hasError={error === "1"} />
    </main>
  )
}
