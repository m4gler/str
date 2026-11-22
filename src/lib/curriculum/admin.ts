import type { Payload } from 'payload'
import { loadCurriculumSource } from '@/lib/curriculum/source'
import { filterBaseDayDefinitions } from '@/lib/curriculum/resolve'
import { normalizeDayProgramConfig } from '@/lib/dayDefinitionAdmin'
import {
  buildGateQuestions,
  buildWeeklyRetroQuestions,
  upsertFounderFormFromCurriculum,
} from '@/lib/dayDefinitionForms'

export type SyncScope = 'snapshots' | 'general' | 'all'

function pickLegacyFields(doc: any) {
  if (!doc) return {}

  const data: Record<string, unknown> = {
    section: doc.section,
    blockFocus: doc.blockFocus,
    mainSoetMission: doc.mainSoetMission,
    autoCheckCriteria: doc.autoCheckCriteria,
    questions: doc.questions,
    linkedForm: typeof doc.linkedForm === 'object' ? doc.linkedForm?.id ?? null : doc.linkedForm,
    eduType: doc.eduType,
    contentType: doc.contentType,
    contentOwner: doc.contentOwner,
    isGateDay: doc.isGateDay,
    gateDayNumber: doc.gateDayNumber,
    gateRequiredArtifacts: doc.gateRequiredArtifacts,
    gateRubric: doc.gateRubric,
    gateThreshold: doc.gateThreshold,
  }

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) delete data[key]
  }

  return data
}

function buildRecordData(record: any) {
  const data: Record<string, unknown> = {
    definitionKind: record.definitionKind,
    definitionKey: record.definitionKey,
    releaseKey: record.releaseKey,
    blockKey: record.blockKey,
    blockType: record.blockType,
    dayNumber: record.dayNumber,
    order: record.order,
    weekNumber: record.weekNumber,
    title: record.title || record.activity || record.blockKey,
    vertical: record.vertical,
    personality: record.personality,
    track: record.track,
    hasVerticalVariants: record.hasVerticalVariants,
    hasPersonalityVariants: record.hasPersonalityVariants,
    hasTrackVariants: record.hasTrackVariants,
    sourceSheet: record.sourceSheet,
    sourceRowNumber: record.sourceRowNumber,
    qaSourceSheet: record.qaSourceSheet,
    qaSourceRowNumber: record.qaSourceRowNumber,
    overrideFields: record.overrideFields,
    theme: record.theme,
    founderCommandment: record.founderCommandment,
    activity: record.activity,
    deliverable: record.deliverable,
    exampleProject: record.exampleProject,
    whereHowTips: record.whereHowTips,
    mesgaIntegration: record.mesgaIntegration,
    estimatedTimeHrs: record.estimatedTimeHrs,
    eduDescription: record.eduDescription,
    eduLinks: record.eduLinks,
    qaTimeBreakdown: record.qaTimeBreakdown,
    coachingNote: record.coachingNote,
    divergenceNotes: record.divergenceNotes,
  }

  if (record.definitionKind === 'override' && record.overrideFields && typeof record.overrideFields === 'object') {
    Object.assign(data, record.overrideFields)
  }

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) delete data[key]
  }

  return data
}

function shouldDeleteForScope(doc: any, scope: SyncScope): boolean {
  if (scope === 'general') return doc?.definitionKind !== 'override'
  if (scope === 'all') return true
  return false
}

