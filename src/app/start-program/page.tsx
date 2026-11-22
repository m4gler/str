import { getPayload } from 'payload'
import config from '@/payload.config'
import { headers, cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import StartProgramClient from '@/components/StartProgramClient'
import { parseProgramConfig, type PaymentType } from '@/lib/attemptEngine'
import { getEffectiveMaxAttemptsForUser } from '@/lib/attemptLimits'
import { getStartProgramAttemptEligibility } from '@/lib/programStart'
import { findUserFromPayloadToken } from '@/lib/payloadUserToken'

export const dynamic = 'force-dynamic'

export default async function StartProgramPage() {
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

    if (user?.id && (!('partner' in user) || !('team' in user))) {
        try {
            user = await payload.findByID({
                collection: 'users',
                id: user.id,
                depth: 1,
            })
        } catch {}
    }

    if (!user) redirect('/login')
    if (user.role !== 'founder') redirect('/')

    const [settings, dayProgram] = await Promise.all([
        payload.findGlobal({ slug: 'platform-settings' }).catch(() => ({})) as Promise<any>,
        payload.findGlobal({ slug: 'day-program' }).catch(() => null),
    ])

    // Gate: must have completed the active founder form
    const founderFormRef = settings?.activeFounderForm
    const founderFormId = founderFormRef
        ? (typeof founderFormRef === 'object' ? founderFormRef?.id : founderFormRef)
        : null

    if (founderFormId) {
        const founderSubs = await payload.find({
            collection: 'founder-form-submissions',
            where: { user: { equals: user.id }, form: { equals: founderFormId } },
            limit: 1,
        })
        if (founderSubs.totalDocs === 0) redirect('/intake')
    } else {
        // No active form configured — fall back to any submission check
        const anySub = await payload.find({
            collection: 'founder-form-submissions',
            where: { user: { equals: user.id } },
            limit: 1,
        })
        if (anySub.totalDocs === 0) redirect('/intake')
    }

    // Gate: must have completed the active personality test
    const personalityFormRef = settings?.activePersonalityTestForm
    const personalityFormId = personalityFormRef
        ? (typeof personalityFormRef === 'object' ? personalityFormRef?.id : personalityFormRef)
        : null

    if (personalityFormId) {
        const ptSubmissions = await payload.find({
            collection: 'founder-form-submissions',
            where: { user: { equals: user.id }, form: { equals: personalityFormId } },
            limit: 1,
        })
        if (ptSubmissions.totalDocs === 0) redirect('/')
    }

    const paymentEnabled = settings?.paymentEnabled !== false
    const partnerId = (user as any).partner?.id ?? (user as any).partner
    let paymentType: PaymentType = 'self_paid'
    let partnerAmountGroszy: number | null = null
    let partnerName: string | null = null
    let partnerLogoUrl: string | null = null
    if (!paymentEnabled) {
        paymentType = 'free'
    } else if (partnerId) {
        const partner = await payload.findByID({ collection: 'partners', id: partnerId }).catch(() => null) as any
        if (partner) {
            partnerName = partner.name ?? null
            if (partner.logo && typeof partner.logo === 'object' && partner.logo.url) {
                partnerLogoUrl = partner.logo.url
            }
        }
        if (partner?.customPricing?.enabled) {
            if (partner.customPricing.type === 'free') {
                paymentType = 'sponsored'
                partnerAmountGroszy = 0
            } else if (partner.customPricing.type === 'fixed' && partner.customPricing.amountGroszy != null) {
                partnerAmountGroszy = partner.customPricing.amountGroszy
            }
        }
    }

    const programAttempts = user.programAttempts || 0
    const maxAttempts = await getEffectiveMaxAttemptsForUser(
        payload,
        user as any,
        paymentType,
        parseProgramConfig(dayProgram),
    )
    const openAttempts = await payload.find({
        collection: 'attempts',
        where: {
            user: { equals: user.id },
            status: { in: ['active', 'warned_1', 'warned_2'] },
        },
        sort: '-attemptNumber',
        limit: 1,
        depth: 0,
    }).catch(() => null)
    const eligibility = getStartProgramAttemptEligibility({
        paymentEnabled,
        hasPaid100Days: Boolean(user.hasPaid100Days),
        currentAttempts: programAttempts,
        maxAttempts,
        hasOpenAttempt: Boolean(openAttempts?.docs?.[0]),
    })

    // Check attempt limit
    if (!eligibility.allowed && eligibility.reason !== 'payment_required') redirect('/')

    // Already active — no need to re-start
    if (user.programStatus === 'active' || user.programStatus === 'prework') redirect('/')

    const pricingSettings = {
        serviceName: settings?.pricingServiceName || null,
        serviceNamePl: settings?.pricingServiceNamePl || null,
        serviceDescription: settings?.pricingServiceDescription || null,
        serviceDescriptionPl: settings?.pricingServiceDescriptionPl || null,
        priceDisplay: settings?.pricingPriceDisplay || null,
        priceDisplayEur: settings?.pricingPriceDisplayEur || null,
        vatInfo: settings?.pricingVatInfo || null,
        vatInfoPl: settings?.pricingVatInfoPl || null,
        activationInfo: settings?.pricingActivationInfo || null,
        activationInfoPl: settings?.pricingActivationInfoPl || null,
        activationLabel: settings?.pricingActivationLabel || 'Service Activation',
        activationLabelPl: settings?.pricingActivationLabelPl || 'Aktywacja usługi',
        returnPolicy: settings?.pricingReturnPolicy || null,
        returnPolicyPl: settings?.pricingReturnPolicyPl || null,
        returnLabel: settings?.pricingReturnLabel || 'Right of Withdrawal',
        returnLabelPl: settings?.pricingReturnLabelPl || 'Prawo odstąpienia',
        complaintProcedure: settings?.pricingComplaintProcedure || null,
        complaintProcedurePl: settings?.pricingComplaintProcedurePl || null,
        complaintLabel: settings?.pricingComplaintLabel || 'Complaints',
        complaintLabelPl: settings?.pricingComplaintLabelPl || 'Reklamacje',
        individualNote: settings?.pricingIndividualNote || null,
        individualNotePl: settings?.pricingIndividualNotePl || null,
    }

    return (
        <StartProgramClient
            userId={user.id as number}
            programAttempts={programAttempts}
            maxAttempts={maxAttempts}
            hasPaid100Days={user.hasPaid100Days || false}
            partnerAmountGroszy={partnerAmountGroszy}
            partnerName={partnerName}
            partnerLogoUrl={partnerLogoUrl}
            paymentEnabled={paymentEnabled}
            termsLink={settings?.footer?.legalLinks?.termsOfUse || null}
            companyName={settings?.companyName || 'MESGA'}
            pricingSettings={pricingSettings}
        />
    )
}
