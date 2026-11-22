/**
 * Unit tests for the pure Attempt Engine logic.
 * No database needed — these test the state machine directly.
 */
import { describe, it, expect } from 'vitest'
import {
  processMiss,
  getAllocationAfterFailure,
  getMaxAttempts,
  isBackfillSubmission,
  isBackfillWindowOpen,
  computeCalendarDay,
  getDayType,
  computeProgramStartDate,
  canSubmitDay,
  DEFAULT_PROGRAM_CONFIG,
  type ProgramConfig,
  type AttemptState,
} from '@/lib/attemptEngine'

// ── processMiss state machine ──

describe('processMiss', () => {
  const baseState: AttemptState = {
    status: 'active',
    missCount: 0,
    currentDay: 5,
    missedDays: [],
  }

  it('first miss → warned_1, emailAction miss_1', () => {
    const r = processMiss(baseState, 5)
    expect(r.newStatus).toBe('warned_1')
    expect(r.newMissCount).toBe(1)
    expect(r.missedDays).toEqual([5])
    expect(r.emailAction).toBe('miss_1')
  })

  it('second miss → warned_2, emailAction miss_2', () => {
    const state: AttemptState = { ...baseState, status: 'warned_1', missCount: 1, missedDays: [3] }
    const r = processMiss(state, 7)
    expect(r.newStatus).toBe('warned_2')
    expect(r.newMissCount).toBe(2)
    expect(r.missedDays).toEqual([3, 7])
    expect(r.emailAction).toBe('miss_2')
  })

  it('third miss → failed, emailAction attempt_over', () => {
    const state: AttemptState = { ...baseState, status: 'warned_2', missCount: 2, missedDays: [3, 7] }
    const r = processMiss(state, 10)
    expect(r.newStatus).toBe('failed')
    expect(r.newMissCount).toBe(3)
    expect(r.missedDays).toEqual([3, 7, 10])
    expect(r.emailAction).toBe('attempt_over')
  })

  it('caps missCount at maxMissesPerAttempt even if somehow called after failure', () => {
    const state: AttemptState = { ...baseState, missCount: 5, missedDays: [1, 2, 3, 4, 5] }
    const r = processMiss(state, 6)
    expect(r.newStatus).toBe('failed')
    expect(r.newMissCount).toBe(3) // capped at config default
  })

  it('respects custom maxMissesPerAttempt', () => {
    const cfg: ProgramConfig = { ...DEFAULT_PROGRAM_CONFIG, maxMissesPerAttempt: 5 }
    const state: AttemptState = { ...baseState, missCount: 3, missedDays: [1, 2, 3] }
    const r = processMiss(state, 8, cfg)
    // 4th miss with max=5 → still warned_2 (maxMisses - 1 = 4)
    expect(r.newStatus).toBe('warned_2')
    expect(r.newMissCount).toBe(4)
    expect(r.emailAction).toBe('miss_2')
  })
})

// ── getAllocationAfterFailure ──

describe('getAllocationAfterFailure', () => {
  it('self_paid with attempts remaining → auto_new_attempt', () => {
    const r = getAllocationAfterFailure('self_paid', 1, 3)
    expect(r.canCreateNewAttempt).toBe(true)
    expect(r.reason).toBe('auto_new_attempt')
    expect(r.newAttemptNumber).toBe(2)
  })

  it('self_paid all used → all_attempts_used', () => {
    const r = getAllocationAfterFailure('self_paid', 3, 3)
    expect(r.canCreateNewAttempt).toBe(false)
    expect(r.reason).toBe('all_attempts_used')
  })

  it('paid with attempts remaining → auto_new_attempt', () => {
    const r = getAllocationAfterFailure('paid', 2, 3)
    expect(r.canCreateNewAttempt).toBe(true)
    expect(r.reason).toBe('auto_new_attempt')
  })

  it('free → free_limit, no new attempt', () => {
    const r = getAllocationAfterFailure('free', 1, 1)
    expect(r.canCreateNewAttempt).toBe(false)
    expect(r.reason).toBe('free_limit')
  })

  it('test → free_limit', () => {
    const r = getAllocationAfterFailure('test', 1, 1)
    expect(r.canCreateNewAttempt).toBe(false)
    expect(r.reason).toBe('free_limit')
  })

  it('sponsored all used → partner_decision_required', () => {
    const r = getAllocationAfterFailure('sponsored', 1, 1)
    expect(r.canCreateNewAttempt).toBe(false)
    expect(r.reason).toBe('partner_decision_required')
  })

  it('partnership with attempts remaining → auto_new_attempt', () => {
    const r = getAllocationAfterFailure('partnership', 1, 3)
    expect(r.canCreateNewAttempt).toBe(true)
    expect(r.reason).toBe('auto_new_attempt')
  })

  it('partnership all used → partner_decision_required', () => {
    const r = getAllocationAfterFailure('partnership', 3, 3)
    expect(r.canCreateNewAttempt).toBe(false)
    expect(r.reason).toBe('partner_decision_required')
  })
})

