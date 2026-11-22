/**
 * Lazy miss-check: processes accumulated missed days on founder page load.
 *
 * This is the authoritative miss progression path. We run it whenever the
 * founder re-enters the founder UI (dashboard, day pages, etc.).
 *
 * For each unprocessed missed day:
 *   1. Calls processMiss() to advance the state machine
 *   2. Persists the new state to the Attempts collection
 *   3. Sends the appropriate notification (email + Telegram)
 *   4. Handles post-failure logic (new attempt allocation, partner override)
 */

import type { Payload } from 'payload'
import {
  processMiss,
  getAllocationAfterFailure,
  computeCalendarDay,
  parseProgramConfig,
  type AttemptStatus,
  type ProgramConfig,
} from '@/lib/attemptEngine'
import { getEffectiveMaxAttemptsForUser } from '@/lib/attemptLimits'
import {
  notifyMiss1,
  notifyMiss2,
  notifyAttemptFailed,
  notifyPartnerOverrideRequired,
} from '@/lib/notifications'
import { notifyTelegram } from '@/lib/telegram'
import { getAppUrl } from '@/lib/appUrl'

export interface MissCheckResult {
  processed: boolean
  missesDetected: number
  newStatus: AttemptStatus | null
  failed: boolean
}

/**
 * Check and process all accumulated misses for a single attempt.
 *
 * Safe to call multiple times — already-processed days (in missedDays array)
 * are skipped, so repeated page loads won't double-count.
 */
export async function checkAndProcessMisses(
  payload: Payload,
  attemptId: string | number,
): Promise<MissCheckResult> {
  const result: MissCheckResult = {
    processed: false,
    missesDetected: 0,
    newStatus: null,
    failed: false,
  }

  // Re-fetch attempt with populated user and cohort
  const attempt = await payload.findByID({
    collection: 'attempts',
    id: attemptId,
    depth: 2,
  }) as any

  if (!attempt) return result

  // Only process active attempts
  if (!['active', 'warned_1', 'warned_2'].includes(attempt.status)) {
    result.processed = true
    result.newStatus = attempt.status
    return result
  }

  const user = typeof attempt.user === 'object' ? attempt.user : null
  if (!user) return result

  // Skip prework-phase users — prework is exempt from miss counting
  if (user.programStatus === 'prework') {
    result.processed = true
    return result
  }

  // Attempt timing is attempt-scoped. Keep the user field as a legacy fallback
  // for older records created before attempts had a reliable startedAt value.
  const attemptProgramStart = attempt.startedAt || user.programStartDate
  if (!attemptProgramStart) {
    result.processed = true
    return result
  }

  // Load program config
  const dayProgramGlobal = await payload.findGlobal({ slug: 'day-program' }).catch(() => null)
  const cfg = parseProgramConfig(dayProgramGlobal)

  const cohort = typeof attempt.cohort === 'object' ? attempt.cohort : null
  const timezone = cohort?.timezone || 'Europe/Warsaw'
  const startDate = new Date(attemptProgramStart)
  const now = new Date()
  const calendarDay = computeCalendarDay(startDate, now, timezone)

  // The last day that should have been submitted is calendarDay - 1
  // (today's day is still in progress)
  const lastExpectedDay = Math.min(calendarDay - 1, cfg.totalProgramDays)
  if (lastExpectedDay < 1) {
    result.processed = true
    return result
  }

  // Get all submitted days for this user
  const userId = user.id
  const { docs: submissions } = await payload.find({
    collection: 'founder-form-submissions',
    where: {
      and: [
        { user: { equals: userId } },
        { programDay: { exists: true } },
        { attempt: { equals: attemptId } },
      ],
    },
    limit: 200,
    depth: 0,
  })
  const backfillSubmissionIdsByDay = new Map<number, Array<string | number>>()
  const submittedDays = new Set(
    submissions
      .map((s: any) => s.programDay as number)
      .filter((d): d is number => typeof d === 'number' && d >= 1),
  )
  const backfilledDays = new Set(
    submissions
      .filter((s: any) => s.isBackfill)
      .map((s: any) => s.programDay as number)
      .filter((d): d is number => typeof d === 'number' && d >= 1),
  )
  const alreadyCountedBackfills = new Set(
    submissions
      .filter((s: any) => s.missedCounted)
      .map((s: any) => s.programDay as number)
      .filter((d): d is number => typeof d === 'number' && d >= 1),
  )
  for (const submission of submissions as any[]) {
    const day = submission.programDay
    if (typeof day !== 'number' || day < 1 || !submission.isBackfill) continue
    const ids = backfillSubmissionIdsByDay.get(day) ?? []
    ids.push(submission.id)
    backfillSubmissionIdsByDay.set(day, ids)
  }

  const existingMissedDays: number[] = Array.isArray(attempt.missedDays) ? [...attempt.missedDays] : []
  const alreadyMissed = new Set(existingMissedDays)

  // Track current state across iterations
  let currentStatus: AttemptStatus = attempt.status
  let currentMissCount: number = attempt.missCount || 0
  let currentMissedDays = [...existingMissedDays]

  const appUrl = getAppUrl()

  // Process each day from 1 to lastExpectedDay
  for (let day = 1; day <= lastExpectedDay; day++) {
    const isBackfilledWithoutMiss =
      backfilledDays.has(day) &&
      !alreadyMissed.has(day) &&
      !alreadyCountedBackfills.has(day)

    // Already submitted on time or already counted as missed — skip
    if ((submittedDays.has(day) && !isBackfilledWithoutMiss) || alreadyMissed.has(day)) continue

    // If attempt already failed from a previous iteration, stop
    if (currentStatus === 'failed') break

    // Process this miss
    const missResult = processMiss(
      {
        status: currentStatus,
        missCount: currentMissCount,
        currentDay: day,
        missedDays: currentMissedDays,
      },
      day,
      cfg,
    )

    currentStatus = missResult.newStatus
    currentMissCount = missResult.newMissCount
    currentMissedDays = missResult.missedDays
    result.missesDetected++

    // Persist state after each miss (prevents data loss if function crashes mid-loop)
    const updateData: Record<string, any> = {
      status: missResult.newStatus,
      missCount: missResult.newMissCount,
      missedDays: missResult.missedDays,
    }

    if (missResult.newStatus === 'failed') {
      updateData.endedAt = new Date().toISOString()
      result.failed = true
    }

    await payload.update({
      collection: 'attempts',
      id: attemptId,
      data: updateData,
    })

    if (missResult.newStatus === 'failed') {
      await applyAttemptFailureState(payload, user, attempt, day, cfg)
    }

    if (backfillSubmissionIdsByDay.has(day)) {
      const submissionIds = backfillSubmissionIdsByDay.get(day) ?? []
      await Promise.allSettled(
        submissionIds.map((submissionId) =>
          payload.update({
            collection: 'founder-form-submissions',
            id: submissionId,
            data: { missedCounted: true },
            overrideAccess: true,
          }),
        ),
      )
    }

    // Send notifications (fire-and-forget — don't block page load)
    sendMissNotifications(payload, missResult.emailAction, user, attempt, day, cfg, appUrl).catch(
      (err) => console.error('[missCheck] Notification error:', err),
    )
  }

  result.processed = true
  result.newStatus = currentStatus
  return result
}

