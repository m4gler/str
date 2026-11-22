import { describe, expect, it } from 'vitest'
import {
  buildFounderFormLookup,
  buildWorkbookStats,
  filterToActiveRelease,
  getDerivedProgramKind,
  getDerivedProgramLabel,
  mapFounderFormSummary,
  normalizeDayProgramConfig,
  resolveDefinitionQuestions,
} from '@/lib/dayDefinitionAdmin'

describe('dayDefinitionAdmin helpers', () => {
  it('filters to the active release when matching docs exist', () => {
    const docs = [
      { id: 1, releaseKey: 'v5.0' },
      { id: 2, releaseKey: 'v6.3' },
      { id: 3, releaseKey: 'v6.3' },
    ]

    expect(filterToActiveRelease(docs, 'v6.3').map((doc) => doc.id)).toEqual([2, 3])
  })

  it('falls back to all docs when the active release is absent', () => {
    const docs = [
      { id: 1, releaseKey: 'v5.0' },
      { id: 2, releaseKey: 'v5.0' },
    ]

    expect(filterToActiveRelease(docs, 'v6.3').map((doc) => doc.id)).toEqual([1, 2])
  })

  it('derives gate and weekly semantics from day-program config with gate precedence', () => {
    const config = normalizeDayProgramConfig({
      gateDays: [14, 28],
      retroEveryNDays: 7,
    })

    expect(getDerivedProgramKind(14, config)).toBe('gate')
    expect(getDerivedProgramLabel(getDerivedProgramKind(14, config))).toBe('Gate Day')
    expect(getDerivedProgramKind(21, config)).toBe('weekly')
    expect(getDerivedProgramLabel(getDerivedProgramKind(21, config))).toBe('Weekly Retro')
    expect(getDerivedProgramKind(8, config)).toBe('standard')
  })

  it('prefers linked-form questions and does not fall back to legacy questions when a link exists', () => {
    const forms = [
      mapFounderFormSummary({
        id: 101,
        title: 'Day 1 Form',
        slug: 'daily-day-block-1',
        sections: [
          {
            id: 'section-1',
            title: 'Section',
            questions: [
              {
                question_id: 'DP1-001',
                question_text: 'Link / Resource',
                question_type: 'url',
                required: true,
                helperText: 'Submit your artifact link.',
              },
            ],
          },
        ],
      }),
    ]

    const lookup = buildFounderFormLookup(forms)
    const resolved = resolveDefinitionQuestions(
      {
        linkedForm: 101,
        questions: [
          {
            questionId: 'LEGACY-1',
            questionTitle: 'Legacy question',
            questionType: 'short_text',
            required: true,
            description: 'Should not be used when linkedForm exists.',
          },
        ],
      },
      lookup,
    )

    expect(resolved.source).toBe('linked_form')
    expect(resolved.questions).toHaveLength(1)
    expect(resolved.questions[0].questionId).toBe('DP1-001')
  })

  it('falls back to embedded legacy questions only when no linked form exists', () => {
    const resolved = resolveDefinitionQuestions(
      {
        linkedForm: null,
        questions: [
          {
            questionId: 'LEGACY-1',
            questionTitle: 'Legacy question',
            questionType: 'short_text',
            required: true,
            description: 'Manual fallback',
          },
        ],
      },
      new Map(),
    )

    expect(resolved.source).toBe('legacy')
    expect(resolved.questions).toHaveLength(1)
    expect(resolved.questions[0].description).toBe('Manual fallback')
  })

  it('computes workbook-centric stats from base day definitions and keeps overrides separate', () => {
    const definitions = Array.from({ length: 100 }, (_, index) => ({
      blockType: 'day',
      definitionKind: 'base' as const,
      dayNumber: index + 1,
      linkedForm: index < 95 ? index + 1 : null,
    }))

    const stats = buildWorkbookStats(
      [
        ...definitions,
        { blockType: 'day', definitionKind: 'override' as const, dayNumber: 1, linkedForm: null },
        { blockType: 'day', definitionKind: 'override' as const, dayNumber: 7, linkedForm: null },
      ],
      normalizeDayProgramConfig({
        gateDays: [15, 30, 50, 70, 94],
        retroEveryNDays: 7,
      }),
    )

    expect(stats.baseDays).toBe(100)
    expect(stats.baseDaysWithLinkedForms).toBe(95)
    expect(stats.overrides).toBe(2)
    expect(stats.gateDays).toBe(5)
    expect(stats.weeklyRetroDays).toBe(13)
    expect(stats.standardDays).toBe(82)
  })
})
