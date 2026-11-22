import { getPayload } from 'payload'
import config from '@/payload.config'
import { headers, cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import RoleSelectionModal from '@/components/RoleSelectionModal'
import LandingPage from '@/components/LandingPage'
import DashboardClient from '@/components/DashboardClient'
import PartnerPage from '@/app/partner/page'
import MentorPage from '@/app/mentor/page'
import { getActiveProgramDay } from '@/lib/dayProgression'
import { PREFERRED_TRACK_COOKIE } from '@/lib/preferredTrack'
import { buildAvailableTrackOptions, isSpaceTrackSlug } from '@/lib/availableTracks'
import { getEffectiveMaxAttemptsForUser } from '@/lib/attemptLimits'
import { isTestProgramStatus } from '@/lib/programTestMode'
import { extractProjectIdeaSectionDescription, normalizeProjectDescriptionForEditing } from '@/lib/projectSubmission'
import { findUserFromPayloadToken } from '@/lib/payloadUserToken'
import { ensureFreshAttemptState } from '@/lib/ensureFreshAttemptState'
import { extractCertificateProfileFromIntake, parseCertificatePolicy, resolveCertificateEligibility } from '@/lib/certificates'
import { sendCertificatePdfEmail } from '@/lib/certificateEmail'

export const dynamic = 'force-dynamic'

export default async function PlatformPage(props: { searchParams?: Promise<{ project?: string }> }) {
    const searchParams = props.searchParams ? await props.searchParams : {}
    const payload = await getPayload({ config })
    const headersObj = await headers()
    const cookieStore = await cookies()
    const token = cookieStore.get('payload-token')?.value

    let user: any = null

    try {
        const authResult = await payload.auth({ headers: headersObj })
        user = authResult.user
    } catch (e) {
    }

    if (!user && token) {
        try {
            user = await findUserFromPayloadToken(payload, token)
        } catch (e) {
        }
    }

    if (user?.id && (!('partner' in user) || !('team' in user) || !('mentor' in user))) {
        try {
            user = await payload.findByID({
                collection: 'users',
                id: user.id,
                depth: 1,
            })
        } catch {}
    }

    let settings: any = {}
    try {
        settings = await payload.findGlobal({ slug: 'platform-settings' })
    } catch (e) { }

    let landingPartners: Array<{
        id: number | string
        name: string
        websiteUrl: string
        logoUrl: string | null
    }> = []
    let landingMentors: Array<{
        id: number | string
        name: string
        partnerName: string | null
        avatarUrl: string | null
        linkUrl: string
    }> = []

    const normalizeMentorLink = (value: unknown): string => {
        const raw = typeof value === 'string' ? value.trim() : ''
        if (!raw) return ''
        if (raw.startsWith('/') || /^https?:\/\//i.test(raw)) return raw
        return `https://${raw}`
    }

    if (!user) {
        try {
            const [partnerResult, mentorResult] = await Promise.all([
                payload.find({
                    collection: 'partners',
                    where: {
                        and: [
                            { showOnLanding: { equals: true } },
                            { websiteUrl: { exists: true } },
                        ],
                    },
                    sort: 'landingOrder',
                    limit: 24,
                    depth: 1,
                    overrideAccess: true,
                }),
                payload.find({
                    collection: 'mentors',
                    where: { isActive: { equals: true } },
                    sort: 'landingOrder',
                    limit: 24,
                    depth: 2,
                    overrideAccess: true,
                }).catch(() => ({ docs: [] })),
            ])

            landingPartners = (partnerResult.docs as any[])
                .map((partner) => {
                    const rawWebsiteUrl = typeof partner.websiteUrl === 'string' ? partner.websiteUrl.trim() : ''
                    const websiteUrl = rawWebsiteUrl
                        ? (/^https?:\/\//i.test(rawWebsiteUrl) ? rawWebsiteUrl : `https://${rawWebsiteUrl}`)
                        : ''

                    return {
                        id: partner.id,
                        name: partner.name || 'Partner',
                        websiteUrl,
                        logoUrl:
                            partner.logo && typeof partner.logo === 'object'
                                ? partner.logo?.url ?? null
                                : null,
                        landingOrder: typeof partner.landingOrder === 'number' ? partner.landingOrder : 0,
                    }
                })
                .filter((partner) => partner.websiteUrl)
                .sort((a, b) => (a.landingOrder - b.landingOrder) || a.name.localeCompare(b.name))
                .map(({ landingOrder, ...partner }) => partner)

            landingMentors = (mentorResult.docs as any[])
                .map((mentor) => {
                    const partner = mentor.partner && typeof mentor.partner === 'object'
                        ? mentor.partner
                        : null
                    const profileImageUrl = mentor.profileImage && typeof mentor.profileImage === 'object'
                        ? mentor.profileImage?.url ?? null
                        : null

                    return {
                        id: mentor.id,
                        name: mentor.title || 'Mentor',
                        partnerName: partner?.name || null,
                        avatarUrl: profileImageUrl,
                        linkUrl: normalizeMentorLink(mentor.linkUrl),
                        landingOrder: typeof mentor.landingOrder === 'number' ? mentor.landingOrder : 0,
                    }
                })
                .sort((a, b) => (a.landingOrder - b.landingOrder) || a.name.localeCompare(b.name))
                .map(({ landingOrder, ...mentor }) => mentor)
        } catch {}
    }

    if (!user) {
        return <LandingPage settings={settings} partners={landingPartners} mentors={landingMentors} />
    }

    if (user && !user.isOnboarded && user.role !== 'admin') {
        return <RoleSelectionModal user={user} />
    }

    if (user && user.role === 'investor') {
        const submissions = await payload.find({
            collection: 'investor-form-submissions',
            where: { user: { equals: user.id } },
            limit: 1,
        })

        if (submissions.totalDocs === 0) {
            redirect('/intake')
        }
    }

    if (user?.role === 'partner') {
        return <PartnerPage />
    }

    if (user?.role === 'mentor') {
        return <MentorPage />
    }

    let hasFounderForm = false
    let hasPersonalityTest = false
    let personalityTestFormSlug: string | null = null
    let founderArchetype: string | null = null
    let founderTrack: string | null = null
    let personalityScores: any = null
    let dailyFormSlug: string | null = null
    let dailyFormTitle: string | null = null
    let hasSubmittedDailyForm = false
    let dayNumber = 0
    let isDayLocked = false
    let dayLockReason: string | null = null
    let nextUnlockTime: string | null = null
    let completedDays: number[] = []
    let dayDefinition: any = null
    let nextMissionDayNumber: number | null = null
    let nextMissionSlug: string | null = null
    let nextMissionTitle: string | null = null
    let preworkProgress: { completed: number; total: number; nextFormSlug: string | null; nextFormTitle: string | null } | null = null
    let currentDayMentorReview: {
        id: number | string
        dayNumber: number
        score: number
        comment: string
        isGateReview: boolean
        gateDecision?: string | null
        mentorName?: string | null
        createdAt: string
    } | null = null
    let assignedMentor: {
        id: number | string
        title: string
        description: string
        isActive: boolean
    } | null = null
    let attemptData: {
        id: number | string
        attemptNumber: number
        maxAttempts: number
        missCount: number
        status: string
        missedDays: number[]
        certificate: {
            fullName?: string | null
            companyName?: string | null
            roleTitle?: string | null
            city?: string | null
            country?: string | null
            profileConfirmedAt?: string | null
            consentGrantedAt?: string | null
            missedSessions?: number | null
            hadWeekOff?: boolean | null
            kind?: 'none' | 'participation' | 'completion' | null
            resolvedAt?: string | null
            emailPdfSentAt?: string | null
        } | null
        certificatePolicy: {
            enabled: boolean
            missedSessionsThreshold: number
            weekOffDisqualifies: boolean
            completionLabel: string
            participationLabel: string
            showOnDashboard: boolean
            emailPdfEnabled: boolean
        } | null
        certificateResolution: {
            kind: 'none' | 'participation' | 'completion'
            label: string | null
            reason: 'disabled' | 'week_off' | 'miss_threshold' | 'completion' | 'participation'
        } | null
    } | null = null

    // Program state
    let programStatus: string = user.programStatus || 'not_started'
    const programAttempts: number = user.programAttempts || 0
    const hasPaid100Days: boolean = user.hasPaid100Days || false
    const paymentEnabled: boolean = settings?.paymentEnabled !== false
    // When payment is disabled, treat all founders as paid for display/gating
    const effectivelyPaid: boolean = hasPaid100Days || !paymentEnabled
    let programStartDate: string | null = user.programStartDate || null

    if (user && user.role === 'founder') {
        const submissions = await payload.find({
            collection: 'founder-form-submissions',
            where: { user: { equals: user.id } },
            sort: 'createdAt',
            limit: 1,
        })

        if (submissions.totalDocs === 0) {
            redirect('/intake')
        }

        hasFounderForm = submissions.totalDocs > 0

        const personalityFormRef = settings?.activePersonalityTestForm
        if (personalityFormRef) {
            const personalityFormId = typeof personalityFormRef === 'object'
                ? personalityFormRef?.id
                : personalityFormRef

            if (personalityFormId) {
                try {
                    const ptForm = await payload.findByID({
                        collection: 'founder-forms',
                        id: personalityFormId,
                    })
                    personalityTestFormSlug = (ptForm as any)?.slug || null
                } catch (e) { }

                const ptSubmissions = await payload.find({
                    collection: 'founder-form-submissions',
                    where: {
                        user: { equals: user.id },
                        form: { equals: personalityFormId },
                    },
                    limit: 1,
                })
                hasPersonalityTest = ptSubmissions.totalDocs > 0

                if (hasPersonalityTest && ptSubmissions.docs[0]) {
                    const ptSub = ptSubmissions.docs[0] as any
                    founderArchetype = ptSub?.archetype || null
                    founderTrack = ptSub?.track || null
                    personalityScores = ptSub?.personalityScores || null
                }
            }
        }

        const freshAttemptState = await ensureFreshAttemptState(payload, user)
        user = freshAttemptState.user
        programStatus = freshAttemptState.programStatus
        programStartDate = freshAttemptState.activeAttemptStartedAt || user.programStartDate || programStartDate

        // Load prework progression when in prework phase
        if (programStatus === 'prework') {
            const dayProgram = await payload.findGlobal({ slug: 'day-program' }).catch(() => null) as any
            const totalPreworkBlocks: number = dayProgram?.totalPreworkBlocks || 10

            // Resolve prework schedule via hierarchy (same as day schedule)
            const partnerRaw = (user as any).partner
            const userPartnerId = partnerRaw?.id ?? partnerRaw ?? null
            let preworkSchedule: Record<string, number | null> = {}

            // Walk schedule hierarchy for prework
            const rawHierarchy: { level: string }[] | undefined = dayProgram?.scheduleHierarchy
            const hierarchy = rawHierarchy?.length ? rawHierarchy : [
                { level: 'partner' }, { level: 'track' }, { level: 'archetype' }, { level: 'general' },
            ]

            for (const { level } of hierarchy) {
                if (Object.keys(preworkSchedule).length > 0) break

                if (level === 'partner' && userPartnerId) {
                    try {
                        const docs = await payload.find({ collection: 'partner-day-schedules', where: { partner: { equals: userPartnerId } }, limit: 1, depth: 0 })
                        if (docs.totalDocs > 0) {
                            const ps = (docs.docs[0] as any)?.preworkSchedule
                            if (ps && Object.keys(ps).length > 0) preworkSchedule = ps
                        }
                    } catch {}
                }
                if (level === 'track' && founderTrack) {
                    try {
                        const docs = await payload.find({ collection: 'track-day-schedules', where: { trackSlug: { equals: founderTrack } }, limit: 1, depth: 0 })
                        if (docs.totalDocs > 0) {
                            const ps = (docs.docs[0] as any)?.preworkSchedule
                            if (ps && Object.keys(ps).length > 0) preworkSchedule = ps
                        }
                    } catch {}
                }
                if (level === 'archetype' && founderArchetype) {
                    try {
                        const docs = await payload.find({ collection: 'archetype-day-schedules', where: { archetype: { equals: founderArchetype } }, limit: 1, depth: 0 })
                        if (docs.totalDocs > 0) {
                            const ps = (docs.docs[0] as any)?.preworkSchedule
                            if (ps && Object.keys(ps).length > 0) preworkSchedule = ps
                        }
                    } catch {}
                }
                if (level === 'general') {
                    preworkSchedule = dayProgram?.preworkSchedule || {}
                }
            }

            // Collect all prework form IDs from the schedule
            const preworkFormIds = Object.values(preworkSchedule).filter((v): v is number => v != null)

            if (preworkFormIds.length > 0) {
                // Fetch submitted prework forms for this user
                const preworkSubs = await payload.find({
                    collection: 'founder-form-submissions',
                    where: {
                        user: { equals: user.id },
                        form: { in: preworkFormIds },
                    },
                    limit: 100,
                    depth: 0,
                })
                const submittedFormIds = new Set(preworkSubs.docs.map((s: any) =>
                    typeof s.form === 'object' ? s.form.id : s.form
                ))

                // Walk through prework blocks 1..N in order, find first incomplete
                let nextFormSlug: string | null = null
                let nextFormTitle: string | null = null
                let completedCount = 0

                for (let pw = 1; pw <= totalPreworkBlocks; pw++) {
                    const formId = preworkSchedule[String(pw)]
                    if (!formId) continue
                    if (submittedFormIds.has(formId)) {
                        completedCount++
                    } else if (!nextFormSlug) {
                        // Fetch slug/title for the next form
                        try {
                            const form = await payload.findByID({ collection: 'founder-forms', id: formId, depth: 0 }) as any
                            nextFormSlug = form?.slug || null
                            nextFormTitle = form?.title || form?.slug || null
                        } catch {}
                    }
                }

                preworkProgress = {
                    completed: completedCount,
                    total: totalPreworkBlocks,
                    nextFormSlug,
                    nextFormTitle,
                }
            } else {
                // Fallback: no prework schedule configured — try slug-based lookup
                const preworkForms = await payload.find({
                    collection: 'founder-forms',
                    where: { slug: { like: 'daily-prework-block-%' } },
                    sort: 'slug',
                    limit: 20,
                    depth: 0,
                })
                const fallbackIds = preworkForms.docs.map((f: any) => f.id)
                if (fallbackIds.length > 0) {
                    const preworkSubs = await payload.find({
                        collection: 'founder-form-submissions',
                        where: { user: { equals: user.id }, form: { in: fallbackIds } },
                        limit: 100,
                        depth: 0,
                    })
                    const submittedFormIds = new Set(preworkSubs.docs.map((s: any) =>
                        typeof s.form === 'object' ? s.form.id : s.form
                    ))
                    const nextForm = preworkForms.docs.find((f: any) => !submittedFormIds.has(f.id))
                    preworkProgress = {
                        completed: submittedFormIds.size,
                        total: preworkForms.docs.length,
                        nextFormSlug: (nextForm as any)?.slug || null,
                        nextFormTitle: (nextForm as any)?.title || (nextForm as any)?.slug || null,
                    }
                } else {
                    preworkProgress = { completed: 0, total: 0, nextFormSlug: null, nextFormTitle: null }
                }
            }
        }

        // Only calculate day progression when the program is active or in internal test mode.
        if ((programStatus === 'active' && programStartDate) || isTestProgramStatus(programStatus)) {
            // Re-check programStatus after page-load refresh, which may fail an attempt
            // or repair a stale "active" state with no active attempt.
            const currentStatus = (user as any).programStatus || 'not_started'
            if (currentStatus === 'active' || isTestProgramStatus(currentStatus)) {
                const partnerRaw = (user as any).partner
                const userPartnerId = partnerRaw?.id ?? partnerRaw ?? null
                const progression = await getActiveProgramDay(
                    payload,
                    user.id,
                    programStartDate || new Date().toISOString(),
                    founderArchetype,
                    founderTrack,
                    userPartnerId,
                )

                dayNumber = progression.displayDay
                isDayLocked = progression.isLocked
                dayLockReason = progression.lockReason
                nextUnlockTime = progression.nextUnlockTime
                completedDays = progression.completedDays
                dailyFormSlug = progression.displayFormSlug
                dailyFormTitle = progression.displayFormTitle
                hasSubmittedDailyForm = progression.displayHasSubmitted
                dayDefinition = progression.displayDayDefinition
                nextMissionDayNumber = progression.nextMissionDay
                nextMissionSlug = progression.nextMissionFormSlug
                nextMissionTitle = progression.nextMissionFormTitle
            }
        }
    }

    if (user?.role === 'founder' && dayNumber > 0) {
        try {
            const mentorReviewsResult = await payload.find({
                collection: 'mentor-reviews',
                where: { 'submission.user': { equals: user.id } },
                sort: '-createdAt',
                limit: 200,
                depth: 1,
                overrideAccess: true,
            })
            const mentorReviewsByDay = new Map<number, any>()
            for (const review of mentorReviewsResult.docs as any[]) {
                const reviewDay = review.dayNumber ?? 0
                if (!reviewDay || mentorReviewsByDay.has(reviewDay)) continue
                mentorReviewsByDay.set(reviewDay, review)
            }
            const currentReview = mentorReviewsByDay.get(dayNumber)
            if (currentReview) {
                currentDayMentorReview = {
                    id: currentReview.id,
                    dayNumber: currentReview.dayNumber ?? dayNumber,
                    score: currentReview.score ?? 0,
                    comment: currentReview.comment ?? '',
                    isGateReview: currentReview.isGateReview ?? false,
                    gateDecision: currentReview.gateDecision ?? null,
                    mentorName: typeof currentReview.reviewer === 'object' ? currentReview.reviewer?.email ?? null : null,
                    createdAt: currentReview.createdAt,
                }
            }
        } catch {}
    }

    if (user?.role === 'founder') {
        try {
            const mentorRef = (user as any).mentor
            const mentorId = typeof mentorRef === 'object' ? mentorRef?.id : mentorRef
            let mentorDoc: any = null

            if (mentorId) {
                mentorDoc = typeof mentorRef === 'object'
                    ? mentorRef
                    : await payload.findByID({
                        collection: 'mentors',
                        id: mentorId,
                        depth: 0,
                        overrideAccess: true,
                    }).catch(() => null)
            }

            if (mentorDoc && mentorDoc.isActive !== false) {
                assignedMentor = {
                    id: mentorDoc.id,
                    title: mentorDoc.title || 'Mentor',
                    description: '',
                    isActive: mentorDoc.isActive !== false,
                }
            }
        } catch {}
    }

    // Fetch active attempt data for status bar
    if (user?.role === 'founder' && (['active', 'prework', 'warned_1', 'warned_2', 'failed', 'completed'].includes(programStatus) || isTestProgramStatus(programStatus))) {
        try {
            const attempts = await payload.find({
                collection: 'attempts',
                where: { user: { equals: user.id } },
                sort: '-attemptNumber',
                limit: 1,
                depth: 0,
            })
            if (attempts.totalDocs > 0) {
                const att = attempts.docs[0] as any
                const { parseProgramConfig } = await import('@/lib/attemptEngine')
                const dayProgramGlobal = await payload.findGlobal({ slug: 'day-program' }).catch(() => null)
                const cfg = parseProgramConfig(dayProgramGlobal)
                const certificatePolicy = parseCertificatePolicy(dayProgramGlobal)
                const activeFounderFormRef = settings?.activeFounderForm
                const activeFounderFormId = typeof activeFounderFormRef === 'object' ? activeFounderFormRef?.id : activeFounderFormRef
                let intakeCertificateProfile = null
                if (activeFounderFormId) {
                    const intakeSubmissionResult = await (payload as any).find({
                        collection: 'founder-form-submissions',
                        where: {
                            user: { equals: user.id },
                            form: { equals: activeFounderFormId },
                        },
                        sort: 'createdAt',
                        limit: 1,
                        depth: 0,
                    }).catch(() => ({ docs: [] }))
                    intakeCertificateProfile = extractCertificateProfileFromIntake(intakeSubmissionResult?.docs?.[0]?.submissionData)
                }
                const certificate = (att.certificate ?? null) as {
                    fullName?: string | null
                    companyName?: string | null
                    roleTitle?: string | null
                    city?: string | null
                    country?: string | null
                    profileConfirmedAt?: string | null
                    consentGrantedAt?: string | null
                    missedSessions?: number | null
                    hadWeekOff?: boolean | null
                    kind?: 'none' | 'participation' | 'completion' | null
                    resolvedAt?: string | null
                    emailPdfSentAt?: string | null
                } | null
                const hasAssignedCertificate = Boolean(certificate?.kind || certificate?.profileConfirmedAt)
                const certificateResolution =
                    att.status === 'completed' || att.status === 'failed' || hasAssignedCertificate
                        ? resolveCertificateEligibility(
                            {
                                completedProgram: att.status === 'completed',
                                missedSessions: certificate?.missedSessions ?? 0,
                                hadWeekOff: certificate?.hadWeekOff ?? false,
                            },
                            certificatePolicy,
                        )
                        : null
                let resolvedCertificate = certificate
                if ((att.status === 'completed' || att.status === 'failed') && certificateResolution && intakeCertificateProfile) {
                    const now = new Date().toISOString()
                    const nextCertificate = {
                        ...(certificate ?? {}),
                        fullName: intakeCertificateProfile.fullName,
                        companyName: intakeCertificateProfile.companyName,
                        roleTitle: intakeCertificateProfile.roleTitle,
                        city: intakeCertificateProfile.city,
                        country: intakeCertificateProfile.country,
                        profileConfirmedAt: certificate?.profileConfirmedAt || now,
                        kind: certificateResolution.kind,
                        resolvedAt: certificate?.resolvedAt || now,
                    }
                    const certificateChanged =
                        !certificate ||
                        certificate.fullName !== nextCertificate.fullName ||
                        certificate.companyName !== nextCertificate.companyName ||
                        certificate.roleTitle !== nextCertificate.roleTitle ||
                        certificate.city !== nextCertificate.city ||
                        certificate.country !== nextCertificate.country ||
                        certificate.profileConfirmedAt !== nextCertificate.profileConfirmedAt ||
                        certificate.kind !== nextCertificate.kind ||
                        certificate.resolvedAt !== nextCertificate.resolvedAt

                    resolvedCertificate = nextCertificate

                    if (certificateChanged) {
                        await (payload as any).update({
                            collection: 'attempts',
                            id: att.id,
                            data: { certificate: nextCertificate },
                            overrideAccess: true,
                        }).catch(() => null)
                    }

                    if (
                        certificatePolicy.emailPdfEnabled &&
                        certificateResolution.kind !== 'none' &&
                        !nextCertificate.emailPdfSentAt &&
                        user.email
                    ) {
                        const sent = await sendCertificatePdfEmail({
                            recipientEmail: user.email,
                            companyName: settings?.companyName || 'MESGA',
                            profile: intakeCertificateProfile,
                            kind: certificateResolution.kind,
                        }).catch((error) => {
                            console.error('[Certificate] Failed to send certificate PDF email:', error)
                            return false
                        })

                        if (sent) {
                            const emailPdfSentAt = new Date().toISOString()
                            resolvedCertificate = { ...nextCertificate, emailPdfSentAt }
                            await (payload as any).update({
                                collection: 'attempts',
                                id: att.id,
                                data: { certificate: resolvedCertificate },
                                overrideAccess: true,
                            }).catch(() => null)
                        }
                    }
                }
                const maxAtt = await getEffectiveMaxAttemptsForUser(
                    payload,
                    user as any,
                    att.paymentType || 'self_paid',
                    cfg,
                )
                attemptData = {
                    id: att.id,
                    attemptNumber: att.attemptNumber || 1,
                    maxAttempts: maxAtt,
                    missCount: att.missCount || 0,
                    status: att.status || 'active',
                    missedDays: att.missedDays || [],
                    certificate: resolvedCertificate,
                    certificatePolicy,
                    certificateResolution,
                }
            }
        } catch {}
    }

    const needsPersonalityTest = user?.role === 'founder' && hasFounderForm && !hasPersonalityTest && !!personalityTestFormSlug

    // Fetch partner info if user is referred by a partner
    let partnerLogoUrl: string | null = null
    let partnerName: string | null = null
    let partnerBrandingColors: any = null
    if (user?.role === 'founder') {
        const partnerRaw = (user as any).partner
        const partnerId = partnerRaw?.id ?? partnerRaw
        if (partnerId) {
            const partnerDoc = await payload.findByID({ collection: 'partners', id: partnerId, depth: 1 }).catch(() => null) as any
            if (partnerDoc) {
                const logo = partnerDoc.logo
                if (logo && typeof logo === 'object' && logo.url) partnerLogoUrl = logo.url
                partnerName = partnerDoc.name ?? null
                partnerBrandingColors = partnerDoc.brandingColors ?? null
            }
        }
    }

    let projectSubmission: { id: number; status: string; partnerComment?: string | null; spaceDataRelevance?: any; projectDescription?: string | null; workspaceUrl?: string | null; reviewedAt?: string | null; trackId?: number | null } | null = null
    let availableTracks: { id: number; name: string; slug: string; description?: string | null }[] = []
    const preferredTrackSlug = cookieStore.get(PREFERRED_TRACK_COOKIE)?.value || null
    if (user?.role === 'founder') {
        const payloadAny = payload as any
        const activeFounderFormRef = settings?.activeFounderForm
        const activeFounderFormId = typeof activeFounderFormRef === 'object' ? activeFounderFormRef?.id : activeFounderFormRef
        const [projSubs, tracksResult] = await Promise.all([
            payloadAny.find({
                collection: 'project-submissions',
                where: { user: { equals: user.id } },
                limit: 1,
                depth: 0,
            }),
            payloadAny.find({
                collection: 'tracks',
                where: { isActive: { equals: true } },
                limit: 50,
                depth: 0,
            }),
        ])
        let legacyDraftDescription: string | null = null
        if (activeFounderFormId) {
            const [activeFounderForm, intakeSubmissionResult] = await Promise.all([
                payload.findByID({
                    collection: 'founder-forms',
                    id: activeFounderFormId,
                    depth: 0,
                }).catch(() => null) as Promise<any>,
                payloadAny.find({
                    collection: 'founder-form-submissions',
                    where: {
                        user: { equals: user.id },
                        form: { equals: activeFounderFormId },
                    },
                    sort: 'createdAt',
                    limit: 1,
                    depth: 0,
                }).catch(() => ({ docs: [] })) as Promise<{ docs?: any[] }>,
            ])

            const intakeSubmission = intakeSubmissionResult?.docs?.[0] ?? null
            if (activeFounderForm && intakeSubmission?.submissionData) {
                legacyDraftDescription = extractProjectIdeaSectionDescription(activeFounderForm, intakeSubmission.submissionData ?? {})
            }
        }

        if (projSubs.totalDocs > 0) {
            const doc = projSubs.docs[0]
            const trackRef = doc.track
            const trackId = typeof trackRef === 'object' ? trackRef?.id : trackRef
            const activeTrack = trackId == null
                ? null
                : (tracksResult.docs as any[]).find((track) => String(track.id) === String(trackId)) ?? null
            projectSubmission = {
                id: doc.id,
                status: doc.status,
                partnerComment: doc.partnerComment ?? null,
                spaceDataRelevance: isSpaceTrackSlug(activeTrack?.slug) ? doc.spaceDataRelevance ?? null : null,
                projectDescription: normalizeProjectDescriptionForEditing(doc.projectDescription ?? null, legacyDraftDescription, doc.status),
                workspaceUrl: doc.workspaceUrl ?? null,
                reviewedAt: doc.reviewedAt ?? null,
                trackId: trackId ?? null,
            }
        }
        availableTracks = buildAvailableTrackOptions(tracksResult.docs as any[], settings?.tracks)
    }

    // After potential auto-fail, re-read the updated status
    const finalProgramStatus: string = (user as any).programStatus || 'not_started'
    const finalProgramAttempts: number = (user as any).programAttempts || 0
    const openProjectModalDefault = searchParams.project === '1'

    return (
        <DashboardClient
            user={user}
            settings={settings}
            partnerLogoUrl={partnerLogoUrl}
            partnerName={partnerName}
            partnerBrandingColors={partnerBrandingColors}
            assignedMentor={assignedMentor}
            needsPersonalityTest={needsPersonalityTest}
            personalityTestSlug={personalityTestFormSlug}
            founderArchetype={founderArchetype}
            founderTrack={founderTrack}
            dailyFormSlug={dailyFormSlug}
            dailyFormTitle={dailyFormTitle}
            hasSubmittedDailyForm={hasSubmittedDailyForm}
            dayNumber={dayNumber}
            isDayLocked={isDayLocked}
            dayLockReason={dayLockReason}
            nextUnlockTime={nextUnlockTime}
            completedDays={completedDays}
            personalityScores={personalityScores}
            nextMissionDayNumber={nextMissionDayNumber}
            nextMissionSlug={nextMissionSlug}
            nextMissionTitle={nextMissionTitle}
            programStatus={finalProgramStatus}
            programAttempts={finalProgramAttempts}
            hasPaid100Days={effectivelyPaid}
            paymentEnabled={paymentEnabled}
            projectSubmission={projectSubmission}
            availableTracks={availableTracks}
            preferredTrackSlug={preferredTrackSlug}
            dashboardCalendarNotice={(user as any)?.dashboardCalendarNotice ?? null}
            currentDayMentorReview={currentDayMentorReview}
            dayDefinition={dayDefinition}
            preworkProgress={preworkProgress}
            attemptData={attemptData}
            openProjectModalDefault={openProjectModalDefault}
        />
    )
}
