import { getPayload } from 'payload'
import config from '@/payload.config'
import { headers, cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import MentorDashboard from '@/components/MentorDashboard'
import { filterBaseDayDefinitions } from '@/lib/curriculum/resolve'
import { findUserFromPayloadToken } from '@/lib/payloadUserToken'

export const dynamic = 'force-dynamic'

function addQuestionLabel(labels: Record<string, string>, question: any) {
  const questionId = question?.question_id ?? question?.questionId
  const questionTitle = question?.question_text ?? question?.questionTitle
  if (questionId && questionTitle) {
    labels[String(questionId)] = String(questionTitle)
  }
}

function buildQuestionLabels(
  formSections: Array<any[] | null | undefined> | any[] | null | undefined,
  dayDefinitionQuestions?: any[] | null,
) {
  const labels: Record<string, string> = {}
  for (const question of dayDefinitionQuestions ?? []) {
    addQuestionLabel(labels, question)
  }

  const sectionGroups = Array.isArray(formSections) && formSections.some((item) => Array.isArray(item))
    ? formSections as Array<any[] | null | undefined>
    : [formSections as any[] | null | undefined]

  for (const sections of sectionGroups) {
    for (const section of sections ?? []) {
      for (const question of section?.questions ?? []) {
        addQuestionLabel(labels, question)
      }
    }
  }
  return labels
}

function mapReviewForTimeline(review: any, dayNumber: number) {
  if (!review) return null

  return {
    id: review.id,
    dayNumber: review.dayNumber ?? dayNumber,
    score: review.score ?? 0,
    comment: review.comment ?? '',
    internalNote: review.internalNote ?? null,
    isGateReview: review.isGateReview ?? false,
    gateDecision: review.gateDecision ?? null,
    mentorName: typeof review.reviewer === 'object' ? review.reviewer?.email ?? null : null,
    createdAt: review.createdAt,
  }
}

export default async function MentorPage() {
  const payload = await getPayload({ config })
  const headersObj = await headers()
  const cookieStore = await cookies()
  const token = cookieStore.get('payload-token')?.value

  let user: any = null

  try {
    const authResult = await payload.auth({ headers: headersObj })
    user = authResult.user
  } catch (e) {}

  if (!user && token) {
    try {
      user = await findUserFromPayloadToken(payload, token)
    } catch (e) {}
  }

  if (!user) {
    redirect('/login')
  }

  if (user.role !== 'mentor' && user.role !== 'admin') {
    redirect('/')
  }

  // Determine mentor type
  const mentorPartnerId =
    typeof user.partner === 'object' && user.partner !== null
      ? user.partner.id
      : user.partner || null
  const mentorType: 'partner' | 'admin' =
    user.role === 'admin' || !mentorPartnerId ? 'admin' : 'partner'

  // Resolve partner name for display
  let partnerName: string | null = null
  if (mentorPartnerId) {
    try {
      const partnerDoc = await payload.findByID({
        collection: 'partners',
        id: mentorPartnerId,
      })
      partnerName = (partnerDoc as any)?.name ?? null
    } catch (e) {}
  }

  const assignedMentorProfiles = user.role === 'mentor'
    ? await payload.find({
        collection: 'mentors',
        where: {
          and: [
            { user: { equals: user.id } },
            { isActive: { equals: true } },
          ],
        },
        limit: 50,
        depth: 0,
        overrideAccess: true,
      }).catch(() => ({ docs: [] as any[] }))
    : { docs: [] as any[] }
  const assignedMentorProfileIds = (assignedMentorProfiles.docs as any[]).map((profile) => profile.id)

  const founderUserFilter: Record<string, any> = user.role === 'mentor'
    ? {
        role: { equals: 'founder' },
        mentor: { in: assignedMentorProfileIds.join(',') },
      }
    : { role: { equals: 'founder' } }

  const foundersResult = await payload.find({
    collection: 'users',
    where: founderUserFilter,
    limit: 500,
    depth: 0,
    overrideAccess: true,
  })
  const founderUsers = foundersResult.docs as any[]
  const founderIds = founderUsers.map((founder) => founder.id)

  // Fetch all existing reviews so we can identify reviewed vs pending
  const existingReviews = await payload.find({
    collection: 'mentor-reviews',
    limit: 3000,
    depth: 1,
    sort: '-createdAt',
    overrideAccess: true,
  })

  const reviewedSubmissionIds = new Set<number>()
  const reviewsBySubmissionId = new Map<number, any>()
  for (const r of existingReviews.docs as any[]) {
    const subId = typeof r.submission === 'object' ? r.submission?.id : r.submission
    if (subId) {
      reviewedSubmissionIds.add(subId)
      if (!reviewsBySubmissionId.has(subId)) {
        reviewsBySubmissionId.set(subId, r)
      }
    }
  }

  // Fetch submissions that are candidates for review
  const allSubmissions = founderIds.length > 0
    ? await payload.find({
        collection: 'founder-form-submissions',
        where: {
          user: { in: founderIds.join(',') },
          programDay: { greater_than: 0 },
        },
        sort: '-createdAt',
        limit: 200,
        depth: 2,
        overrideAccess: true,
      })
    : { docs: [] as any[] }

  // Fetch auto-check results
  const submissionIds = allSubmissions.docs.map((s: any) => s.id)
  const autoCheckResults =
    submissionIds.length > 0
      ? await payload.find({
          collection: 'auto-check-results',
          where: { submission: { in: submissionIds.join(',') } },
          limit: 500,
          depth: 0,
          overrideAccess: true,
        })
      : { docs: [] }

  const autoCheckBySubmission = new Map<number, any>()
  for (const acr of autoCheckResults.docs) {
    const subId =
      typeof acr.submission === 'object'
        ? (acr.submission as any)?.id
        : acr.submission
    if (subId) autoCheckBySubmission.set(subId, acr)
  }

  // Fetch day definitions for context
  const dayDefResult = await payload.find({
    collection: 'day-definitions',
    where: { blockType: { in: ['day', 'prework', 'gate', 'weekly'] } },
    limit: 200,
    depth: 0,
    overrideAccess: true,
  })
  const baseDayDefs = await filterBaseDayDefinitions(payload, dayDefResult.docs as any[])
  const dayDefByNumber = new Map<number, any>()
  for (const dd of baseDayDefs as any[]) {
    if (dd.dayNumber) dayDefByNumber.set(dd.dayNumber, dd)
  }

  const linkedFormIds = [
    ...new Set(
      (baseDayDefs as any[])
        .map((dd) => typeof dd.linkedForm === 'object' ? dd.linkedForm?.id : dd.linkedForm)
        .filter(Boolean)
        .map((id) => Number(id)),
    ),
  ]

  const linkedFormsResult = linkedFormIds.length > 0
    ? await payload.find({
        collection: 'founder-forms',
        where: { id: { in: linkedFormIds.join(',') } },
        limit: linkedFormIds.length,
        depth: 0,
        overrideAccess: true,
      })
    : { docs: [] as any[] }

  const linkedFormById = new Map<number, any>()
  for (const form of linkedFormsResult.docs as any[]) {
    linkedFormById.set(Number(form.id), form)
  }

  // Map submissions
  const pendingSubmissions: any[] = []
  const reviewedSubmissions: any[] = []
  const founderTimelineById = new Map<number, {
    currentDay: number
    completedDays: number[]
    missedDays: number[]
    submissions: any[]
    reviews: any[]
  }>()

  for (const sub of allSubmissions.docs as any[]) {
    const acr = autoCheckBySubmission.get(sub.id)
    const founderUser = typeof sub.user === 'object' ? sub.user : null
    const founderEmail = sub.email ?? founderUser?.email ?? 'unknown'
    const dayNumber = sub.programDay ?? 0
    const dayType = sub.dayType ?? 'standard'
    const dayDef = dayDefByNumber.get(dayNumber)
    const linkedFormId = typeof dayDef?.linkedForm === 'object' ? dayDef?.linkedForm?.id : dayDef?.linkedForm
    const linkedFormObj = linkedFormId ? linkedFormById.get(Number(linkedFormId)) : null

    // Extract answers from submissionData
    const submissionData = sub.submissionData || {}
    const formObj = typeof sub.form === 'object' ? sub.form : null
    const questionLabels = buildQuestionLabels([formObj?.sections, linkedFormObj?.sections], dayDef?.questions)
    const timelineReview = mapReviewForTimeline(reviewsBySubmissionId.get(sub.id), dayNumber)

    const mapped = {
      id: sub.id,
      founderEmail,
      founderId: founderUser?.id ?? null,
      dayNumber,
      dayType,
      programDay: dayNumber,
      submittedAt: sub.createdAt,
      isBackfill: sub.isBackfill ?? false,
      submissionData,
      questionLabels,
      formTitle: formObj?.title ?? null,
      formSections: formObj?.sections ?? null,
      aiSummary: acr?.aiSummary ?? null,
      checksPassed: acr?.checksPassed ?? null,
      linkUrl: acr?.linkUrl ?? null,
      linkReachable: acr?.linkReachable ?? null,
      attemptNumber:
        typeof sub.attempt === 'object' ? sub.attempt?.attemptNumber : undefined,
      // Day definition context
      theme: dayDef?.theme ?? null,
      deliverable: dayDef?.deliverable ?? null,
      autoCheckCriteria: dayDef?.autoCheckCriteria ?? null,
      blockFocus: dayDef?.blockFocus ?? null,
    }

    const founderId = founderUser?.id ?? null
    if (founderId) {
      const existingTimeline = founderTimelineById.get(founderId) ?? {
        currentDay: 0,
        completedDays: [],
        missedDays: [],
        submissions: [],
        reviews: [],
      }

      existingTimeline.submissions.push({
        id: sub.id,
        programDay: dayNumber,
        dayType,
        isBackfill: sub.isBackfill ?? false,
        formTitle: formObj?.title || formObj?.slug || `Day ${dayNumber}`,
        createdAt: sub.createdAt,
        submissionData,
        questionLabels,
        review: timelineReview,
      })

      if (timelineReview) {
        existingTimeline.reviews.push(timelineReview)
      }

      if (dayNumber >= 1 && dayNumber <= 100) {
        existingTimeline.completedDays.push(dayNumber)
      }

      founderTimelineById.set(founderId, existingTimeline)
    }

    if (reviewedSubmissionIds.has(sub.id)) {
      reviewedSubmissions.push({
        ...mapped,
        review: timelineReview
          ? {
              ...timelineReview,
              reviewerEmail: timelineReview.mentorName,
            }
          : null,
      })
    } else {
      pendingSubmissions.push(mapped)
    }
  }

  const attemptsResult = founderIds.length > 0
    ? await payload.find({
        collection: 'attempts',
        where: { or: founderIds.map((founderId) => ({ user: { equals: founderId } })) } as any,
        sort: '-createdAt',
        limit: 2000,
        depth: 0,
        overrideAccess: true,
      }).catch(() => ({ docs: [] }))
    : { docs: [] as any[] }

  const latestAttemptByFounderId = new Map<number, any>()
  for (const attempt of attemptsResult.docs as any[]) {
    const founderId = typeof attempt.user === 'object' ? attempt.user?.id : attempt.user
    if (founderId && !latestAttemptByFounderId.has(founderId)) {
      latestAttemptByFounderId.set(founderId, attempt)
    }
  }

  for (const review of existingReviews.docs as any[]) {
    const submission = typeof review.submission === 'object' ? review.submission : null
    const founderUser = submission?.user && typeof submission.user === 'object' ? submission.user : null
    const founderId = founderUser?.id ?? null
    if (!founderId) continue

    const existingTimeline = founderTimelineById.get(founderId) ?? {
      currentDay: 0,
      completedDays: [],
      missedDays: [],
      submissions: [],
      reviews: [],
    }

    existingTimeline.reviews.push({
      id: review.id,
      dayNumber: review.dayNumber ?? 0,
      score: review.score ?? 0,
      comment: review.comment ?? '',
      internalNote: review.internalNote ?? null,
      isGateReview: review.isGateReview ?? false,
      gateDecision: review.gateDecision ?? null,
      mentorName: typeof review.reviewer === 'object' ? review.reviewer?.email ?? null : null,
      createdAt: review.createdAt,
    })

    founderTimelineById.set(founderId, existingTimeline)
  }

  // Fetch recent reviews by this mentor
  const myReviews = await payload.find({
    collection: 'mentor-reviews',
    where: { reviewer: { equals: user.id } },
    sort: '-createdAt',
    limit: 50,
    depth: 1,
    overrideAccess: true,
  })

  const recentReviews = myReviews.docs.map((r: any) => {
    const sub = typeof r.submission === 'object' ? r.submission : null
    const founderEmail =
      sub?.email ??
      (typeof sub?.user === 'object' ? sub?.user?.email : null) ??
      'unknown'
    return {
      id: r.id,
      submissionId: sub?.id ?? null,
      founderEmail,
      dayNumber: r.dayNumber ?? 0,
      score: r.score ?? 0,
      comment: r.comment ?? '',
      isGateReview: r.isGateReview ?? false,
      gateDecision: r.gateDecision ?? null,
      createdAt: r.createdAt,
    }
  })

  const founders = founderUsers.map((founder) => {
    const timeline = founderTimelineById.get(founder.id) ?? {
      currentDay: 0,
      completedDays: [],
      missedDays: [],
      submissions: [],
      reviews: [],
    }
    const latestAttempt = latestAttemptByFounderId.get(founder.id)
    const completedDays = [...new Set(timeline.completedDays)].sort((a, b) => a - b)
    const submissions = [...timeline.submissions].sort((a, b) => a.programDay - b.programDay || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    const reviewsById = new Map<string, any>()
    for (const review of timeline.reviews) {
      reviewsById.set(String(review.id), review)
    }
    const reviews = [...reviewsById.values()].sort((a, b) => a.dayNumber - b.dayNumber || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

    return {
      id: founder.id,
      email: founder.email,
      programStatus: founder.programStatus || 'not_started',
      currentDay: latestAttempt?.currentDay ?? (completedDays[completedDays.length - 1] ?? 0),
      completedDays,
      missedDays: Array.isArray(latestAttempt?.missedDays) ? latestAttempt.missedDays : [],
      submissions,
      reviews,
    }
  })

  return (
    <MentorDashboard
      user={user}
      mentorType={mentorType}
      partnerName={partnerName}
      pendingSubmissions={pendingSubmissions}
      reviewedSubmissions={reviewedSubmissions}
      recentReviews={recentReviews}
      founders={founders}
    />
  )
}
