import { getPayload } from 'payload'
import config from '@/payload.config'
import { headers, cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import AdminAttemptQueue from '@/components/AdminAttemptQueue'
import { findUserFromPayloadToken } from '@/lib/payloadUserToken'

export const dynamic = 'force-dynamic'

export default async function AdminQueuePage() {
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

    if (!user) {
        redirect('/login')
    }

    if (user.role !== 'admin') {
        redirect('/')
    }

    // Fetch all failed attempts with user data
    const failedResult = await payload.find({
        collection: 'attempts',
        where: {
            status: { equals: 'failed' },
        },
        sort: '-endedAt',
        depth: 2,
        limit: 500,
    })

    // Fetch attempts awaiting partner decision
    const pendingResult = await payload.find({
        collection: 'attempts',
        where: {
            partnerDecision: { equals: 'pending' },
        },
        sort: '-partnerOverrideRequestedAt',
        depth: 2,
        limit: 500,
    })

    const failedAttempts = failedResult.docs.map((attempt: any) => {
        const userData = typeof attempt.user === 'object' ? attempt.user : null
        const partnerData = userData?.partner && typeof userData.partner === 'object' ? userData.partner : null

        return {
            id: attempt.id,
            founderEmail: userData?.email ?? 'Unknown',
            founderId: userData?.id ?? attempt.user,
            attemptNumber: attempt.attemptNumber ?? 1,
            missCount: attempt.missCount ?? 0,
            missedDays: Array.isArray(attempt.missedDays) ? attempt.missedDays : [],
            currentDay: attempt.currentDay ?? 1,
            paymentType: attempt.paymentType ?? 'self_paid',
            status: attempt.status,
            startedAt: attempt.startedAt,
            endedAt: attempt.endedAt ?? null,
            gateFailedAt: attempt.gateFailedAt ?? null,
            partnerName: partnerData?.name ?? null,
            partnerId: partnerData?.id ?? null,
            partnerDecision: attempt.partnerDecision ?? null,
            partnerOverrideRequestedAt: attempt.partnerOverrideRequestedAt ?? null,
        }
    })

    const pendingPartnerDecisions = pendingResult.docs.map((attempt: any) => {
        const userData = typeof attempt.user === 'object' ? attempt.user : null
        const partnerData = userData?.partner && typeof userData.partner === 'object' ? userData.partner : null

        return {
            id: attempt.id,
            founderEmail: userData?.email ?? 'Unknown',
            founderId: userData?.id ?? attempt.user,
            attemptNumber: attempt.attemptNumber ?? 1,
            missCount: attempt.missCount ?? 0,
            currentDay: attempt.currentDay ?? 1,
            partnerName: partnerData?.name ?? 'Unknown Partner',
            partnerId: partnerData?.id ?? 0,
            partnerOverrideRequestedAt: attempt.partnerOverrideRequestedAt ?? new Date().toISOString(),
        }
    })

    return (
        <div className="min-h-screen bg-[#0a0a0f]">
            <AdminAttemptQueue
                failedAttempts={failedAttempts}
                pendingPartnerDecisions={pendingPartnerDecisions}
            />
        </div>
    )
}
