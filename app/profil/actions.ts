"use server"

import { redirect } from "next/navigation"
import { updateOwnProfile } from "@/lib/players/update-own-profile"
import { PLAYER_POSITIONS, type PlayerPosition } from "@/lib/ratings/types"

export async function saveOwnProfile(formData: FormData) {
  const preferredPositions = PLAYER_POSITIONS.filter((position) => formData.getAll("preferredPositions").includes(position)) as PlayerPosition[]

  await updateOwnProfile({
    name: String(formData.get("name") ?? ""),
    phone: String(formData.get("phone") ?? "") || null,
    notes: String(formData.get("notes") ?? "") || null,
    preferredPositions,
  })

  redirect("/")
}
