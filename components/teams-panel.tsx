"use client"

import type { DragEvent } from "react"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { POSITION_LABELS, PLAYER_POSITIONS, type PlayerPosition } from "@/lib/ratings/types"
import { GripVertical, Shuffle, Users, X } from "lucide-react"
import type { Locale } from "@/lib/i18n"

type RosterPlayer = {
  signupId: number
  name: string
  team: number | null
  source: string
  assignedPosition?: string | null
  lineupType?: string | null
  assignedRating?: number | null
  rotationGroupId?: number | null
  rotationGroupType?: string | null
  rotationOrder?: number | null
  startsInWater?: boolean | null
}

type TeamAction = "generate" | "clear"
type TeamNumber = 1 | 2

export function TeamsPanel({ roster, canManage, trainingId, locale = "de" }: { roster: RosterPlayer[]; canManage: boolean; trainingId?: number; locale?: Locale }) {
  const router = useRouter()
  const t = locale === "de" ? { reset: "Zurücksetzen", resetting: "Setze zurück …", generate: "Teams fair einteilen", generating: "Teile ein …", min: "Mindestens 2 Anmeldungen nötig, um Teams einzuteilen.", none: "Noch keine Teams eingeteilt. Tippe auf „Teams fair einteilen“, um positionsbasiert faire Teams zu bilden.", hint: "Ziehe Spieler per Drag-and-drop auf eine Position, um Team und Position manuell anzupassen. Die Wechselgruppen werden danach automatisch neu berechnet.", actionFailed: "Die Team-Aktion ist fehlgeschlagen. Bitte versuche es erneut.", moveFailed: "Der Spieler konnte nicht verschoben werden. Bitte versuche es erneut." } : { reset: "Reset", resetting: "Resetting …", generate: "Assign fair teams", generating: "Assigning …", min: "At least 2 signups are needed to assign teams.", none: "No teams assigned yet. Tap “Assign fair teams” to create position-based fair teams.", hint: "Drag players onto a position to adjust team and position manually. Rotation groups are recalculated afterwards.", actionFailed: "The team action failed. Please try again.", moveFailed: "The player could not be moved. Please try again." }
  const [isPending, startTransition] = useTransition()
  const [pendingAction, setPendingAction] = useState<TeamAction | null>(null)
  const [movingSignupId, setMovingSignupId] = useState<number | null>(null)
  const [draggedSignupId, setDraggedSignupId] = useState<number | null>(null)
  const [dragTarget, setDragTarget] = useState<{ team: TeamNumber; position: PlayerPosition } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const teamsAssigned = roster.some((p) => p.team !== null)
  const team1 = roster.filter((p) => p.team === 1)
  const team2 = roster.filter((p) => p.team === 2)
  const isMutating = isPending || pendingAction !== null || movingSignupId !== null

  async function runTeamAction(action: TeamAction) {
    setPendingAction(action)
    setError(null)

    try {
      await postTeamAction({ action, trainingId }, t.actionFailed)
      startTransition(() => router.refresh())
    } catch (err) {
      setError(err instanceof Error ? err.message : t.actionFailed)
    } finally {
      setPendingAction(null)
    }
  }

  async function movePlayer(signupId: number, team: TeamNumber, position: PlayerPosition) {
    const player = roster.find((item) => item.signupId === signupId)
    if (!player || (player.team === team && player.assignedPosition === position) || !canManage || isMutating) return

    setMovingSignupId(signupId)
    setError(null)

    try {
      await postTeamAction({ action: "move", trainingId, signupId, team, position }, t.moveFailed)
      startTransition(() => router.refresh())
    } catch (err) {
      setError(err instanceof Error ? err.message : t.moveFailed)
    } finally {
      setMovingSignupId(null)
      setDraggedSignupId(null)
      setDragTarget(null)
    }
  }

  function handleDragOver(event: DragEvent, team: TeamNumber, position: PlayerPosition) {
    if (!canManage || !draggedSignupId || isMutating) return
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
    setDragTarget({ team, position })
  }

  function handleDrop(event: DragEvent, team: TeamNumber, position: PlayerPosition) {
    event.preventDefault()
    const signupId = Number(event.dataTransfer.getData("text/plain") || draggedSignupId)
    if (Number.isInteger(signupId)) void movePlayer(signupId, team, position)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="size-5 text-primary" aria-hidden />
          Teams
        </CardTitle>
        {canManage && (
          <div className="flex gap-2">
            {teamsAssigned && (
              <Button type="button" variant="ghost" size="sm" disabled={isMutating} onClick={() => void runTeamAction("clear")}>
                <X className="size-4" aria-hidden />
                {pendingAction === "clear" ? t.resetting : t.reset}
              </Button>
            )}
            <Button type="button" size="sm" disabled={isMutating || roster.length < 2} onClick={() => void runTeamAction("generate")}>
              <Shuffle className="size-4" aria-hidden />
              {pendingAction === "generate" ? t.generating : t.generate}
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {error && <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        {!teamsAssigned ? (
          <p className="text-sm text-muted-foreground text-pretty">
            {roster.length < 2 ? t.min : t.none}
          </p>
        ) : (
          <>
            {canManage && <p className="mb-3 text-sm text-muted-foreground">{t.hint}</p>}
            <div className="grid min-w-0 gap-4 xl:grid-cols-2">
              <TeamColumn
                label="Team 1"
                players={team1}
                variant="primary"
                canManage={canManage}
                movingSignupId={movingSignupId}
                dragTarget={dragTarget?.team === 1 ? dragTarget.position : null}
                onDragStart={setDraggedSignupId}
                onDragEnd={() => { setDraggedSignupId(null); setDragTarget(null) }}
                onPositionDragOver={(event, position) => handleDragOver(event, 1, position)}
                onPositionDragLeave={() => setDragTarget(null)}
                onPositionDrop={(event, position) => handleDrop(event, 1, position)}
              />
              <TeamColumn
                label="Team 2"
                players={team2}
                variant="accent"
                canManage={canManage}
                movingSignupId={movingSignupId}
                dragTarget={dragTarget?.team === 2 ? dragTarget.position : null}
                onDragStart={setDraggedSignupId}
                onDragEnd={() => { setDraggedSignupId(null); setDragTarget(null) }}
                onPositionDragOver={(event, position) => handleDragOver(event, 2, position)}
                onPositionDragLeave={() => setDragTarget(null)}
                onPositionDrop={(event, position) => handleDrop(event, 2, position)}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

async function postTeamAction(body: Record<string, unknown>, fallbackMessage: string) {
  const response = await fetch("/api/training/teams", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    redirect: "manual",
  })

  if (!response.ok || response.type === "opaqueredirect") {
    const data = await response.json().catch(() => null)
    throw new Error(typeof data?.error === "string" ? data.error : fallbackMessage)
  }
}

function TeamColumn({
  label,
  players,
  variant,
  canManage,
  movingSignupId,
  dragTarget,
  onDragStart,
  onDragEnd,
  onPositionDragOver,
  onPositionDragLeave,
  onPositionDrop,
}: {
  label: string
  players: RosterPlayer[]
  variant: "primary" | "accent"
  canManage: boolean
  movingSignupId: number | null
  dragTarget: PlayerPosition | null
  onDragStart: (signupId: number) => void
  onDragEnd: () => void
  onPositionDragOver: (event: DragEvent<HTMLDivElement>, position: PlayerPosition) => void
  onPositionDragLeave: () => void
  onPositionDrop: (event: DragEvent<HTMLDivElement>, position: PlayerPosition) => void
}) {
  const active = players.filter((p) => p.startsInWater ?? p.lineupType !== "substitute").length
  const subs = players.length - active
  const ratedPlayers = players.filter((p) => typeof p.assignedRating === "number")
  const averageRating = ratedPlayers.length > 0 ? Math.round(ratedPlayers.reduce((sum, player) => sum + player.assignedRating!, 0) / ratedPlayers.length) : null

  return (
    <div className="min-w-0 overflow-hidden rounded-lg border bg-card transition-colors">
      <div className={`flex flex-col gap-2 rounded-t-lg px-4 py-3 sm:flex-row sm:items-start sm:justify-between ${variant === "primary" ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"}`}>
        <span className="whitespace-nowrap text-lg font-semibold leading-tight">{label}</span>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Badge variant="secondary" className="whitespace-nowrap">{active} im Wasser · {subs} draußen</Badge>
          {averageRating !== null && <Badge variant="secondary" className="whitespace-nowrap">Ø MMR {averageRating}</Badge>}
        </div>
      </div>
      <div className="grid gap-3 p-3">
        {PLAYER_POSITIONS.map((position) => <PositionGroups key={position} position={position} players={players.filter((p) => p.assignedPosition === position)} canManage={canManage} movingSignupId={movingSignupId} isDropTarget={dragTarget === position} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragOver={(event) => onPositionDragOver(event, position)} onDragLeave={onPositionDragLeave} onDrop={(event) => onPositionDrop(event, position)} />)}
      </div>
    </div>
  )
}

function PositionGroups({ position, players, canManage, movingSignupId, isDropTarget, onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop }: { position: PlayerPosition; players: RosterPlayer[]; canManage: boolean; movingSignupId: number | null; isDropTarget: boolean; onDragStart: (signupId: number) => void; onDragEnd: () => void; onDragOver: (event: DragEvent<HTMLDivElement>) => void; onDragLeave: () => void; onDrop: (event: DragEvent<HTMLDivElement>) => void }) {
  const grouped = new Map<number, RosterPlayer[]>()
  for (const player of players) grouped.set(player.rotationGroupId ?? player.signupId, [...(grouped.get(player.rotationGroupId ?? player.signupId) ?? []), player])

  return (
    <section className={`rounded-md border border-transparent p-2 transition-colors ${isDropTarget ? "border-primary bg-primary/5" : ""}`} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      <h3 className="text-sm font-semibold text-muted-foreground">{POSITION_LABELS[position]}</h3>
      <div className="mt-1 grid gap-2">
        {players.length === 0 && <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">Leer</div>}
        {Array.from(grouped.entries()).map(([groupId, members]) => (
          <RotationGroupCard key={groupId} groupId={groupId} members={members.sort((a, b) => (a.rotationOrder ?? 0) - (b.rotationOrder ?? 0))} canManage={canManage} movingSignupId={movingSignupId} onDragStart={onDragStart} onDragEnd={onDragEnd} />
        ))}
      </div>
    </section>
  )
}

function RotationGroupCard({ groupId, members, canManage, movingSignupId, onDragStart, onDragEnd }: { groupId: number; members: RosterPlayer[]; canManage: boolean; movingSignupId: number | null; onDragStart: (signupId: number) => void; onDragEnd: () => void }) {
  const type = members[0]?.rotationGroupType ?? "single"
  const label = type === "triple" ? "Dreier-Wechselgruppe" : type === "pair" ? "Zweierwechsel" : "Einzelbesetzung"
  const starters = members.filter((member) => member.startsInWater ?? member.lineupType !== "substitute")
  const waiting = members.filter((member) => !(member.startsInWater ?? member.lineupType !== "substitute"))

  return (
    <div className="min-w-0 rounded-md border px-3 py-2 text-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <span className="min-w-0 break-words font-medium">{label} {groupId}</span>
        <Badge variant="secondary" className="max-w-full whitespace-normal text-left sm:shrink-0">Start: {starters.map((p) => p.name).join(" + ") || "—"}</Badge>
      </div>
      {waiting.length > 0 && <p className="mt-1 text-muted-foreground">Draußen: {waiting.map((p) => p.name).join(" + ")}</p>}
      <ol className="mt-2 grid gap-1">
        {members.map((p) => (
          <li key={p.signupId} className={`flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between ${movingSignupId === p.signupId ? "opacity-60" : ""}`} draggable={canManage} onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", String(p.signupId)); onDragStart(p.signupId) }} onDragEnd={onDragEnd}>
            <span className="flex min-w-0 items-center gap-2 break-words">
              {canManage && <GripVertical className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
              <span className="min-w-0">{p.rotationOrder ?? "–"}. {p.name}</span>
            </span>
            <span className="flex flex-wrap gap-2 sm:justify-end">
              {p.startsInWater ?? p.lineupType !== "substitute" ? <Badge variant="outline">im Wasser</Badge> : <Badge variant="secondary">draußen</Badge>}
              {canManage && typeof p.assignedRating === "number" && <Badge variant="outline">MMR {p.assignedRating}</Badge>}
            </span>
          </li>
        ))}
      </ol>
      {type === "pair" && <p className="mt-2 text-muted-foreground">Wechsel: {members.map((p) => p.name).join(" ↔ ")}</p>}
      {type === "triple" && <p className="mt-2 text-muted-foreground">Rotation: {members.map((p, index) => `${p.name} rein → ${members[(index + members.length - 2) % members.length]?.name} raus`).join(" · ")}</p>}
    </div>
  )
}
