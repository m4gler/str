import type { Payload } from 'payload'
import { computeCalendarDay, getDayType, parseProgramConfig } from '@/lib/attemptEngine'
import { normalizeEstimatedTimeHrs } from '@/lib/estimatedTime'
import {
  isTestProgramStatus,
  normalizeRequestedProgramDay,
} from '@/lib/programTestMode'
import {
  resolveCurriculumContext,
  resolveDayDefinitionByBlockKey,
  type ResolvedCurriculumContext,
} from '@/lib/curriculum/resolve'

const CET_TZ = 'Europe/Warsaw'

export interface DayDefinitionMeta {
  title: string | null
  blockKey: string | null
  blockType: string | null
  theme: string | null
  founderCommandment: string | null
  blockFocus: string | null
  mainSoetMission: string | null
  activity: string | null
  deliverable: string | null
  exampleProject: string | null
  whereHowTips: string | null
  autoCheckCriteria: string | null
  mesgaIntegration: string | null
  estimatedTimeHrs: number | null
  eduType: string | null
  eduDescription: string | null
  contentType: string | null
  contentOwner: string | null
  eduLinks: Array<{ label: string; url: string; type?: string }> | null
  weekNumber: number | null
  coachingNote: string | null
  questions: Array<{
    questionId: string
    questionTitle: string
    questionType: string
    required: boolean
    description: string | null
    choices: string | null
    logic: string | null
  }> | null
}

export interface DayProgressionResult {
  activeDay: number
  displayDay: number
  nextMissionDay: number | null
  isLocked: boolean
  lockReason: 'previous_incomplete' | 'before_release_time' | 'before_program_start' | null
  nextUnlockTime: string | null
  completedDays: number[]
  resolvedFormId: string | number | null
  dailyFormSlug: string | null
  dailyFormTitle: string | null
  hasSubmittedToday: boolean
  displayFormSlug: string | null
  displayFormTitle: string | null
  displayHasSubmitted: boolean
  nextMissionFormSlug: string | null
  nextMissionFormTitle: string | null
  isInactiveFailed: boolean
  dayDefinition: DayDefinitionMeta | null
  displayDayDefinition: DayDefinitionMeta | null
  nextMissionDayDefinition: DayDefinitionMeta | null
}

function getCETDate(date: Date): { year: number; month: number; day: number; hours: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CET_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const get = (t: string) => Number(parts.find(p => p.type === t)?.value || '0')
  return { year: get('year'), month: get('month'), day: get('day'), hours: get('hour'), minutes: get('minute') }
}

function buildCETTimestamp(year: number, month: number, day: number, hours: number, minutes: number): Date {
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: CET_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  })

  const testDate = new Date(iso + 'Z')
  const cetParts = getCETDate(testDate)
  const offsetMs = testDate.getTime() - new Date(
    cetParts.year, cetParts.month - 1, cetParts.day, cetParts.hours, cetParts.minutes
  ).getTime()

  const targetLocal = new Date(year, month - 1, day, hours, minutes, 0)
  return new Date(targetLocal.getTime() + offsetMs)
}

function getNextReleaseCET(releaseHour: number, releaseMinute: number): Date {
  const now = new Date()
  const cet = getCETDate(now)

  let targetDay = cet.day
  if (cet.hours > releaseHour || (cet.hours === releaseHour && cet.minutes >= releaseMinute)) {
    targetDay += 1
  }

  return buildCETTimestamp(cet.year, cet.month, targetDay, releaseHour, releaseMinute)
}

function parseReleaseTime(releaseTime: string): { hour: number; minute: number } {
  const [h, m] = (releaseTime || '12:00').split(':').map(Number)
  return { hour: isNaN(h) ? 12 : h, minute: isNaN(m) ? 0 : m }
}

async function isUserInTestProgramState(payload: Payload, userId: string | number): Promise<boolean> {
  try {
    const user = await payload.findByID({
      collection: 'users',
      id: userId,
      depth: 0,
    }) as any

    return isTestProgramStatus(user?.programStatus)
  } catch {
    return false
  }
}

