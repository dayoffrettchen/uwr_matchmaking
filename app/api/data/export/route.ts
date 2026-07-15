import { requireOrganizer } from "@/lib/auth/server"
import { exportAppData } from "@/lib/data-transfer"

export const dynamic = "force-dynamic"

export async function GET() {
  await requireOrganizer()
  const data = await exportAppData()
  const fileDate = new Date().toISOString().slice(0, 10)

  return Response.json(data, {
    headers: {
      "Content-Disposition": `attachment; filename="uwr-matchmaking-export-${fileDate}.json"`,
    },
  })
}
