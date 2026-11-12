export const PREFERRED_TRACK_COOKIE = 'preferred-track'
export const DEFAULT_TRACK_SLUG = 'general'

export type PreferredTrackOption = {
  id: number | string
  slug: string
}

type TrackVisual = {
  icon: string
  color: string
}

const TRACK_VISUALS: Record<string, TrackVisual> = {
  general: { icon: '⚡', color: '#2CB1A1' },
  satc: { icon: '🌆', color: '#E4B94D' },
  edutech: { icon: '🎓', color: '#0b9df7' },
  dadu: { icon: '🛡️', color: '#6EA8FF' },
  'dual-use': { icon: '🛡️', color: '#6EA8FF' },
  dualuse: { icon: '🛡️', color: '#6EA8FF' },
  space: { icon: '🚀', color: '#a855f7' },
  it: { icon: '💻', color: '#38bdf8' },
  fintech: { icon: '🏦', color: '#f59e0b' },
}

export function setPreferredTrackCookie(trackSlug: string) {
  if (typeof document === 'undefined' || !trackSlug) return

  const safeSlug = encodeURIComponent(trackSlug)
  document.cookie = `${PREFERRED_TRACK_COOKIE}=${safeSlug}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`
}

export function resolvePreferredTrackSlug<T extends { slug: string }>(
  preferredTrackSlug: string | null | undefined,
  availableTracks: T[],
): string | null {
  const normalized = preferredTrackSlug?.trim().toLowerCase() || null
  if (normalized && availableTracks.some((track) => track.slug === normalized)) {
    return normalized
  }

  if (availableTracks.some((track) => track.slug === DEFAULT_TRACK_SLUG)) {
    return DEFAULT_TRACK_SLUG
  }

  return availableTracks[0]?.slug ?? null
}

export function resolvePreferredTrackId<T extends PreferredTrackOption>(
  preferredTrackSlug: string | null | undefined,
  availableTracks: T[],
): number | string | null {
  const resolvedSlug = resolvePreferredTrackSlug(preferredTrackSlug, availableTracks)
  if (!resolvedSlug) return null
  return availableTracks.find((track) => track.slug === resolvedSlug)?.id ?? null
}

export function getPreferredTrackVisual(trackSlug: string | null | undefined): TrackVisual {
  return TRACK_VISUALS[trackSlug || ''] ?? { icon: '🎯', color: '#2CB1A1' }
}