async function inferProgramDayFromForm(
  payload: Payload,
  formId: string | number,
): Promise<number | null> {
  try {
    const form = await payload.findByID({
      collection: 'founder-forms',
      id: formId,
      depth: 0,
    }) as any

    return inferProgramDayFromFormSlug(String(form?.slug || ''))
  } catch {
    return null
  }
}

async function isPreworkForm(
  payload: Payload,
  formId: string | number,
): Promise<boolean> {
  try {
    const form = await payload.findByID({
      collection: 'founder-forms',
      id: formId,
      depth: 0,
    }) as any

    return String(form?.slug || '').startsWith('daily-prework-block-')
  } catch {
    return false
  }
}

function inferProgramDayFromFormSlug(formSlug: string, retroEveryN = 7): number | null {
  const directMatch = formSlug.match(/^daily-(?:day|gate)-block-(\d+)$/)
  if (directMatch) {
    return normalizeRequestedProgramDay(directMatch[1])
  }

  const weekMatch = formSlug.match(/^daily-week-block-(\d+)$/)
  if (!weekMatch) return null

  const rawValue = Number(weekMatch[1])
  if (!Number.isInteger(rawValue) || rawValue < 1) return null

  const maxWeekNumber = Math.ceil(100 / retroEveryN)
  if (rawValue <= maxWeekNumber) {
    return normalizeRequestedProgramDay(rawValue * retroEveryN)
  }

  return normalizeRequestedProgramDay(rawValue)
}

function getProgramDayBlockKey(dayNumber: number, retroEveryN = 7, gateDays: number[] = [15, 30, 50, 70, 94]): string {
  const dayType = getDayType(dayNumber, {
    ...parseProgramConfig(null),
    retroEveryNDays: retroEveryN,
    gateDays,
  })

  if (dayType === 'gate') return `GATE-BLOCK-${dayNumber}`
  if (dayType === 'retro') return `WEEK-BLOCK-${Math.floor(dayNumber / retroEveryN)}`
  return `DAY-BLOCK-${dayNumber}`
}

async function resolveLinkedFormFromCurriculumDefinition(
  payload: Payload,
  blockKey: string,
  archetype: string | null,
  track: string | null,
): Promise<string | number | null> {
  try {
    const definition = await resolveDayDefinitionByBlockKey(payload, blockKey, {
      personality: archetype,
      track,
    }) as any | null

    if (!definition) return null

    const linkedForm = definition?.linkedForm
    return linkedForm ? (typeof linkedForm === 'object' ? linkedForm?.id : linkedForm) : null
  } catch {
    return null
  }
}

