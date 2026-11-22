type TrackRecordLike = {
  id: number
  name?: string | null
  slug?: string | null
  description?: string | null
}

type PlatformTrackLike = {
  key?: string | null
  name?: string | null
  desc?: string | null
}

type AvailableTrackOption = {
  id: number
  name: string
  slug: string
  description: string | null
}

const SPACE_TRACK_ALIASES = ['satc', 'space', 'spacecity', 'spaceandcity', 'spaceandthecity'] as const

const TRACK_ALIAS_GROUPS = [
  ['general', 'generaltrack'],
  ['edutech', 'edtech', 'educationtrack'],
  SPACE_TRACK_ALIASES,
  ['dadu', 'dualuse', 'defenceanddualuse', 'defenseanddualuse'],
] as const

const PLACEHOLDER_TRACK_DESCRIPTIONS = new Set([
  'test',
  'tbd',
  'todo',
  'placeholder',
  'comingsoon',
  'descriptioncomingsoon',
  'loremipsum',
])

function normalizeTrackToken(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '')
}

export function isSpaceTrackSlug(value: unknown): boolean {
  const token = normalizeTrackToken(value)
  return SPACE_TRACK_ALIASES.some((alias) => alias === token)
}

function expandTrackAliases(values: Array<unknown>): Set<string> {
  const tokens = new Set<string>()

  for (const value of values) {
    const token = normalizeTrackToken(value)
    if (!token) continue

    tokens.add(token)

    for (const group of TRACK_ALIAS_GROUPS) {
      if (!group.some((alias) => alias === token)) continue
      for (const alias of group) tokens.add(alias)
    }
  }

  return tokens
}

function hasSharedTrackIdentity(left: Set<string>, right: Set<string>): boolean {
  for (const token of left) {
    if (right.has(token)) return true
  }
  return false
}

function cleanDescription(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function isPlaceholderTrackDescription(value: unknown): boolean {
  const description = cleanDescription(value)
  if (!description) return true

  const normalized = normalizeTrackToken(description)
  if (PLACEHOLDER_TRACK_DESCRIPTIONS.has(normalized)) return true

  return description.length < 10 && /^[a-z0-9 .,_-]+$/i.test(description)
}

export function resolveTrackDescription(
  track: Pick<TrackRecordLike, 'name' | 'slug' | 'description'>,
  platformTracks: PlatformTrackLike[] | null | undefined,
): string | null {
  const directDescription = cleanDescription(track.description)
  if (!isPlaceholderTrackDescription(directDescription)) {
    return directDescription
  }

  const trackIdentity = expandTrackAliases([track.slug, track.name])

  for (const platformTrack of platformTracks || []) {
    const platformDescription = cleanDescription(platformTrack?.desc)
    if (!platformDescription) continue

    const platformIdentity = expandTrackAliases([platformTrack?.key, platformTrack?.name])
    if (hasSharedTrackIdentity(trackIdentity, platformIdentity)) {
      return platformDescription
    }
  }

  return directDescription || null
}

export function buildAvailableTrackOptions(
  tracks: TrackRecordLike[] | null | undefined,
  platformTracks: PlatformTrackLike[] | null | undefined,
): AvailableTrackOption[] {
  return (tracks || []).map((track) => ({
    id: track.id,
    name: String(track.name || ''),
    slug: String(track.slug || ''),
    description: resolveTrackDescription(track, platformTracks),
  }))
}
