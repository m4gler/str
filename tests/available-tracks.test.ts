import { describe, expect, it } from 'vitest'
import { buildAvailableTrackOptions, isSpaceTrackSlug, resolveTrackDescription } from '@/lib/availableTracks'

describe('available track descriptions', () => {
  it('falls back to PlatformSettings track copy when the collection description is missing or placeholder text', () => {
    const platformTracks = [
      {
        key: 'edutech',
        name: 'EduTech',
        desc: 'Transform education through technology across K-12, higher education, workforce learning, and corporate training.',
      },
      {
        key: 'satc',
        name: 'Space & the City',
        desc: 'Use satellite data, geolocation, and Earth observation to solve real urban, civic, agricultural, or consumer problems.',
      },
    ]

    const tracks = buildAvailableTrackOptions(
      [
        { id: 1, name: 'EduTech', slug: 'edutech', description: '' },
        { id: 2, name: 'Space & City', slug: 'space', description: 'test' },
      ],
      platformTracks,
    )

    expect(tracks).toEqual([
      {
        id: 1,
        name: 'EduTech',
        slug: 'edutech',
        description: 'Transform education through technology across K-12, higher education, workforce learning, and corporate training.',
      },
      {
        id: 2,
        name: 'Space & City',
        slug: 'space',
        description: 'Use satellite data, geolocation, and Earth observation to solve real urban, civic, agricultural, or consumer problems.',
      },
    ])
  })

  it('keeps an explicit non-placeholder track description', () => {
    const description = resolveTrackDescription(
      {
        name: 'Defence & Dual Use',
        slug: 'dual-use',
        description:
          'Build technology that works where failure is not an option.',
      },
      [
        {
          key: 'dadu',
          name: 'Defence & Dual Use',
          desc: 'Fallback copy that should not replace the live track description.',
        },
      ],
    )

    expect(description).toBe('Build technology that works where failure is not an option.')
  })
})

describe('space track classification', () => {
  it.each([
    'satc',
    'space',
    'space-city',
    'Space & City',
    'space_and_the_city',
  ])('recognizes the supported space alias %s', (slug) => {
    expect(isSpaceTrackSlug(slug)).toBe(true)
  })

  it.each(['general', 'edutech', 'dadu', '', null, undefined])(
    'rejects the non-space value %s',
    (slug) => {
      expect(isSpaceTrackSlug(slug)).toBe(false)
    },
  )
})