async function resolveFormForDay(
  payload: Payload,
  dayNumber: number,
  userId: string | number,
  archetype: string | null,
  track: string | null,
  partnerId: string | number | null,
): Promise<string | number | null> {
  let resolvedFormId: string | number | null = null
  let retroEveryN = 7
  let gateDays = [15, 30, 50, 70, 94]

  // 1. User-level override always takes precedence
  try {
    const overrides = await payload.find({
      collection: 'user-day-overrides',
      where: {
        user: { equals: userId },
        day: { equals: dayNumber },
      },
      limit: 1,
      depth: 0,
    })
    if (overrides.totalDocs > 0) {
      const f = (overrides.docs[0] as any)?.form
      resolvedFormId = typeof f === 'object' ? f?.id : f
    }
  } catch {}

  if (resolvedFormId) return resolvedFormId

  try {
    const dayProgram = await payload.findGlobal({ slug: 'day-program' }) as any
    const cfg = parseProgramConfig(dayProgram)
    retroEveryN = cfg.retroEveryNDays
    gateDays = cfg.gateDays

    const dayType = getDayType(dayNumber, cfg)
    if (dayType !== 'standard') {
      const blockKey = getProgramDayBlockKey(dayNumber, retroEveryN, gateDays)
      resolvedFormId = await resolveLinkedFormFromCurriculumDefinition(payload, blockKey, archetype, track)
    }
  } catch {}

  if (resolvedFormId) return resolvedFormId

  // 2. Walk schedule hierarchy
  try {
    const dayProgram = await payload.findGlobal({ slug: 'day-program' }) as any
    const cfg = parseProgramConfig(dayProgram)
    retroEveryN = cfg.retroEveryNDays
    gateDays = cfg.gateDays
    const rawHierarchy: { level: string }[] | undefined = dayProgram?.scheduleHierarchy
    const hierarchy: { level: string }[] = rawHierarchy && rawHierarchy.length > 0
      ? rawHierarchy
      : [
          { level: 'partner' },
          { level: 'track' },
          { level: 'archetype' },
          { level: 'general' },
        ]

    for (const { level } of hierarchy) {
      if (resolvedFormId) break

      if (level === 'partner' && partnerId) {
        try {
          const docs = await payload.find({
            collection: 'partner-day-schedules',
            where: { partner: { equals: partnerId } },
            limit: 1,
            depth: 0,
          })
          if (docs.totalDocs > 0) {
            const schedule = (docs.docs[0] as any)?.schedule || {}
            resolvedFormId = schedule[String(dayNumber)] ?? null
          }
        } catch {}
      }

      if (level === 'track' && track) {
        try {
          const docs = await payload.find({
            collection: 'track-day-schedules',
            where: { trackSlug: { equals: track } },
            limit: 1,
            depth: 0,
          })
          if (docs.totalDocs > 0) {
            const schedule = (docs.docs[0] as any)?.schedule || {}
            resolvedFormId = schedule[String(dayNumber)] ?? null
          }
        } catch {}
      }

      if (level === 'archetype' && archetype) {
        try {
          const docs = await payload.find({
            collection: 'archetype-day-schedules',
            where: { archetype: { equals: archetype } },
            limit: 1,
            depth: 0,
          })
          if (docs.totalDocs > 0) {
            const schedule = (docs.docs[0] as any)?.schedule || {}
            resolvedFormId = schedule[String(dayNumber)] ?? null
          }
        } catch {}
      }

      if (level === 'general') {
        const blockKey = getProgramDayBlockKey(dayNumber, retroEveryN, gateDays)
        resolvedFormId = await resolveLinkedFormFromCurriculumDefinition(payload, blockKey, archetype, track)

        if (!resolvedFormId) {
          const defaultSchedule = dayProgram?.defaultSchedule || {}
          resolvedFormId = defaultSchedule[String(dayNumber)] ?? null
        }
      }
    }
  } catch {}

  if (!resolvedFormId) {
    try {
      const blockKey = getProgramDayBlockKey(dayNumber, retroEveryN, gateDays)
      resolvedFormId = await resolveLinkedFormFromCurriculumDefinition(payload, blockKey, archetype, track)
    } catch {}
  }

  return resolvedFormId
}

