import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@/payload.config'
import FounderFormComponent from '@/components/FounderForm'
import { computeCalendarDay, getDayType, hasReachedProgramStartDate, parseProgramConfig } from '@/lib/attemptEngine'
import { normalizeEstimatedTimeHrs } from '@/lib/estimatedTime'
import { isTestProgramStatus } from '@/lib/programTestMode'
import { resolveCurriculumContext, resolveDayDefinitionByBlockKey } from '@/lib/curriculum/resolve'
import { findUserFromPayloadToken } from '@/lib/payloadUserToken'
import { ensureFreshAttemptState } from '@/lib/ensureFreshAttemptState'

export const dynamic = 'force-dynamic'

function inferProgramDayFromSlug(slug: string): number | null {
  const directMatch = slug.match(/^daily-(?:day|gate)-block-(\d+)$/)
  if (directMatch) {
    const day = Number(directMatch[1])
    return Number.isInteger(day) && day >= 1 && day <= 100 ? day : null
  }

  const weekMatch = slug.match(/^daily-week-block-(\d+)$/)
  if (!weekMatch) return null

  const rawValue = Number(weekMatch[1])
  if (!Number.isInteger(rawValue) || rawValue < 1) return null

  const maxWeekNumber = Math.ceil(100 / 7)
  const day = rawValue <= maxWeekNumber ? rawValue * 7 : rawValue
  return day >= 1 && day <= 100 ? day : null
}

function getCanonicalSlugForProgramDay(dayNumber: number, retroEveryN: number, gateDays: number[]): string {
  const dayType = getDayType(dayNumber, {
    ...parseProgramConfig(null),
    retroEveryNDays: retroEveryN,
    gateDays,
  })

  if (dayType === 'gate') return `/day/daily-gate-block-${dayNumber}`
  if (dayType === 'retro') return `/day/daily-week-block-${Math.floor(dayNumber / retroEveryN)}`
  return `/day/daily-day-block-${dayNumber}`
}

