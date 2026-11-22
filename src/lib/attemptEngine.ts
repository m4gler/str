/**
 * Attempt & Miss Engine — PRD Section 5 implementation.
 *
 * State machine: ACTIVE → WARNED_1 → WARNED_2 → ATTEMPT_OVER (or COMPLETED)
 *
 * This module provides pure logic functions. Founder page loads, server actions,
 * and reminder routes call these.
 * It does NOT call Payload directly — the caller is responsible for persistence.
 *
 * All configurable values (gate days, miss limits, attempt limits, backfill window)
 * are passed in via ProgramConfig, sourced from the DayProgram global in Payload.
 */

export type AttemptStatus = 'active' | 'warned_1' | 'warned_2' | 'completed' | 'failed'
export type PaymentType = 'self_paid' | 'paid' | 'free' | 'test' | 'sponsored' | 'partnership'

/**
 * Configuration loaded from DayProgram global. Caller fetches and passes in.
 */
export interface ProgramConfig {
  maxMissesPerAttempt: number      // default 3
  backfillWindowDays: number       // default 1
  gateDays: number[]               // default [15,30,50,70,94]
  retroEveryNDays: number          // default 7
  totalProgramDays: number         // default 100
  totalPreworkBlocks: number       // default 10
  attemptLimits: {
    selfPaid: number               // default 3
    free: number                   // default 1
    sponsoredDefault: number       // default 1
  }
}

/** Default config — used only as fallback if DayProgram is unavailable. */
export const DEFAULT_PROGRAM_CONFIG: ProgramConfig = {
  maxMissesPerAttempt: 3,
  backfillWindowDays: 1,
  gateDays: [15, 30, 50, 70, 94],
  retroEveryNDays: 7,
  totalProgramDays: 100,
  totalPreworkBlocks: 10,
  attemptLimits: {
    selfPaid: 3,
    free: 1,
    sponsoredDefault: 1,
  },
}

export interface AttemptState {
  status: AttemptStatus
  missCount: number
  currentDay: number
  missedDays: number[]
}

export interface MissTransitionResult {
  newStatus: AttemptStatus
  newMissCount: number
  missedDays: number[]
  emailAction: 'miss_1' | 'miss_2' | 'attempt_over' | null
}

export interface AttemptAllocationResult {
  canCreateNewAttempt: boolean
  reason: 'auto_new_attempt' | 'all_attempts_used' | 'free_limit' | 'partner_decision_required'
  newAttemptNumber?: number
}

/**
 * PRD 5.3: Process a missed deadline (23:59:59 crossing without submission).
 * Returns the new state and which email notification to send.
 */
export function processMiss(
  state: AttemptState,
  missedDayNumber: number,
  cfg: ProgramConfig = DEFAULT_PROGRAM_CONFIG,
): MissTransitionResult {
  const newMissCount = state.missCount + 1
  const missedDays = [...state.missedDays, missedDayNumber]

  if (newMissCount < cfg.maxMissesPerAttempt - 1) {
    return {
      newStatus: 'warned_1',
      newMissCount,
      missedDays,
      emailAction: 'miss_1',
    }
  }

  if (newMissCount === cfg.maxMissesPerAttempt - 1) {
    return {
      newStatus: 'warned_2',
      newMissCount,
      missedDays,
      emailAction: 'miss_2',
    }
  }

  // newMissCount >= maxMissesPerAttempt
  return {
    newStatus: 'failed',
    newMissCount: cfg.maxMissesPerAttempt,
    missedDays,
    emailAction: 'attempt_over',
  }
}

/**
 * PRD 5.4: Determine what happens after an attempt fails.
 */
export function getAllocationAfterFailure(
  paymentType: PaymentType,
  attemptsUsed: number,
  maxAttempts: number,
): AttemptAllocationResult {
  if (['paid', 'self_paid'].includes(paymentType)) {
    if (attemptsUsed < maxAttempts) {
      return {
        canCreateNewAttempt: true,
        reason: 'auto_new_attempt',
        newAttemptNumber: attemptsUsed + 1,
      }
    }
    return { canCreateNewAttempt: false, reason: 'all_attempts_used' }
  }

  if (['free', 'test'].includes(paymentType)) {
    return { canCreateNewAttempt: false, reason: 'free_limit' }
  }

  // sponsored / partnership
  if (attemptsUsed >= maxAttempts) {
    return { canCreateNewAttempt: false, reason: 'partner_decision_required' }
  }
  return {
    canCreateNewAttempt: true,
    reason: 'auto_new_attempt',
    newAttemptNumber: attemptsUsed + 1,
  }
}

/**
 * PRD 5.6: Get max_attempts for a payment type from config.
 */
export function getMaxAttempts(
  paymentType: PaymentType,
  cfg: ProgramConfig = DEFAULT_PROGRAM_CONFIG,
  overrideMaxAttempts?: number | null,
): number {
  if (typeof overrideMaxAttempts === 'number' && Number.isFinite(overrideMaxAttempts) && overrideMaxAttempts > 0) {
    return overrideMaxAttempts
  }
  if (['paid', 'self_paid'].includes(paymentType)) return cfg.attemptLimits.selfPaid
  if (['free', 'test'].includes(paymentType)) return cfg.attemptLimits.free
  // sponsored / partnership: admin sets custom per cohort — use configured default
  return cfg.attemptLimits.sponsoredDefault
}

/**
 * PRD 5.2: Check if a submission is a backfill.
 */
export function isBackfillSubmission(submissionDayNumber: number, currentCalendarDay: number): boolean {
  return submissionDayNumber < currentCalendarDay
}

