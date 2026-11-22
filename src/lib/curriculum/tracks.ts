import { GENERAL_DIMENSION_VALUE } from './constants'
import type { CurriculumSnapshot } from './source'

export type CurriculumTrackSeed = {
  name: string
  slug: string
  isActive: boolean
}

const TRACK_SLUG_OVERRIDES: Record<string, string> = {
  [GENERAL_DIMENSION_VALUE]: 'general',
  'Dual Use': 'dual-use',
  EduTech: 'edutech',
  FinTech: 'fintech',
  'Space & City': 'space',
}

const ACTIVE_TRACK_NAMES = new Set([
  GENERAL_DIMENSION_VALUE,
  'Dual Use',
])

function slugifyTrackName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function getCurriculumTrackSlug(name: string): string {
  return TRACK_SLUG_OVERRIDES[name] || slugifyTrackName(name)
}

export function getCurriculumTrackSeeds(
  snapshot: Pick<CurriculumSnapshot, 'baseDefinitions' | 'overrideDefinitions'>,
): CurriculumTrackSeed[] {
  const names = new Set<string>()

  for (const definition of [...snapshot.baseDefinitions, ...snapshot.overrideDefinitions]) {
    const vertical = String(definition.vertical || '').trim()
    if (!vertical) continue
    names.add(vertical)
  }

  return Array.from(names)
    .sort((left, right) => left.localeCompare(right))
    .map((name) => ({
      name,
      slug: getCurriculumTrackSlug(name),
      isActive: ACTIVE_TRACK_NAMES.has(name),
    }))
}
