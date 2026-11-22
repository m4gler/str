import { describe, expect, it } from 'vitest'
import { calculateScores } from '@/lib/scoring'

function buildNeutralResponses() {
  const responses: Record<string, number> = {}

  for (const prefix of ['E', 'A', 'C', 'N', 'O'] as const) {
    for (let index = 1; index <= 4; index++) {
      responses[`${prefix}${index}`] = 3
    }
  }

  for (let index = 1; index <= 5; index++) {
    responses[`SE${index}`] = 3
    responses[`RT${index}`] = 3
  }

  return responses
}

describe('calculateScores', () => {
  it('returns Anchor as the default fallback archetype', () => {
    const scores = calculateScores(buildNeutralResponses())

    expect(scores.archetype).toBe('Anchor')
    expect(scores.archetypeEmoji).toBe('⚓')
    expect(scores.archetypeTagline).toBe('Balanced, Relentless Operator')
  })

  it('returns Explorer when QC checks fail', () => {
    const scores = calculateScores({
      ...buildNeutralResponses(),
      S1_ATTN: 1,
      S2_HONESTY: 5,
    })

    expect(scores.archetype).toBe('Explorer')
    expect(scores.archetypeEmoji).toBe('🧭')
    expect(scores.archetypeTagline).toBe('Needs Calibration')
    expect(scores.track).toBe('Starter Track')
  })
})
