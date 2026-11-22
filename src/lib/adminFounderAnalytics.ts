import { resolveArchetypeDisplay } from '@/lib/personalityTest'

export type RelationValue = string | number | { id?: string | number; name?: string; slug?: string; email?: string } | null | undefined

export interface AnalyticsOption {
  id: string
  label: string
}

export interface FounderAnalyticsFilters {
  trackId?: string
  partnerId?: string
  personality?: string
  query?: string
}

export interface FounderAnalyticsRow {
  id: string
  email: string
  createdAt: string | null
  partnerId: string | null
  partnerName: string | null
  programTrackId: string | null
  programTrackName: string | null
  personality: string | null
  personalityEmoji: string | null
  personalityTrack: string | null
  programStatus: string
  attemptStatus: string | null
  attemptCurrentDay: number
  completedDays: number[]
  daySubmissionIds: Record<number, string>
  stepLinks: Partial<Record<keyof FounderAnalyticsRow['steps'], string>>
  currentDay: number
  lastSubmissionAt: string | null
  latestProjectStatus: string | null
  steps: {
    registered: boolean
    intake: boolean
    personality: boolean
    project: boolean
    prework: boolean
    started100Days: boolean
    active100Days: boolean
    finished: boolean
    failed: boolean
  }
}

export interface FounderAnalyticsResult {
  rows: FounderAnalyticsRow[]
  filteredRows: FounderAnalyticsRow[]
  trackOptions: AnalyticsOption[]
  partnerOptions: AnalyticsOption[]
  personalityOptions: AnalyticsOption[]
  stepCounts: Record<keyof FounderAnalyticsRow['steps'], number>
  distributions: {
    tracks: Record<string, number>
    partners: Record<string, number>
    personalities: Record<string, number>
    statuses: Record<string, number>
  }
}

export function relationId(value: RelationValue): string | null {
  if (value == null) return null
  if (typeof value === 'object') {
    const id = value.id
    return id == null ? null : String(id)
  }
  return String(value)
}

function relationLabel(value: RelationValue, fallback: string): string {
  if (value && typeof value === 'object') {
    return value.name || value.email || value.slug || fallback
  }
  return fallback
}

function latestByUser(docs: any[]): Record<string, any> {
  const byUser: Record<string, any> = {}
  for (const doc of docs) {
    const userId = relationId(doc?.user)
    if (!userId) continue
    const current = byUser[userId]
    if (!current || String(doc?.createdAt || '') > String(current?.createdAt || '')) {
      byUser[userId] = doc
    }
  }
  return byUser
}

function latestAttemptByUser(docs: any[]): Record<string, any> {
  const byUser: Record<string, any> = {}
  for (const doc of docs) {
    const userId = relationId(doc?.user)
    if (!userId) continue
    const current = byUser[userId]
    const nextDate = String(doc?.updatedAt || doc?.createdAt || doc?.startedAt || '')
    const currentDate = String(current?.updatedAt || current?.createdAt || current?.startedAt || '')
    if (!current || nextDate > currentDate) {
      byUser[userId] = doc
    }
  }
  return byUser
}

function addOption(map: Map<string, string>, id: string | null, label: string | null) {
  if (!id || !label) return
  if (!map.has(id)) map.set(id, label)
}

function increment(map: Record<string, number>, key: string | null | undefined) {
  const label = key && key.trim() ? key.trim() : 'Unassigned'
  map[label] = (map[label] || 0) + 1
}

function computeCurrentDay(completedDays: number[], fallbackDay: number): number {
  const completedSet = new Set(completedDays)
  for (let day = 1; day <= 100; day += 1) {
    if (!completedSet.has(day)) return Math.max(day, fallbackDay || 1)
  }
  return 100
}

