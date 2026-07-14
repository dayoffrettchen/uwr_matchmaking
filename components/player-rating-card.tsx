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
  lastMatchAt: Date | null
  ratings: Record<PlayerPosition, Rating>
}

const initialState: UpdatePlayerPositionRatingState = { ok: false }

const lastMatchFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" })

function getPositionReview(player: PlayerWithRatings) {
  const mainPosition = PLAYER_POSITIONS.find((position) => player.ratings[position].preferenceOrder === 1)
  if (!mainPosition) return null

  const mainRating = player.ratings[mainPosition]
  const betterPosition = PLAYER_POSITIONS
    .filter((position) => position !== mainPosition)
    .map((position) => ({ position, rating: player.ratings[position] }))
    .filter(({ rating }) => rating.isEligible && getRatingConfidence(rating.gamesPlayed) === 1 && rating.rating > mainRating.rating)
    .sort((a, b) => b.rating.rating - a.rating.rating)[0]

  if (!betterPosition) return null

  return { mainPosition, betterPosition: betterPosition.position, ratingDifference: betterPosition.rating.rating - mainRating.rating }
}

export function PlayerRatingCard({ player, canManage }: { player: PlayerWithRatings; canManage: boolean }) {
  const enabled = PLAYER_POSITIONS.filter((position) => player.ratings[position].isEligible)
  const main = PLAYER_POSITIONS.find((position) => player.ratings[position].preferenceOrder === 1)
  const positionReview = getPositionReview(player)
  const lastMatchLabel = player.lastMatchAt ? lastMatchFormatter.format(new Date(player.lastMatchAt)) : "Noch kein Match"

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg">
          <span>{player.name}</span>
          {enabled.length === 0 && <Badge variant="destructive">Keine Position</Badge>}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Hauptposition: {main ? POSITION_LABELS[main] : "Nicht gesetzt"} · Letztes Match: {lastMatchLabel}
        </p>
        {positionReview && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Spielerposition überdenken: {POSITION_LABELS[positionReview.betterPosition]} ist bei 100 % Konfidenz um {positionReview.ratingDifference} Ratingpunkte stärker als {POSITION_LABELS[positionReview.mainPosition]}.
          </p>
        )}
      </CardHeader>
      {canManage ? (
        <PlayerRatingForm player={player} />
      ) : (
        <CardContent className="grid gap-3 md:grid-cols-3">
          {PLAYER_POSITIONS.map((position) => (
            <PositionRatingSummary key={position} rating={player.ratings[position]} position={position} />
          ))}
        </CardContent>
      )}
    </Card>
  )
}

function PositionRatingSummary({ position, rating }: { position: PlayerPosition; rating: Rating }) {
  return (
    <div className="rounded-lg border p-3">
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
    </div>
  )
}

function PlayerRatingForm({ player }: { player: PlayerWithRatings }) {
  const [state, formAction, isPending] = useActionState(updatePlayerPositionRating, initialState)

  return (
    <form action={formAction}>
      <CardContent className="grid gap-3 md:grid-cols-3">
        <input type="hidden" name="playerId" value={player.id} />
        {PLAYER_POSITIONS.map((position) => {
          const rating = player.ratings[position]
          const hasPlayed = rating.gamesPlayed > 0

          return (
            <div key={position} className="rounded-lg border p-3">
              <input type="hidden" name="positions" value={position} />
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
              <div className="mt-3 grid gap-2 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" name={`${position}:isEligible`} defaultChecked={rating.isEligible} />
                  spielbar
                </label>
                <label>
                  Präferenz
                  <select
                    name={`${position}:preferenceOrder`}
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
                    name={`${position}:initialRating`}
                    type="number"
                    min="100"
                    defaultValue={rating.initialRating}
                    disabled={hasPlayed}
                    title={hasPlayed ? "Start-Rating kann nur vor dem ersten Spiel geändert werden" : undefined}
                    className="mt-1 w-full rounded-md border bg-background px-2 py-1 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                  {hasPlayed && (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Nur vor dem ersten Spiel änderbar.
                    </span>
                  )}
                </label>
                <label>
                  Aktuelles Rating
                  <input
                    name={`${position}:rating`}
                    type="number"
                    min="100"
                    defaultValue={rating.rating}
                    className="mt-1 w-full rounded-md border bg-background px-2 py-1"
                  />
                </label>
              </div>
            </div>
          )
        })}
        <div className="md:col-span-3">
          {state.message && (
            <p className={state.ok ? "mb-2 text-xs text-muted-foreground" : "mb-2 text-xs text-destructive"}>{state.message}</p>
          )}
          <button disabled={isPending} className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-60">
            {isPending ? "Speichere …" : "Speichern"}
          </button>
        </div>
      </CardContent>
    </form>
  )
}
