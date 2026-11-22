import 'dotenv/config'
import { getPayload } from 'payload'
import config from '@/payload.config'
import {
  CANONICAL_ARCHETYPE_MAP,
  GENERAL_DIMENSION_VALUE,
  normalizeArchetypeKey,
} from '@/lib/curriculum/constants'
import {
  generateFounderFormsFromCurriculum,
  syncCurriculumRelease,
} from '@/lib/curriculum/admin'
import { loadCurriculumSource } from '@/lib/curriculum/source'
import { getCurriculumTrackSeeds } from '@/lib/curriculum/tracks'
import { normalizePlatformSettingsDoc } from '@/lib/personalityConfig'

const WORKBOOK_PATH = 'MESGA_100Days_MASTER_v3.xlsx'

function stableStringify(value: unknown): string {
  return JSON.stringify(value ?? null)
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function normalizeStoredArchetype(value: unknown): string | null {
  if (value == null || value === '') return null
  const normalized = normalizeArchetypeKey(String(value))
  return normalized === GENERAL_DIMENSION_VALUE ? null : normalized
}

function normalizePersonalityScores(scores: any) {
  if (!scores || typeof scores !== 'object') return scores

  const archetype = normalizeStoredArchetype(scores.archetype)
  if (!archetype) return scores

  const meta = CANONICAL_ARCHETYPE_MAP[archetype]
  return {
    ...scores,
    archetype,
    archetypeEmoji: meta?.emoji || scores.archetypeEmoji || null,
    archetypeTagline: meta?.tagline || scores.archetypeTagline || null,
  }
}

async function migratePlatformSettings(payload: Awaited<ReturnType<typeof getPayload>>) {
  console.log('Checking platform-settings archetype definitions...')
  const settings = await payload.findGlobal({ slug: 'platform-settings' }).catch(() => null) as any
  if (!settings?.personality?.archetypes) {
    console.log('No platform-settings personality archetypes found.')
    return { updated: false }
  }

  const normalized = normalizePlatformSettingsDoc(settings)
  const currentArchetypes = settings.personality?.archetypes || []
  const nextArchetypes = normalized?.personality?.archetypes || []

  if (stableStringify(currentArchetypes) === stableStringify(nextArchetypes)) {
    console.log('Platform-settings archetypes already canonical.')
    return { updated: false }
  }

  await payload.updateGlobal({
    slug: 'platform-settings',
    data: {
      personality: {
        ...settings.personality,
        archetypes: nextArchetypes,
      },
    },
  })

  console.log('Updated platform-settings archetypes.')
  return { updated: true }
}

async function migrateArchetypeDaySchedules(payload: Awaited<ReturnType<typeof getPayload>>) {
  console.log('Migrating archetype-day-schedules...')
  const result = await payload.find({
    collection: 'archetype-day-schedules',
    limit: 500,
    depth: 0,
  })

  let updated = 0
  let deleted = 0

  for (const doc of result.docs as any[]) {
    const normalizedArchetype = normalizeStoredArchetype(doc.archetype)
    if (!normalizedArchetype || normalizedArchetype === doc.archetype) continue

    const canonicalExisting = await payload.find({
      collection: 'archetype-day-schedules',
      where: { archetype: { equals: normalizedArchetype } },
      limit: 1,
      depth: 0,
    })

    const targetDoc = canonicalExisting.docs[0]
    if (targetDoc && String(targetDoc.id) !== String(doc.id)) {
      const mergedSchedule = {
        ...asObject(doc.schedule),
        ...asObject(targetDoc.schedule),
      }
      const mergedPreworkSchedule = {
        ...asObject(doc.preworkSchedule),
        ...asObject(targetDoc.preworkSchedule),
      }

      if (
        stableStringify(targetDoc.schedule) !== stableStringify(mergedSchedule)
        || stableStringify(targetDoc.preworkSchedule) !== stableStringify(mergedPreworkSchedule)
      ) {
        await payload.update({
          collection: 'archetype-day-schedules',
          id: targetDoc.id,
          data: {
            schedule: mergedSchedule,
            preworkSchedule: mergedPreworkSchedule,
          },
        })
        updated++
      }

      await payload.delete({
        collection: 'archetype-day-schedules',
        id: doc.id,
      })
      deleted++
      continue
    }

    await payload.update({
      collection: 'archetype-day-schedules',
      id: doc.id,
      data: {
        archetype: normalizedArchetype,
      },
    })
    updated++
  }

  return { updated, deleted }
}

async function migrateFounderFormSubmissions(payload: Awaited<ReturnType<typeof getPayload>>) {
  console.log('Migrating founder-form-submissions archetype fields...')
  let page = 1
  const limit = 200
  let updated = 0

  while (true) {
    const result = await payload.find({
      collection: 'founder-form-submissions',
      page,
      limit,
      depth: 0,
      sort: 'id',
    })

    console.log(`Founder submissions page ${page}/${result.totalPages} (${result.totalDocs} docs total)...`)

    for (const doc of result.docs as any[]) {
      const nextArchetype = normalizeStoredArchetype(doc.archetype)
      const nextScores = normalizePersonalityScores(doc.personalityScores)

      if (
        stableStringify(doc.archetype) === stableStringify(nextArchetype)
        && stableStringify(doc.personalityScores) === stableStringify(nextScores)
      ) {
        continue
      }

      await payload.update({
        collection: 'founder-form-submissions',
        id: doc.id,
        data: {
          archetype: nextArchetype,
          personalityScores: nextScores,
        },
      })
      updated++
    }

    if (page >= result.totalPages) break
    page++
  }

  return { updated }
}

async function syncImportedTracks(payload: Awaited<ReturnType<typeof getPayload>>) {
  console.log('Syncing imported tracks...')

  const { snapshot } = loadCurriculumSource({
    filePath: WORKBOOK_PATH,
    rootDir: process.cwd(),
    preferSnapshot: true,
  })

  const seeds = getCurriculumTrackSeeds(snapshot)
  const existing = await payload.find({
    collection: 'tracks',
    limit: 200,
    depth: 0,
    sort: 'name',
  })

  const bySlug = new Map(
    (existing.docs as any[]).map((doc) => [String(doc.slug || ''), doc]),
  )

  let created = 0
  let updated = 0

  for (const seed of seeds) {
    const existingDoc = bySlug.get(seed.slug)

    if (!existingDoc) {
      await payload.create({
        collection: 'tracks',
        data: seed,
      })
      created++
      continue
    }

    if (existingDoc.name === seed.name && Boolean(existingDoc.isActive) === seed.isActive) {
      continue
    }

    await payload.update({
      collection: 'tracks',
      id: existingDoc.id,
      data: {
        name: seed.name,
        isActive: seed.isActive,
      },
    })
    updated++
  }

  return {
    created,
    updated,
    totalImported: seeds.length,
  }
}

async function main() {
  const payload = await getPayload({ config })

  console.log(`Migrating stored archetypes and syncing curriculum from ${WORKBOOK_PATH}...`)

  const platformSettings = await migratePlatformSettings(payload)
  const archetypeSchedules = await migrateArchetypeDaySchedules(payload)
  const submissions = await migrateFounderFormSubmissions(payload)
  const tracks = await syncImportedTracks(payload)

  console.log(`Syncing curriculum release from ${WORKBOOK_PATH}...`)
  const syncResult = await syncCurriculumRelease(payload, {
    filePath: WORKBOOK_PATH,
    scope: 'all',
    refreshSnapshot: true,
    writeMarkdown: true,
    activateRelease: true,
  })

  console.log('Regenerating founder forms from synced curriculum...')
  const founderForms = await generateFounderFormsFromCurriculum(payload, {
    assignToSchedule: true,
  })

  console.log(JSON.stringify({
    workbook: WORKBOOK_PATH,
    platformSettings,
    archetypeSchedules,
    submissions,
    tracks,
    curriculum: {
      releaseKey: syncResult.releaseKey,
      created: syncResult.created,
      updated: syncResult.updated,
      deleted: syncResult.deleted,
      baseDefinitions: syncResult.baseDefinitions,
      overrideDefinitions: syncResult.overrideDefinitions,
    },
    founderForms: {
      created: founderForms.created,
      updated: founderForms.updated,
      totalProcessed: founderForms.totalProcessed,
      scheduleEntries: founderForms.scheduleEntries,
      errors: founderForms.errors || [],
    },
  }, null, 2))
}

main().catch((error) => {
  console.error('curriculum:sync:v3 failed:', error)
  process.exit(1)
})