export async function syncCurriculumRelease(
  payload: Payload,
  options: {
    scope?: SyncScope
    filePath?: string
    refreshSnapshot?: boolean
    writeMarkdown?: boolean
    activateRelease?: boolean
  } = {},
) {
  const scope = options.scope || 'all'
  const refreshSnapshot = options.refreshSnapshot === true
  const writeMarkdown = options.writeMarkdown !== false
  const activateRelease = options.activateRelease !== false

  const { snapshot } = loadCurriculumSource({
    filePath: options.filePath,
    rootDir: process.cwd(),
    preferSnapshot: true,
    refreshSnapshot,
    writeMarkdown,
  })

  if (scope === 'snapshots') {
    return {
      success: true,
      scope,
      releaseKey: snapshot.releaseKey,
      sourceFilePath: snapshot.sourceFilePath,
      sourceSignature: snapshot.sourceSignature,
      baseDefinitions: snapshot.baseDefinitions.length,
      overrideDefinitions: snapshot.overrideDefinitions.length,
      message: `Snapshot refreshed for ${snapshot.releaseKey}. Markdown and JSON outputs are up to date.`,
    }
  }

  const records = scope === 'general'
    ? snapshot.baseDefinitions
    : [...snapshot.baseDefinitions, ...snapshot.overrideDefinitions]

  const definitionKeys = new Set(records.map((record) => record.definitionKey))
  const existing = await payload.find({
    collection: 'day-definitions',
    where: { releaseKey: { equals: snapshot.releaseKey } },
    limit: 500,
    depth: 0,
  })
  const legacyPool = await payload.find({
    collection: 'day-definitions',
    limit: 500,
    depth: 0,
  })

  const existingByKey = new Map(
    (existing.docs as any[]).map((doc) => [String(doc.definitionKey || ''), doc]),
  )
  const legacyBaseByBlockKey = new Map<string, any>()

  for (const doc of legacyPool.docs as any[]) {
    if (String(doc.releaseKey || '') === snapshot.releaseKey) continue
    if (doc.definitionKind === 'override') continue
    const blockKey = String(doc.blockKey || '')
    if (blockKey && !legacyBaseByBlockKey.has(blockKey)) {
      legacyBaseByBlockKey.set(blockKey, doc)
    }
  }

  let created = 0
  let updated = 0
  let deleted = 0

  for (const record of records) {
    const data = buildRecordData(record)
    const existingDoc = existingByKey.get(record.definitionKey)

    if (existingDoc) {
      await payload.update({
        collection: 'day-definitions',
        id: existingDoc.id,
        data,
      })
      updated++
    } else {
      await (payload as any).create({
        collection: 'day-definitions',
        data: {
          ...pickLegacyFields(legacyBaseByBlockKey.get(record.blockKey)),
          ...data,
        },
      })
      created++
    }
  }

  const staleDocs = (existing.docs as any[]).filter((doc) => {
    if (!shouldDeleteForScope(doc, scope)) return false
    return !definitionKeys.has(String(doc.definitionKey || ''))
  })

  for (const staleDoc of staleDocs) {
    await payload.delete({
      collection: 'day-definitions',
      id: staleDoc.id,
    })
    deleted++
  }

  if (activateRelease) {
    await (payload as any).updateGlobal({
      slug: 'day-program',
      data: {
        activeCurriculumReleaseKey: snapshot.releaseKey,
      },
    })
  }

  return {
    success: true,
    scope,
    releaseKey: snapshot.releaseKey,
    sourceFilePath: snapshot.sourceFilePath,
    sourceSignature: snapshot.sourceSignature,
    created,
    updated,
    deleted,
    baseDefinitions: snapshot.baseDefinitions.length,
    overrideDefinitions: snapshot.overrideDefinitions.length,
    message:
      scope === 'general'
        ? `Synced ${snapshot.baseDefinitions.length} base curriculum blocks for ${snapshot.releaseKey}.`
        : `Synced ${records.length} curriculum records for ${snapshot.releaseKey}.`,
  }
}

