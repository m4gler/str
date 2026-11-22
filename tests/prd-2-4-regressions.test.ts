import { describe, it, expect, vi } from 'vitest'
import type { Payload } from 'payload'

vi.mock('@/lib/openai', async () => {
  const actual = await vi.importActual<typeof import('@/lib/openai')>('@/lib/openai')
  return {
    ...actual,
    generateAISummary: vi.fn(async () => ({
      summary_3s: 'summary',
      key_output: '',
      decision: '',
      learnings: '',
      mentor_ask: '',
      checks_passed: true,
      link_reachable: true,
      generated_at: '2026-03-28T00:00:00.000Z',
    })),
  }
})

import { getActiveProgramDay, validateDaySubmission } from '@/lib/dayProgression'
import { normalizeEstimatedTimeHrs } from '@/lib/estimatedTime'
import { canUserReadDocument } from '@/lib/documents'
import { extractArtifactReference, runAutoCheck } from '@/lib/autoCheck'
import { DEFAULT_PROGRAM_CONFIG } from '@/lib/attemptEngine'
import { getEffectiveMaxAttemptsForUser } from '@/lib/attemptLimits'
import { computeProgramProgress, getProgressDisplayDay, normalizeProgramGates } from '@/lib/partnerBranding'
import { extractProjectIdeaSectionDescription, normalizeProjectDescriptionForEditing } from '@/lib/projectSubmission'
import { getPreworkStartNowEligibility, getStartProgramAttemptEligibility } from '@/lib/programStart'

describe('PRD 2.4: start-program gating', () => {
  it('blocks starting a new attempt when one is already open', () => {
    const result = getStartProgramAttemptEligibility({
      paymentEnabled: true,
      hasPaid100Days: true,
      currentAttempts: 1,
      maxAttempts: 3,
      hasOpenAttempt: true,
    })

    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('attempt_in_progress')
  })
})

