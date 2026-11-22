import { CANONICAL_ARCHETYPES, normalizeArchetypeKey } from '@/lib/curriculum/constants'

const CANONICAL_ARCHETYPE_META = Object.fromEntries(
  CANONICAL_ARCHETYPES.map((archetype) => [archetype.key, archetype]),
)

export function normalizePlatformArchetype(archetype: any) {
  if (!archetype || typeof archetype !== 'object') return archetype

  const rawKey = typeof archetype.key === 'string' ? archetype.key.trim() : ''
  const key = rawKey ? normalizeArchetypeKey(rawKey) : ''
  const meta = CANONICAL_ARCHETYPE_META[key]

  return {
    ...archetype,
    key,
    emoji: meta?.emoji || archetype.emoji || '',
    tagline: archetype.tagline || meta?.tagline || '',
  }
}

export function normalizePlatformArchetypes(archetypes: any) {
  if (!Array.isArray(archetypes)) return archetypes
  return archetypes.map((archetype) => normalizePlatformArchetype(archetype))
}

const LANDING_CHALLENGE_PILLS = [
  { key: 'general', label: 'General' },
  { key: 'education', label: 'Education' },
  { key: 'space', label: 'Space' },
  { key: 'urban', label: 'Urban' },
  { key: 'other', label: 'Other' },
  { key: 'dualuse', label: 'Dual Use' },
] as const

const GENERAL_CHALLENGE_DESC = 'Use the 100-day MESGA structure for a sector-agnostic startup: sharpen the problem, validate demand, build evidence, and prepare for review without forcing the company into a specialist track.'
const TRACK_CHALLENGE_ORDER: Record<string, string[]> = {
  general: ['general'],
  edutech: ['education'],
  satc: ['space', 'urban', 'other'],
  dadu: ['dualuse'],
}

function normalizeChallengeToken(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '')
}

function normalizeLandingChallengeKey(value: unknown, trackKey?: string): string {
  const token = normalizeChallengeToken(value)
  const trackToken = normalizeChallengeToken(trackKey)

  if (!token) return ''

  if (
    trackToken === 'general' &&
    ['academic', 'academicinstitution', 'financial', 'financialinstitution', 'technology', 'technologycompany', 'blockchain'].includes(token)
  ) {
    return 'general'
  }

  if (token === 'academic') return 'education'
  if (token === 'downstream') return 'urban'
  if (token === 'spacetech' || token === 'spacetechnology' || token === 'spacetechchallenge') return 'space'
  if (token === 'spacetechtrack' || token === 'space') return 'space'
  if (token === 'blockchain') return 'other'
  if (token === 'dualuse' || token === 'defencedualuse' || token === 'defenseanddualuse') return 'dualuse'

  return token
}

function canonicalChallengeTitle(key: string): string | null {
  return LANDING_CHALLENGE_PILLS.find((pill) => pill.key === key)?.label ?? null
}

function sortLandingTrackChallenges(trackKey: string, challenges: Array<{ key: string; title: string; desc: string }>) {
  const order = TRACK_CHALLENGE_ORDER[normalizeChallengeToken(trackKey)]
  if (!order) return challenges

  return [...challenges].sort((left, right) => {
    const leftIndex = order.indexOf(left.key)
    const rightIndex = order.indexOf(right.key)
    const normalizedLeft = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex
    const normalizedRight = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex
    return normalizedLeft - normalizedRight
  })
}

function normalizeLandingChallengePills(challengePills: any) {
  if (!Array.isArray(challengePills) || challengePills.length === 0) {
    return [...LANDING_CHALLENGE_PILLS]
  }

  const knownPills = new Map<string, { key: string; label: string }>(LANDING_CHALLENGE_PILLS.map((pill) => [pill.key, { ...pill }]))
  const normalized = challengePills.reduce<Array<{ key: string; label: string }>>((acc, pill) => {
    if (!pill || typeof pill !== 'object') return acc

    const mappedKey = normalizeLandingChallengeKey(pill.key)
    const canonical = knownPills.get(mappedKey)

    if (!mappedKey || !canonical) return acc

    acc.push({
      key: canonical.key,
      label: canonical.label,
    })
    return acc
  }, [])

  const deduped = normalized.filter((pill, index, array) => array.findIndex((item) => item.key === pill.key) === index)
  if (deduped.length === 0) return [...LANDING_CHALLENGE_PILLS]

  return LANDING_CHALLENGE_PILLS.map((pill) => deduped.find((item) => item.key === pill.key) ?? { ...pill })
}

function normalizeLandingTrack(track: any) {
  if (!track || typeof track !== 'object') return track

  const rawKey = typeof track.key === 'string' ? track.key.trim().toLowerCase() : ''
  const trackKey = rawKey || track.key
  const normalizedChallenges = Array.isArray(track.challenges)
    ? (track.challenges as any[]).reduce<Array<{ key: string; title: string; desc: string }>>((acc, challenge: any) => {
        if (!challenge || typeof challenge !== 'object') return acc
        const key = normalizeLandingChallengeKey(challenge.key, trackKey)

        if (!key) return acc

        acc.push({
          ...challenge,
          key,
          title: canonicalChallengeTitle(key) || (typeof challenge.title === 'string' ? challenge.title : ''),
          desc: typeof challenge.desc === 'string' ? challenge.desc : '',
        })
        return acc
      }, [])
    : track.challenges

  return {
    ...track,
    key: trackKey,
    challenges: trackKey === 'general'
      ? [{ key: 'general', title: 'General', desc: GENERAL_CHALLENGE_DESC }]
      : sortLandingTrackChallenges(String(trackKey), normalizedChallenges || []),
  }
}

function normalizeLandingTracks(tracks: any) {
  if (!Array.isArray(tracks)) return tracks
  return tracks.map((track) => normalizeLandingTrack(track))
}

export function normalizePlatformSettingsDoc(doc: any) {
  if (!doc || typeof doc !== 'object') return doc

  return {
    ...doc,
    challengePills: normalizeLandingChallengePills(doc.challengePills),
    tracks: normalizeLandingTracks(doc.tracks),
    personality: doc.personality && typeof doc.personality === 'object'
      ? {
        ...doc.personality,
        archetypes: normalizePlatformArchetypes(doc.personality.archetypes),
      }
      : doc.personality,
  }
}

export function buildNormalizedArchetypeMap(archetypes: any): Record<string, any> {
  if (!Array.isArray(archetypes)) return {}

  return Object.fromEntries(
    archetypes
      .map((archetype) => normalizePlatformArchetype(archetype))
      .filter((archetype) => archetype?.key)
      .map((archetype) => [archetype.key, archetype]),
  )
}