export async function generateFounderFormsFromCurriculum(
  payload: Payload,
  options: {
    blockTypes?: string[]
    assignToSchedule?: boolean
  } = {},
) {
  const blockTypes = options.blockTypes || ['day', 'prework', 'gate', 'weekly']
  const assignToSchedule = options.assignToSchedule !== false
  const dayProgram = await payload.findGlobal({ slug: 'day-program' }).catch(() => null)
  const programConfig = normalizeDayProgramConfig(dayProgram)

  const allDefs = await payload.find({
    collection: 'day-definitions',
    where: {
      blockType: { in: blockTypes },
    },
    limit: 500,
    sort: 'order',
    depth: 0,
  })
  const baseDefinitions = await filterBaseDayDefinitions(payload, allDefs.docs as any[])

  let created = 0
  let updated = 0
  const errors: string[] = []
  const scheduleMap: Record<string, string | number> = {}

  for (const dd of baseDefinitions as any[]) {
    try {
      const result = await upsertFounderFormFromCurriculum(payload, dd)
      const formId = result.formId
      if (result.action === 'created') created++
      else updated++

      await payload.update({ collection: 'day-definitions', id: dd.id, data: { linkedForm: formId } })

      if (dd.dayNumber && dd.blockType === 'day') {
        scheduleMap[String(dd.dayNumber)] = formId
      }
    } catch (err: any) {
      errors.push(`${dd.blockKey}: ${err.message || String(err)}`)
    }
  }

  const retroEveryN = programConfig.retroEveryNDays
  const retroDays = Array.from(
    { length: Math.floor(100 / retroEveryN) },
    (_, index) => (index + 1) * retroEveryN,
  )

  for (const retroDay of retroDays) {
    const weekNum = retroDay / retroEveryN
    const slug = `daily-week-block-${weekNum}`
    const dayDef = (baseDefinitions as any[]).find((definition) => definition.dayNumber === retroDay)
    const title = `Week ${weekNum} — Weekly Retro`
    const formQuestions = buildWeeklyRetroQuestions(dayDef || {})
    const sectionDesc = dayDef
      ? [dayDef.deliverable, dayDef.whereHowTips].filter(Boolean).join(' — ') || undefined
      : undefined

    try {
      const formData: any = {
        title,
        slug,
        allowMultipleSubmissions: true,
        sections: [{
          id: `WEEK-BLOCK-${weekNum}`,
          title,
          description: sectionDesc,
          questions: formQuestions,
        }],
      }

      const existing = await payload.find({
        collection: 'founder-forms',
        where: { slug: { equals: slug } },
        limit: 1,
      })

      let formId: string | number
      if (existing.totalDocs > 0) {
        const updatedForm = await payload.update({
          collection: 'founder-forms',
          id: existing.docs[0].id,
          data: formData,
        })
        formId = updatedForm.id
        updated++
      } else {
        const createdForm = await payload.create({
          collection: 'founder-forms',
          data: formData,
        })
        formId = createdForm.id
        created++
      }

      scheduleMap[String(retroDay)] = formId
    } catch (err: any) {
      errors.push(`WEEK-BLOCK-${weekNum}: ${err.message || String(err)}`)
    }
  }

  for (const gateDay of programConfig.gateDays) {
    const slug = `daily-gate-block-${gateDay}`
    const dayDef = (baseDefinitions as any[]).find((definition) => definition.dayNumber === gateDay)
    const title = `Gate Day ${gateDay}`
    const formQuestions = buildGateQuestions({ ...dayDef, dayNumber: gateDay })
    const sectionDesc = dayDef
      ? [dayDef.deliverable, dayDef.whereHowTips].filter(Boolean).join(' — ') || undefined
      : undefined

    try {
      const formData: any = {
        title,
        slug,
        allowMultipleSubmissions: true,
        sections: [{
          id: `GATE-BLOCK-${gateDay}`,
          title,
          description: sectionDesc,
          questions: formQuestions,
        }],
      }

      const existing = await payload.find({
        collection: 'founder-forms',
        where: { slug: { equals: slug } },
        limit: 1,
      })

      let formId: string | number
      if (existing.totalDocs > 0) {
        const updatedForm = await payload.update({
          collection: 'founder-forms',
          id: existing.docs[0].id,
          data: formData,
        })
        formId = updatedForm.id
        updated++
      } else {
        const createdForm = await payload.create({
          collection: 'founder-forms',
          data: formData,
        })
        formId = createdForm.id
        created++
      }

      scheduleMap[String(gateDay)] = formId
    } catch (err: any) {
      errors.push(`GATE-BLOCK-${gateDay}: ${err.message || String(err)}`)
    }
  }

  if (assignToSchedule && Object.keys(scheduleMap).length > 0) {
    try {
      const currentDayProgram = await payload.findGlobal({ slug: 'day-program' }) as any
      const existingSchedule = currentDayProgram?.defaultSchedule || {}
      const merged = { ...existingSchedule, ...scheduleMap }
      await payload.updateGlobal({
        slug: 'day-program',
        data: { defaultSchedule: merged },
      })
    } catch (err: any) {
      errors.push(`Schedule update: ${err.message || String(err)}`)
    }
  }

  return {
    success: true,
    created,
    updated,
    errors: errors.length > 0 ? errors : undefined,
    totalProcessed: baseDefinitions.length,
    scheduleEntries: Object.keys(scheduleMap).length,
    message: `Generated ${created} new + ${updated} updated forms from ${baseDefinitions.length} definitions. ${Object.keys(scheduleMap).length} entries assigned to default schedule.`,
  }
}
