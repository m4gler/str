import { getPayload } from 'payload'
import config from '@/payload.config'
import { headers, cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPaymentAmount } from '@/lib/paynow'
import PaymentClient from '@/components/PaymentClient'
import { defaultPolishTranslations } from '@/lib/i18n'
import { findUserFromPayloadToken } from '@/lib/payloadUserToken'

function tr(key: string, fallback: string, lang: string): string {
    if (lang !== 'pl') return fallback
    return (defaultPolishTranslations as Record<string, string>)[key] || fallback
}

export const dynamic = 'force-dynamic'

export default async function PaymentPage(props: {
    searchParams?: Promise<{ error?: string }>
}) {
    const searchParams = props.searchParams ? await props.searchParams : {}

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

    if (!user) redirect('/login')
    if (user.role !== 'founder') redirect('/')
    if (user.hasPaid100Days) redirect('/')

    const settings: any = await payload.findGlobal({ slug: 'platform-settings' }).catch(() => ({}))
    if (settings?.paymentEnabled === false) redirect('/')

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

    // Gate: project submission must be approved
    const payloadAny = payload as any
    const projResult = await payloadAny.find({
        collection: 'project-submissions',
        where: { user: { equals: user.id } },
        limit: 1,
        depth: 0,
    })
    if (projResult.totalDocs === 0) redirect('/')
    if (projResult.docs[0]?.status !== 'approved') redirect('/')
    const lang = cookieStore.get('mesga-lang')?.value || 'en'
    const companyName = settings?.companyName || 'MESGA'
    const logoUrl = settings?.logo?.url || null
    const amountGroszy = getPaymentAmount()

    // Check if user's partner has custom pricing
    let partnerAmountGroszy: number | null = null
    const partnerRaw = (user as any).partner
    const partnerId = partnerRaw?.id ?? partnerRaw
    if (partnerId) {
        const partner = await payload.findByID({ collection: 'partners', id: partnerId }).catch(() => null) as any
        if (partner?.customPricing?.enabled) {
            if (partner.customPricing.type === 'free') {
                partnerAmountGroszy = 0
            } else if (partner.customPricing.type === 'fixed' && partner.customPricing.amountGroszy != null) {
                partnerAmountGroszy = partner.customPricing.amountGroszy
            }
        }
    }

    // Show error page if redirected back with ?error=
    if (searchParams.error) {
        const error = decodeURIComponent(searchParams.error)
        const t = (key: string, fallback: string) => tr(key, fallback, lang)
        return (
            <div className="relative min-h-screen bg-[#1a2634] text-white font-sans flex items-center justify-center px-4">
                <div className="absolute inset-0 z-0 pointer-events-none">
                    <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#C96A4A]/8 blur-[130px] rounded-full" />
                </div>
                <div className="relative z-10 w-full max-w-md text-center">
                    <div className="w-16 h-16 rounded-full bg-[#C96A4A]/15 border border-[#C96A4A]/30 flex items-center justify-center mx-auto mb-6">
                        <svg className="w-8 h-8 text-[#C96A4A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-3">{t('payment.errorPage.title', 'Payment Error')}</h1>
                    <p className="text-white/50 text-sm mb-8 leading-relaxed">{error}</p>
                    <div className="flex gap-3 justify-center">
                        <a
                            href="/payment"
                            className="px-6 py-3 rounded-full font-bold text-sm text-[#1a2634] transition-all hover:opacity-90"
                            style={{ background: 'linear-gradient(135deg, #ffcc00 0%, #C96A4A 100%)' }}
                        >
                            {t('payment.tryAgain', 'Try Again')}
                        </a>
                        <a
                            href="/"
                            className="px-6 py-3 rounded-full font-bold text-sm text-white/60 border border-white/10 hover:border-white/20 transition-all"
                        >
                            {t('payment.backToDashboard', '← Back to dashboard')}
                        </a>
                    </div>
                </div>
            </div>
        )
    }

    // Compute max attempts based on payment type
    const { getMaxAttempts, parseProgramConfig } = await import('@/lib/attemptEngine')
    const dayProgramGlobal = await payload.findGlobal({ slug: 'day-program' }).catch(() => null)
    const programCfg = parseProgramConfig(dayProgramGlobal)
    const paymentType = partnerAmountGroszy === 0 ? 'sponsored' : 'self_paid'
    const maxAttempts = getMaxAttempts(paymentType as any, programCfg)

    return (
        <PaymentClient
            companyName={companyName}
            logoUrl={logoUrl}
            amountGroszy={amountGroszy}
            partnerAmountGroszy={partnerAmountGroszy}
            maxAttempts={maxAttempts}
            priceDisplayPln={settings?.pricingPriceDisplay || '1 999,00 PLN'}
            priceDisplayEur={settings?.pricingPriceDisplayEur || '500,00 EUR'}
            productName={settings?.pricingServiceName || '100 Days Acceleration Program — Platform Access'}
            productNamePl={settings?.pricingServiceNamePl || settings?.pricingServiceName || 'Program 100 Dni — dostęp do platformy akceleracyjnej'}
            productDescription={settings?.pricingServiceDescription || '100-day acceleration program for founders. Daily mission, deliverable, proof submission, and mentor review.'}
            productDescriptionPl={settings?.pricingServiceDescriptionPl || settings?.pricingServiceDescription || '100-dniowy program akceleracyjny dla founderów. Codzienna misja, deliverable, proof submission i mentor review.'}
            vatInfo={settings?.pricingVatInfo || 'gross price (includes 23% VAT)'}
            vatInfoPl={settings?.pricingVatInfoPl || settings?.pricingVatInfo || 'cena brutto (zawiera 23% VAT)'}
            paymentMethods={settings?.pricingPaymentMethods || 'Online payment — PayNow (operated by mBank S.A.)'}
            paymentMethodsPl={settings?.pricingPaymentMethodsPl || settings?.pricingPaymentMethods || 'Płatność online — PayNow (obsługiwana przez mBank S.A.)'}
            activationInfo={settings?.pricingActivationInfo || 'Program access is activated automatically upon payment confirmation by PayNow.'}
            activationInfoPl={settings?.pricingActivationInfoPl || settings?.pricingActivationInfo || 'Dostęp do programu aktywowany jest automatycznie po potwierdzeniu płatności przez system PayNow.'}
            returnPolicy={settings?.pricingReturnPolicy || 'Consumers have the right to withdraw from the contract within 14 days without giving any reason, except where the digital service has begun with explicit consent.'}
            returnPolicyPl={settings?.pricingReturnPolicyPl || settings?.pricingReturnPolicy || 'Konsumentowi przysługuje prawo odstąpienia od umowy w terminie 14 dni od dnia zawarcia umowy, bez podania przyczyny, z zastrzeżeniem wyjątków dla usług cyfrowych rozpoczętych na wyraźne żądanie klienta.'}
            complaintProcedure={settings?.pricingComplaintProcedure || 'Complaints can be submitted by email to: support@bakery.vc. Complaints are processed within 14 days.'}
            complaintProcedurePl={settings?.pricingComplaintProcedurePl || settings?.pricingComplaintProcedure || 'Reklamacje można składać drogą elektroniczną na adres support@bakery.vc. Reklamacje rozpatrywane są w terminie 14 dni.'}
            termsLink={settings?.footer?.legalLinks?.termsOfUse || null}
            privacyLink={settings?.footer?.legalLinks?.privacyPolicy || null}
            seller={{
                name: settings?.invoicing?.sellerName || companyName,
                nip: settings?.invoicing?.sellerNip || null,
                regon: settings?.invoicing?.sellerRegon || null,
                address: settings?.invoicing?.sellerAddress || null,
                postalCode: settings?.invoicing?.sellerPostalCode || null,
                city: settings?.invoicing?.sellerCity || null,
                email: settings?.invoicing?.contactEmail || settings?.invoicing?.sellerEmail || null,
                phone: settings?.invoicing?.sellerPhone || null,
            }}
        />
    )
}