describe('PRD 2.4: prework -> day 1 activation', () => {
  it('allows immediate activation only after all prework blocks are complete', () => {
    expect(getPreworkStartNowEligibility({
      programStatus: 'prework',
      completedPreworkBlocks: 10,
      totalPreworkBlocks: 10,
      hasActiveAttempt: true,
    }).allowed).toBe(true)

    expect(getPreworkStartNowEligibility({
      programStatus: 'prework',
      completedPreworkBlocks: 9,
      totalPreworkBlocks: 10,
      hasActiveAttempt: true,
    }).allowed).toBe(false)
  })

  it('keeps day 1 locked before the scheduled program start date', async () => {
    const payload = {
      findGlobal: vi.fn().mockResolvedValue(null),
      find: vi.fn(async ({ collection }: { collection: string }) => {
        if (collection === 'attempts') return { docs: [{ id: 1 }] }
        if (collection === 'founder-form-submissions') return { docs: [] }
        if (collection === 'day-definitions') return { totalDocs: 0, docs: [] }
        return { totalDocs: 0, docs: [] }
      }),
    } as unknown as Payload

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const result = await getActiveProgramDay(
      payload,
      123,
      tomorrow.toISOString(),
      null,
      null,
      null,
    )

    expect(result.activeDay).toBe(1)
    expect(result.isLocked).toBe(true)
    expect(result.lockReason).toBe('before_program_start')
    expect(result.nextUnlockTime).toBeTruthy()
  })

  it('allows prework forms while the founder is still in prework', async () => {
    const dayOneFormId = 101
    const preworkFormId = 501
    const payload = {
      findGlobal: vi.fn(async ({ slug }: { slug: string }) => {
        if (slug === 'day-program') {
          return {
            defaultSchedule: { '1': dayOneFormId },
            preworkSchedule: { '1': preworkFormId },
          }
        }
        return null
      }),
      findByID: vi.fn(async ({ collection, id }: { collection: string; id?: number | string }) => {
        if (collection === 'users') return { id: 123, programStatus: 'prework' }
        if (collection === 'founder-forms' && String(id) === String(preworkFormId)) {
          return { id: preworkFormId, slug: 'daily-prework-block-1' }
        }
        if (collection === 'founder-forms' && String(id) === String(dayOneFormId)) {
          return { id: dayOneFormId, slug: 'daily-day-block-1' }
        }
        return null
      }),
      find: vi.fn(async ({ collection }: { collection: string }) => {
        if (collection === 'attempts') return { docs: [{ id: 77 }], totalDocs: 1 }
        if (collection === 'founder-form-submissions') return { docs: [], totalDocs: 0 }
        if (collection === 'day-definitions') return { docs: [], totalDocs: 0 }
        if (collection === 'user-day-overrides') return { docs: [], totalDocs: 0 }
        return { docs: [], totalDocs: 0 }
      }),
    } as unknown as Payload

    const result = await validateDaySubmission(
      payload,
      123,
      new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      null,
      preworkFormId,
      null,
      null,
      null,
    )

    expect(result.allowed).toBe(true)
    expect(result.programDay).toBe(0)
  })

  it('allows prework forms for test-mode founders', async () => {
    const dayOneFormId = 101
    const preworkFormId = 501
    const payload = {
      findGlobal: vi.fn(async ({ slug }: { slug: string }) => {
        if (slug === 'day-program') {
          return {
            defaultSchedule: { '1': dayOneFormId },
            preworkSchedule: { '1': preworkFormId },
          }
        }
        return null
      }),
      findByID: vi.fn(async ({ collection, id }: { collection: string; id?: number | string }) => {
        if (collection === 'users') return { id: 123, programStatus: 'test' }
        if (collection === 'founder-forms' && String(id) === String(preworkFormId)) {
          return { id: preworkFormId, slug: 'daily-prework-block-1' }
        }
        if (collection === 'founder-forms' && String(id) === String(dayOneFormId)) {
          return { id: dayOneFormId, slug: 'daily-day-block-1' }
        }
        return null
      }),
      find: vi.fn(async ({ collection }: { collection: string }) => {
        if (collection === 'attempts') return { docs: [{ id: 77 }], totalDocs: 1 }
        if (collection === 'founder-form-submissions') return { docs: [], totalDocs: 0 }
        if (collection === 'day-definitions') return { docs: [], totalDocs: 0 }
        if (collection === 'user-day-overrides') return { docs: [], totalDocs: 0 }
        return { docs: [], totalDocs: 0 }
      }),
    } as unknown as Payload

    const result = await validateDaySubmission(
      payload,
      123,
      null,
      null,
      preworkFormId,
      null,
      null,
      null,
    )

    expect(result.allowed).toBe(true)
    expect(result.programDay).toBe(0)
  })
})

