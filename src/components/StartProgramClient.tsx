'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { startProgramAttempt } from '@/app/actions'
import { useLanguage } from '@/lib/i18n'
import { resolveLocalizedLegalDocument, type LocalizedLegalDocumentLink } from '@/lib/legalDocuments'

interface PricingSettings {
  serviceName: string | null
  serviceNamePl: string | null
  serviceDescription: string | null
  serviceDescriptionPl: string | null
  priceDisplay: string | null
  priceDisplayEur: string | null
  vatInfo: string | null
  vatInfoPl: string | null
  activationInfo: string | null
  activationInfoPl: string | null
  activationLabel: string
  activationLabelPl: string
  returnPolicy: string | null
  returnPolicyPl: string | null
  returnLabel: string
  returnLabelPl: string
  complaintProcedure: string | null
  complaintProcedurePl: string | null
  complaintLabel: string
  complaintLabelPl: string
  individualNote: string | null
  individualNotePl: string | null
}

interface StartProgramClientProps {
  userId: number
  programAttempts: number
  maxAttempts: number
  hasPaid100Days: boolean
  partnerAmountGroszy?: number | null
  partnerName?: string | null
  partnerLogoUrl?: string | null
  paymentEnabled?: boolean
  termsLink?: LocalizedLegalDocumentLink | null
  companyName?: string
  pricingSettings?: PricingSettings
}