export default async function DayFormPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const payload = await getPayload({ config })
  const hdrs = await headers()
  const dayProgram = await payload.findGlobal({ slug: 'day-program' }).catch(() => null) as any
  const programConfig = parseProgramConfig(dayProgram)

  // Authenticate user (same two-step fallback as other pages)
  let user: any = null
  try {
    const result = await payload.auth({ headers: hdrs })
    if (result.user) user = result.user
  } catch {}

  if (!user) {
    try {
      const cookieStore = await cookies()
      const token = cookieStore.get('payload-token')?.value
      if (token) {
        user = await findUserFromPayloadToken(payload, token)
      }
    } catch {}
  }

  if (!user) redirect('/login')
  if (user.role !== 'founder') redirect('/')

  const freshAttemptState = await ensureFreshAttemptState(payload, user)
  user = freshAttemptState.user
  let programStatus = freshAttemptState.programStatus
  const activeProgramStartDate = freshAttemptState.activeAttemptStartedAt || user.programStartDate || null

  const isTestMode = isTestProgramStatus(programStatus)

  if (programStatus !== 'active' && programStatus !== 'prework' && !isTestMode) {
    redirect('/')
  }
  const isPrework = programStatus === 'prework' || slug.includes('prework-block')
  const canonicalProgramDay = !isPrework ? inferProgramDayFromSlug(slug) : null

  if (canonicalProgramDay != null) {
    const canonicalSlug = getCanonicalSlugForProgramDay(
      canonicalProgramDay,
      programConfig.retroEveryNDays,
      programConfig.gateDays,
    )

    if (canonicalSlug !== `/day/${slug}`) {
      redirect(canonicalSlug)
    }
  }

  // Load the form by slug
  let resolvedSlug = slug
  let formDocs = await payload.find({
    collection: 'founder-forms',
    where: { slug: { equals: resolvedSlug } },
    limit: 1,
  })

  if (formDocs.totalDocs === 0) {
    const weekAliasMatch = slug.match(/^daily-week-block-(\d+)$/)
    if (weekAliasMatch) {
      const rawValue = Number(weekAliasMatch[1])
      const maxWeekNumber = Math.ceil(100 / 7)
      if (Number.isInteger(rawValue) && rawValue > maxWeekNumber && rawValue % 7 === 0) {
        resolvedSlug = `daily-week-block-${Math.floor(rawValue / 7)}`
        formDocs = await payload.find({
          collection: 'founder-forms',
          where: { slug: { equals: resolvedSlug } },
          limit: 1,
        })
      }
    }
  }

  if (formDocs.totalDocs === 0) {
    redirect('/')
  }

  const form = formDocs.docs[0] as any

  // Load platform settings and partner branding
  const settings = await payload.findGlobal({ slug: 'platform-settings' }).catch(() => ({})) as any
  const partnerId = user.partner?.id ?? user.partner ?? null
  let partnerBranding = null
  if (partnerId) {
    try {
      const partner = await payload.findByID({ collection: 'partners', id: partnerId }) as any
      if (partner?.brandingColors) {
        partnerBranding = partner.brandingColors
      }
    } catch {}
  }

  // Load DayDefinition metadata for context display
  let dayDefinition: any = null
  let dayNumber: number | null = canonicalProgramDay
  try {
    const dayMatch = resolvedSlug.match(/^daily-day-block-(\d+)$/)
    const gateMatch = resolvedSlug.match(/^daily-gate-block-(\d+)$/)
    const weekMatch = resolvedSlug.match(/^daily-week-block-(\d+)$/)
    const preworkMatch = resolvedSlug.match(/^daily-prework-block-(\d+)$/)

    let blockKey: string | null = null
    if (dayMatch) {
      blockKey = `DAY-BLOCK-${dayMatch[1]}`
      dayNumber = canonicalProgramDay ?? parseInt(dayMatch[1], 10) ?? dayNumber
    } else if (gateMatch) {
      blockKey = `GATE-BLOCK-${gateMatch[1]}`
      dayNumber = canonicalProgramDay ?? parseInt(gateMatch[1], 10) ?? dayNumber
    } else if (weekMatch) {
      blockKey = `WEEK-BLOCK-${weekMatch[1]}`
      const weekNum = parseInt(weekMatch[1], 10) || 0
      dayNumber = canonicalProgramDay ?? Math.min(weekNum * programConfig.retroEveryNDays, 100)
    } else if (preworkMatch) {
      blockKey = `PREWORK-BLOCK-${preworkMatch[1]}`
    }

    if (blockKey) {
      const curriculumContext = await resolveCurriculumContext(payload, {
        userId: user.id,
      })
      const def = await resolveDayDefinitionByBlockKey(payload, blockKey, curriculumContext)
      if (def) {
        const resolvedDefinitionDayNumber = def?.blockType === 'weekly'
          ? dayNumber ?? (typeof def?.weekNumber === 'number' ? Math.min(def.weekNumber * programConfig.retroEveryNDays, 100) : ((def?.dayNumber as number | null | undefined) ?? null))
          : dayNumber ?? (def?.dayNumber as number | null | undefined) ?? null
        dayDefinition = {
          ...def,
          dayNumber: resolvedDefinitionDayNumber,
          estimatedTimeHrs: normalizeEstimatedTimeHrs(def?.estimatedTimeHrs),
        }
        dayNumber = resolvedDefinitionDayNumber
      }
    }
  } catch {}

  // Block access to future/locked days
  if (dayNumber !== null && dayNumber > 0 && !isPrework && !isTestMode) {
    const programStartDate = activeProgramStartDate
    if (
      !programStartDate ||
      !hasReachedProgramStartDate(new Date(programStartDate), new Date(), 'Europe/Warsaw')
    ) {
      redirect('/')
    }
    const calendarDay = Math.min(
      100,
      computeCalendarDay(new Date(programStartDate), new Date(), 'Europe/Warsaw'),
    )

    // Find completed days to determine the actual active day
    // (user may have completed days ahead of the calendar if they started early)
    const completedSubs = await payload.find({
      collection: 'founder-form-submissions',
      where: { user: { equals: user.id }, programDay: { greater_than: 0 } },
      limit: 200,
      depth: 0,
    })
    const completedDays = new Set(
      completedSubs.docs.map((s: any) => s.programDay as number).filter((d): d is number => typeof d === 'number' && d >= 1)
    )
    // Active day = first uncompleted day up to calendarDay, or calendarDay+1 if all done
    let activeDay = calendarDay
    for (let d = 1; d <= calendarDay; d++) {
      if (!completedDays.has(d)) { activeDay = d; break }
      if (d === calendarDay) activeDay = Math.min(d + 1, 100)
    }

    if (dayNumber > activeDay && !completedDays.has(dayNumber)) {
      redirect('/')
    }
  }

  // Check if user already submitted for this form — if so, show read-only
  let existingAnswers: Record<string, any> | null = null
  let projectWorkspaceUrl: string | null = null
  try {
    const projectSubmission = await payload.find({
      collection: 'project-submissions',
      where: { user: { equals: user.id } },
      sort: '-updatedAt',
      limit: 1,
      depth: 0,
    })
    projectWorkspaceUrl = projectSubmission.docs[0]?.workspaceUrl ?? null
  } catch {}

  try {
    const activeAttemptResult = await payload.find({
      collection: 'attempts',
      where: {
        user: { equals: user.id },
        status: { in: ['active', 'warned_1', 'warned_2'] },
      },
      sort: '-attemptNumber',
      limit: 1,
      depth: 0,
    }).catch(() => null)
    const activeAttemptId = activeAttemptResult?.docs?.[0]?.id ?? null

    const existingClauses: any[] = [
      { user: { equals: user.id } },
      !isPrework && dayNumber != null
        ? { programDay: { equals: dayNumber } }
        : { form: { equals: form.id } },
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
    ]

    const existingSubs = await payload.find({
      collection: 'founder-form-submissions',
      where: { and: existingClauses },
      sort: '-createdAt',
      limit: 1,
      depth: 0,
    })
    if (existingSubs.totalDocs > 0) {
      const sub = existingSubs.docs[0] as any
      existingAnswers = sub.submissionData ?? null
    }
  } catch {}

  const isReadOnly = existingAnswers !== null

  return (
    <FounderFormComponent
      form={form}
      initialPartnerId={partnerId ? Number(partnerId) : null}
      partnerBrandingColors={partnerBranding}
      platformSettings={settings}
      dayDefinitionContext={dayDefinition}
      isDailyForm={!isPrework}
      isPrework={isPrework}
      dayNumber={dayNumber}
      readOnly={isReadOnly}
      existingAnswers={existingAnswers}
      projectWorkspaceUrl={projectWorkspaceUrl}
    />
  )
}
