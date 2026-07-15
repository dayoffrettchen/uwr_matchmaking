import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { messages, playerPositionPreferences, playerPositionRatings, players, trainings } from "@/lib/db/schema"
import { ensureDatabaseSchema } from "@/lib/db/ensure-schema"
import { type PlayerPosition } from "@/lib/ratings/types"
import { initializePlayerRatings } from "@/lib/players/initialize-ratings"
import { signUpPlayer } from "@/lib/signup"
import { ensureNextRegularTraining } from "@/lib/training/schedule"

type SamplePlayer = {
  name: string
  phone: string
  skillRating: number
  notes: string
  positions: [PlayerPosition, PlayerPosition, PlayerPosition]
  ratings: Record<PlayerPosition, number>
  present: boolean
  message: string
}

const SAMPLE_PLAYERS: SamplePlayer[] = [
  { name: "Anna Krüger", phone: "+491510000001", skillRating: 8, notes: "Testdaten: starke Torwartin", positions: ["goalkeeper", "defender", "forward"], ratings: { goalkeeper: 1320, defender: 1180, forward: 1040 }, present: true, message: "Bin da" },
  { name: "Ben Hoffmann", phone: "+491510000002", skillRating: 7, notes: "Testdaten: flexibel in der Abwehr", positions: ["defender", "forward", "goalkeeper"], ratings: { goalkeeper: 980, defender: 1260, forward: 1120 }, present: true, message: "komme heute" },
  { name: "Clara Neumann", phone: "+491510000003", skillRating: 6, notes: "Testdaten: schnelle Stürmerin", positions: ["forward", "defender", "goalkeeper"], ratings: { goalkeeper: 940, defender: 1110, forward: 1240 }, present: true, message: "+1 bin dabei" },
  { name: "David Schulte", phone: "+491510000004", skillRating: 5, notes: "Testdaten: Allrounder", positions: ["defender", "goalkeeper", "forward"], ratings: { goalkeeper: 1090, defender: 1130, forward: 1080 }, present: true, message: "dabei" },
  { name: "Elif Yilmaz", phone: "+491510000005", skillRating: 9, notes: "Testdaten: sehr erfahren", positions: ["forward", "defender", "goalkeeper"], ratings: { goalkeeper: 1010, defender: 1280, forward: 1370 }, present: true, message: "bin da, bringe Flossen mit" },
  { name: "Felix Wagner", phone: "+491510000006", skillRating: 4, notes: "Testdaten: neuer Spieler", positions: ["forward", "defender", "goalkeeper"], ratings: { goalkeeper: 900, defender: 960, forward: 1010 }, present: true, message: "komme" },
  { name: "Greta Fischer", phone: "+491510000007", skillRating: 7, notes: "Testdaten: Tor/Abwehr", positions: ["goalkeeper", "defender", "forward"], ratings: { goalkeeper: 1250, defender: 1190, forward: 990 }, present: true, message: "bin dabei" },
  { name: "Hannes Becker", phone: "+491510000008", skillRating: 6, notes: "Testdaten: robuste Verteidigung", positions: ["defender", "forward", "goalkeeper"], ratings: { goalkeeper: 970, defender: 1210, forward: 1060 }, present: true, message: "Bin da!" },
  { name: "Ines Roth", phone: "+491510000009", skillRating: 5, notes: "Testdaten: Reserve für spätere Anmeldung", positions: ["forward", "goalkeeper", "defender"], ratings: { goalkeeper: 1030, defender: 980, forward: 1100 }, present: false, message: "schaffe es heute leider nicht" },
  { name: "Jonas Keller", phone: "+491510000010", skillRating: 8, notes: "Testdaten: Reserve, hoher Angriffswert", positions: ["forward", "defender", "goalkeeper"], ratings: { goalkeeper: 950, defender: 1160, forward: 1310 }, present: false, message: "nächstes Mal wieder" },
]

export async function importSampleTrainingData() {
  await ensureDatabaseSchema()
  const training = await ensureNextRegularTraining(new Date())
  if (!training) throw new Error("Kein offenes Training für den Testdaten-Import gefunden.")

  let createdPlayers = 0
  let createdSignups = 0

  for (const sample of SAMPLE_PLAYERS) {
    let [player] = await db.select().from(players).where(eq(players.phone, sample.phone)).limit(1)
    if (!player) {
      ;[player] = await db.insert(players).values({
        name: sample.name,
        phone: sample.phone,
        notes: sample.notes,
        skillRating: sample.skillRating,
        profileCompleted: true,
        initialRatingConfigured: true,
      }).returning()
      createdPlayers += 1
      await initializePlayerRatings(player.id)
    } else {
      await db.update(players).set({
        name: sample.name,
        notes: sample.notes,
        skillRating: sample.skillRating,
        profileCompleted: true,
        initialRatingConfigured: true,
        updatedAt: new Date(),
      }).where(eq(players.id, player.id))
    }

    await db.delete(playerPositionPreferences).where(eq(playerPositionPreferences.playerId, player.id))
    await db.insert(playerPositionPreferences).values(sample.positions.map((position, index) => ({
      playerId: player.id,
      position,
      preferenceOrder: index + 1,
    })))

    for (const position of sample.positions) {
      await db.update(playerPositionRatings).set({
        rating: sample.ratings[position],
        initialRating: sample.ratings[position],
        gamesPlayed: 8,
        wins: 4,
        draws: 1,
        losses: 3,
        isEligible: true,
        preferenceOrder: sample.positions.indexOf(position) + 1,
        updatedAt: new Date(),
      }).where(and(eq(playerPositionRatings.playerId, player.id), eq(playerPositionRatings.position, position)))
    }

    if (sample.present) {
      const result = await signUpPlayer({ playerId: player.id, name: sample.name, phone: sample.phone, source: "testdaten", trainingId: training.id })
      if (result.ok && !result.alreadySignedUp) createdSignups += 1
    }

    const [existingMessage] = await db.select().from(messages).where(and(eq(messages.trainingId, training.id), eq(messages.phone, sample.phone), eq(messages.body, sample.message))).limit(1)
    if (!existingMessage) {
      await db.insert(messages).values({ trainingId: training.id, playerName: sample.name, phone: sample.phone, body: sample.message, matched: sample.present })
    }
  }

  await db.update(trainings).set({ isOpen: true }).where(eq(trainings.id, training.id))

  return { trainingTitle: training.title, playerCount: SAMPLE_PLAYERS.length, signupCount: SAMPLE_PLAYERS.filter((player) => player.present).length, createdPlayers, createdSignups }
}
