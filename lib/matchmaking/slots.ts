import type { PlayerPosition } from "@/lib/ratings/types"
import type { MatchmakingPlayer, RotationGroupMember, RotationStep } from "./types"

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length)
}

export function buildRotationSteps(members: RotationGroupMember[], activeSlotCount: 1 | 2): RotationStep[] {
  if (members.length <= activeSlotCount) return []
  return members.map((member, index) => ({
    outgoingSignupId: member.signupId,
    incomingSignupId: members[(index + activeSlotCount) % members.length].signupId,
  }))
}

export function buildPositionSlotGroups(members: MatchmakingPlayer[], position: PlayerPosition): MatchmakingPlayer[][] {
  if (members.length <= 2) return members.map((member) => [member])

  const slots: [MatchmakingPlayer[], MatchmakingPlayer[]] = [[members[0]], [members[1]]]
  for (const member of members.slice(2)) {
    const [slot1, slot2] = slots
    const slot1Rating = average(slot1.map((player) => player.ratings[position]))
    const slot2Rating = average(slot2.map((player) => player.ratings[position]))
    const slot1SizeAfter = slot1.length + 1
    const slot2SizeAfter = slot2.length + 1
    const sizeDiff1 = Math.abs(slot1SizeAfter - slot2.length)
    const sizeDiff2 = Math.abs(slot1.length - slot2SizeAfter)
    const ratingDiff1 = Math.abs(average([...slot1.map((player) => player.ratings[position]), member.ratings[position]]) - slot2Rating)
    const ratingDiff2 = Math.abs(slot1Rating - average([...slot2.map((player) => player.ratings[position]), member.ratings[position]]))

    if (sizeDiff1 < sizeDiff2 || (sizeDiff1 === sizeDiff2 && ratingDiff1 < ratingDiff2)) slot1.push(member)
    else slot2.push(member)
  }

  return slots
}