describe('PRD 2.4: test program state', () => {
  const retroDayCases = [
    { day: 7, week: 1 },
    { day: 14, week: 2 },
    { day: 21, week: 3 },
    { day: 28, week: 4 },
    { day: 35, week: 5 },
    { day: 42, week: 6 },
    { day: 49, week: 7 },
    { day: 56, week: 8 },
    { day: 63, week: 9 },
    { day: 77, week: 11 },
    { day: 84, week: 12 },
    { day: 91, week: 13 },
    { day: 98, week: 14 },
  ] as const

  const gateDayCases = [15, 30, 50, 70, 94] as const

  it('keeps real progression state for test users while removing locks', async () => {
    const findMock = vi.fn(async ({ collection }: { collection: string }) => {
      if (collection === 'attempts') return { docs: [{ id: 77 }], totalDocs: 1 }
      if (collection === 'founder-form-submissions') {
        return {
          docs: [
            { programDay: 1, createdAt: '2026-03-28T10:00:00.000Z' },
            { programDay: 2, createdAt: '2026-03-29T10:00:00.000Z' },
            { programDay: 5, createdAt: '2026-03-30T10:00:00.000Z' },
          ],
          totalDocs: 3,
        }
      }
      if (collection === 'day-definitions') return { docs: [], totalDocs: 0 }
      if (collection === 'user-day-overrides') return { docs: [], totalDocs: 0 }
      return { docs: [], totalDocs: 0 }
    })

    const payload = {
      findGlobal: vi.fn().mockResolvedValue(null),
      findByID: vi.fn(async ({ collection }: { collection: string }) => {
        if (collection === 'users') return { id: 123, programStatus: 'test' }
        return null
      }),
      find: findMock,
    } as unknown as Payload

    const result = await getActiveProgramDay(
      payload,
      123,
      null,
      null,
      null,
      null,
    )

    expect(result.activeDay).toBe(3)
    expect(result.displayDay).toBe(5)
    expect(result.nextMissionDay).toBe(6)
    expect(result.isLocked).toBe(false)
    expect(result.completedDays).toEqual([1, 2, 5])
    expect(findMock).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'founder-form-submissions',
      where: {
        and: [
          { user: { equals: 123 } },
          { programDay: { exists: true } },
          {
            or: [
              { attempt: { equals: 77 } },
              { attempt: { exists: false } },
            ],
          },
        ],
      },
    }))
  })

  it('allows test users to submit any requested program day', async () => {
    const payload = {
      findByID: vi.fn(async ({ collection }: { collection: string }) => {
        if (collection === 'users') return { id: 123, programStatus: 'test' }
        return null
      }),
      find: vi.fn(async ({ collection }: { collection: string }) => {
        if (collection === 'attempts') return { docs: [], totalDocs: 0 }
        if (collection === 'founder-form-submissions') return { docs: [], totalDocs: 0 }
        return { docs: [], totalDocs: 0 }
      }),
    } as unknown as Payload

    const result = await validateDaySubmission(
      payload,
      123,
      null,
      null,
      999,
      null,
      null,
      42,
    )

    expect(result.allowed).toBe(true)
    expect(result.programDay).toBe(42)
  })

  it('falls back to the next real active day when test-mode submission has no explicit day', async () => {
    const payload = {
      findGlobal: vi.fn().mockResolvedValue(null),
      findByID: vi.fn(async ({ collection }: { collection: string }) => {
        if (collection === 'users') return { id: 123, programStatus: 'test' }
        return null
      }),
      find: vi.fn(async ({ collection, where }: { collection: string; where?: Record<string, any> }) => {
        if (collection === 'attempts') return { docs: [], totalDocs: 0 }
        if (collection === 'founder-form-submissions') {
          const targetDayClause = where?.and?.find?.((clause: any) => clause?.programDay?.equals != null)
          if (targetDayClause?.programDay?.equals === 3) {
            return { docs: [], totalDocs: 0 }
          }
          return {
            docs: [
              { programDay: 1, createdAt: '2026-03-28T10:00:00.000Z' },
              { programDay: 2, createdAt: '2026-03-29T10:00:00.000Z' },
            ],
            totalDocs: 2,
          }
        }
        if (collection === 'day-definitions') return { docs: [], totalDocs: 0 }
        if (collection === 'user-day-overrides') return { docs: [], totalDocs: 0 }
        return { docs: [], totalDocs: 0 }
      }),
    } as unknown as Payload

    const result = await validateDaySubmission(
      payload,
      123,
      null,
      null,
      999,
      null,
      null,
      null,
    )

    expect(result.allowed).toBe(true)
    expect(result.programDay).toBe(3)
  })

  it('switches the day form to a personality override linkedForm before falling back to the general schedule', async () => {
    const personalityOverrideFormId = 202
    const generalScheduleFormId = 301

    const payload = {
      findGlobal: vi.fn(async ({ slug }: { slug: string }) => {
        if (slug === 'day-program') {
          return {
            activeCurriculumReleaseKey: 'v-test',
            defaultSchedule: { '1': generalScheduleFormId },
          }
        }
        return null
      }),
      findByID: vi.fn(async ({ collection, id }: { collection: string; id?: number | string }) => {
        if (collection === 'users') return { id: 123, programStatus: 'test' }
        if (collection === 'founder-forms' && String(id) === String(personalityOverrideFormId)) {
          return { id: personalityOverrideFormId, slug: 'daily-day-block-1-guardian', title: 'Day 1 — Guardian' }
        }
        if (collection === 'founder-forms' && String(id) === String(generalScheduleFormId)) {
          return { id: generalScheduleFormId, slug: 'daily-day-block-1-general', title: 'Day 1 — General' }
        }
        return null
      }),
      find: vi.fn(async ({ collection, where }: { collection: string; where?: Record<string, any> }) => {
        if (collection === 'attempts') return { docs: [], totalDocs: 0 }
        if (collection === 'founder-form-submissions') return { docs: [], totalDocs: 0 }
        if (collection === 'user-day-overrides') return { docs: [], totalDocs: 0 }
        if (collection === 'day-definitions' && where?.blockKey?.equals === 'DAY-BLOCK-1') {
          return {
            docs: [
              {
                id: 1,
                blockKey: 'DAY-BLOCK-1',
                definitionKind: 'base',
                releaseKey: 'v-test',
                vertical: 'General',
                personality: 'General',
                track: 'General',
                linkedForm: 101,
                dayNumber: 1,
                blockType: 'day',
              },
              {
                id: 2,
                blockKey: 'DAY-BLOCK-1',
                definitionKind: 'override',
                releaseKey: 'v-test',
                vertical: 'General',
                personality: 'Guardian',
                track: 'General',
                linkedForm: personalityOverrideFormId,
                dayNumber: 1,
                blockType: 'day',
              },
            ],
            totalDocs: 2,
          }
        }
        if (collection === 'day-definitions') return { docs: [], totalDocs: 0 }
        return { docs: [], totalDocs: 0 }
      }),
    } as unknown as Payload

    const progression = await getActiveProgramDay(
      payload,
      123,
      null,
      'Bat Radar',
      null,
      null,
    )

    expect(progression.activeDay).toBe(1)
    expect(progression.resolvedFormId).toBe(personalityOverrideFormId)
    expect(progression.dailyFormSlug).toBe('daily-day-block-1-guardian')

    const allowed = await validateDaySubmission(
      payload,
      123,
      null,
      'Bat Radar',
      personalityOverrideFormId,
      null,
      null,
      1,
    )

    expect(allowed.allowed).toBe(true)
    expect(allowed.programDay).toBe(1)

    const rejected = await validateDaySubmission(
      payload,
      123,
      null,
      'Bat Radar',
      generalScheduleFormId,
      null,
      null,
      1,
    )

    expect(rejected.allowed).toBe(false)
    expect(rejected.programDay).toBe(1)
    expect(rejected.error).toBe('Incorrect form for requested day')
  })

  it('maps weekly retro form slugs to their actual program day', async () => {
    const payload = {
      findGlobal: vi.fn().mockResolvedValue(null),
      findByID: vi.fn(async ({ collection, id }: { collection: string; id?: number | string }) => {
        if (collection === 'users') return { id: 123, programStatus: 'test' }
        if (collection === 'founder-forms' && String(id) === '241') {
          return { id: 241, slug: 'daily-week-block-5' }
        }
        return null
      }),
      find: vi.fn(async ({ collection }: { collection: string }) => {
        if (collection === 'attempts') return { docs: [], totalDocs: 0 }
        if (collection === 'founder-form-submissions') return { docs: [], totalDocs: 0 }
        if (collection === 'day-definitions') return { docs: [], totalDocs: 0 }
        if (collection === 'user-day-overrides') return { docs: [], totalDocs: 0 }
        return { docs: [], totalDocs: 0 }
      }),
    } as unknown as Payload

    const result = await validateDaySubmission(
      payload,
      123,
      null,
      null,
      241,
      null,
      null,
      null,
    )

    expect(result.allowed).toBe(true)
    expect(result.programDay).toBe(35)
  })

  it.each(retroDayCases)(
    'maps weekly retro slug daily-week-block-$week to program day $day',
    async ({ day, week }) => {
      const formId = 800 + week
      const payload = {
        findGlobal: vi.fn().mockResolvedValue(null),
        findByID: vi.fn(async ({ collection, id }: { collection: string; id?: number | string }) => {
          if (collection === 'users') return { id: 123, programStatus: 'test' }
          if (collection === 'founder-forms' && String(id) === String(formId)) {
            return { id: formId, slug: `daily-week-block-${week}` }
          }
          return null
        }),
        find: vi.fn(async ({ collection }: { collection: string }) => {
          if (collection === 'attempts') return { docs: [], totalDocs: 0 }
          if (collection === 'founder-form-submissions') return { docs: [], totalDocs: 0 }
          if (collection === 'day-definitions') return { docs: [], totalDocs: 0 }
          if (collection === 'user-day-overrides') return { docs: [], totalDocs: 0 }
          return { docs: [], totalDocs: 0 }
        }),
      } as unknown as Payload

      const result = await validateDaySubmission(
        payload,
        123,
        null,
        null,
        formId,
        null,
        null,
        null,
      )

      expect(result.allowed).toBe(true)
      expect(result.programDay).toBe(day)
    },
  )

  it.each([
    ...retroDayCases.map(({ day, week }) => ({
      day,
      blockKey: `WEEK-BLOCK-${week}`,
      formId: 900 + week,
    })),
    ...gateDayCases.map((day) => ({
      day,
      blockKey: `GATE-BLOCK-${day}`,
      formId: 1000 + day,
    })),
  ])(
    'resolves the correct linked form for special day $day via $blockKey',
    async ({ day, blockKey, formId }) => {
      const findMock = vi.fn(async ({ collection, where }: { collection: string; where?: Record<string, any> }) => {
        if (collection === 'attempts') return { docs: [], totalDocs: 0 }
        if (collection === 'founder-form-submissions') return { docs: [], totalDocs: 0 }
        if (collection === 'day-definitions' && where?.blockKey?.equals === blockKey) {
          return { docs: [{ linkedForm: formId }], totalDocs: 1 }
        }
        if (collection === 'day-definitions') return { docs: [], totalDocs: 0 }
        if (collection === 'user-day-overrides') return { docs: [], totalDocs: 0 }
        return { docs: [], totalDocs: 0 }
      })

      const payload = {
        findGlobal: vi.fn().mockResolvedValue(null),
        findByID: vi.fn(async ({ collection }: { collection: string }) => {
          if (collection === 'users') return { id: 123, programStatus: 'test' }
          return null
        }),
        find: findMock,
      } as unknown as Payload

      const result = await validateDaySubmission(
        payload,
        123,
        null,
        null,
        formId,
        null,
        null,
        day,
      )

      expect(result.allowed).toBe(true)
      expect(result.programDay).toBe(day)
      expect(findMock).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'day-definitions',
          where: { blockKey: { equals: blockKey } },
        }),
      )
    },
  )

  it('rejects the wrong form for a requested retro day in test mode', async () => {
    const payload = {
      findGlobal: vi.fn().mockResolvedValue(null),
      findByID: vi.fn(async ({ collection }: { collection: string }) => {
        if (collection === 'users') return { id: 123, programStatus: 'test' }
        return null
      }),
      find: vi.fn(async ({ collection, where }: { collection: string; where?: Record<string, any> }) => {
        if (collection === 'attempts') return { docs: [], totalDocs: 0 }
        if (collection === 'founder-form-submissions') return { docs: [], totalDocs: 0 }
        if (collection === 'day-definitions' && where?.blockKey?.equals === 'WEEK-BLOCK-5') {
          return { docs: [{ linkedForm: 241 }], totalDocs: 1 }
        }
        if (collection === 'day-definitions') return { docs: [], totalDocs: 0 }
        if (collection === 'user-day-overrides') return { docs: [], totalDocs: 0 }
        return { docs: [], totalDocs: 0 }
      }),
    } as unknown as Payload

    const result = await validateDaySubmission(
      payload,
      123,
      null,
      null,
      169,
      null,
      null,
      35,
    )

    expect(result.allowed).toBe(false)
    expect(result.programDay).toBe(35)
    expect(result.error).toBe('Incorrect form for requested day')
  })

  it('blocks duplicate submissions for the same test-mode day', async () => {
    const payload = {
      findGlobal: vi.fn().mockResolvedValue(null),
      findByID: vi.fn(async ({ collection }: { collection: string }) => {
        if (collection === 'users') return { id: 123, programStatus: 'test' }
        return null
      }),
      find: vi.fn(async ({ collection, where }: { collection: string; where?: Record<string, any> }) => {
        if (collection === 'attempts') return { docs: [{ id: 77 }], totalDocs: 1 }
        if (collection === 'founder-form-submissions' && where?.and?.some?.((clause: any) => clause?.programDay?.equals === 17)) {
          return { docs: [{ id: 999, programDay: 17 }], totalDocs: 1 }
        }
        if (collection === 'founder-form-submissions') return { docs: [], totalDocs: 0 }
        if (collection === 'day-definitions') return { docs: [], totalDocs: 0 }
        if (collection === 'user-day-overrides') return { docs: [], totalDocs: 0 }
        return { docs: [], totalDocs: 0 }
      }),
    } as unknown as Payload

    const result = await validateDaySubmission(
      payload,
      123,
      null,
      null,
      999,
      null,
      null,
      17,
    )

    expect(result.allowed).toBe(false)
    expect(result.error).toBe('Already submitted for this day')
    expect(result.programDay).toBe(17)
  })
})

