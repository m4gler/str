import { getPayload } from 'payload'
import config from '@/payload.config'
import { headers, cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import PartnerDashboard from '@/components/PartnerDashboard'
import { findUserFromPayloadToken } from '@/lib/payloadUserToken'

export const dynamic = 'force-dynamic'

function buildQuestionLabels(formSections: any[] | null | undefined) {
    const labels: Record<string, string> = {}
    for (const section of formSections ?? []) {
        for (const question of section?.questions ?? []) {
            if (question?.question_id && question?.question_text) {
                labels[question.question_id] = question.question_text
            }
        }
    }
    return labels
}

function mapProgressSubmission(submission: any) {
    const form = typeof submission?.form === 'object' ? submission.form : null
    const formSections = Array.isArray(form?.sections) ? form.sections : []

    return {
        id: submission.id,
        programDay: submission.programDay ?? 0,
        dayType: submission.dayType ?? 'standard',
        isBackfill: submission.isBackfill ?? false,
        formTitle: form?.title || form?.slug || `Day ${submission.programDay ?? 0}`,
        createdAt: submission.createdAt,
        submissionData: submission.submissionData ?? null,
        questionLabels: buildQuestionLabels(formSections),
    }
}

function mapPartnerInviteLink(link: any) {
    const partner = typeof link?.partner === 'object' ? link.partner : null
    const track = typeof link?.track === 'object' ? link.track : null

    return {
        id: link.id,
        label: link.label || 'Referral link',
        token: link.token || '',
        isActive: link.isActive !== false,
        createdAt: link.createdAt || null,
        lastUsedAt: link.lastUsedAt || null,
        useCount: typeof link.useCount === 'number' ? link.useCount : 0,
        partnerId: partner?.id ?? link?.partner ?? null,
        partnerName: partner?.name ?? null,
        partnerSlug: partner?.slug ?? null,
        track: track ? {
            id: track.id,
            name: track.name || '',
            slug: track.slug || '',
        } : null,
    }
}

export default async function PartnerPage() {
    const payload = await getPayload({ config })
    const headersObj = await headers()
    const cookieStore = await cookies()
    const token = cookieStore.get('payload-token')?.value

    let user: any = null

    try {
        const authResult = await payload.auth({ headers: headersObj })
        user = authResult.user
    } catch {}

    if (!user && token) {
        try {
            user = await findUserFromPayloadToken(payload, token, { depth: 2 })
        } catch {}
    }

    if (!user) redirect('/login')
    if (user.role !== 'partner' && user.role !== 'admin') redirect('/')

    const payloadAny = payload as any
    const settings: any = await payload.findGlobal({ slug: 'platform-settings' }).catch(() => ({}))

    let submissions: any[] = []
    let partnerRecord: any = null
    let founders: any[] = []
    let allPartners: Array<{ id: number; name: string; slug: string; tracks?: Array<{ id: number; name: string; slug: string }> }> = []
    let allTracks: { id: number; name: string; slug: string }[] = []
    let pendingAttempts: any[] = []
    let inviteLinks: any[] = []

    if (user.role === 'partner') {
        const partnerId = user.partner?.id ?? user.partner
        if (!partnerId) {
            return (
                <div className="min-h-screen bg-[#1a2634] text-white flex items-center justify-center">
                    <p className="text-white/40">No partner organization assigned to your account. Contact an admin.</p>
                </div>
            )
        }

        partnerRecord = await payload.findByID({ collection: 'partners', id: partnerId, depth: 1, overrideAccess: true }).catch(() => null) as any

        // Fetch tracks for export filtering
        const tracksForPartner = await payload.find({ collection: 'tracks', where: { isActive: { equals: true } }, depth: 0, limit: 50, overrideAccess: true })
        allTracks = (tracksForPartner.docs as any[]).map(t => ({ id: t.id, name: t.name, slug: t.slug }))

        const inviteLinksResult = await payload.find({
            collection: 'partner-invite-links',
            where: { partner: { equals: partnerId } },
            depth: 2,
            limit: 200,
            sort: '-createdAt',
            overrideAccess: true,
        }).catch(() => null)
        inviteLinks = (inviteLinksResult?.docs as any[] | undefined)?.map(mapPartnerInviteLink) ?? []

        // Fetch pending partner override attempts
        const pendingAttemptsResult = await payload.find({
            collection: 'attempts',
            where: {
                partnerDecision: { equals: 'pending' },
                'user.partner': { equals: partnerId },
            },
            depth: 2,
            limit: 50,
            overrideAccess: true,
        })
        pendingAttempts = (pendingAttemptsResult.docs as any[]).map(a => ({
            id: a.id,
            attemptNumber: a.attemptNumber,
            missCount: a.missCount,
            missedDays: a.missedDays || [],
            currentDay: a.currentDay,
            founderEmail: typeof a.user === 'object' ? a.user.email : 'Unknown',
            founderId: typeof a.user === 'object' ? a.user.id : a.user,
            partnerOverrideRequestedAt: a.partnerOverrideRequestedAt,
        }))

        // Fetch project submissions for this partner's users
        const projResult = await payloadAny.find({
            collection: 'project-submissions',
            where: { 'user.partner': { equals: partnerId } },
            depth: 2,
            sort: '-createdAt',
            limit: 200,
        })
        submissions = projResult.docs ?? []

        // Fetch all users in this partner
        const usersResult = await payload.find({
            collection: 'users',
            where: { partner: { equals: partnerId }, role: { equals: 'founder' } },
            depth: 0,
            limit: 500,
            overrideAccess: true,
        })
        const partnerUsers = usersResult.docs as any[]

        if (partnerUsers.length > 0) {
            const userIds = partnerUsers.map(u => u.id)

            const ptFormRef = settings?.activePersonalityTestForm
            const ptFormId = ptFormRef ? (typeof ptFormRef === 'object' ? ptFormRef?.id : ptFormRef) : null

            // All form submissions for these users — use `or` conditions because `in` is unreliable for relationship fields
            const orConditions = userIds.map((uid: number) => ({ user: { equals: uid } }))
            const allSubsResult = await payload.find({
                collection: 'founder-form-submissions',
                where: { or: orConditions } as any,
                depth: 2,
                limit: 2000,
                overrideAccess: true,
            })

            const ptByUser: Record<number, any> = {}
            const intakeByUser: Record<number, any> = {}
            const dailySubsByUser: Record<number, any[]> = {}

            for (const sub of allSubsResult.docs as any[]) {
                const uid = typeof sub.user === 'object' ? sub.user?.id : sub.user
                if (!uid) continue
                const formId = typeof sub.form === 'object' ? sub.form?.id : sub.form
                const formIdStr = String(formId)
                const formSlug = typeof sub.form === 'object' ? sub.form?.slug || '' : ''
                // Use form ID only — archetype may be set on intake submissions too
                const isPT = ptFormId ? formIdStr === String(ptFormId) : false
                const isDaily = Boolean(sub.programDay) || formSlug.startsWith('daily-')

                if (isPT) {
                    if (!ptByUser[uid]) ptByUser[uid] = sub
                } else if (!isDaily) {
                    if (!intakeByUser[uid]) intakeByUser[uid] = sub
                } else {
                    if (!dailySubsByUser[uid]) dailySubsByUser[uid] = []
                    dailySubsByUser[uid].push(sub)
                }
            }

            const attemptsResult = await payload.find({
                collection: 'attempts',
                where: { or: userIds.map((uid: number) => ({ user: { equals: uid } })) } as any,
                depth: 0,
                sort: '-createdAt',
                limit: 2000,
                overrideAccess: true,
            }).catch(() => ({ docs: [] }))

            const latestAttemptByUser: Record<number, any> = {}
            for (const attempt of attemptsResult.docs as any[]) {
                const uid = typeof attempt.user === 'object' ? attempt.user?.id : attempt.user
                if (uid && !latestAttemptByUser[uid]) latestAttemptByUser[uid] = attempt
            }

            const dailySubmissionIds = Object.values(dailySubsByUser).flat().map((sub: any) => sub.id)
            const reviewsResult = dailySubmissionIds.length > 0
                ? await payload.find({
                    collection: 'mentor-reviews',
                    where: { submission: { in: dailySubmissionIds.join(',') } },
                    depth: 1,
                    sort: '-createdAt',
                    limit: 3000,
                    overrideAccess: true,
                }).catch(() => ({ docs: [] }))
                : { docs: [] as any[] }

            const reviewBySubmissionId: Record<number, any> = {}
            const reviewsByUser: Record<number, any[]> = {}
            for (const review of reviewsResult.docs as any[]) {
                const submissionRef = typeof review.submission === 'object' ? review.submission : null
                const submissionId = submissionRef?.id ?? review.submission
                if (submissionId && !reviewBySubmissionId[submissionId]) {
                    reviewBySubmissionId[submissionId] = review
                }

                const founderUser = submissionRef?.user && typeof submissionRef.user === 'object' ? submissionRef.user : null
                const founderUserId = founderUser?.id
                if (!founderUserId) continue

                if (!reviewsByUser[founderUserId]) reviewsByUser[founderUserId] = []
                reviewsByUser[founderUserId].push({
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
            }

            // Project submissions indexed by user
            const projByUser: Record<number, any> = {}
            for (const s of submissions) {
                const uid = s.user?.id ?? s.user
                if (!projByUser[uid]) projByUser[uid] = s
            }

            founders = partnerUsers.map(u => {
                const pt = ptByUser[u.id]
                const intake = intakeByUser[u.id]
                const intakeForm = typeof intake?.form === 'object' ? intake.form : null
                const dailySubs = (dailySubsByUser[u.id] ?? [])
                    .filter((sub: any) => typeof sub.programDay === 'number' && sub.programDay > 0)
                    .sort((a: any, b: any) => a.programDay - b.programDay || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                const completedDays = [...new Set(dailySubs.map((sub: any) => sub.programDay).filter((day: number) => day >= 1 && day <= 100))].sort((a, b) => a - b)
                const attempt = latestAttemptByUser[u.id]
                const progressSubmissions = dailySubs.map((sub: any) => ({
                    ...mapProgressSubmission(sub),
                    review: reviewBySubmissionId[sub.id]
                        ? {
                            id: reviewBySubmissionId[sub.id].id,
                            dayNumber: reviewBySubmissionId[sub.id].dayNumber ?? sub.programDay ?? 0,
                            score: reviewBySubmissionId[sub.id].score ?? 0,
                            comment: reviewBySubmissionId[sub.id].comment ?? '',
                            internalNote: reviewBySubmissionId[sub.id].internalNote ?? null,
                            isGateReview: reviewBySubmissionId[sub.id].isGateReview ?? false,
                            gateDecision: reviewBySubmissionId[sub.id].gateDecision ?? null,
                            mentorName: typeof reviewBySubmissionId[sub.id].reviewer === 'object' ? reviewBySubmissionId[sub.id].reviewer?.email ?? null : null,
                            createdAt: reviewBySubmissionId[sub.id].createdAt,
                        }
                        : null,
                }))

                return {
                    id: u.id,
                    email: u.email,
                    programStatus: u.programStatus || 'not_started',
                    programAttempts: u.programAttempts || 0,
                    hasPaid100Days: u.hasPaid100Days || false,
                    createdAt: u.createdAt,
                    archetype: pt?.archetype ?? null,
                    archetypeEmoji: pt?.personalityScores?.archetypeEmoji ?? null,
                    track: pt?.track ?? null,
                    personalityScores: pt?.personalityScores ?? null,
                    intakeSubmission: intake ? {
                        formTitle: intakeForm?.title ?? null,
                        formSections: intakeForm?.sections ?? null,
                        submissionData: intake.submissionData ?? null,
                        createdAt: intake.createdAt,
                    } : null,
                    progressTimeline: {
                        currentDay: attempt?.currentDay ?? (completedDays[completedDays.length - 1] ?? 0),
                        completedDays,
                        missedDays: Array.isArray(attempt?.missedDays) ? attempt.missedDays : [],
                        submissions: progressSubmissions,
                        reviews: reviewsByUser[u.id] ?? [],
                    },
                    projectSubmission: projByUser[u.id]
                        ? {
                            status: projByUser[u.id].status,
                            partnerComment: projByUser[u.id].partnerComment ?? null,
                            projectDescription: projByUser[u.id].projectDescription ?? null,
                            track: projByUser[u.id].track ?? null,
                        }
                        : null,
                }
            })
        }
    } else {
        // Admin: fetch all pending partner override attempts
        const adminPendingResult = await payload.find({
            collection: 'attempts',
            where: { partnerDecision: { equals: 'pending' } },
            depth: 2,
            limit: 100,
            overrideAccess: true,
        })
        pendingAttempts = (adminPendingResult.docs as any[]).map(a => ({
            id: a.id,
            attemptNumber: a.attemptNumber,
            missCount: a.missCount,
            missedDays: a.missedDays || [],
            currentDay: a.currentDay,
            founderEmail: typeof a.user === 'object' ? a.user.email : 'Unknown',
            founderId: typeof a.user === 'object' ? a.user.id : a.user,
            partnerOverrideRequestedAt: a.partnerOverrideRequestedAt,
        }))

        // Admin: fetch all project submissions
        const projResult = await payloadAny.find({
            collection: 'project-submissions',
            depth: 2,
            sort: '-createdAt',
            limit: 500,
        })
        submissions = projResult.docs ?? []

        // Fetch all partners & tracks for export UI
        const [partnersResult, tracksResult] = await Promise.all([
            payload.find({ collection: 'partners', depth: 1, limit: 200, overrideAccess: true }),
            payload.find({ collection: 'tracks', where: { isActive: { equals: true } }, depth: 0, limit: 50, overrideAccess: true }),
        ])
        allPartners = (partnersResult.docs as any[]).map((p) => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            tracks: Array.isArray(p.tracks)
                ? p.tracks
                    .map((track: any) => ({
                        id: typeof track === 'object' ? track?.id : track,
                        name: typeof track === 'object' ? track?.name || '' : '',
                        slug: typeof track === 'object' ? track?.slug || '' : '',
                    }))
                    .filter((track: any) => track.id != null)
                : [],
        }))
        allTracks = (tracksResult.docs as any[]).map(t => ({ id: t.id, name: t.name, slug: t.slug }))

        const inviteLinksResult = await payload.find({
            collection: 'partner-invite-links',
            depth: 2,
            limit: 500,
            sort: '-createdAt',
            overrideAccess: true,
        }).catch(() => null)
        inviteLinks = (inviteLinksResult?.docs as any[] | undefined)?.map(mapPartnerInviteLink) ?? []

        // Fetch all founders
        const usersResult = await payload.find({
            collection: 'users',
            where: { role: { equals: 'founder' } },
            depth: 0,
            limit: 1000,
            overrideAccess: true,
        })
        const allFounders = usersResult.docs as any[]

        const allSubsResult = await payload.find({
            collection: 'founder-form-submissions',
            depth: 2,
            limit: 5000,
            overrideAccess: true,
        })

        const ptByUser: Record<number, any> = {}
        const intakeByUser: Record<number, any> = {}
        const dailySubsByUser: Record<number, any[]> = {}

        const ptFormRef2 = settings?.activePersonalityTestForm
        const ptFormId2 = ptFormRef2 ? (typeof ptFormRef2 === 'object' ? ptFormRef2?.id : ptFormRef2) : null

        for (const sub of allSubsResult.docs as any[]) {
            const uid = typeof sub.user === 'object' ? sub.user?.id : sub.user
            if (!uid) continue
            const formId = typeof sub.form === 'object' ? sub.form?.id : sub.form
            const formIdStr = String(formId)
            const formSlug2 = typeof sub.form === 'object' ? sub.form?.slug || '' : ''
            // Use form ID only — archetype may be set on intake submissions too
            const isPT = ptFormId2 ? formIdStr === String(ptFormId2) : false
            const isDaily = Boolean(sub.programDay) || formSlug2.startsWith('daily-')

            if (isPT) {
                if (!ptByUser[uid]) ptByUser[uid] = sub
            } else if (!isDaily) {
                if (!intakeByUser[uid]) intakeByUser[uid] = sub
            } else {
                if (!dailySubsByUser[uid]) dailySubsByUser[uid] = []
                dailySubsByUser[uid].push(sub)
            }
        }

        const founderIds = allFounders.map((u: any) => u.id)
        const attemptsResult = founderIds.length > 0
            ? await payload.find({
                collection: 'attempts',
                where: { or: founderIds.map((uid: number) => ({ user: { equals: uid } })) } as any,
                depth: 0,
                sort: '-createdAt',
                limit: 5000,
                overrideAccess: true,
            }).catch(() => ({ docs: [] }))
            : { docs: [] as any[] }

        const latestAttemptByUser: Record<number, any> = {}
        for (const attempt of attemptsResult.docs as any[]) {
            const uid = typeof attempt.user === 'object' ? attempt.user?.id : attempt.user
            if (uid && !latestAttemptByUser[uid]) latestAttemptByUser[uid] = attempt
        }

        const dailySubmissionIds = Object.values(dailySubsByUser).flat().map((sub: any) => sub.id)
        const reviewsResult = dailySubmissionIds.length > 0
            ? await payload.find({
                collection: 'mentor-reviews',
                where: { submission: { in: dailySubmissionIds.join(',') } },
                depth: 1,
                sort: '-createdAt',
                limit: 5000,
                overrideAccess: true,
            }).catch(() => ({ docs: [] }))
            : { docs: [] as any[] }

        const reviewBySubmissionId: Record<number, any> = {}
        const reviewsByUser: Record<number, any[]> = {}
        for (const review of reviewsResult.docs as any[]) {
            const submissionRef = typeof review.submission === 'object' ? review.submission : null
            const submissionId = submissionRef?.id ?? review.submission
            if (submissionId && !reviewBySubmissionId[submissionId]) {
                reviewBySubmissionId[submissionId] = review
            }

            const founderUser = submissionRef?.user && typeof submissionRef.user === 'object' ? submissionRef.user : null
            const founderUserId = founderUser?.id
            if (!founderUserId) continue

            if (!reviewsByUser[founderUserId]) reviewsByUser[founderUserId] = []
            reviewsByUser[founderUserId].push({
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
        }

        const projByUser: Record<number, any> = {}
        for (const s of submissions) {
            const uid = s.user?.id ?? s.user
            if (!projByUser[uid]) projByUser[uid] = s
        }

        founders = allFounders.map((u: any) => {
            const pt = ptByUser[u.id]
            const intake = intakeByUser[u.id]
            const intakeForm = typeof intake?.form === 'object' ? intake.form : null
            const dailySubs = (dailySubsByUser[u.id] ?? [])
                .filter((sub: any) => typeof sub.programDay === 'number' && sub.programDay > 0)
                .sort((a: any, b: any) => a.programDay - b.programDay || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
            const completedDays = [...new Set(dailySubs.map((sub: any) => sub.programDay).filter((day: number) => day >= 1 && day <= 100))].sort((a, b) => a - b)
            const attempt = latestAttemptByUser[u.id]
            const progressSubmissions = dailySubs.map((sub: any) => ({
                ...mapProgressSubmission(sub),
                review: reviewBySubmissionId[sub.id]
                    ? {
                        id: reviewBySubmissionId[sub.id].id,
                        dayNumber: reviewBySubmissionId[sub.id].dayNumber ?? sub.programDay ?? 0,
                        score: reviewBySubmissionId[sub.id].score ?? 0,
                        comment: reviewBySubmissionId[sub.id].comment ?? '',
                        internalNote: reviewBySubmissionId[sub.id].internalNote ?? null,
                        isGateReview: reviewBySubmissionId[sub.id].isGateReview ?? false,
                        gateDecision: reviewBySubmissionId[sub.id].gateDecision ?? null,
                        mentorName: typeof reviewBySubmissionId[sub.id].reviewer === 'object' ? reviewBySubmissionId[sub.id].reviewer?.email ?? null : null,
                        createdAt: reviewBySubmissionId[sub.id].createdAt,
                    }
                    : null,
            }))
            return {
                id: u.id,
                email: u.email,
                programStatus: u.programStatus || 'not_started',
                programAttempts: u.programAttempts || 0,
                hasPaid100Days: u.hasPaid100Days || false,
                createdAt: u.createdAt,
                archetype: pt?.archetype ?? null,
                archetypeEmoji: pt?.personalityScores?.archetypeEmoji ?? null,
                track: pt?.track ?? null,
                personalityScores: pt?.personalityScores ?? null,
                intakeSubmission: intake ? {
                    formTitle: intakeForm?.title ?? null,
                    formSections: intakeForm?.sections ?? null,
                    submissionData: intake.submissionData ?? null,
                    createdAt: intake.createdAt,
                } : null,
                progressTimeline: {
                    currentDay: attempt?.currentDay ?? (completedDays[completedDays.length - 1] ?? 0),
                    completedDays,
                    missedDays: Array.isArray(attempt?.missedDays) ? attempt.missedDays : [],
                    submissions: progressSubmissions,
                    reviews: reviewsByUser[u.id] ?? [],
                },
                projectSubmission: projByUser[u.id]
                    ? {
                        status: projByUser[u.id].status,
                        partnerComment: projByUser[u.id].partnerComment ?? null,
                        projectDescription: projByUser[u.id].projectDescription ?? null,
                        track: projByUser[u.id].track ?? null,
                    }
                    : null,
            }
        })
    }

    return (
        <PartnerDashboard
            user={user}
            settings={settings}
            submissions={submissions}
            partnerRecord={partnerRecord}
            founders={founders}
            allPartners={allPartners}
            allTracks={allTracks}
            inviteLinks={inviteLinks}
            pendingAttempts={pendingAttempts}
            overrideGrantsRemaining={partnerRecord?.overrideGrantsRemaining ?? 0}
        />
    )
}