async function resolveFormStateForActiveDay(
  payload: Payload,
  activeDay: number,
  userId: string | number,
  archetype: string | null,
  track: string | null,
  partnerId: string | number | null,
  completedSet: Set<number>,
  isLocked: boolean,
): Promise<Pick<DayProgressionResult, 'resolvedFormId' | 'dailyFormSlug' | 'dailyFormTitle' | 'hasSubmittedToday'>> {
  let resolvedFormId: string | number | null = null
  let dailyFormSlug: string | null = null
  let dailyFormTitle: string | null = null
  let hasSubmittedToday = false

  if (isLocked) {
    return {
      resolvedFormId,
      dailyFormSlug,
      dailyFormTitle,
      hasSubmittedToday,
    }
  }

  resolvedFormId = await resolveFormForDay(payload, activeDay, userId, archetype, track, partnerId)

  if (!resolvedFormId) {
    try {
      const blockKey = `DAY-BLOCK-${activeDay}`
      resolvedFormId = await resolveLinkedFormFromCurriculumDefinition(payload, blockKey, archetype, track)
    } catch {}
  }

  if (!resolvedFormId) {
    const settings = await payload.findGlobal({ slug: 'platform-settings' }).catch(() => null) as any
    const activeDailyForm = settings?.activeDailyForm
    if (activeDailyForm) resolvedFormId = typeof activeDailyForm === 'object' ? activeDailyForm?.id : activeDailyForm
  }

  if (resolvedFormId) {
    try {
      const form = await payload.findByID({ collection: 'founder-forms', id: resolvedFormId })
      dailyFormSlug = (form as any)?.slug || null
      dailyFormTitle = (form as any)?.title || null
    } catch {}

    hasSubmittedToday = completedSet.has(activeDay)
  }

  return {
    resolvedFormId,
    dailyFormSlug,
    dailyFormTitle,
    hasSubmittedToday,
  }
}

async function resolveDayDefinitionForDay(
  payload: Payload,
  activeDay: number,
  context: ResolvedCurriculumContext,
): Promise<DayDefinitionMeta | null> {
  try {
    const dayProgram = await payload.findGlobal({ slug: 'day-program' }).catch(() => null) as any
    const cfg = parseProgramConfig(dayProgram)
    const blockKey = getProgramDayBlockKey(activeDay, cfg.retroEveryNDays, cfg.gateDays)
    const d = await resolveDayDefinitionByBlockKey(payload, blockKey, context)
    if (d) {
      return {
        title: (d.title as string | null) ?? null,
        blockKey: (d.blockKey as string | null) ?? null,
        blockType: (d.blockType as string | null) ?? null,
        theme: (d.theme as string | null) ?? null,
        founderCommandment: (d.founderCommandment as string | null) ?? null,
        blockFocus: (d.blockFocus as string | null) ?? null,
        mainSoetMission: (d.mainSoetMission as string | null) ?? null,
        activity: (d.activity as string | null) ?? null,
        deliverable: (d.deliverable as string | null) ?? null,
        exampleProject: (d.exampleProject as string | null) ?? null,
        whereHowTips: (d.whereHowTips as string | null) ?? null,
        autoCheckCriteria: (d.autoCheckCriteria as string | null) ?? null,
        mesgaIntegration: (d.mesgaIntegration as string | null) ?? null,
        estimatedTimeHrs: normalizeEstimatedTimeHrs(d.estimatedTimeHrs as number | null | undefined),
        eduType: (d.eduType as string | null) ?? null,
        eduDescription: (d.eduDescription as string | null) ?? null,
        contentType: (d.contentType as string | null) ?? null,
        contentOwner: (d.contentOwner as string | null) ?? null,
        eduLinks: (d.eduLinks as Array<{ label: string; url: string; type?: string }> | null) ?? null,
        weekNumber: (d.weekNumber as number | null) ?? null,
        coachingNote: (d.coachingNote as string | null) ?? null,
        questions: (d.questions as DayDefinitionMeta['questions']) ?? null,
      }
    }
  } catch {}

  return null
}

async function getActiveAttemptId(
  payload: Payload,
  userId: string | number,
): Promise<string | number | null> {
  const activeAttemptResult = await payload.find({
    collection: 'attempts',
    where: {
      user: { equals: userId },
      status: { in: ['active', 'warned_1', 'warned_2'] },
    },
    sort: '-attemptNumber',
    limit: 1,
    depth: 0,
  }).catch(() => null)

  return activeAttemptResult?.docs?.[0]?.id ?? null
}

function buildProgramSubmissionWhere(
  userId: string | number,
  extraClauses: Array<Record<string, unknown>>,
  activeAttemptId: string | number | null,
  isTestMode: boolean,
): any {
  return {
    and: [
      { user: { equals: userId } },
      ...extraClauses,
      ...(activeAttemptId
        ? isTestMode
          ? [{
              or: [
                { attempt: { equals: activeAttemptId } },
                { attempt: { exists: false } },
              ],
            }]
          : [{ attempt: { equals: activeAttemptId } }]
        : []),
    ],
  }
}

