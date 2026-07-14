"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { POSITION_LABELS, PLAYER_POSITIONS, type PlayerPosition } from "@/lib/ratings/types"
import { Shuffle, Users, X } from "lucide-react"

type RosterPlayer = { signupId: number; name: string; team: number | null; source: string; assignedPosition?: string | null; lineupType?: string | null; assignedRating?: number | null }
type TeamAction = "generate" | "clear"

export function TeamsPanel({ roster, canManage, trainingId }: { roster: RosterPlayer[]; canManage: boolean; trainingId?: number }) {
  const router = useRouter(); const [isPending, startTransition] = useTransition(); const [pendingAction, setPendingAction] = useState<TeamAction | null>(null); const [error, setError] = useState<string | null>(null)
  const teamsAssigned = roster.some((p) => p.team !== null); const team1 = roster.filter((p) => p.team === 1); const team2 = roster.filter((p) => p.team === 2); const isMutating = isPending || pendingAction !== null
  async function runTeamAction(action: TeamAction) { setPendingAction(action); setError(null); try { const response = await fetch("/api/training/teams", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, trainingId }), redirect: "manual" }); if (!response.ok || response.type === "opaqueredirect") { const data = await response.json().catch(() => null); throw new Error(typeof data?.error === "string" ? data.error : "Die Team-Aktion ist fehlgeschlagen. Bitte versuche es erneut.") } startTransition(() => router.refresh()) } catch (err) { setError(err instanceof Error ? err.message : "Die Team-Aktion ist fehlgeschlagen. Bitte versuche es erneut.") } finally { setPendingAction(null) } }
  return <Card><CardHeader className="flex flex-row items-center justify-between gap-2"><CardTitle className="flex items-center gap-2 text-lg"><Users className="size-5 text-primary" aria-hidden />Teams</CardTitle>{canManage && <div className="flex gap-2">{teamsAssigned && <Button type="button" variant="ghost" size="sm" disabled={isMutating} onClick={() => void runTeamAction("clear")}><X className="size-4" aria-hidden />{pendingAction === "clear" ? "Setze zurück …" : "Zurücksetzen"}</Button>}<Button type="button" size="sm" disabled={isMutating || roster.length < 2} onClick={() => void runTeamAction("generate")}><Shuffle className="size-4" aria-hidden />{pendingAction === "generate" ? "Teile ein …" : "Teams fair einteilen"}</Button></div>}</CardHeader><CardContent>{error && <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}{!teamsAssigned ? <p className="text-sm text-muted-foreground text-pretty">{roster.length < 2 ? "Mindestens 2 Anmeldungen nötig, um Teams einzuteilen." : "Noch keine Teams eingeteilt. Tippe auf „Teams fair einteilen“, um positionsbasiert faire Teams zu bilden."}</p> : <div className="grid gap-4 sm:grid-cols-2"><TeamColumn label="Team 1" players={team1} variant="primary" /><TeamColumn label="Team 2" players={team2} variant="accent" /></div>}</CardContent></Card>
}

function TeamColumn({ label, players, variant }: { label: string; players: RosterPlayer[]; variant: "primary" | "accent" }) {
  const active = players.filter((p) => p.lineupType !== "substitute").length; const subs = players.length - active
  const ratedPlayers = players.filter((p) => typeof p.assignedRating === "number")
  const averageRating = ratedPlayers.length > 0 ? Math.round(ratedPlayers.reduce((sum, player) => sum + player.assignedRating!, 0) / ratedPlayers.length) : null
  return <div className="rounded-lg border bg-card"><div className={`flex items-center justify-between rounded-t-lg px-4 py-2 ${variant === "primary" ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"}`}><span className="font-semibold">{label}</span><div className="flex flex-wrap justify-end gap-2"><Badge variant="secondary">{active} aktiv · {subs} Wechsel</Badge>{averageRating !== null && <Badge variant="secondary">Ø MMR {averageRating}</Badge>}</div></div><div className="grid gap-3 p-3">{PLAYER_POSITIONS.map((position) => <section key={position}><h3 className="text-sm font-semibold text-muted-foreground">{POSITION_LABELS[position]}</h3><ul className="mt-1 divide-y rounded-md border">{players.filter((p) => p.assignedPosition === position).map((p) => <li key={p.signupId} className="flex items-center justify-between gap-3 px-3 py-2 text-sm"><span>{p.name}</span><span className="flex flex-wrap justify-end gap-2">{typeof p.assignedRating === "number" && <Badge variant="outline">MMR {p.assignedRating}</Badge>}{p.lineupType === "substitute" && <Badge variant="secondary">Wechsel</Badge>}</span></li>)}{players.filter((p) => p.assignedPosition === position).length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">Leer</li>}</ul></section>)}</div></div>
}