describe('PRD 2.4: estimated time sanitization', () => {
  it('drops invalid spreadsheet serials from estimated-time metadata', () => {
    expect(normalizeEstimatedTimeHrs(46027)).toBeNull()
    expect(normalizeEstimatedTimeHrs(46058)).toBeNull()
    expect(normalizeEstimatedTimeHrs(3.25)).toBe(3.3)
  })
})

describe('PRD 2.4: dashboard progress card', () => {
  it('uses the current IC gate checkpoints from the program calendar', () => {
    const progress = computeProgramProgress(17, {})

    expect(progress?.gates).toEqual([
      { day: 15, label: 'Day 15 — IC Gate #1' },
      { day: 30, label: 'Day 30 — IC Gate #2' },
      { day: 50, label: 'Day 50 — IC Gate #3' },
      { day: 70, label: 'Day 70 — IC Gate #4' },
      { day: 94, label: 'Day 94 — IC Gate #5 (final internal)' },
    ])
  })

  it('shows the highest completed day on the dashboard while keeping next day progression separate', () => {
    expect(getProgressDisplayDay(18, [1, 2, 17])).toBe(17)
    expect(getProgressDisplayDay(1, [])).toBe(1)
  })

  it('upgrades legacy partner branding gates to the current IC gate set', () => {
    expect(normalizeProgramGates([
      { day: 30, label: 'Day 30 — First Review' },
      { day: 60, label: 'Day 60 — Mid-Program Gate' },
      { day: 100, label: 'Day 100 — Final Gate' },
    ])).toEqual([
      { day: 15, label: 'Day 15 — IC Gate #1' },
      { day: 30, label: 'Day 30 — IC Gate #2' },
      { day: 50, label: 'Day 50 — IC Gate #3' },
      { day: 70, label: 'Day 70 — IC Gate #4' },
      { day: 94, label: 'Day 94 — IC Gate #5 (final internal)' },
    ])
  })
})