function getFirstIncompleteDay(completedDays: number[]): number {
  const completedSet = new Set(completedDays)

  for (let day = 1; day <= 100; day++) {
    if (!completedSet.has(day)) return day
  }

  return 100
}

function getLastCompletedDay(completedDays: number[]): number | null {
  return completedDays.length > 0 ? completedDays[completedDays.length - 1] : null
}

export async function getActiveProgramDay(
  payload: Payload,
  userId: string | number,
  founderStartDate: string | null,
  archetype: string | null,
  track: string | null = null,
  partnerId: string | number | null = null,
): Promise<DayProgressionResult> {
  const isTestMode = await isUserInTestProgramState(payload, userId)
  const dayProgram = await payload.findGlobal({ slug: 'day-program' }).catch(() => null) as any
  const releaseTimeStr: string = dayProgram?.dailyReleaseTime || '12:00'
  const { hour: releaseHour, minute: releaseMinute } = parseReleaseTime(releaseTimeStr)

  const activeAttemptId = await getActiveAttemptId(payload, userId)
  const submissionWhere = buildProgramSubmissionWhere(
    userId,
    [{ programDay: { exists: true } }],
    activeAttemptId,
    isTestMode,
  ) as any

  const allSubs = await payload.find({
    collection: 'founder-form-submissions',
    where: submissionWhere,
    sort: 'programDay',
    limit: 200,
    depth: 0,
  })

  const completedDays = [...new Set(
    allSubs.docs
      .map((s: any) => s.programDay as number)
      .filter((d): d is number => typeof d === 'number' && d >= 1 && d <= 100)
  )].sort((a, b) => a - b)
  const curriculumContext = await resolveCurriculumContext(payload, {
    userId,
    personality: archetype,
    track,
  })

  if (isTestMode) {
    const completedSet = new Set(completedDays)
    const activeDay = getFirstIncompleteDay(completedDays)
    const formState = await resolveFormStateForActiveDay(
      payload,
      activeDay,
      userId,
      archetype,
      track,
      partnerId,
      completedSet,
      false,
    )
    const dayDefinition = await resolveDayDefinitionForDay(payload, activeDay, curriculumContext)
    const displayDay = getLastCompletedDay(completedDays) ?? activeDay
    const nextMissionDay = displayDay < 100 ? displayDay + 1 : null

    let displayFormState = formState
    let displayDayDefinition = dayDefinition
    let nextMissionFormState: Pick<DayProgressionResult, 'resolvedFormId' | 'dailyFormSlug' | 'dailyFormTitle' | 'hasSubmittedToday'> | null = null
    let nextMissionDayDefinition: DayDefinitionMeta | null = null

    if (displayDay !== activeDay) {
      displayFormState = await resolveFormStateForActiveDay(
        payload,
        displayDay,
        userId,
        archetype,
        track,
        partnerId,
        completedSet,
        false,
      )
      displayDayDefinition = await resolveDayDefinitionForDay(payload, displayDay, curriculumContext)
    }

    if (nextMissionDay != null) {
      if (nextMissionDay === activeDay) {
        nextMissionFormState = formState
        nextMissionDayDefinition = dayDefinition
      } else if (nextMissionDay === displayDay) {
        nextMissionFormState = displayFormState
        nextMissionDayDefinition = displayDayDefinition
      } else {
        nextMissionFormState = await resolveFormStateForActiveDay(
          payload,
          nextMissionDay,
          userId,
          archetype,
          track,
          partnerId,
          completedSet,
          false,
        )
        nextMissionDayDefinition = await resolveDayDefinitionForDay(payload, nextMissionDay, curriculumContext)
      }
    }

    return {
      activeDay,
      displayDay,
      nextMissionDay,
      isLocked: false,
      lockReason: null,
      nextUnlockTime: null,
      completedDays,
      resolvedFormId: formState.resolvedFormId,
      dailyFormSlug: formState.dailyFormSlug,
      dailyFormTitle: formState.dailyFormTitle,
      hasSubmittedToday: formState.hasSubmittedToday,
      displayFormSlug: displayFormState.dailyFormSlug,
      displayFormTitle: displayFormState.dailyFormTitle,
      displayHasSubmitted: displayFormState.hasSubmittedToday,
      nextMissionFormSlug: nextMissionFormState?.dailyFormSlug ?? null,
      nextMissionFormTitle: nextMissionFormState?.dailyFormTitle ?? null,
      isInactiveFailed: false,
      dayDefinition,
      displayDayDefinition,
      nextMissionDayDefinition,
    }
  }

  const completedSet = new Set(completedDays)

  const rawCalendarDay = founderStartDate
    ? computeCalendarDay(new Date(founderStartDate), new Date(), CET_TZ)
    : 0
  const calendarDay = Math.min(100, rawCalendarDay)

  let activeDay = 1
  if (calendarDay >= 1) {
    for (let d = 1; d <= calendarDay; d++) {
      if (!completedSet.has(d)) {
        activeDay = d
        break
      }
      if (d === calendarDay) {
        activeDay = Math.min(d + 1, 100)
      }
    }
  }

  let isLocked = false
  let lockReason: DayProgressionResult['lockReason'] = null
  let nextUnlockTime: string | null = null

  if (calendarDay < 1) {
    isLocked = true
    lockReason = 'before_program_start'
    nextUnlockTime = founderStartDate ? new Date(founderStartDate).toISOString() : null
  }

  if (activeDay > 1 && !completedSet.has(activeDay - 1)) {
    isLocked = true
    lockReason = 'previous_incomplete'
  }

  if (!isLocked && activeDay > 1) {
    const cet = getCETDate(new Date())
    const beforeRelease = cet.hours < releaseHour || (cet.hours === releaseHour && cet.minutes < releaseMinute)

    if (beforeRelease) {
      const lastCompletedSub = allSubs.docs.find((s: any) => s.programDay === activeDay - 1)
      if (lastCompletedSub) {
        const completedDate = getCETDate(new Date((lastCompletedSub as any).createdAt))
        const todayCET = getCETDate(new Date())
        if (completedDate.year === todayCET.year && completedDate.month === todayCET.month && completedDate.day === todayCET.day) {
          isLocked = true
          lockReason = 'before_release_time'
          nextUnlockTime = getNextReleaseCET(releaseHour, releaseMinute).toISOString()
        }
      }
    }
  }

  if (!isLocked && !nextUnlockTime && activeDay < 100 && completedSet.has(activeDay)) {
    nextUnlockTime = getNextReleaseCET(releaseHour, releaseMinute).toISOString()
  }

  const isInactiveFailed = false
  const formState = await resolveFormStateForActiveDay(
    payload,
    activeDay,
    userId,
    archetype,
    track,
    partnerId,
    completedSet,
    isLocked,
  )
  const dayDefinition = await resolveDayDefinitionForDay(payload, activeDay, curriculumContext)

  return {
    activeDay,
    displayDay: activeDay,
    nextMissionDay: null,
    isLocked,
    lockReason,
    nextUnlockTime,
    completedDays,
    resolvedFormId: formState.resolvedFormId,
    dailyFormSlug: formState.dailyFormSlug,
    dailyFormTitle: formState.dailyFormTitle,
    hasSubmittedToday: formState.hasSubmittedToday,
    displayFormSlug: formState.dailyFormSlug,
    displayFormTitle: formState.dailyFormTitle,
    displayHasSubmitted: formState.hasSubmittedToday,
    nextMissionFormSlug: null,
    nextMissionFormTitle: null,
    isInactiveFailed,
    dayDefinition,
    displayDayDefinition: dayDefinition,
    nextMissionDayDefinition: null,
  }
}

