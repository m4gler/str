import { getPayload } from 'payload'
import config from '@/payload.config'
import { headers, cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import FeedbackClient from '@/components/FeedbackClient'
import { findUserFromPayloadToken } from '@/lib/payloadUserToken'

export const dynamic = 'force-dynamic'

export default async function FeedbackPage() {
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
            user = await findUserFromPayloadToken(payload, token)
        } catch {}
    }

    if (!user || user.role !== 'founder') {
        redirect('/')
    }

    let settings: any = {}
    try {
        settings = await payload.findGlobal({ slug: 'platform-settings' })
    } catch {}

    // Fetch all mentor reviews for this founder
    let reviews: any[] = []
    try {
        const reviewsResult = await payload.find({
            collection: 'mentor-reviews',
            where: { 'submission.user': { equals: user.id } },
            sort: '-createdAt',
            limit: 100,
            depth: 1,
        })
        reviews = (reviewsResult.docs as any[]).map(r => ({
            id: r.id,
            dayNumber: r.dayNumber ?? 0,
            score: r.score ?? 0,
            comment: r.comment ?? '',
            isGateReview: r.isGateReview ?? false,
            gateDecision: r.gateDecision ?? null,
            mentorName: typeof r.mentor === 'object' ? r.mentor?.email : null,
            createdAt: r.createdAt,
        }))
    } catch {}

    // Fetch all daily form submissions (programDay > 0) for this founder
    let submissions: any[] = []
    try {
        const subsResult = await payload.find({
            collection: 'founder-form-submissions',
            where: {
                user: { equals: user.id },
                programDay: { greater_than: 0 },
            },
            sort: '-programDay',
            limit: 200,
            depth: 1,
        })
        submissions = (subsResult.docs as any[]).map(s => {
            const form = typeof s.form === 'object' ? s.form : null
            // Build question_id → question_text map from form sections
            const questionLabels: Record<string, string> = {}
            if (form?.sections) {
                for (const section of form.sections) {
                    if (section.questions) {
                        for (const q of section.questions) {
                            if (q.question_id && q.question_text) {
                                questionLabels[q.question_id] = q.question_text
                            }
                        }
                    }
                }
            }
            return {
                id: s.id,
                programDay: s.programDay ?? 0,
                dayType: s.dayType ?? 'standard',
                isBackfill: s.isBackfill ?? false,
                formTitle: form?.title || form?.slug || `Day ${s.programDay}`,
                createdAt: s.createdAt,
                submissionData: s.submissionData ?? null,
                questionLabels,
            }
        })
    } catch {}

    // Fetch active attempt for timeline data
    let currentDay = 0
    let missedDays: number[] = []
    try {
        const attemptResult = await payload.find({
            collection: 'attempts',
            where: {
                user: { equals: user.id },
                status: { in: ['active', 'warned_1', 'warned_2', 'completed'] },
            },
            sort: '-createdAt',
            limit: 1,
            depth: 0,
        })
        if (attemptResult.totalDocs > 0) {
            const attempt = attemptResult.docs[0] as any
            currentDay = attempt.currentDay ?? 0
            missedDays = Array.isArray(attempt.missedDays) ? attempt.missedDays : []
        }
    } catch {}

    // Derive completedDays from submissions
    const completedDays = [...new Set(
        submissions.map(s => s.programDay).filter((d): d is number => typeof d === 'number' && d >= 1 && d <= 100)
    )].sort((a, b) => a - b)

    const companyName = settings?.companyName || 'MESGA'

    return (
        <FeedbackClient
            user={user}
            reviews={reviews}
            submissions={submissions}
            companyName={companyName}
            settings={settings}
            currentDay={currentDay}
            completedDays={completedDays}
            missedDays={missedDays}
        />
    )
}
