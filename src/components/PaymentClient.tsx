'use client'

import { useState } from 'react'
import Link from 'next/link'
import { validateDiscountCode } from '@/app/actions'
import type { InvoiceFormData } from '@/lib/paymentFlow'
import { useLanguage } from '@/lib/i18n'
import { resolveLocalizedLegalDocument, type LocalizedLegalDocumentLink } from '@/lib/legalDocuments'
import LanguageSwitcher from '@/components/LanguageSwitcher'

const INPUT_CLASS =
    'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-[#ffcc00]/40 focus:ring-1 focus:ring-[#ffcc00]/20 transition-all'

const INPUT_ERROR_CLASS =
    'w-full bg-white/5 border border-[#C96A4A]/40 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-[#C96A4A]/50 focus:ring-1 focus:ring-[#C96A4A]/20 transition-all'

function validateNip(nip: string): boolean {
    const cleaned = nip.replace(/[-\s]/g, '')
    if (!/^\d{10}$/.test(cleaned)) return false
    const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7]
    const digits = cleaned.split('').map(Number)
    const sum = weights.reduce((acc, w, i) => acc + w * digits[i], 0)
    return sum % 11 === digits[9]
}

function Field({
    label,
    hint,
    error,
    children,
}: {
    label: string
    hint?: string
    error?: string | null
    children: React.ReactNode
}) {
    return (
        <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">
                {label}
                {hint && <span className="ml-1.5 text-white/25 font-normal">{hint}</span>}
            </label>
            {children}
            {error && <p className="text-xs text-[#C96A4A] mt-1">{error}</p>}
        </div>
    )
}