describe('PRD 2.4: private documents access', () => {
  it('allows the owner to read a private document', () => {
    expect(
      canUserReadDocument(
        { visibility: 'private', owner: 10, ownerPartner: 100 },
        { id: 10, role: 'founder' },
      ),
    ).toBe(true)
  })

  it('blocks a partner from reading another partner’s private document', () => {
    expect(
      canUserReadDocument(
        { visibility: 'private', owner: 10, ownerPartner: 100 },
        { id: 99, role: 'partner', partner: 200 },
      ),
    ).toBe(false)
  })

  it('allows a partner to read a founder document only within the same partner scope', () => {
    expect(
      canUserReadDocument(
        { visibility: 'private', owner: 10, ownerPartner: 100 },
        { id: 99, role: 'partner', partner: 100 },
      ),
    ).toBe(true)
  })
})

describe('PRD 2.4: uploaded proof handling', () => {
  it('detects local document download paths as artifact references', () => {
    expect(
      extractArtifactReference({ proof: '/api/documents/doc-token-55/download' }),
    ).toEqual({
      value: '/api/documents/doc-token-55/download',
      kind: 'document_download',
      documentLocator: 'doc-token-55',
    })
  })

  it('stores uploaded documents as reachable file proofs during auto-check', async () => {
    const createMock = vi.fn(async ({ data }: { data: Record<string, unknown> }) => data)
    const findByIDMock = vi.fn()
    const findMock = vi.fn(async ({ collection, where }: { collection: string; where?: Record<string, any> }) => {
      if (collection === 'documents' && where?.downloadToken?.equals === 'doc-token-55') {
        return {
          docs: [
            {
              id: 55,
              downloadToken: 'doc-token-55',
              url: 'https://blob.example.test/private.pdf',
              mimeType: 'application/pdf',
            },
          ],
        }
      }

      if (collection === 'day-definitions') return { docs: [] }

      return { totalDocs: 0, docs: [] }
    })
    const payload = {
      find: findMock,
      findGlobal: vi.fn().mockResolvedValue(null),
      findByID: findByIDMock,
      create: createMock,
    } as unknown as Payload

    await runAutoCheck(
      payload,
      1,
      2,
      3,
      4,
      { artifact: '/api/documents/doc-token-55/download' },
      99,
    )

    expect(findMock).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'documents',
        where: expect.objectContaining({
          downloadToken: { equals: 'doc-token-55' },
        }),
      }),
    )
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'auto-check-results',
        data: expect.objectContaining({
          dayNumber: 4,
          checksPassed: true,
          linkReachable: true,
          linkUrl: '/api/documents/doc-token-55/download',
          proofType: 'file_pdf',
        }),
      }),
    )
  })
})

