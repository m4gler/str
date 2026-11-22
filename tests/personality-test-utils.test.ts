import { describe, expect, it } from 'vitest'

import {
  getActivePersonalityTestFormId,
  isActivePersonalityTestSubmission,
  resolveArchetypeDisplay,
} from '@/lib/personalityTest'

describe('personality test helpers', () => {
  it('extracts active personality form id from payload relation values', () => {
    expect(getActivePersonalityTestFormId({ activePersonalityTestForm: 3 })).toBe('3')
    expect(getActivePersonalityTestFormId({ activePersonalityTestForm: { id: 7 } })).toBe('7')
    expect(getActivePersonalityTestFormId({ activePersonalityTestForm: null })).toBeNull()
  })

  it('detects whether a submission belongs to the active personality form', () => {
    const settings = { activePersonalityTestForm: { id: 3 } }

    expect(isActivePersonalityTestSubmission(3, settings)).toBe(true)
    expect(isActivePersonalityTestSubmission({ id: 3 }, settings)).toBe(true)
    expect(isActivePersonalityTestSubmission({ id: 4 }, settings)).toBe(false)
  })

  it('normalizes legacy archetype labels to canonical display values', () => {
    expect(
      resolveArchetypeDisplay('Moon Raker', {
        emoji: '🌕',
        tagline: 'See the Market Before It Is Obvious',
      }),
    ).toEqual({
      key: 'Seeker',
      emoji: '🔍',
      tagline: "See the Market Before It's Obvious",
    })
  })
})