export default function StartProgramClient({
  userId,
  programAttempts,
  maxAttempts,
  hasPaid100Days,
  partnerAmountGroszy = null,
  partnerName = null,
  partnerLogoUrl = null,
  paymentEnabled = true,
  termsLink,
  companyName = 'MESGA',
  pricingSettings,
}: StartProgramClientProps) {
  const [agreedRules, setAgreedRules] = useState(false)
  const [agreedTerms, setAgreedTerms] = useState(false)
  const [agreedWithdrawal, setAgreedWithdrawal] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const { t, lang: siteLang } = useLanguage()
  // null = follow site lang; set on manual toggle
  const [pricingLangOverride, setPricingLangOverride] = useState<'en' | 'pl' | null>(null)

  const p = pricingSettings
  const lang = pricingLangOverride ?? siteLang
  const hasPartnerPricing = partnerAmountGroszy !== null
  const isPartnerFree = partnerAmountGroszy === 0
  const isRestart = hasPaid100Days && programAttempts > 0
  const requiresCheckout = !hasPaid100Days && paymentEnabled
  const isFirstTimePaid = requiresCheckout && !isPartnerFree
  const partnerPriceDisplayPln = hasPartnerPricing
    ? new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format((partnerAmountGroszy || 0) / 100)
    : null
  const displayPrice = hasPartnerPricing
    ? (isPartnerFree ? t('payment.free', 'Free') : partnerPriceDisplayPln)
    : (lang === 'en' ? (p?.priceDisplayEur || p?.priceDisplay) : p?.priceDisplay)
  const resolvedTermsLink = resolveLocalizedLegalDocument(
    termsLink ?? null,
    lang,
    lang === 'pl' ? 'Warunki korzystania' : 'Terms of Use',
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!agreedRules || !agreedTerms) return
    if (isFirstTimePaid && !agreedWithdrawal) return
    setError(null)

    if (requiresCheckout) {
      if (isPartnerFree) {
        router.push('/payment')
        return
      }

      const cartItem = {
        sku: 'mesga-100-days-program',
        name: p?.serviceNamePl || p?.serviceName || `Program 100 Dni — ${companyName}`,
        description: p?.serviceDescriptionPl || p?.serviceDescription || '',
        priceDisplay: isPartnerFree ? t('payment.free', 'Free') : (partnerPriceDisplayPln || p?.priceDisplay || '1 999,00 PLN'),
        priceDisplayEur: hasPartnerPricing ? undefined : (p?.priceDisplayEur || undefined),
        quantity: 1,
        addedAt: new Date().toISOString(),
      }
      window.localStorage.setItem('mesga-cart-v1', JSON.stringify(cartItem))
      router.push('/cart')
      return
    }

    startTransition(async () => {
      try {
        await startProgramAttempt(userId)
        router.push('/')
      } catch (err: any) {
        setError(err?.message || t('startProgram.errorFallback', 'Failed to start program. Please try again.'))
      }
    })
  }

  return (
    <div className="relative min-h-screen bg-[#1a2634] text-white font-sans overflow-hidden flex items-center justify-center px-4 py-16">
      {/* Background glows */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#ffcc00]/8 blur-[130px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#ffcc00]/8 blur-[130px] rounded-full" />
      </div>

      <div className="relative z-10 w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#ffcc00]/10 border border-[#ffcc00]/25 mb-6">
            <div className="w-2 h-2 rounded-full bg-[#ffcc00] animate-pulse" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#ffcc00]">
              {companyName} {t('startProgram.badge', '100-Day Program')}
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-black mb-4 tracking-tight leading-[1.1]">
            {t('startProgram.heading', 'Start Your')}{' '}
            <span className="bg-clip-text text-transparent bg-linear-to-r from-[#ffcc00] to-[#C96A4A]">
              {t('startProgram.headingHighlight', '100 Days')}
            </span>
          </h1>
          <p className="text-white/50 text-base max-w-lg mx-auto leading-relaxed">
            {t('startProgram.subtitle', 'Before you begin, please read and agree to the program rules.')}
          </p>
        </div>

        {/* Attempt counter */}
        <div className="flex items-center justify-center gap-3 mb-8">
          {Array.from({ length: maxAttempts }, (_, index) => index + 1).map((n) => (
            <div key={n} className="flex flex-col items-center gap-1.5">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all"
                style={{
                  borderColor: n <= programAttempts ? '#C96A4A' : n === programAttempts + 1 ? '#ffcc00' : 'rgba(255,255,255,0.1)',
                  backgroundColor: n <= programAttempts ? '#C96A4A15' : n === programAttempts + 1 ? '#ffcc0010' : 'transparent',
                  color: n <= programAttempts ? '#C96A4A' : n === programAttempts + 1 ? '#ffcc00' : 'rgba(255,255,255,0.2)',
                }}
              >
                {n <= programAttempts ? '✗' : n}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: n <= programAttempts ? '#C96A4A' : 'rgba(255,255,255,0.2)' }}>
                {n <= programAttempts ? t('startProgram.attemptUsed', 'Used') : `${t('startProgram.attemptTry', 'Try')} ${n}`}
              </span>
            </div>
          ))}
        </div>

        {/* Rules card */}
        <div className="rounded-3xl border border-white/10 bg-[#203e5f]/60 backdrop-blur-sm p-8 mb-6 space-y-5">
          <h2 className="text-lg font-bold text-white mb-6">{t('startProgram.rulesTitle', 'Program Rules')}</h2>

          <Rule
            number={1}
            title={t('startProgram.rule1Title', 'Miss Limit')}
            description={t('startProgram.rule1Desc', 'You can miss up to 2 daily deadlines during this attempt. On the 3rd missed day, your attempt automatically ends.')}
            color="#ffcc00"
          />
          <Rule
            number={2}
            title={t('startProgram.rule2Title', 'Late Submissions')}
            description={t('startProgram.rule2Desc', 'You may submit a missed day after its deadline (backfill). However, submitting a late day does NOT automatically unlock the next day — you must also submit the current day\'s task by 23:59 of the same calendar day.')}
            color="#C96A4A"
          />
          <Rule
            number={3}
            title={t('startProgram.rule3Title', 'No Pausing')}
            description={t('startProgram.rule3Desc', 'Once started, the program runs continuously. You cannot pause, freeze, or defer your 100 days.')}
            color="#ffcc00"
          />
          <Rule
            number={4}
            title={t('startProgram.rule4Title', 'Attempts')}
            description={t('startProgram.rule4Desc', `Your current allocation gives you up to ${maxAttempts} total attempt${maxAttempts === 1 ? '' : 's'}. Each failed attempt uses 1 chance.`)}
            color="#2CB1A1"
          />
          <Rule
            number={5}
            title={t('startProgram.rule5Title', 'Completion')}
            description={t('startProgram.rule5Desc', 'The program ends successfully the moment you complete Day 100 in any attempt (1st, 2nd, or 3rd). Remaining unused attempts are not consumed — you\'re done.')}
            color="#ffcc00"
          />
        </div>

        {/* Pricing info card — shown only on first-time paid flow */}
        {isFirstTimePaid && p && (
          <div className="rounded-3xl border border-[#ffcc00]/20 bg-[#203e5f]/60 backdrop-blur-sm p-8 mb-6">
            {/* Lang toggle */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">{t('startProgram.servicePriceTitle', 'Service & Price')}</h2>
              <div className="flex items-center gap-1 rounded-full bg-white/5 border border-white/10 p-1">
                <button
                  type="button"
                  onClick={() => setPricingLangOverride('en')}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${lang === 'en' ? 'bg-[#ffcc00] text-[#1a2634]' : 'text-white/40 hover:text-white/70'}`}
                >EN</button>
                <button
                  type="button"
                  onClick={() => setPricingLangOverride('pl')}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${lang === 'pl' ? 'bg-[#ffcc00] text-[#1a2634]' : 'text-white/40 hover:text-white/70'}`}
                >PL</button>
              </div>
            </div>

            {hasPartnerPricing && partnerName && (
              <div className="mb-5 rounded-2xl border border-[#ffcc00]/20 bg-[#ffcc00]/[0.06] p-4">
                <div className="flex flex-col items-start gap-3">
                  {partnerLogoUrl ? (
                    <img src={partnerLogoUrl} alt={partnerName} className="h-12 w-auto object-contain" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-[#ffcc00]/20 text-[#ffcc00] flex items-center justify-center text-sm font-black">
                      {partnerName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#ffcc00] mb-1">
                      {t('startProgram.partnerAccessBadge', 'Partner Access')}
                    </p>
                    <p className="text-sm font-semibold text-white">
                      {t('startProgram.partnerAccessDescription', 'Your account is connected to')} {partnerName}
                    </p>
                    <p className="text-xs text-white/45 mt-1">
                      {t('startProgram.partnerAccessSubtitle', 'Your start price has been adjusted for this partner.')}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Service name + description */}
            <div className="mb-5">
              <p className="text-sm font-semibold text-white/90 mb-1">
                {lang === 'en' ? p.serviceName : p.serviceNamePl}
              </p>
              <p className="text-xs text-white/50 leading-relaxed">
                {lang === 'en' ? p.serviceDescription : p.serviceDescriptionPl}
              </p>
            </div>

            {/* Price */}
            {(p.priceDisplay || p.priceDisplayEur) && (
              <div className="flex items-baseline gap-3 mb-5 pb-5 border-b border-white/8">
                <span className="text-3xl font-black text-[#ffcc00]">
                  {displayPrice}
                </span>
                {!isPartnerFree && (
                  <span className="text-xs text-white/40">
                    {lang === 'en' ? p.vatInfo : p.vatInfoPl}
                  </span>
                )}
              </div>
            )}

            {/* Legal grid */}
            {!isPartnerFree && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {p.activationInfo && (
                    <div className="rounded-xl bg-white/3 border border-white/6 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#ffcc00] mb-2">
                        {lang === 'en' ? p.activationLabel : p.activationLabelPl}
                      </p>
                      <p className="text-xs text-white/50 leading-relaxed">
                        {lang === 'en' ? p.activationInfo : p.activationInfoPl}
                      </p>
                    </div>
                  )}
                  {p.returnPolicy && (
                    <div className="rounded-xl bg-white/3 border border-white/6 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#ffcc00] mb-2">
                        {lang === 'en' ? p.returnLabel : p.returnLabelPl}
                      </p>
                      <p className="text-xs text-white/50 leading-relaxed">
                        {lang === 'en' ? p.returnPolicy : p.returnPolicyPl}
                      </p>
                    </div>
                  )}
                  {p.complaintProcedure && (
                    <div className="rounded-xl bg-white/3 border border-white/6 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#ffcc00] mb-2">
                        {lang === 'en' ? p.complaintLabel : p.complaintLabelPl}
                      </p>
                      <p className="text-xs text-white/50 leading-relaxed">
                        {lang === 'en' ? p.complaintProcedure : p.complaintProcedurePl}
                      </p>
                    </div>
                  )}
                </div>

                {p.individualNote && (
                  <p className="mt-4 text-[11px] text-white/30 italic">
                    {lang === 'en' ? p.individualNote : p.individualNotePl}
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* Agreement form */}
        <form onSubmit={handleSubmit} className="space-y-4 mb-6">
          <label className="flex items-start gap-4 rounded-2xl border border-white/8 bg-[#203e5f]/40 p-5 cursor-pointer hover:border-[#ffcc00]/30 transition-colors group">
            <input
              type="checkbox"
              checked={agreedRules}
              onChange={(e) => setAgreedRules(e.target.checked)}
              className="mt-0.5 shrink-0 w-5 h-5 rounded border-white/20 bg-white/5 accent-[#ffcc00]"
              required
            />
            <span className="text-sm text-white/70 leading-relaxed group-hover:text-white/90 transition-colors">
              {t('startProgram.consentRules', 'I have read and understand the 100-day program rules. I accept that missing 3 daily deadlines will end my current attempt, and I understand the backfill and attempt allocation rules.')}
            </span>
          </label>

          <label className="flex items-start gap-4 rounded-2xl border border-white/8 bg-[#203e5f]/40 p-5 cursor-pointer hover:border-[#ffcc00]/30 transition-colors group">
            <input
              type="checkbox"
              checked={agreedTerms}
              onChange={(e) => setAgreedTerms(e.target.checked)}
              className="mt-0.5 shrink-0 w-5 h-5 rounded border-white/20 bg-white/5 accent-[#ffcc00]"
              required
            />
            <span className="text-sm text-white/70 leading-relaxed group-hover:text-white/90 transition-colors">
              {t('startProgram.consentTermsPrefix', 'I agree to the')} {companyName}{' '}
              {resolvedTermsLink.href ? (
                <a
                  href={resolvedTermsLink.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#ffcc00] hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {resolvedTermsLink.label}
                </a>
              ) : (
                <span className="text-[#ffcc00]">{resolvedTermsLink.label}</span>
              )}{' '}
              {t('startProgram.consentTermsSuffix', 'and understand all program conditions.')}
            </span>
          </label>

          {/* Withdrawal consent — required by Polish law for digital services, only on first paid flow */}
          {isFirstTimePaid && (
            <label className="flex items-start gap-4 rounded-2xl border border-white/8 bg-[#203e5f]/40 p-5 cursor-pointer hover:border-[#ffcc00]/30 transition-colors group">
              <input
                type="checkbox"
                checked={agreedWithdrawal}
                onChange={(e) => setAgreedWithdrawal(e.target.checked)}
                className="mt-0.5 shrink-0 w-5 h-5 rounded border-white/20 bg-white/5 accent-[#ffcc00]"
                required
              />
              <span className="text-sm text-white/70 leading-relaxed group-hover:text-white/90 transition-colors">
                {t('startProgram.consentWithdrawal', 'I request immediate access to the digital service after payment and acknowledge that by doing so I lose my 14-day right of withdrawal (Art. 38(13) of the Polish Consumer Rights Act).')}
              </span>
            </label>
          )}

          {error && (
            <div className="rounded-2xl border border-[#C96A4A]/30 bg-[#C96A4A]/10 px-5 py-4 text-sm text-[#C96A4A]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!agreedRules || !agreedTerms || (isFirstTimePaid && !agreedWithdrawal) || isPending}
            className="w-full py-4 rounded-2xl font-bold text-base transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: agreedRules && agreedTerms && (!isFirstTimePaid || agreedWithdrawal) ? 'linear-gradient(135deg, #ffcc00 0%, #C96A4A 100%)' : 'rgba(255,255,255,0.05)',
              color: agreedRules && agreedTerms && (!isFirstTimePaid || agreedWithdrawal) ? '#1a2634' : 'rgba(255,255,255,0.3)',
              boxShadow: agreedRules && agreedTerms && (!isFirstTimePaid || agreedWithdrawal) ? '0 0 40px -8px #ffcc0060' : 'none',
            }}
          >
            {isPending
              ? t('startProgram.btnStarting', 'Starting...')
              : requiresCheckout
              ? isPartnerFree
                ? `${t('cart.proceedToCheckout', 'Proceed to checkout')} →`
                : t('startProgram.btnProceedPayment', 'Agree & Proceed to Payment →')
              : isRestart
              ? `${t('startProgram.btnRestartPrefix', 'Agree & Start Attempt')} ${programAttempts + 1} →`
              : t('startProgram.btnStart', 'Agree & Start Program →')}
          </button>
        </form>

        <div className="text-center">
          <Link href="/" className="text-sm text-white/30 hover:text-white/60 transition-colors">
            {t('startProgram.backToDashboard', '← Back to dashboard')}
          </Link>
        </div>
      </div>
    </div>
  )
}

function Rule({
  number,
  title,
  description,
  color,
}: {
  number: number
  title: string
  description: string
  color: string
}) {
  return (
    <div className="flex gap-4">
      <div
        className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border"
        style={{ backgroundColor: `${color}15`, borderColor: `${color}30`, color }}
      >
        {number}
      </div>
      <div>
        <h3 className="text-sm font-bold text-white mb-1">{title}</h3>
        <p className="text-xs text-white/50 leading-relaxed">{description}</p>
      </div>
    </div>
  )
}