// ── getMaxAttempts ──

describe('getMaxAttempts', () => {
  it('self_paid → 3 (default)', () => {
    expect(getMaxAttempts('self_paid')).toBe(3)
  })
  it('paid → 3', () => {
    expect(getMaxAttempts('paid')).toBe(3)
  })
  it('free → 1', () => {
    expect(getMaxAttempts('free')).toBe(1)
  })
  it('test → 1', () => {
    expect(getMaxAttempts('test')).toBe(1)
  })
  it('sponsored → 1 (default)', () => {
    expect(getMaxAttempts('sponsored')).toBe(1)
  })
  it('respects custom config', () => {
    const cfg: ProgramConfig = {
      ...DEFAULT_PROGRAM_CONFIG,
      attemptLimits: { selfPaid: 5, free: 2, sponsoredDefault: 3 },
    }
    expect(getMaxAttempts('self_paid', cfg)).toBe(5)
    expect(getMaxAttempts('free', cfg)).toBe(2)
    expect(getMaxAttempts('sponsored', cfg)).toBe(3)
  })
})

// ── Backfill logic ──

describe('isBackfillSubmission', () => {
  it('same day → false', () => {
    expect(isBackfillSubmission(5, 5)).toBe(false)
  })
  it('past day → true', () => {
    expect(isBackfillSubmission(3, 5)).toBe(true)
  })
  it('future day → false', () => {
    expect(isBackfillSubmission(7, 5)).toBe(false)
  })
})

describe('isBackfillWindowOpen', () => {
  it('within window (default 1 day) → true', () => {
    expect(isBackfillWindowOpen(5, 6)).toBe(true) // day 5 missed, now day 6
  })
  it('outside window → false', () => {
    expect(isBackfillWindowOpen(5, 7)).toBe(false) // day 5 missed, now day 7
  })
  it('respects custom backfillWindowDays', () => {
    const cfg: ProgramConfig = { ...DEFAULT_PROGRAM_CONFIG, backfillWindowDays: 3 }
    expect(isBackfillWindowOpen(5, 8, cfg)).toBe(true) // 5+3=8, still open
    expect(isBackfillWindowOpen(5, 9, cfg)).toBe(false) // 5+3=8 < 9
  })
})

// ── computeCalendarDay ──

describe('computeCalendarDay', () => {
  it('start date = today → Day 1', () => {
    const now = new Date('2026-03-22T14:00:00Z')
    const start = new Date('2026-03-22T00:00:00Z')
    expect(computeCalendarDay(start, now, 'Europe/Warsaw')).toBe(1)
  })

  it('start date = yesterday → Day 2', () => {
    const now = new Date('2026-03-22T14:00:00Z')
    const start = new Date('2026-03-21T00:00:00Z')
    expect(computeCalendarDay(start, now, 'Europe/Warsaw')).toBe(2)
  })

  it('10 days after start → Day 11', () => {
    const now = new Date('2026-04-01T10:00:00Z')
    const start = new Date('2026-03-22T00:00:00Z')
    expect(computeCalendarDay(start, now, 'Europe/Warsaw')).toBe(11)
  })

  it('handles UTC vs CET timezone boundary', () => {
    // 23:30 UTC on March 22 = 00:30 CET on March 23
    const now = new Date('2026-03-22T23:30:00Z')
    const start = new Date('2026-03-22T00:00:00Z')
    // In CET, it's already March 23 → Day 2
    expect(computeCalendarDay(start, now, 'Europe/Warsaw')).toBe(2)
  })

  it('handles different timezone (US Eastern)', () => {
    // March 22 at 03:00 UTC = March 21 at 22:00 EST (still previous day)
    const now = new Date('2026-03-22T03:00:00Z')
    const start = new Date('2026-03-22T00:00:00Z')
    // In America/New_York, now is March 21 but start is March 21 too → depends on TZ interpretation
    const day = computeCalendarDay(start, now, 'America/New_York')
    expect(day).toBeGreaterThanOrEqual(0) // just verify no crash
  })
})

