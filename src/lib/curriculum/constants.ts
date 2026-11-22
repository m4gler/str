export const CURRICULUM_SOURCE_DEFAULT_PATH = 'MESGA_100Days_MASTER_v3.xlsx'
export const CURRICULUM_DEFAULT_RELEASE_KEY = 'v6.3'
export const CURRICULUM_SNAPSHOT_DIR = 'content/curriculum'
export const CURRICULUM_SNAPSHOT_JSON = `${CURRICULUM_SNAPSHOT_DIR}/snapshot.json`

export const GENERAL_DIMENSION_VALUE = 'General'
export const VERTICAL_VARIANT_MARKER = '▲ Vertical-specific'
export const PERSONALITY_VARIANT_MARKER = '◆ Archetype-specific'
export const TRACK_VARIANT_MARKER = '● Track injection'

export const CURRICULUM_META_SHEET = 'META'
export const CURRICULUM_DEV_NOTE_SHEET = 'DEV NOTE'
export const CURRICULUM_GENERAL_SHEET = 'GENERAL'
export const CURRICULUM_GENERAL_TEST_SHEET = 'GENERAL TEST'
export const CURRICULUM_PERSONALITY_GUIDE_SHEET = 'PERSONALITY GUIDE'

export const CURRICULUM_VERTICAL_SHEET_LABELS: Record<string, string> = {
  'SPACE & CITY': 'Space & City',
  EDUTECH: 'EduTech',
  FINTECH: 'FinTech',
  'DUAL USE': 'Dual Use',
  'SOFTWARE & DATA': 'Software & Data',
  'COMMERCE & RETAIL': 'Commerce & Retail',
  HEALTH: 'Health & Life Sciences',
  'MEDIA & GAMING': 'Media / Social / Gaming',
  'HARDWARE & IOT': 'Hardware / IoT / Industrial',
  MARTECH: 'Marketing & Sales Tech',
  'FOOD & AGRI': 'Food & Agriculture',
  'CLIMATE TECH': 'Energy & Environment',
  MOBILITY: 'Mobility & Transport',
  'LEGAL TECH': 'Legal Tech / Legal & IP',
}

export const CURRICULUM_VERTICAL_SHEETS = Object.keys(CURRICULUM_VERTICAL_SHEET_LABELS)

export type CanonicalArchetype = {
  key: string
  emoji: string
  tagline: string
  legacyKeys: string[]
}

export const CANONICAL_ARCHETYPES: CanonicalArchetype[] = [
  { key: 'Builder', emoji: '⚒️', tagline: 'Ship It, Fix It, Ship Again', legacyKeys: ['Bob the Beaver'] },
  { key: 'Driver', emoji: '⚡', tagline: 'Close Fast, Keep Leverage', legacyKeys: ['Deal Shark', 'Deal Closer'] },
  { key: 'Seeker', emoji: '🔍', tagline: "See the Market Before It's Obvious", legacyKeys: ['Eagle Eye', 'Moon Raker'] },
  { key: 'Architect', emoji: '📐', tagline: 'Find the Shortcut, Stay Invisible', legacyKeys: ['Secret Fox', 'Stealth Hacker'] },
  { key: 'Nexus', emoji: '🔗', tagline: 'Build the Hive, Trigger the Flywheel', legacyKeys: ['Queen Bee', 'Community Master'] },
  { key: 'Guardian', emoji: '🛡️', tagline: 'Spot Risks Early, Avoid Crashes', legacyKeys: ['Bat Radar', 'Risk Navigator'] },
  { key: 'Challenger', emoji: '🚀', tagline: 'Big Engine, Big Upside', legacyKeys: ['HIPO', 'Hippo'] },
  { key: 'Anchor', emoji: '⚓', tagline: 'Balanced, Relentless Operator', legacyKeys: ['Orca', 'The General', 'The General (Balanced Builder)', 'Balanced Builder'] },
  { key: 'Explorer', emoji: '🧭', tagline: 'Needs Calibration', legacyKeys: ['Chameleon'] },
]

export const ARCHETYPE_ALIAS_MAP = Object.fromEntries(
  CANONICAL_ARCHETYPES.flatMap((archetype) => [
    [archetype.key.toLowerCase(), archetype.key],
    ...archetype.legacyKeys.map((legacyKey) => [legacyKey.toLowerCase(), archetype.key] as const),
  ]),
)

export const CANONICAL_ARCHETYPE_MAP = Object.fromEntries(
  CANONICAL_ARCHETYPES.map((archetype) => [archetype.key, archetype]),
)

