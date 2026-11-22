import type { Payload } from 'payload'
import { normalizeEstimatedTimeHrs } from '@/lib/estimatedTime'
import {
  GENERAL_DIMENSION_VALUE,
  normalizeArchetypeKey,
  normalizeVariantTrackLabel,
  normalizeVerticalLabel,
  resolveVerticalFromTrackLike,
} from './constants'
import { getActivePersonalityTestFormId } from '@/lib/personalityTest'

const RESOLVED_FIELDS = [
  'title',
  'blockKey',
  'blockType',
  'theme',
  'founderCommandment',
  'blockFocus',
  'mainSoetMission',
  'activity',
  'deliverable',
  'exampleProject',
  'whereHowTips',
  'autoCheckCriteria',
  'mesgaIntegration',
  'estimatedTimeHrs',
  'eduType',
  'eduDescription',
  'contentType',
  'contentOwner',
  'eduLinks',
  'weekNumber',
  'dayNumber',
  'questions',
  'coachingNote',
  'qaTimeBreakdown',
  'vertical',
  'personality',
  'track',
  'hasVerticalVariants',
  'hasPersonalityVariants',
  'hasTrackVariants',
  'definitionKind',
  'releaseKey',
  'linkedForm',
  'order',
  'sourceSheet',
  'sourceRowNumber',
] as const

type ResolvedField = (typeof RESOLVED_FIELDS)[number]

export type ResolvedCurriculumContext = {
  releaseKey: string | null
  vertical: string
  personality: string
  track: string
}

function getFieldValue(doc: any, field: ResolvedField) {
  return doc?.[field]
}

function isOverrideDoc(doc: any): boolean {
  return doc?.definitionKind === 'override'
}

function scoreSpecificity(doc: any) {
  const vertical = normalizeVerticalLabel(doc?.vertical)
  const personality = normalizeArchetypeKey(doc?.personality)
  const track = normalizeVariantTrackLabel(doc?.track)

  let score = 0
  if (vertical !== GENERAL_DIMENSION_VALUE) score += 100
  if (personality !== GENERAL_DIMENSION_VALUE) score += 10
  if (track !== GENERAL_DIMENSION_VALUE) score += 1
  return score
}

function normalizeFieldValue(field: 'vertical' | 'personality' | 'track', value: string | null | undefined): string {
  if (field === 'vertical') return normalizeVerticalLabel(value)
  if (field === 'personality') return normalizeArchetypeKey(value)
  return normalizeVariantTrackLabel(value)
}

function matchesDimension(
  field: 'vertical' | 'personality' | 'track',
  docValue: string | null | undefined,
  targetValue: string,
): boolean {
  const normalizedDocValue = normalizeFieldValue(field, docValue)
  return normalizedDocValue === GENERAL_DIMENSION_VALUE || normalizedDocValue === targetValue
}

function matchesContext(doc: any, context: ResolvedCurriculumContext): boolean {
  return (
    matchesDimension('vertical', doc?.vertical, context.vertical)
    && matchesDimension('personality', doc?.personality, context.personality)
    && matchesDimension('track', doc?.track, context.track)
  )
}

function filterByRelease(docs: any[], activeReleaseKey: string | null): any[] {
  if (!activeReleaseKey) return docs

  const explicitReleaseDocs = docs.filter((doc) => String(doc?.releaseKey || '') === activeReleaseKey)
  if (explicitReleaseDocs.length > 0) return explicitReleaseDocs

  return docs.filter((doc) => !doc?.releaseKey)
}

export async function getActiveCurriculumReleaseKey(payload: Payload): Promise<string | null> {
  try {
    const dayProgram = await payload.findGlobal({ slug: 'day-program' }) as any
    const value = String(dayProgram?.activeCurriculumReleaseKey || '').trim()
    return value || null
  } catch {
    return null
  }
}

export async function resolveCurriculumContext(
  payload: Payload,
  options: {
    userId?: string | number | null
    vertical?: string | null
    personality?: string | null
    track?: string | null
  } = {},
): Promise<ResolvedCurriculumContext> {
  const releaseKey = await getActiveCurriculumReleaseKey(payload)

  const explicitTrack = normalizeVariantTrackLabel(options.track)
  let vertical = resolveVerticalFromTrackLike(options.vertical)
  if (vertical === GENERAL_DIMENSION_VALUE && explicitTrack !== GENERAL_DIMENSION_VALUE) {
    vertical = resolveVerticalFromTrackLike(explicitTrack)
  }

  if (vertical === GENERAL_DIMENSION_VALUE && options.userId != null) {
    try {
      const latestProject = await payload.find({
        collection: 'project-submissions',
        where: { user: { equals: options.userId } },
        sort: '-createdAt',
        limit: 1,
        depth: 1,
      })

      const trackValue = latestProject.docs[0]
        ? typeof (latestProject.docs[0] as any).track === 'object'
          ? ((latestProject.docs[0] as any).track?.name || (latestProject.docs[0] as any).track?.slug || null)
          : (latestProject.docs[0] as any).track
        : null

      vertical = resolveVerticalFromTrackLike(trackValue)
    } catch {}
  }

  let personality = normalizeArchetypeKey(options.personality)
  if (personality === GENERAL_DIMENSION_VALUE && options.userId != null) {
    try {
      const platformSettings = await payload.findGlobal({ slug: 'platform-settings' }).catch(() => null)
      const activePersonalityTestFormId = getActivePersonalityTestFormId(platformSettings)
      if (!activePersonalityTestFormId) {
        throw new Error('No active personality test form configured.')
      }

      const latestScores = await payload.find({
        collection: 'founder-form-submissions',
        where: {
          user: { equals: options.userId },
          form: { equals: activePersonalityTestFormId },
        },
        sort: '-createdAt',
        limit: 1,
        depth: 0,
      })
      personality = normalizeArchetypeKey((latestScores.docs[0] as any)?.archetype)
    } catch {}
  }

  return {
    releaseKey,
    vertical,
    personality,
    track: explicitTrack,
  }
}

