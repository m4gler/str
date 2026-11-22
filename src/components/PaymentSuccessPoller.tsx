'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/i18n'

interface PaymentSuccessPollerProps {
    paymentId: string | null
    companyName: string
}

export default function PaymentSuccessPoller({ paymentId, companyName }: PaymentSuccessPollerProps) {
    const router = useRouter()
    const { t } = useLanguage()
    const [attempt, setAttempt] = useState(0)
    const maxAttempts = 20

    useEffect(() => {
        if (attempt >= maxAttempts) return

        const timer = setTimeout(() => {
            router.refresh()
            setAttempt(a => a + 1)
        }, 3000)

        return () => clearTimeout(timer)
    }, [attempt, router])

    const timedOut = attempt >= maxAttempts

    return (
        <div className="relative min-h-screen bg-[#1a2634] text-white font-sans flex items-center justify-center px-4">
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#ffcc00]/8 blur-[130px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#ffcc00]/8 blur-[130px] rounded-full" />
            </div>

            <div className="relative z-10 w-full max-w-md text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
                {!timedOut ? (
                    <>
                        <div className="w-20 h-20 rounded-full bg-[#ffcc00]/15 border border-[#ffcc00]/30 flex items-center justify-center mx-auto mb-6">
                            <svg className="w-10 h-10 text-[#ffcc00] animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.990" />
                            </svg>
                        </div>
                        <h1 className="text-3xl font-black text-white mb-3">{t('payment.poller.confirmingTitle', 'Confirming Payment…')}</h1>
                        <p className="text-white/50 text-base mb-2 leading-relaxed">
                            {t('payment.poller.confirmingDesc', 'Your payment is being confirmed. This usually takes just a few seconds.')}
                        </p>
                        <p className="text-white/25 text-xs mt-6">
                            {t('payment.poller.checkingEvery', 'Checking automatically every 3 seconds…')}
                        </p>
                    </>
                ) : (
                    <>
                        <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-6">
                            <svg className="w-10 h-10 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-black text-white mb-3">{t('payment.poller.waitingTitle', 'Still Waiting…')}</h1>
                        <p className="text-white/50 text-sm mb-2 leading-relaxed">
                            {t('payment.poller.waitingDesc', 'The payment confirmation is taking longer than expected. Once it completes, your program will start automatically.')}
                        </p>
                        <p className="text-white/30 text-xs mb-8">
                            {t('payment.poller.waitingHint', 'You can safely go back to the dashboard — your program will activate automatically when the payment clears.')}
                        </p>
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={() => { setAttempt(0); router.refresh() }}
                                className="px-6 py-3 rounded-full font-bold text-sm text-[#1a2634] hover:opacity-90 transition-all"
                                style={{ background: 'linear-gradient(135deg, #ffcc00, #C96A4A)' }}
                            >
                                {t('payment.poller.checkAgain', 'Check Again')}
                            </button>
                            <Link href="/" className="px-6 py-3 rounded-full font-bold text-sm text-white/60 border border-white/10 hover:border-white/20 transition-all">
                                {t('payment.poller.dashboard', 'Dashboard')}
                            </Link>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
