"use client"

import { useActionState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { updatePlayerPositionRating, type UpdatePlayerPositionRatingState } from "@/lib/players/mutations"
import { getRatingConfidence, getRatingStatusLabel } from "@/lib/ratings/confidence"
import { POSITION_LABELS, PLAYER_POSITIONS, type PlayerPosition } from "@/lib/ratings/types"

type Rating = {
  position: PlayerPosition
  rating: number
  initialRating: number
  gamesPlayed: number
  wins: number
  draws: number
  losses: number
  isEligible: boolean
  preferenceOrder: number | null
}

type PlayerWithRatings = {
  id: number
  name: string
  ratings: Record<PlayerPosition, Rating>
}

const initialState: UpdatePlayerPositionRatingState = { ok: false }

export function PlayerRatingCard({ player, canManage }: { player: PlayerWithRatings; canManage: boolean }) {
  const enabled = PLAYER_POSITIONS.filter((position) => player.ratings[position].isEligible)
  const main = PLAYER_POSITIONS.find((position) => player.ratings[position].preferenceOrder === 1)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg">
          <span>{player.name}</span>
          {enabled.length === 0 && <Badge variant="destructive">Keine Position</Badge>}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Hauptposition: {main ? POSITION_LABELS[main] : "Nicht gesetzt"}
        </p>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3">
        {PLAYER_POSITIONS.map((position) => {
          const rating = player.ratings[position]

          return (
            <div key={position} className="rounded-lg border p-3">
              <div className="mb-2 flex items-center justify-between">
                <strong>{POSITION_LABELS[position]}</strong>
                <Badge variant={rating.isEligible ? "default" : "secondary"}>
                  {rating.isEligible ? "Freigeschaltet" : "Gesperrt"}
                </Badge>
              </div>
              <p className="text-sm">Rating {rating.rating}</p>
              <p className="text-sm text-muted-foreground">
                {rating.gamesPlayed} Spiele · {getRatingStatusLabel(rating.gamesPlayed)}
              </p>
              <p className="text-sm text-muted-foreground">
                Konfidenz {Math.round(getRatingConfidence(rating.gamesPlayed) * 100)} %
              </p>
              {canManage && <PositionRatingForm playerId={player.id} position={position} rating={rating} />}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function PositionRatingForm({ playerId, position, rating }: { playerId: number; position: PlayerPosition; rating: Rating }) {
  const [state, formAction, isPending] = useActionState(updatePlayerPositionRating, initialState)

  return (
    <form action={formAction} className="mt-3 grid gap-2 text-sm">
      <input type="hidden" name="playerId" value={playerId} />
      <input type="hidden" name="position" value={position} />
      <label className="flex items-center gap-2">
        <input type="checkbox" name="isEligible" defaultChecked={rating.isEligible} />
        spielbar
      </label>
      <label>
        Präferenz
        <select
          name="preferenceOrder"
          defaultValue={rating.preferenceOrder ?? ""}
          className="mt-1 w-full rounded-md border bg-background px-2 py-1"
        >
          <option value="">Keine</option>
          <option value="1">Hauptposition</option>
          <option value="2">Nebenposition 1</option>
          <option value="3">Nebenposition 2</option>
        </select>
      </label>
      <label>
        Start-Rating
        <input
          name="initialRating"
          type="number"
          min="100"
          defaultValue={rating.initialRating}
          className="mt-1 w-full rounded-md border bg-background px-2 py-1"
        />
      </label>
      <label>
        Aktuelles Rating
        <input
          name="rating"
          type="number"
          min="100"
          defaultValue={rating.rating}
          className="mt-1 w-full rounded-md border bg-background px-2 py-1"
        />
      </label>
      {state.message && (
        <p className={state.ok ? "text-xs text-muted-foreground" : "text-xs text-destructive"}>{state.message}</p>
      )}
      <button disabled={isPending} className="rounded-md bg-primary px-2 py-1 text-primary-foreground disabled:opacity-60">
        {isPending ? "Speichere …" : "Speichern"}
      </button>
    </form>
  )
}