export function buildFounderAnalytics({
  users,
  submissions,
  projectSubmissions,
  attempts,
  partners,
  tracks,
  settings,
  activePersonalityTestFormId,
  filters = {},
}: {
  users: any[]
  submissions: any[]
  projectSubmissions: any[]
  attempts: any[]
  partners: any[]
  tracks: any[]
  settings: any
  activePersonalityTestFormId: string | null
  filters?: FounderAnalyticsFilters
}): FounderAnalyticsResult {
  const submissionState: Record<string, {
    completedDays: number[]
    daySubmissionIds: Record<number, string>
    daySubmissionDates: Record<number, string>
    lastSubmissionAt: string | null
    hasIntake: boolean
    personality: string | null
    personalityEmoji: string | null
    personalityTrack: string | null
    intakeSubmissionId: string | null
    intakeSubmissionDate: string | null
    personalitySubmissionId: string | null
    personalitySubmissionDate: string | null
  }> = {}

  for (const sub of submissions) {
    const userId = relationId(sub?.user)
    if (!userId) continue
    if (!submissionState[userId]) {
      submissionState[userId] = {
        completedDays: [],
        daySubmissionIds: {},
        daySubmissionDates: {},
        lastSubmissionAt: null,
        hasIntake: false,
        personality: null,
        personalityEmoji: null,
        personalityTrack: null,
        intakeSubmissionId: null,
        intakeSubmissionDate: null,
        personalitySubmissionId: null,
        personalitySubmissionDate: null,
      }
    }

    const state = submissionState[userId]
    const formId = relationId(sub?.form)
    const isPersonalityTest = activePersonalityTestFormId != null && formId === activePersonalityTestFormId
    const programDay = Number(sub?.programDay)

    if (Number.isFinite(programDay) && programDay >= 1 && programDay <= 100) {
      state.completedDays.push(programDay)
      if (sub?.id != null) {
        const previousDate = state.daySubmissionDates[programDay]
        if (!previousDate || String(sub?.createdAt || '') > previousDate) {
          state.daySubmissionIds[programDay] = String(sub.id)
          state.daySubmissionDates[programDay] = String(sub?.createdAt || '')
        }
      }
    } else if (!isPersonalityTest) {
      state.hasIntake = true
      if (sub?.id != null) {
        const createdAt = String(sub?.createdAt || '')
        if (!state.intakeSubmissionDate || createdAt > state.intakeSubmissionDate) {
          state.intakeSubmissionId = String(sub.id)
          state.intakeSubmissionDate = createdAt
        }
      }
    }

    if (isPersonalityTest && sub?.archetype) {
      const display = resolveArchetypeDisplay(sub.archetype, {
        archetypes: settings?.personality?.archetypes,
        emoji: sub.personalityScores?.archetypeEmoji,
        tagline: sub.personalityScores?.archetypeTagline,
      })
      state.personality = display.key
      state.personalityEmoji = display.emoji
      state.personalityTrack = typeof sub.track === 'string' ? sub.track : null
      if (sub?.id != null) {
        const createdAt = String(sub?.createdAt || '')
        if (!state.personalitySubmissionDate || createdAt > state.personalitySubmissionDate) {
          state.personalitySubmissionId = String(sub.id)
          state.personalitySubmissionDate = createdAt
        }
      }
    }

    if (sub?.createdAt && (!state.lastSubmissionAt || sub.createdAt > state.lastSubmissionAt)) {
      state.lastSubmissionAt = sub.createdAt
    }
  }

  const latestProjectByUser = latestByUser(projectSubmissions)
  const latestAttempt = latestAttemptByUser(attempts)
  const partnerOptionMap = new Map<string, string>()
  const trackOptionMap = new Map<string, string>()
  const personalityOptionMap = new Map<string, string>()

  for (const partner of partners) addOption(partnerOptionMap, relationId(partner), relationLabel(partner, `Partner ${relationId(partner)}`))
  for (const track of tracks) addOption(trackOptionMap, relationId(track), relationLabel(track, `Track ${relationId(track)}`))

  const rows = users
    .filter((user) => user?.role === 'founder')
    .map((user): FounderAnalyticsRow => {
      const userId = String(user.id)
      const state = submissionState[userId] || {
        completedDays: [],
        daySubmissionIds: {},
        daySubmissionDates: {},
        lastSubmissionAt: null,
        hasIntake: false,
        personality: null,
        personalityEmoji: null,
        personalityTrack: null,
        intakeSubmissionId: null,
        intakeSubmissionDate: null,
        personalitySubmissionId: null,
        personalitySubmissionDate: null,
      }
      const project = latestProjectByUser[userId]
      const attempt = latestAttempt[userId]
      const completedDays = Array.from(new Set(state.completedDays)).sort((a, b) => a - b)
      const attemptCurrentDay = Number(attempt?.currentDay || 0)
      const currentDay = computeCurrentDay(completedDays, attemptCurrentDay)
      const partnerId = relationId(user.partner || project?.partner)
      const partnerName = partnerId
        ? relationLabel(user.partner || project?.partner, partnerOptionMap.get(partnerId) || `Partner ${partnerId}`)
        : null
      const trackId = relationId(project?.track)
      const trackName = trackId
        ? relationLabel(project?.track, trackOptionMap.get(trackId) || `Track ${trackId}`)
        : null
      const programStatus = user.programStatus || 'not_started'
      const attemptStatus = attempt?.status || null
      const hasPaid = Boolean(user.hasPaid100Days)
      const started100Days = Boolean(
        attempt ||
        user.programStartDate ||
        ['active', 'completed', 'failed', 'frozen', 'test'].includes(programStatus),
      )
      const finished = Boolean(programStatus === 'completed' || attemptStatus === 'completed' || completedDays.length >= 100)
      const failed = Boolean(programStatus === 'failed' || attemptStatus === 'failed')
      const attemptHref = attempt?.id != null ? `/admin/collections/attempts/${attempt.id}` : undefined
      const stepLinks: FounderAnalyticsRow['stepLinks'] = {
        registered: `/admin/collections/users/${userId}`,
        ...(state.intakeSubmissionId ? { intake: `/admin/collections/founder-form-submissions/${state.intakeSubmissionId}` } : {}),
        ...(state.personalitySubmissionId ? { personality: `/admin/collections/founder-form-submissions/${state.personalitySubmissionId}` } : {}),
        ...(project?.id != null ? { project: `/admin/collections/project-submissions/${project.id}` } : {}),
        ...(attemptHref ? {
          prework: attemptHref,
          started100Days: attemptHref,
          active100Days: attemptHref,
          finished: attemptHref,
          failed: attemptHref,
        } : {}),
      }

      if (state.personality) addOption(personalityOptionMap, state.personality, `${state.personalityEmoji || ''} ${state.personality}`.trim())
      addOption(partnerOptionMap, partnerId, partnerName)
      addOption(trackOptionMap, trackId, trackName)

      return {
        id: userId,
        email: user.email || `Founder ${userId}`,
        createdAt: user.createdAt || null,
        partnerId,
        partnerName,
        programTrackId: trackId,
        programTrackName: trackName,
        personality: state.personality,
        personalityEmoji: state.personalityEmoji,
        personalityTrack: state.personalityTrack,
        programStatus,
        attemptStatus,
        attemptCurrentDay,
        completedDays,
        daySubmissionIds: state.daySubmissionIds,
        stepLinks,
        currentDay,
        lastSubmissionAt: state.lastSubmissionAt,
        latestProjectStatus: project?.status || null,
        steps: {
          registered: true,
          intake: state.hasIntake,
          personality: Boolean(state.personality),
          project: Boolean(project),
          prework: Boolean(hasPaid || ['prework', 'active', 'completed', 'failed', 'frozen', 'test'].includes(programStatus)),
          started100Days,
          active100Days: Boolean(started100Days && !finished && !failed),
          finished,
          failed,
        },
      }
    })
    .sort((a, b) => b.completedDays.length - a.completedDays.length)

  const query = filters.query?.trim().toLowerCase() || ''
  const filteredRows = rows.filter((row) => {
    if (filters.trackId && row.programTrackId !== filters.trackId) return false
    if (filters.partnerId && row.partnerId !== filters.partnerId) return false
    if (filters.personality && row.personality !== filters.personality) return false
    if (query && !row.email.toLowerCase().includes(query)) return false
    return true
  })

  const stepCounts = {
    registered: 0,
    intake: 0,
    personality: 0,
    project: 0,
    prework: 0,
    started100Days: 0,
    active100Days: 0,
    finished: 0,
    failed: 0,
  }
  const distributions = {
    tracks: {} as Record<string, number>,
    partners: {} as Record<string, number>,
    personalities: {} as Record<string, number>,
    statuses: {} as Record<string, number>,
  }

  for (const row of filteredRows) {
    for (const key of Object.keys(stepCounts) as Array<keyof typeof stepCounts>) {
      if (row.steps[key]) stepCounts[key] += 1
    }
    increment(distributions.tracks, row.programTrackName)
    increment(distributions.partners, row.partnerName)
    increment(distributions.personalities, row.personality ? `${row.personalityEmoji || ''} ${row.personality}`.trim() : null)
    increment(distributions.statuses, row.attemptStatus || row.programStatus)
  }

  const toOptions = (map: Map<string, string>) => Array.from(map.entries())
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label))

  return {
    rows,
    filteredRows,
    trackOptions: toOptions(trackOptionMap),
    partnerOptions: toOptions(partnerOptionMap),
    personalityOptions: toOptions(personalityOptionMap),
    stepCounts,
    distributions,
  }
}