export async function validateDaySubmission(
  payload: Payload,
  userId: string | number,
  founderStartDate: string | null,
  archetype: string | null,
  formId: string | number,
  track: string | null = null,
  partnerId: string | number | null = null,
  requestedProgramDay?: number | null,
): Promise<{ allowed: boolean; programDay: number; error?: string }> {
  const submittedFormIsPrework = await isPreworkForm(payload, formId)

  if (submittedFormIsPrework) {
    try {
      const user = await payload.findByID({
        collection: 'users',
        id: userId,
        depth: 0,
      }) as any

      const isPreworkSubmissionMode = user?.programStatus === 'prework' || isTestProgramStatus(user?.programStatus)

      if (isPreworkSubmissionMode) {
        const activeAttemptId = await getActiveAttemptId(payload, userId)
        const existingSubs = await payload.find({
          collection: 'founder-form-submissions',
          where: buildProgramSubmissionWhere(
            userId,
            [{ form: { equals: formId } }],
            activeAttemptId,
            isTestProgramStatus(user?.programStatus),
          ),
          limit: 1,
          depth: 0,
        }).catch(() => null)

        if ((existingSubs?.totalDocs ?? 0) > 0) {
          return {
            allowed: false,
            programDay: 0,
            error: 'Already submitted for this prework block',
          }
        }

        return {
          allowed: true,
          programDay: 0,
        }
      }
    } catch {}
  }

  if (await isUserInTestProgramState(payload, userId)) {
    const requestedDay = normalizeRequestedProgramDay(requestedProgramDay)
    const inferredDay = requestedDay ?? await inferProgramDayFromForm(payload, formId)
    const targetDay = inferredDay ?? (await getActiveProgramDay(payload, userId, founderStartDate, archetype, track, partnerId)).activeDay
    const expectedFormId = await resolveFormForDay(payload, targetDay, userId, archetype, track, partnerId)

    if (expectedFormId && String(expectedFormId) !== String(formId)) {
      return {
        allowed: false,
        programDay: targetDay,
        error: 'Incorrect form for requested day',
      }
    }

    const activeAttemptId = await getActiveAttemptId(payload, userId)
    const existingSubs = await payload.find({
      collection: 'founder-form-submissions',
      where: buildProgramSubmissionWhere(
        userId,
        [{ programDay: { equals: targetDay } }],
        activeAttemptId,
        true,
      ),
      limit: 1,
      depth: 0,
    }).catch(() => null)

    if ((existingSubs?.totalDocs ?? 0) > 0) {
      return {
        allowed: false,
        programDay: targetDay,
        error: 'Already submitted for this day',
      }
    }

    return {
      allowed: true,
      programDay: targetDay,
    }
  }

  const progression = await getActiveProgramDay(payload, userId, founderStartDate, archetype, track, partnerId)

  if (progression.isLocked) {
    if (progression.lockReason === 'previous_incomplete') {
      return { allowed: false, programDay: progression.activeDay, error: `Complete day ${progression.activeDay - 1} first` }
    }
    if (progression.lockReason === 'before_release_time') {
      return { allowed: false, programDay: progression.activeDay, error: 'Task not yet available. Wait for the release time.' }
    }
    if (progression.lockReason === 'before_program_start') {
      return { allowed: false, programDay: progression.activeDay, error: 'Day 1 is not available yet. Your program starts on the scheduled start date.' }
    }
    return { allowed: false, programDay: progression.activeDay, error: 'Day is locked' }
  }

  if (progression.hasSubmittedToday) {
    return { allowed: false, programDay: progression.activeDay, error: 'Already submitted for this day' }
  }

  if (progression.resolvedFormId && String(progression.resolvedFormId) !== String(formId)) {
    return { allowed: false, programDay: progression.activeDay, error: 'Incorrect form for current day' }
  }

  return { allowed: true, programDay: progression.activeDay }
}