function buildResolvedFromBase(baseDoc: any) {
  const resolved: Record<string, unknown> = {}
  for (const field of RESOLVED_FIELDS) {
    const value = getFieldValue(baseDoc, field)
    if (value !== undefined) resolved[field] = value
  }
  return resolved
}

function applyOverride(resolved: Record<string, unknown>, overrideDoc: any) {
  const patch = overrideDoc?.overrideFields && typeof overrideDoc.overrideFields === 'object'
    ? overrideDoc.overrideFields
    : null

  if (patch) {
    for (const [field, value] of Object.entries(patch)) {
      resolved[field] = value
    }
  }

  for (const field of RESOLVED_FIELDS) {
    if (field === 'definitionKind' || field === 'releaseKey') continue
    const value = getFieldValue(overrideDoc, field)
    if (value !== undefined && value !== null && value !== '') {
      resolved[field] = value
    }
  }
}

export async function resolveDayDefinitionByBlockKey(
  payload: Payload,
  blockKey: string,
  contextOptions: {
    userId?: string | number | null
    vertical?: string | null
    personality?: string | null
    track?: string | null
  } = {},
): Promise<Record<string, unknown> | null> {
  const context = await resolveCurriculumContext(payload, contextOptions)
  const result = await payload.find({
    collection: 'day-definitions',
    where: { blockKey: { equals: blockKey } },
    limit: 200,
    depth: 0,
  }).catch(() => null)

  const docs = filterByRelease(result?.docs || [], context.releaseKey)
  if (docs.length === 0) return null

  const matchingDocs = docs.filter((doc) => matchesContext(doc, context))
  if (matchingDocs.length === 0) return null

  const baseDoc = matchingDocs.find((doc) => !isOverrideDoc(doc))
  if (!baseDoc) return null

  const resolved = buildResolvedFromBase(baseDoc)
  const overrides = matchingDocs
    .filter((doc) => isOverrideDoc(doc))
    .sort((left, right) => scoreSpecificity(left) - scoreSpecificity(right))

  for (const overrideDoc of overrides) {
    applyOverride(resolved, overrideDoc)
  }

  resolved.estimatedTimeHrs = normalizeEstimatedTimeHrs(resolved.estimatedTimeHrs as number | null | undefined)
  resolved.vertical = context.vertical
  resolved.personality = context.personality
  resolved.track = context.track

  if (!resolved.title && resolved.activity) {
    resolved.title = resolved.activity
  }

  return resolved
}

export async function findBaseDayDefinitionByDayNumber(
  payload: Payload,
  dayNumber: number,
  blockType?: string,
): Promise<any | null> {
  const activeReleaseKey = await getActiveCurriculumReleaseKey(payload)
  const result = await payload.find({
    collection: 'day-definitions',
    where: {
      dayNumber: { equals: dayNumber },
      ...(blockType ? { blockType: { equals: blockType } } : {}),
    },
    limit: 200,
    depth: 0,
  }).catch(() => null)

  const docs = filterByRelease(result?.docs || [], activeReleaseKey)
  const baseDocs = docs.filter((doc) => !isOverrideDoc(doc))
  return baseDocs[0] ?? null
}

export async function findBaseDayDefinitionByBlockKey(
  payload: Payload,
  blockKey: string,
): Promise<any | null> {
  const activeReleaseKey = await getActiveCurriculumReleaseKey(payload)
  const result = await payload.find({
    collection: 'day-definitions',
    where: { blockKey: { equals: blockKey } },
    limit: 200,
    depth: 0,
  }).catch(() => null)

  const docs = filterByRelease(result?.docs || [], activeReleaseKey)
  const baseDocs = docs.filter((doc) => !isOverrideDoc(doc))
  return baseDocs[0] ?? null
}

export async function filterBaseDayDefinitions(
  payload: Payload,
  docs: any[],
): Promise<any[]> {
  const activeReleaseKey = await getActiveCurriculumReleaseKey(payload)
  return filterByRelease(docs, activeReleaseKey).filter((doc) => !isOverrideDoc(doc))
}