export default function PaymentClient({
    companyName,
    logoUrl,
    amountGroszy,
    partnerAmountGroszy,
    maxAttempts = 3,
    priceDisplayPln,
    priceDisplayEur,
    productName,
    productNamePl,
    productDescription,
    productDescriptionPl,
    vatInfo,
    vatInfoPl,
    paymentMethods,
    paymentMethodsPl,
    activationInfo,
    activationInfoPl,
    returnPolicy,
    returnPolicyPl,
    complaintProcedure,
    complaintProcedurePl,
    termsLink,
    privacyLink,
    seller,
}: {
    companyName: string
    logoUrl?: string | null
    amountGroszy: number
    /** Null = no partner pricing. 0 = free. >0 = custom fixed price. */
    partnerAmountGroszy: number | null
    maxAttempts?: number
    priceDisplayPln?: string
    priceDisplayEur?: string
    productName: string
    productNamePl?: string
    productDescription: string
    productDescriptionPl?: string
    vatInfo: string
    vatInfoPl?: string
    paymentMethods: string
    paymentMethodsPl?: string
    activationInfo: string
    activationInfoPl?: string
    returnPolicy: string
    returnPolicyPl?: string
    complaintProcedure: string
    complaintProcedurePl?: string
    termsLink?: LocalizedLegalDocumentLink | null
    privacyLink?: LocalizedLegalDocumentLink | null
    seller: {
        name: string
        nip?: string | null
        regon?: string | null
        address?: string | null
        postalCode?: string | null
        city?: string | null
        email?: string | null
        phone?: string | null
    }
}) {
    const { t, lang } = useLanguage()
    const isPl = lang === 'pl'
    const resolvedProductName = isPl ? (productNamePl || productName) : productName
    const resolvedProductDescription = isPl ? (productDescriptionPl || productDescription) : productDescription
    const resolvedVatInfo = isPl ? (vatInfoPl || vatInfo) : vatInfo
    const resolvedPaymentMethods = isPl ? (paymentMethodsPl || paymentMethods) : paymentMethods
    const resolvedActivationInfo = isPl ? (activationInfoPl || activationInfo) : activationInfo
    const resolvedReturnPolicy = isPl ? (returnPolicyPl || returnPolicy) : returnPolicy
    const resolvedComplaintProcedure = isPl ? (complaintProcedurePl || complaintProcedure) : complaintProcedure
    const resolvedTermsLink = resolveLocalizedLegalDocument(
        termsLink ?? null,
        lang,
        isPl ? 'Warunki korzystania' : 'Terms of Use',
    )
    const resolvedPrivacyLink = resolveLocalizedLegalDocument(
        privacyLink ?? null,
        lang,
        isPl ? 'Polityka prywatności' : 'Privacy Policy',
    )
    const [isPending, setIsPending] = useState(false)
    const [globalError, setGlobalError] = useState<string | null>(null)
    const [nipError, setNipError] = useState<string | null>(null)
    const [form, setForm] = useState<InvoiceFormData>({
        wantInvoice: false,
        companyName: '',
        nip: '',
        address: '',
        city: '',
        postalCode: '',
        country: 'PL',
        invoiceEmail: '',
    })

    const [codeInput, setCodeInput] = useState('')
    const [codeApplying, setCodeApplying] = useState(false)
    const [appliedCode, setAppliedCode] = useState<{
        code: string
        type: 'percent' | 'fixed_amount'
        value: number
        finalAmountGroszy: number
    } | null>(null)
    const [codeError, setCodeError] = useState<string | null>(null)
    const [acceptedTerms, setAcceptedTerms] = useState(false)
    const [acceptedPrivacy, setAcceptedPrivacy] = useState(false)
    const [acceptedWithdrawal, setAcceptedWithdrawal] = useState(false)

    const set = <K extends keyof InvoiceFormData>(key: K, value: InvoiceFormData[K]) =>
        setForm(prev => ({ ...prev, [key]: value }))

    const effectiveAmount = partnerAmountGroszy !== null
        ? partnerAmountGroszy
        : (appliedCode?.finalAmountGroszy ?? amountGroszy)

    const isFree = effectiveAmount === 0
    const displayAmount = (effectiveAmount / 100).toFixed(2)
    const baseAmountPLN = (amountGroszy / 100).toFixed(2)

    async function handleApplyCode() {
        const code = codeInput.trim()
        if (!code) return
        setCodeApplying(true)
        setCodeError(null)
        setAppliedCode(null)
        try {
            const result = await validateDiscountCode(code)
            if ('error' in result) {
                setCodeError(result.error)
            } else {
                setAppliedCode({ code, ...result })
            }
        } catch {
            setCodeError(t('payment.errorCodeValidate', 'Failed to validate code. Please try again.'))
        } finally {
            setCodeApplying(false)
        }
    }

    function handleRemoveCode() {
        setAppliedCode(null)
        setCodeInput('')
        setCodeError(null)
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setGlobalError(null)
        setNipError(null)

        if (!acceptedTerms || !acceptedPrivacy || (!isFree && !acceptedWithdrawal)) {
            setGlobalError(t('payment.errorLegalRequired', 'Please accept the required legal statements before continuing.'))
            return
        }

        if (form.wantInvoice && form.nip) {
            if (!validateNip(form.nip)) {
                setNipError(t('payment.errorInvalidNip', 'Invalid NIP. Please check and try again.'))
                return
            }
        }

        setIsPending(true)
        const formElement = e.currentTarget as HTMLFormElement
        window.requestAnimationFrame(() => {
            HTMLFormElement.prototype.submit.call(formElement)
        })
    }

    return (
        <div className="relative min-h-screen bg-[#1a2634] text-white font-sans overflow-hidden flex items-center justify-center px-4 py-16">
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#ffcc00]/8 blur-[130px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#ffcc00]/8 blur-[130px] rounded-full" />
            </div>

            <div className="relative z-10 w-full max-w-lg">
                {/* Header */}
                <div className="text-center mb-10">
                    <div className="flex items-center justify-center gap-3 mb-6">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#ffcc00]/10 border border-[#ffcc00]/25">
                            <div className="w-2 h-2 rounded-full bg-[#ffcc00] animate-pulse" />
                            <span className="text-[11px] font-bold uppercase tracking-widest text-[#ffcc00]">
                                {isFree ? t('payment.badgePartner', 'Partner Access') : t('payment.badgeSecure', 'Secure Payment')}
                            </span>
                        </div>
                        <LanguageSwitcher />
                    </div>
                    <h1 className="text-4xl font-black mb-2 tracking-tight">
                        {isFree ? t('payment.headingFree', 'Activate Your Access') : t('payment.headingPaid', 'Complete Your Order')}
                    </h1>
                    <p className="text-white/40 text-sm">{resolvedProductName} · {t('payment.oneTimePayment', 'one-time payment')}</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/3 p-5 mb-6">
                    <div className="flex items-start gap-4">
                        <div className="w-20 h-20 rounded-[1.5rem] border border-white/10 bg-black/20 flex items-center justify-center shrink-0 overflow-hidden">
                            {logoUrl ? (
                                <img src={logoUrl} alt={`${companyName} product`} className="w-14 h-14 object-contain" />
                            ) : (
                                <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-[#ffcc00] to-[#203e5f] flex items-center justify-center text-2xl font-black text-white">M</div>
                            )}
                        </div>
                        <div className="min-w-0">
                            <p className="text-[11px] font-bold uppercase tracking-[2px] text-[#ffcc00] mb-1">{t('payment.productLabel', 'Product')}</p>
                            <h2 className="text-lg font-bold text-white">{resolvedProductName}</h2>
                            <p className="text-white/50 text-sm leading-relaxed mt-2">{resolvedProductDescription}</p>
                        </div>
                    </div>
                    <img
                        src="/paynow/banner-payment-methods.png"
                        alt="Paynow, BLIK, Visa, Mastercard and Google Pay payment methods"
                        className="w-full h-auto mt-5 rounded-xl border border-white/8"
                    />
                    <div className="mt-3 flex items-center gap-3">
                        <img
                            src="/paynow/banner-autopay-cards.png"
                            alt="Visa, Mastercard"
                            className="h-8 w-auto object-contain"
                        />
                        <img
                            src="/paynow/logo-autopay.webp"
                            alt="Autopay"
                            className="h-5 w-auto object-contain"
                        />
                    </div>
                </div>

                {/* Amount summary */}
                <div className="rounded-2xl border border-white/10 bg-white/3 p-5 mb-6 flex items-center justify-between">
                    <div>
                        <p className="text-white/40 text-xs font-bold uppercase tracking-wider mb-1">
                            {isFree ? t('payment.accessLabel', 'Access') : t('payment.totalLabel', 'Total')}
                        </p>
                        {isFree ? (
                            <p className="text-3xl font-black text-[#2CB1A1]">{t('payment.freeLabel', 'Free')}</p>
                        ) : (
                            <div className="flex items-baseline gap-2">
                                {!isPl && priceDisplayEur && !appliedCode && partnerAmountGroszy === null ? (
                                    <p className="text-3xl font-black text-white">{priceDisplayEur}</p>
                                ) : (
                                    <>
                                        <p className="text-3xl font-black text-white">
                                            {appliedCode ? `${displayAmount} PLN` : (priceDisplayPln || `${displayAmount} PLN`)}
                                        </p>
                                        {appliedCode && (
                                            <p className="text-sm text-white/40 line-through">{priceDisplayPln || `${baseAmountPLN} PLN`}</p>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="text-right">
                        <p className="text-white/40 text-xs">{companyName} — {t('payment.programLabel', '100-Day Program')}</p>
                        {partnerAmountGroszy !== null ? (
                            <p className="text-[#2CB1A1] text-xs mt-0.5 font-medium">{t('payment.partnerPricing', 'Partner pricing applied')}</p>
                        ) : appliedCode ? (
                            <p className="text-[#2CB1A1] text-xs mt-0.5 font-medium">
                                {appliedCode.type === 'percent'
                                    ? `${appliedCode.value}% ${t('payment.discountApplied', 'discount applied')}`
                                    : `${appliedCode.value} PLN ${t('payment.discountOff', 'off')}`}
                            </p>
                        ) : (
                            <p className="text-white/25 text-xs mt-0.5">
                                {maxAttempts} {maxAttempts === 1 ? t('payment.attempt', 'attempt') : t('payment.attempts', 'attempts')} · {t('payment.noAdditionalCharges', 'no additional charges')}
                            </p>
                        )}
                    </div>
                </div>

                <div className="rounded-2xl border border-white/8 bg-[#203e5f]/40 p-5 mb-6">
                    <div className="grid gap-4">
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-[2px] text-white/35 mb-1">{t('payment.sectionPrice', 'Price')}</p>
                            <p className="text-sm text-white/70">{resolvedVatInfo}</p>
                        </div>
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-[2px] text-white/35 mb-1">{t('payment.sectionPaymentMethods', 'Payment methods')}</p>
                            <p className="text-sm text-white/70">{resolvedPaymentMethods}</p>
                            {isPl && <p className="text-xs text-white/35 mt-1">Podmiotem świadczącym obsługę płatności online jest mElements S.A.</p>}
                            <p className="text-xs text-white/35 mt-1">
                                {isPl
                                    ? 'Dla płatności kartą operatorem płatności online jest Autopay S.A.'
                                    : 'Card payments are handled online by Autopay S.A.'}
                            </p>
                        </div>
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-[2px] text-white/35 mb-1">{t('payment.sectionActivation', 'Service activation / delivery')}</p>
                            <p className="text-sm text-white/70">{resolvedActivationInfo}</p>
                        </div>
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-[2px] text-white/35 mb-1">{t('payment.sectionReturns', 'Returns')}</p>
                            <p className="text-sm text-white/70">{resolvedReturnPolicy}</p>
                        </div>
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-[2px] text-white/35 mb-1">{t('payment.sectionComplaints', 'Complaints')}</p>
                            <p className="text-sm text-white/70">{resolvedComplaintProcedure}</p>
                        </div>
                    </div>
                </div>

                <form
                    onSubmit={handleSubmit}
                    action="/api/paynow/initiate"
                    method="post"
                    className="space-y-4"
                >
                    <input type="hidden" name="discountCode" value={partnerAmountGroszy === null ? (appliedCode?.code ?? '') : ''} />
                    <input type="hidden" name="wantInvoice" value={form.wantInvoice ? 'true' : 'false'} />
                    <input type="hidden" name="companyName" value={form.companyName ?? ''} />
                    <input type="hidden" name="nip" value={form.nip ?? ''} />
                    <input type="hidden" name="address" value={form.address ?? ''} />
                    <input type="hidden" name="city" value={form.city ?? ''} />
                    <input type="hidden" name="postalCode" value={form.postalCode ?? ''} />
                    <input type="hidden" name="country" value={form.country ?? 'PL'} />
                    <input type="hidden" name="invoiceEmail" value={form.invoiceEmail ?? ''} />
                    <input type="hidden" name="acceptedTerms" value={acceptedTerms ? 'true' : 'false'} />
                    <input type="hidden" name="acceptedPrivacy" value={acceptedPrivacy ? 'true' : 'false'} />
                    <input type="hidden" name="acceptedWithdrawal" value={acceptedWithdrawal ? 'true' : 'false'} />
                    <input type="hidden" name="consentLang" value={lang} />

                    {/* Discount code — only show if no partner pricing */}
                    {partnerAmountGroszy === null && (
                        <div className="rounded-2xl border border-white/8 bg-[#203e5f]/40 p-5">
                            <p className="text-xs font-semibold text-white/50 mb-3">{t('payment.discountCodeLabel', 'Discount Code')}</p>
                            {appliedCode ? (
                                <div className="flex items-center gap-3">
                                    <div className="flex-1 rounded-xl px-4 py-2.5 text-sm bg-[#2CB1A1]/10 border border-[#2CB1A1]/30 text-[#2CB1A1] font-mono font-bold">
                                        {appliedCode.code}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleRemoveCode}
                                        className="text-white/40 hover:text-white/70 text-xs transition-colors px-2 py-1"
                                    >
                                        {t('payment.removeCode', 'Remove')}
                                    </button>
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={codeInput}
                                        onChange={e => {
                                            setCodeInput(e.target.value.toUpperCase())
                                            setCodeError(null)
                                        }}
                                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleApplyCode() } }}
                                        placeholder="XXXX-XXXX-XXXX"
                                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-[#2CB1A1]/40 focus:ring-1 focus:ring-[#2CB1A1]/20 transition-all font-mono"
                                        maxLength={14}
                                    />
                                    <button
                                        type="button"
                                        onClick={handleApplyCode}
                                        disabled={!codeInput.trim() || codeApplying}
                                        className="px-4 py-2.5 rounded-xl text-sm font-bold border border-white/10 text-white/60 hover:border-[#2CB1A1]/40 hover:text-[#2CB1A1] transition-all disabled:opacity-40"
                                    >
                                        {codeApplying ? '…' : t('payment.applyCode', 'Apply')}
                                    </button>
                                </div>
                            )}
                            {codeError && <p className="text-xs text-[#C96A4A] mt-2">{codeError}</p>}
                        </div>
                    )}

                    {/* Invoice toggle */}
                    <label className="flex items-start gap-4 rounded-2xl border border-white/8 bg-[#203e5f]/40 p-5 cursor-pointer hover:border-[#ffcc00]/30 transition-colors group">
                        <input
                            type="checkbox"
                            checked={form.wantInvoice}
                            onChange={e => set('wantInvoice', e.target.checked)}
                            className="mt-0.5 w-5 h-5 rounded border-white/20 bg-white/5 accent-[#ffcc00] shrink-0 cursor-pointer"
                        />
                        <div>
                            <p className="text-sm font-semibold text-white group-hover:text-white/90 transition-colors">
                                {t('payment.invoiceToggleTitle', 'I need a VAT Invoice (Faktura VAT)')}
                            </p>
                            <p className="text-xs text-white/40 mt-0.5">
                                {t('payment.invoiceToggleHint', 'Fill in your company details — invoice will be sent by email after payment confirmation')}
                            </p>
                        </div>
                    </label>

                    {/* Invoice fields */}
                    {form.wantInvoice && (
                        <div className="rounded-2xl border border-[#ffcc00]/20 bg-[#ffcc00]/5 p-6 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[#ffcc00]/60">
                                {t('payment.billingDetailsLabel', 'Billing Details')}
                            </p>

                            <Field label={t('payment.fieldCompanyName', 'Company Name / Full Name *')}>
                                <input
                                    type="text"
                                    required={form.wantInvoice}
                                    value={form.companyName}
                                    onChange={e => set('companyName', e.target.value)}
                                    placeholder="Bakery VC Sp. z o.o."
                                    className={INPUT_CLASS}
                                />
                            </Field>

                            <Field label="NIP" hint={t('payment.fieldNipHint', '(optional — for companies)')} error={nipError}>
                                <input
                                    type="text"
                                    value={form.nip}
                                    onChange={e => {
                                        set('nip', e.target.value)
                                        if (nipError) setNipError(null)
                                    }}
                                    placeholder="1234567890"
                                    className={nipError ? INPUT_ERROR_CLASS : INPUT_CLASS}
                                    maxLength={14}
                                />
                            </Field>

                            <Field label={t('payment.fieldStreet', 'Street & Number *')}>
                                <input
                                    type="text"
                                    required={form.wantInvoice}
                                    value={form.address}
                                    onChange={e => set('address', e.target.value)}
                                    placeholder={isPl ? 'ul. Marszałkowska 1/2' : '123 Main Street'}
                                    className={INPUT_CLASS}
                                />
                            </Field>

                            <div className="grid grid-cols-2 gap-3">
                                <Field label={t('payment.fieldPostalCode', 'Postal Code *')}>
                                    <input
                                        type="text"
                                        required={form.wantInvoice}
                                        value={form.postalCode}
                                        onChange={e => set('postalCode', e.target.value)}
                                        placeholder="00-001"
                                        className={INPUT_CLASS}
                                        maxLength={10}
                                    />
                                </Field>
                                <Field label={t('payment.fieldCity', 'City *')}>
                                    <input
                                        type="text"
                                        required={form.wantInvoice}
                                        value={form.city}
                                        onChange={e => set('city', e.target.value)}
                                        placeholder="Warsaw"
                                        className={INPUT_CLASS}
                                    />
                                </Field>
                            </div>

                            <Field label={t('payment.fieldCountry', 'Country')} hint={t('payment.fieldCountryHint', 'ISO code (2 letters)')}>
                                <input
                                    type="text"
                                    value={form.country}
                                    onChange={e => set('country', e.target.value.toUpperCase())}
                                    placeholder="PL"
                                    className={INPUT_CLASS}
                                    maxLength={2}
                                />
                            </Field>

                            <Field label={t('payment.fieldInvoiceEmail', 'Invoice Email')} hint={t('payment.fieldInvoiceEmailHint', '(leave blank to use account email)')}>
                                <input
                                    type="email"
                                    value={form.invoiceEmail}
                                    onChange={e => set('invoiceEmail', e.target.value)}
                                    placeholder="accounting@company.com"
                                    className={INPUT_CLASS}
                                />
                            </Field>
                        </div>
                    )}

                    {globalError && (
                        <div className="rounded-xl border border-[#C96A4A]/30 bg-[#C96A4A]/10 px-4 py-3 text-sm text-[#C96A4A]">
                            {globalError}
                        </div>
                    )}

                    <label className="flex items-start gap-4 rounded-2xl border border-white/8 bg-[#203e5f]/40 p-5 cursor-pointer hover:border-[#ffcc00]/30 transition-colors group">
                        <input
                            type="checkbox"
                            checked={acceptedTerms}
                            onChange={e => setAcceptedTerms(e.target.checked)}
                            className="mt-0.5 w-5 h-5 rounded border-white/20 bg-white/5 accent-[#ffcc00] shrink-0 cursor-pointer"
                        />
                        <span className="text-sm text-white/70 leading-relaxed group-hover:text-white/90 transition-colors">
                            {t('payment.consentTermsPrefix', 'I have read and accept the')}{' '}
                            {resolvedTermsLink.href ? (
                                <a href={resolvedTermsLink.href} target="_blank" rel="noopener noreferrer" className="text-[#ffcc00] hover:underline" onClick={e => e.stopPropagation()}>
                                    {resolvedTermsLink.label}
                                </a>
                            ) : (
                                <span className="text-[#ffcc00]">{resolvedTermsLink.label}</span>
                            )}.
                        </span>
                    </label>

                    <label className="flex items-start gap-4 rounded-2xl border border-white/8 bg-[#203e5f]/40 p-5 cursor-pointer hover:border-[#ffcc00]/30 transition-colors group">
                        <input
                            type="checkbox"
                            checked={acceptedPrivacy}
                            onChange={e => setAcceptedPrivacy(e.target.checked)}
                            className="mt-0.5 w-5 h-5 rounded border-white/20 bg-white/5 accent-[#ffcc00] shrink-0 cursor-pointer"
                        />
                        <span className="text-sm text-white/70 leading-relaxed group-hover:text-white/90 transition-colors">
                            {t('payment.consentPrivacyPrefix', 'I have read the information on personal data processing and the')}{' '}
                            {resolvedPrivacyLink.href ? (
                                <a href={resolvedPrivacyLink.href} target="_blank" rel="noopener noreferrer" className="text-[#ffcc00] hover:underline" onClick={e => e.stopPropagation()}>
                                    {resolvedPrivacyLink.label}
                                </a>
                            ) : (
                                <span className="text-[#ffcc00]">{resolvedPrivacyLink.label}</span>
                            )}.
                        </span>
                    </label>

                    {!isFree && (
                        <label className="flex items-start gap-4 rounded-2xl border border-white/8 bg-[#203e5f]/40 p-5 cursor-pointer hover:border-[#ffcc00]/30 transition-colors group">
                            <input
                                type="checkbox"
                                checked={acceptedWithdrawal}
                                onChange={e => setAcceptedWithdrawal(e.target.checked)}
                                className="mt-0.5 w-5 h-5 rounded border-white/20 bg-white/5 accent-[#ffcc00] shrink-0 cursor-pointer"
                            />
                            <span className="text-sm text-white/70 leading-relaxed group-hover:text-white/90 transition-colors">
                                {t('payment.consentWithdrawal', 'I request immediate performance of the digital service after payment and acknowledge that after activation I may lose the 14-day right of withdrawal in cases provided by law.')}
                            </span>
                        </label>
                    )}

                    <button
                        type="submit"
                        disabled={isPending}
                        className="w-full py-4 rounded-2xl font-bold text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed text-[#1a2634]"
                        style={{
                            background: isFree
                                ? 'linear-gradient(135deg, #2CB1A1 0%, #ffcc00 100%)'
                                : 'linear-gradient(135deg, #ffcc00 0%, #C96A4A 100%)',
                            boxShadow: isPending ? 'none' : isFree ? '0 0 40px -8px #2CB1A160' : '0 0 40px -8px #ffcc0060',
                        }}
                    >
                        {isPending
                            ? (isFree ? t('payment.btnActivating', 'Activating…') : t('payment.btnRedirecting', 'Redirecting to payment...'))
                            : (isFree ? t('payment.btnActivateFree', 'Activate for Free →') : `${t('payment.btnPay', 'Pay')} ${!isPl && priceDisplayEur && !appliedCode && partnerAmountGroszy === null ? priceDisplayEur : (priceDisplayPln || `${displayAmount} PLN`)} →`)}
                    </button>
                </form>

                <div className="text-center mt-6 space-y-2">
                    {!isFree && <p className="text-white/20 text-xs">{t('payment.secureFooter', 'Secure payment powered by PayNow · mBank')}</p>}
                    <Link href="/" className="text-sm text-white/30 hover:text-white/60 transition-colors">
                        {t('payment.backToDashboard', '← Back to dashboard')}
                    </Link>
                </div>

                <div className="mt-6 rounded-2xl border border-white/8 bg-[#203e5f]/40 p-5 text-sm text-white/60 leading-relaxed">
                    <p className="text-[11px] font-bold uppercase tracking-[2px] text-white/35 mb-2">{t('payment.sellerDetails', 'Seller details')}</p>
                    <p>{seller.name}</p>
                    <p>{[seller.address, [seller.postalCode, seller.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</p>
                    <p>NIP: {seller.nip || '—'}{seller.regon ? ` · REGON: ${seller.regon}` : ''}</p>
                    {seller.email && <p className="mt-2">{seller.email}</p>}
                    {seller.phone && <p>{seller.phone}</p>}
                </div>
            </div>
        </div>
    )
}