/**
 * PRD 5.2: Check if a backfill is still within the allowed window.
 */
export function isBackfillWindowOpen(
  missedDayNumber: number,
  currentCalendarDay: number,
  cfg: ProgramConfig = DEFAULT_PROGRAM_CONFIG,
): boolean {
  return currentCalendarDay <= missedDayNumber + cfg.backfillWindowDays
}

/**
 * Compute the current calendar day based on programStartDate and current time.
 * Day 1 starts on programStartDate at 00:00:00 in the cohort timezone.
 */
export function computeCalendarDay(programStartDate: Date, now: Date, timezone: string): number {
  const startStr = formatDateInTimezone(programStartDate, timezone)
  const nowStr = formatDateInTimezone(now, timezone)

  const startParts = startStr.split('-').map(Number)
  const nowParts = nowStr.split('-').map(Number)

  const startEpoch = Date.UTC(startParts[0], startParts[1] - 1, startParts[2])
  const nowEpoch = Date.UTC(nowParts[0], nowParts[1] - 1, nowParts[2])

  const diffDays = Math.floor((nowEpoch - startEpoch) / (24 * 60 * 60 * 1000))
  return diffDays + 1 // Day 1 = start date
}

export function hasReachedProgramStartDate(programStartDate: Date, now: Date, timezone: string): boolean {
  return computeCalendarDay(programStartDate, now, timezone) >= 1
}

/**
 * Format a Date to YYYY-MM-DD in a given timezone.
 */
function formatDateInTimezone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const get = (t: string) => parts.find((p) => p.type === t)?.value || ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

/**
 * Get the day type — uses config for gate days and retro interval.
 */
export function getDayType(
  dayNumber: number,
  cfg: ProgramConfig = DEFAULT_PROGRAM_CONFIG,
): 'standard' | 'retro' | 'gate' | 'prework' {
  if (dayNumber <= 0) return 'prework'
  if (cfg.gateDays.includes(dayNumber)) return 'gate'
  if (dayNumber % cfg.retroEveryNDays === 0) return 'retro'
  return 'standard'
}

/**
 * PRD 3B.2: Calculate program_start_date from prework completion.
 * program_start_date = prework_completion_date + 1 calendar day.
 */
export function computeProgramStartDate(preworkCompletionDate: Date, timezone: string): Date {
  const dateStr = formatDateInTimezone(preworkCompletionDate, timezone)
  const parts = dateStr.split('-').map(Number)
  const nextDay = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + 1))
  return nextDay
}

/**
 * Check whether the founder can submit a given day.
 */
export function canSubmitDay(
  dayNumber: number,
  attemptStatus: AttemptStatus,
  completedDays: number[],
  currentCalendarDay: number,
  cfg: ProgramConfig = DEFAULT_PROGRAM_CONFIG,
): { allowed: boolean; reason: string } {
  if (attemptStatus === 'failed' || attemptStatus === 'completed') {
    return { allowed: false, reason: 'This attempt has ended. No more submissions are accepted.' }
  }

  if (completedDays.includes(dayNumber)) {
    return { allowed: false, reason: `Day ${dayNumber} has already been submitted.` }
  }

  if (dayNumber === 1 && !completedDays.includes(1)) {
    return { allowed: true, reason: '' }
  }

  if (dayNumber > 1 && !completedDays.includes(dayNumber - 1)) {
    if (dayNumber < currentCalendarDay) {
      if (isBackfillWindowOpen(dayNumber, currentCalendarDay, cfg)) {
        return { allowed: true, reason: 'backfill' }
      }
      return { allowed: false, reason: `The backfill window for Day ${dayNumber} has expired.` }
    }
    return { allowed: false, reason: `Day ${dayNumber - 1} must be completed first.` }
  }

  if (dayNumber > currentCalendarDay) {
    return { allowed: false, reason: `Day ${dayNumber} is not yet available. Today is Day ${currentCalendarDay}.` }
  }

  return { allowed: true, reason: '' }
}

/**
 * Helper: Load ProgramConfig from a DayProgram global document.
 * Pass the result of `payload.findGlobal({ slug: 'day-program' })`.
 */
export function parseProgramConfig(dayProgram: any): ProgramConfig {
  return {
    maxMissesPerAttempt: dayProgram?.maxMissesPerAttempt ?? DEFAULT_PROGRAM_CONFIG.maxMissesPerAttempt,
    backfillWindowDays: dayProgram?.backfillWindowDays ?? DEFAULT_PROGRAM_CONFIG.backfillWindowDays,
    gateDays: Array.isArray(dayProgram?.gateDays) ? dayProgram.gateDays : DEFAULT_PROGRAM_CONFIG.gateDays,
    retroEveryNDays: dayProgram?.retroEveryNDays ?? DEFAULT_PROGRAM_CONFIG.retroEveryNDays,
    totalProgramDays: dayProgram?.totalProgramDays ?? DEFAULT_PROGRAM_CONFIG.totalProgramDays,
    totalPreworkBlocks: dayProgram?.totalPreworkBlocks ?? DEFAULT_PROGRAM_CONFIG.totalPreworkBlocks,
    attemptLimits: {
      selfPaid: dayProgram?.attemptLimits?.selfPaid ?? DEFAULT_PROGRAM_CONFIG.attemptLimits.selfPaid,
      free: dayProgram?.attemptLimits?.free ?? DEFAULT_PROGRAM_CONFIG.attemptLimits.free,
      sponsoredDefault: dayProgram?.attemptLimits?.sponsoredDefault ?? DEFAULT_PROGRAM_CONFIG.attemptLimits.sponsoredDefault,
    },
  }
}
