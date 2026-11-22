import type { Payload } from 'payload'
import { hasReachedProgramStartDate } from '@/lib/attemptEngine'
import { checkAndProcessMisses, type MissCheckResult } from '@/lib/missCheck'

export interface EnsureFreshAttemptStateResult {
  user: any
  programStatus: string
  activeAttemptId: string | number | null
  activeAttemptStartedAt: string | null
  missCheck: MissCheckResult | null
}

export async function ensureFreshAttemptState(
  payload: Payload,
  initialUser: any,
): Promise<EnsureFreshAttemptStateResult> {
  let user = initialUser
  let programStatus = user?.programStatus || 'not_started'
  let activeAttemptId: string | number | null = null
  let activeAttemptStartedAt: string | null = null
  let missCheck: MissCheckResult | null = null

  if (!user || user.role !== 'founder') {
    return { user, programStatus, activeAttemptId, activeAttemptStartedAt, missCheck }
  }

  if (programStatus === 'prework' && user.programStartDate) {
    const shouldActivate = hasReachedProgramStartDate(
      new Date(user.programStartDate),
      new Date(),
      'Europe/Warsaw',
    )

    if (shouldActivate) {
      await payload.update({
        collection: 'users',
        id: user.id,
        data: { programStatus: 'active' },
        overrideAccess: true,
      })

      user = await payload.findByID({
        collection: 'users',
        id: user.id,
        depth: 1,
      }).catch(() => ({ ...user, programStatus: 'active' }))
      programStatus = user?.programStatus || 'active'
    }
  }

  if (programStatus !== 'active') {
    return { user, programStatus, activeAttemptId, activeAttemptStartedAt, missCheck }
  }

  const activeAttempts = await payload.find({
    collection: 'attempts',
    where: {
      user: { equals: user.id },
      status: { in: ['active', 'warned_1', 'warned_2'] },
    },
    sort: '-attemptNumber',
    limit: 1,
    depth: 0,
  })

  const activeAttempt = activeAttempts.docs[0]

  if (!activeAttempt) {
    await payload.update({
      collection: 'users',
      id: user.id,
      data: { programStatus: 'not_started' },
      overrideAccess: true,
    })

    user = await payload.findByID({
      collection: 'users',
      id: user.id,
      depth: 1,
    }).catch(() => ({ ...user, programStatus: 'not_started' }))

    return {
      user,
      programStatus: user?.programStatus || 'not_started',
      activeAttemptId: null,
      activeAttemptStartedAt: null,
      missCheck: null,
    }
  }

  activeAttemptId = activeAttempt.id
  activeAttemptStartedAt = typeof (activeAttempt as any).startedAt === 'string'
    ? (activeAttempt as any).startedAt
    : null
  missCheck = await checkAndProcessMisses(payload, activeAttempt.id)

  if (missCheck.failed) {
    user = await payload.findByID({
      collection: 'users',
      id: user.id,
      depth: 1,
    }).catch(() => user)
    programStatus = user?.programStatus || 'not_started'
  }

  return {
    user,
    programStatus,
    activeAttemptId,
    activeAttemptStartedAt,
    missCheck,
  }
}
