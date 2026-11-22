import { CANONICAL_ARCHETYPES, GENERAL_DIMENSION_VALUE, normalizeArchetypeKey } from '@/lib/curriculum/constants'
import { buildNormalizedArchetypeMap } from '@/lib/personalityConfig'

const CANONICAL_ARCHETYPE_MAP = Object.fromEntries(
  CANONICAL_ARCHETYPES.map((archetype) => [archetype.key, archetype]),
)

export function getActivePersonalityTestFormId(platformSettings: any): string | null {
  const raw = platformSettings?.activePersonalityTestForm

  if (raw == null) return null
  if (typeof raw === 'object') {
    const id = raw?.id
    return id == null ? null : String(id)
  }

  return String(raw)
}

export function isActivePersonalityTestSubmission(
  form: unknown,
  platformSettings: any,
): boolean {
  const activePersonalityTestFormId = getActivePersonalityTestFormId(platformSettings)
  if (!activePersonalityTestFormId) return false

  const formId =
    typeof form === 'object' && form && 'id' in form
      ? (form as { id?: number | string | null }).id
      : form

  if (formId == null) return false
  return String(formId) === activePersonalityTestFormId
}

export function resolveArchetypeDisplay(
  rawArchetype: string | null | undefined,
  options?: {
    archetypes?: any
    emoji?: string | null
    tagline?: string | null
  },
): {
  key: string | null
  emoji: string | null
  tagline: string | null
} {
  const normalizedKey = normalizeArchetypeKey(rawArchetype)
  if (!rawArchetype || normalizedKey === GENERAL_DIMENSION_VALUE) {
    return {
      key: null,
      emoji: options?.emoji ?? null,
      tagline: options?.tagline ?? null,
    }
  }

  const payloadMeta = buildNormalizedArchetypeMap(options?.archetypes)[normalizedKey] ?? null
  const canonicalMeta = CANONICAL_ARCHETYPE_MAP[normalizedKey] ?? null

  return {
    key: normalizedKey,
    emoji: payloadMeta?.emoji || canonicalMeta?.emoji || options?.emoji || null,
    tagline: payloadMeta?.tagline || canonicalMeta?.tagline || options?.tagline || null,
  }
}