describe('PRD 2.4: project description drafting', () => {
  it('ignores single-letter placeholder answers when drafting the project description', () => {
    const form = {
      sections: [
        {
          id: 'idea_a',
          questions: [
            { question_id: 'one_liner', question_text: 'One liner (what you want to build + for whom)' },
            { question_id: 'industry_general', question_text: 'Industry / vertical (general)' },
            { question_id: 'solution', question_text: 'Proposed solution (MVP) (2-4 sentences)' },
          ],
        },
      ],
    }

    expect(
      extractProjectIdeaSectionDescription(form, {
        one_liner: 'a',
        industry_general: 'Commerce & Retail',
        solution: 'Urban air quality analytics platform for municipalities across Europe.',
      }),
    ).toBe(
      'Industry / vertical (general): Commerce & Retail\n' +
      'Proposed solution (MVP) (2-4 sentences): Urban air quality analytics platform for municipalities across Europe.',
    )
  })

  it('treats legacy auto-drafted pending project descriptions as empty for editing', () => {
    expect(
      normalizeProjectDescriptionForEditing(
        'Industry / vertical (general): Commerce & Retail',
        'Industry / vertical (general): Commerce & Retail',
        'pending',
      ),
    ).toBe('')

    expect(
      normalizeProjectDescriptionForEditing(
        'Founder-written custom summary',
        'Industry / vertical (general): Commerce & Retail',
        'pending',
      ),
    ).toBe('Founder-written custom summary')
  })
})

describe('PRD 2.4: attempt allocation lookup', () => {
  it('does not recurse forever when a founder has no team', async () => {
    const findByIDMock = vi.fn().mockResolvedValue({
      id: 123,
      team: null,
    })
    const payload = {
      findByID: findByIDMock,
    } as unknown as Payload

    await expect(
      getEffectiveMaxAttemptsForUser(
        payload,
        { id: 123, team: null },
        'self_paid',
        DEFAULT_PROGRAM_CONFIG,
      ),
    ).resolves.toBe(3)

    expect(findByIDMock).toHaveBeenCalledTimes(1)
  })
})
