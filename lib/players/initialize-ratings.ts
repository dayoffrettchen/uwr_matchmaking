import { db } from "@/lib/db"
import { ensureDatabaseSchema } from "@/lib/db/ensure-schema"
import { playerPositionRatings } from "@/lib/db/schema"
import { PLAYER_POSITIONS } from "@/lib/ratings/types"
import { DEFAULT_RATING } from "@/lib/ratings/constants"

export async function initializePlayerRatings(playerId: number, tx = db): Promise<void> {
  await ensureDatabaseSchema()
  await tx
    .insert(playerPositionRatings)
    .values(
      PLAYER_POSITIONS.map((position) => ({
        playerId,
        position,
        rating: DEFAULT_RATING,
        initialRating: DEFAULT_RATING,
      })),
    )
    .onConflictDoNothing()
}