export const TRACK_LIKE_TO_VERTICAL_MAP: Record<string, string> = {
  general: GENERAL_DIMENSION_VALUE,
  'general track': GENERAL_DIMENSION_VALUE,
  satc: 'Space & City',
  space: 'Space & City',
  'space & city': 'Space & City',
  'space & the city': 'Space & City',
  edutech: 'EduTech',
  'edu tech': 'EduTech',
  fintech: 'FinTech',
  'financial services': 'FinTech',
  'dual use': 'Dual Use',
  'dual-use': 'Dual Use',
  software: 'Software & Data',
  'software & data': 'Software & Data',
  commerce: 'Commerce & Retail',
  'commerce & retail': 'Commerce & Retail',
  health: 'Health & Life Sciences',
  'health & life sciences': 'Health & Life Sciences',
  media: 'Media / Social / Gaming',
  gaming: 'Media / Social / Gaming',
  'media / social / gaming': 'Media / Social / Gaming',
  hardware: 'Hardware / IoT / Industrial',
  iot: 'Hardware / IoT / Industrial',
  industrial: 'Hardware / IoT / Industrial',
  'hardware / iot / industrial': 'Hardware / IoT / Industrial',
  martech: 'Marketing & Sales Tech',
  'marketing & sales': 'Marketing & Sales Tech',
  'marketing & sales tech': 'Marketing & Sales Tech',
  food: 'Food & Agriculture',
  agri: 'Food & Agriculture',
  'food & agriculture': 'Food & Agriculture',
  climate: 'Energy & Environment',
  'climate tech': 'Energy & Environment',
  'energy & environment': 'Energy & Environment',
  mobility: 'Mobility & Transport',
  transport: 'Mobility & Transport',
  'mobility & transport': 'Mobility & Transport',
  legal: 'Legal Tech / Legal & IP',
  'legal tech': 'Legal Tech / Legal & IP',
  'legal tech / legal & ip': 'Legal Tech / Legal & IP',
}

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function stripLeadingDecorators(value: string): string {
  return compactWhitespace(
    value
      .replace(/^✦\s*/u, '')
      .replace(/^★\s*/u, '')
      .replace(/^⚙\s*/u, '')
      .replace(/^⚠\s*/u, '')
      .replace(/^PLACEHOLDER\s*[—-]\s*/iu, '')
      .replace(/^[^\p{L}\p{N}]+/gu, ''),
  )
}

export function normalizeDimensionValue(value: string | null | undefined): string {
  const cleaned = compactWhitespace(String(value || ''))
  return cleaned || GENERAL_DIMENSION_VALUE
}

export function normalizeVerticalLabel(value: string | null | undefined): string {
  const cleaned = stripLeadingDecorators(String(value || '').replace(/\n/g, ' '))
  if (!cleaned) return GENERAL_DIMENSION_VALUE

  const normalized = TRACK_LIKE_TO_VERTICAL_MAP[cleaned.toLowerCase()]
  if (normalized) return normalized

  return cleaned
}

export function normalizeVariantTrackLabel(value: string | null | undefined): string {
  const cleaned = stripLeadingDecorators(String(value || '').replace(/\n/g, ' '))
  return cleaned || GENERAL_DIMENSION_VALUE
}

export function normalizeArchetypeKey(value: string | null | undefined): string {
  const cleaned = stripLeadingDecorators(
    String(value || '')
      .replace(/\n/g, ' ')
      .replace(/\s*\(support notes?\)\s*/giu, ' ')
      .replace(/:\s*$/u, ''),
  )
  if (!cleaned) return GENERAL_DIMENSION_VALUE

  const candidates = Array.from(new Set([
    cleaned,
    compactWhitespace(cleaned.replace(/\([^)]*\)/g, ' ')),
    compactWhitespace(cleaned.split(/\s+[—-]\s+/u)[0] || cleaned),
  ])).filter(Boolean)

  for (const candidate of candidates) {
    const alias = ARCHETYPE_ALIAS_MAP[candidate.toLowerCase()]
    if (alias) return alias
  }

  return cleaned
}

export function getCanonicalArchetype(value: string | null | undefined): CanonicalArchetype | null {
  const normalized = normalizeArchetypeKey(value)
  if (!normalized || normalized === GENERAL_DIMENSION_VALUE) return null
  return CANONICAL_ARCHETYPE_MAP[normalized] ?? null
}

export function getArchetypeAliases(value: string | null | undefined): string[] {
  const archetype = getCanonicalArchetype(value)
  if (!archetype) return []
  return [archetype.key, ...archetype.legacyKeys]
}

export function resolveVerticalFromTrackLike(value: string | null | undefined): string {
  if (!value) return GENERAL_DIMENSION_VALUE

  const normalized = TRACK_LIKE_TO_VERTICAL_MAP[compactWhitespace(value).toLowerCase()]
  if (normalized) return normalized

  return normalizeVerticalLabel(value)
}

export function isGeneralDimension(value: string | null | undefined): boolean {
  return normalizeDimensionValue(value) === GENERAL_DIMENSION_VALUE
}

export function buildDefinitionKey(input: {
  releaseKey: string
  blockKey: string
  vertical?: string | null
  personality?: string | null
  track?: string | null
}): string {
  return [
    input.releaseKey,
    input.blockKey,
    normalizeVerticalLabel(input.vertical),
    normalizeArchetypeKey(input.personality),
    normalizeVariantTrackLabel(input.track),
  ].join('::')
}
