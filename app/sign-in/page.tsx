import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/auth/server"
import { SignInForm } from "@/components/sign-in-form"

export const dynamic = "force-dynamic"

export default async function SignInPage() {
  const user = await getSessionUser()
  if (user) redirect("/")

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <SignInForm />
    </main>
  )
}
