import { describe, expect, it } from 'vitest'
import { buildNormalizedArchetypeMap, normalizePlatformSettingsDoc } from '@/lib/personalityConfig'

describe('personality config normalization', () => {
  it('normalizes legacy platform archetype keys to canonical names', () => {
    const normalized = normalizePlatformSettingsDoc({
      companyName: 'MESGA',
      personality: {
        archetypes: [
          { key: 'Bob the Beaver', emoji: '🦫', tagline: 'Ship It, Fix It, Ship Again' },
          { key: 'Deal Closer', emoji: '💼', tagline: 'Close Fast, Keep Leverage' },
          { key: 'The General', emoji: '🪖' },
        ],
      },
    })

    expect(normalized.personality.archetypes.map((archetype: any) => archetype.key)).toEqual([
      'Builder',
      'Driver',
      'Anchor',
    ])
    expect(normalized.personality.archetypes.map((archetype: any) => archetype.emoji)).toEqual([
      '⚒️',
      '⚡',
      '⚓',
    ])
    expect(normalized.personality.archetypes[2].tagline).toBe('Balanced, Relentless Operator')
  })

  it('builds a normalized lookup map from legacy and emoji-prefixed archetype keys', () => {
    const archetypeMap = buildNormalizedArchetypeMap([
      { key: 'Moon Raker', emoji: '🌕' },
      { key: '🛡️ Guardian', emoji: '🧭' },
    ])

    expect(Object.keys(archetypeMap)).toEqual(['Seeker', 'Guardian'])
    expect(archetypeMap['Seeker'].emoji).toBe('🔍')
    expect(archetypeMap['Guardian'].key).toBe('Guardian')
  })
})