/**
 * Fire-and-forget notification sender for a single miss event.
 */
async function sendMissNotifications(
  payload: Payload,
  emailAction: string | null,
  user: any,
  attempt: any,
  dayNumber: number,
  cfg: ProgramConfig,
  appUrl: string,
): Promise<void> {
  const founderRecipient = { email: user.email, name: user.email }

  // Get admin emails
  const { docs: admins } = await payload.find({
    collection: 'users',
    where: { role: { equals: 'admin' } },
    limit: 10,
  })
  const adminRecipients = admins.map((a: any) => ({ email: a.email }))

  if (emailAction === 'miss_1') {
    await notifyMiss1(payload, founderRecipient, [], dayNumber, appUrl)
  } else if (emailAction === 'miss_2') {
    await notifyMiss2(payload, founderRecipient, adminRecipients, dayNumber, appUrl)
  } else if (emailAction === 'attempt_over') {
    const maxAttempts = await getEffectiveMaxAttemptsForUser(payload, user, attempt.paymentType, cfg)
    const attemptsUsed = attempt.attemptNumber

    await notifyAttemptFailed(
      payload,
      founderRecipient,
      adminRecipients,
      attemptsUsed,
      maxAttempts,
      attempt.paymentType,
      appUrl,
    )

    // Telegram alert
    await notifyTelegram(
      'warning',
      `Attempt FAILED (lazy check)`,
      `Founder: ${user.email}\nAttempt #${attemptsUsed}\nDay: ${dayNumber}`,
    )
  }
}

async function applyAttemptFailureState(
  payload: Payload,
  user: any,
  attempt: any,
  dayNumber: number,
  cfg: ProgramConfig,
): Promise<void> {
  await payload.update({
    collection: 'users',
    id: user.id,
    data: { programStatus: 'failed' },
    overrideAccess: true,
  })

  const maxAttempts = await getEffectiveMaxAttemptsForUser(payload, user, attempt.paymentType, cfg)
  const allocation = getAllocationAfterFailure(attempt.paymentType, attempt.attemptNumber, maxAttempts)

  if (allocation.reason !== 'partner_decision_required') {
    return
  }

  const partnerId = user.partner?.id ?? user.partner
  if (partnerId) {
    const { docs: partnerUsers } = await payload.find({
      collection: 'users',
      where: { and: [{ role: { equals: 'partner' } }, { partner: { equals: partnerId } }] },
      limit: 1,
    })
    if (partnerUsers.length > 0) {
      const appUrl = getAppUrl()
      await notifyPartnerOverrideRequired(
        payload,
        { email: (partnerUsers[0] as any).email },
        user.email,
        attempt.attemptNumber,
        dayNumber,
        appUrl,
      )
    }
  }

  await payload.update({
    collection: 'attempts',
    id: attempt.id,
    data: {
      partnerOverrideRequestedAt: new Date().toISOString(),
      partnerDecision: 'pending',
    },
  })
}