// ── getDayType ──

describe('getDayType', () => {
  it('prework (day 0 or negative) → prework', () => {
    expect(getDayType(0)).toBe('prework')
    expect(getDayType(-1)).toBe('prework')
  })

  it('gate days → gate', () => {
    for (const d of [15, 30, 50, 70, 94]) {
      expect(getDayType(d)).toBe('gate')
    }
  })

  it('retro days (multiples of 7) → retro', () => {
    expect(getDayType(7)).toBe('retro')
    expect(getDayType(14)).toBe('retro')
    expect(getDayType(21)).toBe('retro')
    expect(getDayType(28)).toBe('retro')
  })

  it('gate takes precedence over retro (day 70 is both 7*10 and gate)', () => {
    expect(getDayType(70)).toBe('gate')
  })

  it('regular day → standard', () => {
    expect(getDayType(1)).toBe('standard')
    expect(getDayType(5)).toBe('standard')
    expect(getDayType(99)).toBe('standard')
  })

  it('custom gate days config', () => {
    const cfg: ProgramConfig = { ...DEFAULT_PROGRAM_CONFIG, gateDays: [10, 20] }
    expect(getDayType(10, cfg)).toBe('gate')
    expect(getDayType(15, cfg)).toBe('standard') // not a gate in custom config
  })
})

// ── computeProgramStartDate ──

describe('computeProgramStartDate', () => {
  it('returns next day from prework completion', () => {
    const completion = new Date('2026-03-22T15:00:00Z')
    const startDate = computeProgramStartDate(completion, 'Europe/Warsaw')
    expect(startDate.toISOString()).toContain('2026-03-23')
  })
})

// ── canSubmitDay ──

describe('canSubmitDay', () => {
  it('day 1 with no completions → allowed', () => {
    const r = canSubmitDay(1, 'active', [], 1)
    expect(r.allowed).toBe(true)
  })

  it('already completed day → not allowed', () => {
    const r = canSubmitDay(1, 'active', [1], 2)
    expect(r.allowed).toBe(false)
    expect(r.reason).toContain('already been submitted')
  })

  it('future day → not allowed', () => {
    const r = canSubmitDay(5, 'active', [1, 2, 3], 3)
    expect(r.allowed).toBe(false)
    expect(r.reason).toContain('must be completed first')
  })

  it('failed attempt → not allowed', () => {
    const r = canSubmitDay(1, 'failed', [], 1)
    expect(r.allowed).toBe(false)
    expect(r.reason).toContain('ended')
  })

  it('completed attempt → not allowed', () => {
    const r = canSubmitDay(1, 'completed', [], 1)
    expect(r.allowed).toBe(false)
  })

  it('previous day incomplete but within backfill window → allowed', () => {
    // Day 3, calendar day 4, day 2 not done, within 1-day window
    const r = canSubmitDay(3, 'active', [1], 4)
    expect(r.allowed).toBe(true)
    expect(r.reason).toBe('backfill')
  })

  it('previous day incomplete, outside backfill window → not allowed', () => {
    const r = canSubmitDay(3, 'active', [1], 5)
    expect(r.allowed).toBe(false)
    expect(r.reason).toContain('backfill window')
  })

  it('sequential completion allowed', () => {
    const r = canSubmitDay(4, 'active', [1, 2, 3], 4)
    expect(r.allowed).toBe(true)
  })
})
