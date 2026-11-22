import { getPayload } from 'payload'
import config from '@/payload.config'
import { headers, cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { checkPaymentStatus } from '@/lib/paynow'
import { activateProgramInternal as activateProgram } from '@/lib/activateProgram'
import { sendInvoiceEmail } from '@/lib/invoice'
import {
    finalizePendingDiscountCode,
    releasePendingDiscountCode,
} from '@/lib/paymentFlow'
import Link from 'next/link'
import PaymentSuccessPoller from '@/components/PaymentSuccessPoller'
import { defaultPolishTranslations } from '@/lib/i18n'
import { findUserFromPayloadToken } from '@/lib/payloadUserToken'

function tr(key: string, fallback: string, lang: string): string {
    if (lang !== 'pl') return fallback
    return (defaultPolishTranslations as Record<string, string>)[key] || fallback
}

export const dynamic = 'force-dynamic'

export default async function PaymentSuccessPage() {
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

    if (!user) redirect('/login')

    const settings: any = await payload.findGlobal({ slug: 'platform-settings' }).catch(() => ({}))
    if (settings?.paymentEnabled === false) redirect('/')
    const companyName = settings?.companyName || 'MESGA'

    // Re-fetch user to get latest state
    const freshUser = await payload.findByID({ collection: 'users', id: user.id }).catch(() => user) as any

    const lang = cookieStore.get('mesga-lang')?.value || 'en'

    async function maybeFinalizeDiscountCode(currentUser: any) {
        await finalizePendingDiscountCode(payload, currentUser)
    }

    async function maybeReleaseDiscountCode(currentUser: any) {
        await releasePendingDiscountCode(payload, currentUser)
    }

    async function maybeSendInvoice(currentUser: any) {
        const invoiceData = currentUser?.invoiceData
        if (!invoiceData?.wantInvoice || invoiceData?.invoiceSent) return
        try {
            const invoiceSettings = settings?.invoicing || {}
            const paynowPaymentId = cookieStore.get('paynow-payment-id')?.value ?? null
            await sendInvoiceEmail({
                userId: currentUser.id,
                userEmail: currentUser.email,
                invoiceData,
                invoiceSettings,
                companyName,
                amountGroszy: invoiceData.paidAmountGroszy ?? undefined,
                paynowPaymentId,
            })
            await payload.update({
                collection: 'users',
                id: currentUser.id,
                data: { 'invoiceData.invoiceSent': true } as any,
                overrideAccess: true,
            })
        } catch (err) {
            console.error('[PaymentSuccess] Invoice send failed (non-fatal):', err)
        }
    }

    async function finalizePaymentSideEffects(currentUser: any) {
        await maybeFinalizeDiscountCode(currentUser)

        const refreshedUser = await payload.findByID({
            collection: 'users',
            id: currentUser.id,
            overrideAccess: true,
        }).catch(() => currentUser) as any

        await maybeSendInvoice(refreshedUser)
    }

    // Already paid/activated — finalize discount + send invoice if not yet done, then show success
    if (freshUser?.hasPaid100Days) {
        await finalizePaymentSideEffects(freshUser)
        return <SuccessView companyName={companyName} lang={lang} />
    }

    // Try to verify payment using stored paymentId cookie
    const paymentId = cookieStore.get('paynow-payment-id')?.value
    const storedUserId = cookieStore.get('paynow-user-id')?.value

    if (paymentId && storedUserId && String(freshUser.id) === storedUserId) {
        try {
            const { status } = await checkPaymentStatus(paymentId)

            if (status === 'CONFIRMED') {
                // Activate the program directly — no need to wait for webhook
                await activateProgram(freshUser.id)
                const activatedUser = await payload.findByID({
                    collection: 'users',
                    id: freshUser.id,
                    overrideAccess: true,
                }).catch(() => ({ ...freshUser, hasPaid100Days: true })) as any

                await finalizePaymentSideEffects(activatedUser)
                return <SuccessView companyName={companyName} lang={lang} />
            }

            if (status === 'ERROR' || status === 'REJECTED' || status === 'ABANDONED' || status === 'EXPIRED') {
                await maybeReleaseDiscountCode(freshUser)
                return <FailureView status={status} companyName={companyName} lang={lang} />
            }

            // PENDING or NEW — show polling view
            return <PaymentSuccessPoller paymentId={paymentId} companyName={companyName} />

        } catch (err) {
            console.error('[PaymentSuccess] Status check failed:', err)
            // Fall through to polling view
        }
    }

    // No paymentId cookie — show polling/waiting view
    return <PaymentSuccessPoller paymentId={paymentId ?? null} companyName={companyName} />
}

function SuccessView({ companyName, lang }: { companyName: string; lang: string }) {
    const t = (key: string, fallback: string) => tr(key, fallback, lang)
    return (
        <div className="relative min-h-screen bg-[#1a2634] text-white font-sans flex items-center justify-center px-4">
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#2CB1A1]/8 blur-[130px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#ffcc00]/8 blur-[130px] rounded-full" />
            </div>
            <div className="relative z-10 w-full max-w-md text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="w-20 h-20 rounded-full bg-[#2CB1A1]/15 border border-[#2CB1A1]/30 flex items-center justify-center mx-auto mb-6">
                    <svg className="w-10 h-10 text-[#2CB1A1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                </div>
                <h1 className="text-3xl font-black text-white mb-3">{t('payment.success.title', 'Payment Confirmed!')}</h1>
                <p className="text-white/50 text-base mb-2 leading-relaxed">
                    {t('payment.success.desc', 'Your payment has been processed. You can now')}{' '}
                    <strong className="text-white">{t('payment.success.descHighlight', 'start the 100-Day Program')}</strong>{' '}
                    {t('payment.success.descSuffix', 'whenever you are ready.')}
                </p>
                <p className="text-white/30 text-sm mb-8">{t('payment.success.hint', 'Go to your dashboard and click "Start 100 Days" when you\'re ready to begin.')}</p>
                <Link
                    href="/"
                    className="inline-block px-8 py-4 rounded-full font-bold text-base text-[#1a2634] hover:opacity-90 transition-all shadow-lg"
                    style={{
                        background: 'linear-gradient(135deg, #2CB1A1 0%, #ffcc00 100%)',
                        boxShadow: '0 0 40px -8px #2CB1A160',
                    }}
                >
                    {t('payment.success.dashboardBtn', 'Go to Dashboard →')}
                </Link>
            </div>
        </div>
    )
}

function FailureView({ status, companyName, lang }: { status: string; companyName: string; lang: string }) {
    const t = (key: string, fallback: string) => tr(key, fallback, lang)
    const messages: Record<string, string> = {
        ERROR: t('payment.failure.statusError', 'An error occurred during payment processing.'),
        REJECTED: t('payment.failure.statusRejected', 'Your payment was rejected by the bank.'),
        ABANDONED: t('payment.failure.statusAbandoned', 'The payment was abandoned.'),
        EXPIRED: t('payment.failure.statusExpired', 'The payment session expired.'),
    }
    return (
        <div className="relative min-h-screen bg-[#1a2634] text-white font-sans flex items-center justify-center px-4">
            <div className="relative z-10 w-full max-w-md text-center">
                <div className="w-16 h-16 rounded-full bg-[#C96A4A]/15 border border-[#C96A4A]/30 flex items-center justify-center mx-auto mb-6">
                    <svg className="w-8 h-8 text-[#C96A4A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                </div>
                <h1 className="text-2xl font-bold text-white mb-3">{t('payment.failure.title', 'Payment Failed')}</h1>
                <p className="text-white/50 text-sm mb-8">{messages[status] ?? t('payment.failure.fallback', 'Payment could not be completed.')}</p>
                <div className="flex gap-3 justify-center">
                    <a href="/payment" className="px-6 py-3 rounded-full font-bold text-sm text-[#1a2634] hover:opacity-90 transition-all" style={{ background: 'linear-gradient(135deg, #ffcc00, #C96A4A)' }}>
                        {t('payment.tryAgain', 'Try Again')}
                    </a>
                    <a href="/" className="px-6 py-3 rounded-full font-bold text-sm text-white/60 border border-white/10 hover:border-white/20 transition-all">
                        {t('payment.dashboard', 'Dashboard')}
                    </a>
                </div>
            </div>
        </div>
    )
}
