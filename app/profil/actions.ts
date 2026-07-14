"use server"

import { redirect } from "next/navigation"
import { updateOwnProfile } from "@/lib/players/update-own-profile"
import { PLAYER_POSITIONS, type PlayerPosition } from "@/lib/ratings/types"

export async function saveOwnProfile(formData: FormData) {
  const mainPositions = PLAYER_POSITIONS.filter((position) => formData.get(`${position}:positionRole`) === "main") as PlayerPosition[]
  if (mainPositions.length !== 1) throw new Error("Bitte wähle genau eine Hauptposition.")

  const secondaryPositions = PLAYER_POSITIONS.filter((position) => formData.get(`${position}:positionRole`) === "secondary") as PlayerPosition[]
  const preferredPositions = [mainPositions[0], ...secondaryPositions]

  await updateOwnProfile({
    name: String(formData.get("name") ?? ""),
    phone: String(formData.get("phone") ?? "") || null,
    notes: String(formData.get("notes") ?? "") || null,
    preferredPositions,
  })

  redirect("/")
}
