import type { Payload } from 'payload'

import { getMaxAttempts, type PaymentType, type ProgramConfig } from '@/lib/attemptEngine'

type MaybeUserLike = {
  team?: unknown
} | string | number | null | undefined

function readTeamMaxAttempts(teamValue: unknown): number | null {
  if (!teamValue || typeof teamValue !== 'object') return null
  const maxAttempts = (teamValue as { maxAttempts?: unknown }).maxAttempts
  return typeof maxAttempts === 'number' && Number.isFinite(maxAttempts) && maxAttempts > 0
    ? maxAttempts
    : null
}

async function resolveTeamMaxAttempts(payload: Payload, userLike: MaybeUserLike): Promise<number | null> {
  if (!userLike) return null

  if (typeof userLike === 'object') {
    const teamValue = userLike.team
    const inlineValue = readTeamMaxAttempts(teamValue)
    if (inlineValue != null) return inlineValue

    const teamId =
      teamValue && typeof teamValue === 'object'
        ? (teamValue as { id?: string | number }).id
        : teamValue

    if (teamId == null || teamId === '') {
      const userId = (userLike as { id?: string | number }).id
      if (userId == null || userId === '') return null

      const hydratedUser = await payload.findByID({
        collection: 'users',
        id: userId,
        depth: 1,
      }).catch(() => null) as { team?: unknown } | null

      if (!hydratedUser) return null
      if (!hydratedUser.team) return null
      return resolveTeamMaxAttempts(payload, hydratedUser)
    }

    const team = await payload.findByID({
      collection: 'teams',
      id: teamId as string | number,
      depth: 0,
    }).catch(() => null) as { maxAttempts?: unknown } | null

    return readTeamMaxAttempts(team)
  }

  const user = await payload.findByID({
    collection: 'users',
    id: userLike,
    depth: 1,
  }).catch(() => null) as { team?: unknown } | null

  return resolveTeamMaxAttempts(payload, user)
}

export async function getEffectiveMaxAttemptsForUser(
  payload: Payload,
  userLike: MaybeUserLike,
  paymentType: PaymentType,
  cfg: ProgramConfig,
): Promise<number> {
  const teamMaxAttempts = await resolveTeamMaxAttempts(payload, userLike)
  return getMaxAttempts(paymentType, cfg, teamMaxAttempts)
}
