import { sql } from '@payloadcms/db-postgres'
import { activateProgramInternal as activateProgram } from '@/lib/activateProgram'
import { getAppUrl } from '@/lib/appUrl'
import type { ResolvedLegalDocumentLink } from '@/lib/legalDocuments'
import { resolveLocalizedLegalDocument } from '@/lib/legalDocuments'
import { normalizeLanguage, type Language } from '@/lib/language'
import { sendInvoiceEmail } from '@/lib/invoice'
import { createPaynowPayment, getPaymentAmount } from '@/lib/paynow'

export interface InvoiceFormData {
  wantInvoice: boolean
  companyName?: string
  nip?: string
  address?: string
  city?: string
  postalCode?: string
  country?: string
  invoiceEmail?: string
}

export interface PaymentConsents {
  acceptedTerms: boolean
  acceptedPrivacy: boolean
  acceptedWithdrawal: boolean
}

export type DiscountCodeValidationResult =
  | { valid: true; type: 'percent' | 'fixed_amount'; value: number; finalAmountGroszy: number }
  | { valid: false; error: string }

type DiscountCodeReservationResult =
  | {
    ok: true
    codeId: string | number
    type: 'percent' | 'fixed_amount'
    value: number
    finalAmountGroszy: number
  }
  | { ok: false; error: string }

export interface PaymentCookieInstruction {
  name: string
  value: string
  maxAge: number
}

interface PaymentCookieTarget {
  set: (
    name: string,
    value: string,
    options: {
      httpOnly: boolean
      secure: boolean
      sameSite: 'lax'
      path: string
      maxAge: number
    }
  ) => void
}

type InitiatePaymentResult =
  | { ok: true; redirectUrl: string; cookies: PaymentCookieInstruction[] }
  | { ok: false; error: string }

interface LegalConsentAuditSnapshot {
  lang: Language
  acceptedTermsAt: string
  acceptedPrivacyAt: string
  acceptedWithdrawalAt: string | null
  termsDocumentId: string
  termsDocumentTitle: string
  termsDocumentUpdatedAt: string | null
  privacyDocumentId: string
  privacyDocumentTitle: string
  privacyDocumentUpdatedAt: string | null
}

const PAYMENT_COOKIE_MAX_AGE = 60 * 30
const PAYMENT_COOKIE_NAMES = [
  'paynow-payment-id',
  'paynow-user-id',
] as const

export function applyPaymentCookies(
  target: PaymentCookieTarget,
  instructions: PaymentCookieInstruction[],
) {
  for (const instruction of instructions) {
    target.set(instruction.name, instruction.value, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: instruction.maxAge,
    })
  }
}

function clearPaymentCookies(): PaymentCookieInstruction[] {
  return PAYMENT_COOKIE_NAMES.map((name) => ({
    name,
    value: '',
    maxAge: 0,
  }))
}

function buildPaymentCookies(params: {
  paymentId?: string | null
  userId?: string | number | null
}): PaymentCookieInstruction[] {
  return [
    {
      name: 'paynow-payment-id',
      value: params.paymentId ? String(params.paymentId) : '',
      maxAge: params.paymentId ? PAYMENT_COOKIE_MAX_AGE : 0,
    },
    {
      name: 'paynow-user-id',
      value: params.userId ? String(params.userId) : '',
      maxAge: params.userId ? PAYMENT_COOKIE_MAX_AGE : 0,
    },
  ]
}

function getRelationIds(value: unknown): Array<string | number> {
  if (!Array.isArray(value)) return []

  return value
    .map((entry: any) => entry?.id ?? entry)
    .filter((entry) => entry != null)
}

function hasRelationId(value: unknown, target: string | number): boolean {
  return getRelationIds(value).some((entry) => String(entry) === String(target))
}

function buildDiscountAmountResult(dc: any): DiscountCodeValidationResult {
  const baseAmount = getPaymentAmount()
  const finalAmountGroszy = dc.type === 'percent'
    ? Math.round(baseAmount * (1 - dc.value / 100))
    : Math.max(0, baseAmount - dc.value * 100)

  return {
    valid: true,
    type: dc.type,
    value: dc.value,
    finalAmountGroszy,
  }
}

export function validatePaymentConsents(
  consents: PaymentConsents | null | undefined,
  requiresWithdrawalConsent: boolean,
): string | null {
  if (!consents?.acceptedTerms || !consents?.acceptedPrivacy) {
    return 'Please accept the Terms of Use and Privacy Policy before continuing.'
  }

  if (requiresWithdrawalConsent && !consents.acceptedWithdrawal) {
    return 'Please confirm immediate access to the digital service before continuing.'
  }

  return null
}

async function ensureLegalDocumentMeta(
  payload: any,
  resolved: ResolvedLegalDocumentLink,
): Promise<{
  id: string | null
  title: string | null
  updatedAt: string | null
}> {
  if (!resolved.id) {
    return {
      id: null,
      title: resolved.title ?? resolved.label,
      updatedAt: resolved.updatedAt ?? null,
    }
  }

  if (resolved.title && resolved.updatedAt) {
    return {
      id: resolved.id,
      title: resolved.title,
      updatedAt: resolved.updatedAt,
    }
  }

  const document = await payload.findByID({
    collection: 'documents',
    id: resolved.id,
    depth: 0,
    overrideAccess: true,
  }).catch(() => null) as any

  return {
    id: resolved.id,
    title: document?.title || resolved.title || resolved.label,
    updatedAt: document?.updatedAt || resolved.updatedAt || null,
  }
}

async function buildLegalConsentAuditSnapshot(params: {
  payload: any
  settings: any
  lang: string | null | undefined
  consents: PaymentConsents
  consentedAt: string
}): Promise<LegalConsentAuditSnapshot | { error: string }> {
  const { payload, settings, lang, consents, consentedAt } = params
  const normalizedLang = normalizeLanguage(lang)
  const termsDocument = resolveLocalizedLegalDocument(
    settings?.footer?.legalLinks?.termsOfUse,
    normalizedLang,
    normalizedLang === 'pl' ? 'Warunki korzystania' : 'Terms of Use',
  )
  const privacyDocument = resolveLocalizedLegalDocument(
    settings?.footer?.legalLinks?.privacyPolicy,
    normalizedLang,
    normalizedLang === 'pl' ? 'Polityka prywatności' : 'Privacy Policy',
  )

  if (!termsDocument.href || !privacyDocument.href) {
    return { error: 'Legal documents are currently unavailable. Please try again later.' }
  }

  const [termsMeta, privacyMeta] = await Promise.all([
    ensureLegalDocumentMeta(payload, termsDocument),
    ensureLegalDocumentMeta(payload, privacyDocument),
  ])

  if (!termsMeta.id || !privacyMeta.id) {
    return { error: 'Legal documents are currently unavailable. Please try again later.' }
  }

  return {
    lang: normalizedLang,
    acceptedTermsAt: consentedAt,
    acceptedPrivacyAt: consentedAt,
    acceptedWithdrawalAt: consents.acceptedWithdrawal ? consentedAt : null,
    termsDocumentId: termsMeta.id,
    termsDocumentTitle: termsMeta.title || termsDocument.label,
    termsDocumentUpdatedAt: termsMeta.updatedAt,
    privacyDocumentId: privacyMeta.id,
    privacyDocumentTitle: privacyMeta.title || privacyDocument.label,
    privacyDocumentUpdatedAt: privacyMeta.updatedAt,
  }
}

async function beginDiscountCodeTransaction(payload: any) {
  const adapter = payload.db as any
  const transactionID = await adapter?.beginTransaction?.()
  if (!transactionID) return null

  const tableName = adapter.tableNameMap?.get('discount_codes') ?? 'discount_codes'
  const table = adapter.tables?.[tableName]
  const db = adapter.sessions?.[transactionID]?.db ?? adapter.drizzle

  return {
    adapter,
    transactionID,
    req: { transactionID } as any,
    table,
    db,
  }
}

async function rollbackDiscountCodeTransaction(tx: Awaited<ReturnType<typeof beginDiscountCodeTransaction>>) {
  if (!tx) return

  try {
    await tx.adapter.rollbackTransaction(tx.transactionID)
  } catch {}
}

async function lockDiscountCodeById(
  tx: NonNullable<Awaited<ReturnType<typeof beginDiscountCodeTransaction>>>,
  codeId: string | number,
) {
  if (!tx.table?.id) return

  await tx.db.execute(
    sql`select ${tx.table.id} from ${tx.table} where ${tx.table.id} = ${codeId} for update`,
  )
}

async function lockDiscountCodeByCode(
  tx: NonNullable<Awaited<ReturnType<typeof beginDiscountCodeTransaction>>>,
  code: string,
) {
  if (!tx.table?.id || !tx.table?.code) return

  await tx.db.execute(
    sql`select ${tx.table.id} from ${tx.table} where ${tx.table.code} = ${code} for update`,
  )
}

async function clearPendingDiscountCodeId(
  payload: any,
  userId: string | number,
  req?: any,
) {
  await payload.update({
    collection: 'users',
    id: userId,
    data: { 'invoiceData.pendingDiscountCodeId': null } as any,
    overrideAccess: true,
    ...(req ? { req } : {}),
  })
}

export async function validateDiscountCodeForUser(
  payload: any,
  user: any,
  code: string,
): Promise<DiscountCodeValidationResult> {
  const trimmed = code.trim().toUpperCase()
  if (!trimmed) return { valid: false, error: 'No code provided' }
  if (trimmed.length > 50 || !/^[A-Z0-9\-_]+$/.test(trimmed)) {
    return { valid: false, error: 'Invalid code format' }
  }

  const result = await payload.find({
    collection: 'discount-codes',
    where: { code: { equals: trimmed } },
    limit: 1,
  })

  const dc = result.docs[0] as any
  if (!dc) return { valid: false, error: 'Code not found' }
  if (!dc.isActive) return { valid: false, error: 'Code is no longer active' }
  if (dc.expiresAt && new Date(dc.expiresAt) < new Date()) return { valid: false, error: 'Code has expired' }

  const restrictedUserId = dc.restrictToUser?.id ?? dc.restrictToUser
  if (restrictedUserId && String(restrictedUserId) !== String(user.id)) {
    return { valid: false, error: 'Code is not valid for your account' }
  }

  const alreadyUsed = hasRelationId(dc.usedBy, user.id)
  if (alreadyUsed) return { valid: false, error: 'You have already used this code' }
  if (hasRelationId(dc.pendingUsers, user.id)) {
    return { valid: false, error: 'Code is already attached to your pending payment' }
  }

  const reservedCount = getRelationIds(dc.pendingUsers).length
  if (dc.maxUses > 0 && (dc.useCount ?? 0) + reservedCount >= dc.maxUses) {
    return { valid: false, error: 'Code has reached its maximum uses' }
  }

  return buildDiscountAmountResult(dc)
}

async function reserveDiscountCodeForUser(
  payload: any,
  user: any,
  code: string,
): Promise<DiscountCodeReservationResult> {
  const trimmed = code.trim().toUpperCase()
  if (!trimmed) return { ok: false, error: 'No code provided' }
  if (trimmed.length > 50 || !/^[A-Z0-9\-_]+$/.test(trimmed)) {
    return { ok: false, error: 'Invalid code format' }
  }

  const tx = await beginDiscountCodeTransaction(payload)
  let committed = false
  const fail = async (error: string): Promise<DiscountCodeReservationResult> => {
    if (tx && !committed) {
      await rollbackDiscountCodeTransaction(tx)
    }
    return { ok: false, error }
  }

  try {
    if (tx) {
      await lockDiscountCodeByCode(tx, trimmed)
    }

    const result = await payload.find({
      collection: 'discount-codes',
      where: { code: { equals: trimmed } },
      limit: 1,
      overrideAccess: true,
      ...(tx ? { req: tx.req } : {}),
    })

    const dc = result.docs[0] as any
    if (!dc) return fail('Code not found')
    if (!dc.isActive) return fail('Code is no longer active')
    if (dc.expiresAt && new Date(dc.expiresAt) < new Date()) return fail('Code has expired')

    const restrictedUserId = dc.restrictToUser?.id ?? dc.restrictToUser
    if (restrictedUserId && String(restrictedUserId) !== String(user.id)) {
      return fail('Code is not valid for your account')
    }

    if (hasRelationId(dc.usedBy, user.id)) {
      return fail('You have already used this code')
    }
    if (hasRelationId(dc.pendingUsers, user.id)) {
      return fail('Code is already attached to your pending payment')
    }

    const pendingUserIds = getRelationIds(dc.pendingUsers)
    if (dc.maxUses > 0 && (dc.useCount ?? 0) + pendingUserIds.length >= dc.maxUses) {
      return fail('Code has reached its maximum uses')
    }

    await payload.update({
      collection: 'discount-codes',
      id: dc.id,
      data: {
        pendingUsers: [...pendingUserIds, user.id],
      },
      overrideAccess: true,
      ...(tx ? { req: tx.req } : {}),
    })

    if (tx) {
      await tx.adapter.commitTransaction(tx.transactionID)
      committed = true
    }

    const amount = buildDiscountAmountResult(dc)
    if (!amount.valid) {
      return fail('Code could not be applied')
    }

    return {
      ok: true,
      codeId: dc.id,
      type: amount.type,
      value: amount.value,
      finalAmountGroszy: amount.finalAmountGroszy,
    }
  } catch (error) {
    if (tx && !committed) {
      await rollbackDiscountCodeTransaction(tx)
    }
    console.error('[DiscountCode] Failed to reserve code:', error)
    return { ok: false, error: 'Failed to reserve discount code' }
  }
}

export async function finalizePendingDiscountCode(
  payload: any,
  user: any,
) {
  const discountCodeId = user?.invoiceData?.pendingDiscountCodeId
  if (!discountCodeId) return

  const tx = await beginDiscountCodeTransaction(payload)
  let committed = false

  try {
    if (tx) {
      await lockDiscountCodeById(tx, discountCodeId)
    }

    const dc = await payload.findByID({
      collection: 'discount-codes',
      id: discountCodeId,
      overrideAccess: true,
      ...(tx ? { req: tx.req } : {}),
    }) as any

    const pendingUserIds = getRelationIds(dc.pendingUsers)
    const usedByIds = getRelationIds(dc.usedBy)
    const nextPendingUsers = pendingUserIds.filter((entry) => String(entry) !== String(user.id))
    const alreadyUsed = usedByIds.some((entry) => String(entry) === String(user.id))

    const updateData: Record<string, unknown> = {}

    if (nextPendingUsers.length !== pendingUserIds.length) {
      updateData.pendingUsers = nextPendingUsers
    }

    if (!alreadyUsed) {
      updateData.useCount = (dc.useCount ?? 0) + 1
      updateData.usedBy = [...usedByIds, user.id]
    }

    if (Object.keys(updateData).length > 0) {
      await payload.update({
        collection: 'discount-codes',
        id: discountCodeId,
        data: updateData,
        overrideAccess: true,
        ...(tx ? { req: tx.req } : {}),
      })
    }

    await clearPendingDiscountCodeId(payload, user.id, tx?.req)

    if (tx) {
      await tx.adapter.commitTransaction(tx.transactionID)
      committed = true
    }
  } catch (error) {
    if (tx && !committed) {
      await rollbackDiscountCodeTransaction(tx)
    }
    console.error('[DiscountCode] Failed to finalize pending code:', error)
  }
}

/**
 * Clears a reserved discount code after payment failure/cancellation.
 */
export async function releasePendingDiscountCode(
  payload: any,
  user: any,
) {
  const discountCodeId = user?.invoiceData?.pendingDiscountCodeId
  if (!discountCodeId) return

  const tx = await beginDiscountCodeTransaction(payload)
  let committed = false

  try {
    if (tx) {
      await lockDiscountCodeById(tx, discountCodeId)
    }

    const dc = await payload.findByID({
      collection: 'discount-codes',
      id: discountCodeId,
      overrideAccess: true,
      ...(tx ? { req: tx.req } : {}),
    }) as any

    const pendingUserIds = getRelationIds(dc.pendingUsers)
    const nextPendingUsers = pendingUserIds.filter((entry) => String(entry) !== String(user.id))

    if (nextPendingUsers.length !== pendingUserIds.length) {
      await payload.update({
        collection: 'discount-codes',
        id: discountCodeId,
        data: { pendingUsers: nextPendingUsers },
        overrideAccess: true,
        ...(tx ? { req: tx.req } : {}),
      })
    }

    await clearPendingDiscountCodeId(payload, user.id, tx?.req)

    if (tx) {
      await tx.adapter.commitTransaction(tx.transactionID)
      committed = true
    }
  } catch (error) {
    if (tx && !committed) {
      await rollbackDiscountCodeTransaction(tx)
    }
    console.error('[DiscountCode] Failed to release pending code:', error)
  }
}

export async function initiatePaymentForUser(params: {
  payload: any
  user: any
  invoiceData?: InvoiceFormData
  discountCode?: string | null
  locale?: string | null
  lang?: string | null
  consents?: PaymentConsents | null
}): Promise<InitiatePaymentResult> {
  const { payload, user, invoiceData, discountCode, locale, lang, consents } = params

  if (!user) return { ok: false, error: 'Authentication required' }
  if ((user as any).hasPaid100Days) return { ok: false, error: 'Already paid' }
  if (user?.invoiceData?.pendingDiscountCodeId) {
    return { ok: false, error: 'A discounted payment is already pending for your account' }
  }

  const baseAmount = getPaymentAmount()
  let effectiveAmount = baseAmount
  let appliedDiscountCodeId: string | number | null = null
  const trimmedDiscountCode = discountCode?.trim() || null

  const partnerRaw = (user as any).partner
  const partnerId = partnerRaw?.id ?? partnerRaw
  if (partnerId) {
    const partner = await payload.findByID({ collection: 'partners', id: partnerId }).catch(() => null) as any
    if (partner?.customPricing?.enabled) {
      if (partner.customPricing.type === 'free') {
        effectiveAmount = 0
      } else if (partner.customPricing.type === 'fixed' && partner.customPricing.amountGroszy != null) {
        effectiveAmount = partner.customPricing.amountGroszy
      }
    }
  }

  const canApplyDiscountCode = Boolean(trimmedDiscountCode && effectiveAmount === baseAmount)

  if (canApplyDiscountCode) {
    const discountPreview = await validateDiscountCodeForUser(payload, user, trimmedDiscountCode as string)
    if (!discountPreview.valid) {
      return { ok: false, error: `Discount code: ${discountPreview.error}` }
    }

    effectiveAmount = discountPreview.finalAmountGroszy
  }

  const consentError = validatePaymentConsents(consents, effectiveAmount > 0)
  if (consentError) {
    return { ok: false, error: consentError }
  }

  const settings: any = await payload.findGlobal({ slug: 'platform-settings' }).catch(() => ({}))
  const consentedAt = new Date().toISOString()
  const legalConsentAudit = await buildLegalConsentAuditSnapshot({
    payload,
    settings,
    lang,
    consents: consents as PaymentConsents,
    consentedAt,
  })

  if ('error' in legalConsentAudit) {
    return { ok: false, error: legalConsentAudit.error }
  }

  if (canApplyDiscountCode) {
    const reservation = await reserveDiscountCodeForUser(payload, user, trimmedDiscountCode as string)
    if (!reservation.ok) {
      return { ok: false, error: `Discount code: ${reservation.error}` }
    }

    effectiveAmount = reservation.finalAmountGroszy
    appliedDiscountCodeId = reservation.codeId
  }

  if (invoiceData?.wantInvoice) {
    await payload.update({
      collection: 'users',
      id: user.id,
      data: {
        invoiceData: {
          wantInvoice: true,
          companyName: invoiceData.companyName || '',
          nip: invoiceData.nip || '',
          address: invoiceData.address || '',
          city: invoiceData.city || '',
          postalCode: invoiceData.postalCode || '',
          country: invoiceData.country || 'PL',
          invoiceEmail: invoiceData.invoiceEmail || '',
          invoiceSent: false,
          paidAmountGroszy: effectiveAmount,
          pendingDiscountCodeId: appliedDiscountCodeId ? String(appliedDiscountCodeId) : null,
          legalConsentAudit,
        },
      },
      overrideAccess: true,
    })
  } else {
    await payload.update({
      collection: 'users',
      id: user.id,
      data: {
        invoiceData: {
          wantInvoice: false,
          invoiceSent: false,
          paidAmountGroszy: effectiveAmount,
          pendingDiscountCodeId: appliedDiscountCodeId ? String(appliedDiscountCodeId) : null,
          legalConsentAudit,
        },
      },
      overrideAccess: true,
    })
  }

  if (effectiveAmount === 0) {
    await activateProgram(user.id)
    if (appliedDiscountCodeId) {
      await finalizePendingDiscountCode(payload, {
        id: user.id,
        invoiceData: {
          pendingDiscountCodeId: String(appliedDiscountCodeId),
        },
      })
    }

    if (invoiceData?.wantInvoice) {
      try {
        await sendInvoiceEmail({
          userId: user.id,
          userEmail: user.email,
          invoiceData,
          invoiceSettings: settings?.invoicing || {},
          companyName: settings?.companyName || 'MESGA',
          amountGroszy: effectiveAmount,
        })
        await payload.update({
          collection: 'users',
          id: user.id,
          data: { 'invoiceData.invoiceSent': true } as any,
          overrideAccess: true,
        })
      } catch (error) {
        console.error('[Invoice] Failed to send invoice for free activation:', error)
      }
    }

    return {
      ok: true,
      redirectUrl: '/payment/success',
      cookies: clearPaymentCookies(),
    }
  }

  const companyName = settings?.companyName || 'MESGA'
  const origin = getAppUrl()

  try {
    const payment = await createPaynowPayment({
      amount: effectiveAmount,
      externalId: String(user.id),
      description: `${companyName} 100-Day Program`,
      buyerEmail: user.email,
      continueUrl: `${origin}/payment/success`,
      ...(locale ? { locale } : {}),
    })

    return {
      ok: true,
      redirectUrl: payment.redirectUrl,
      cookies: buildPaymentCookies({
        paymentId: payment.paymentId,
        userId: user.id,
      }),
    }
  } catch (error: any) {
    if (appliedDiscountCodeId) {
      await releasePendingDiscountCode(payload, {
        id: user.id,
        invoiceData: {
          pendingDiscountCodeId: String(appliedDiscountCodeId),
        },
      })
    }
    return { ok: false, error: error?.message || 'Payment creation failed' }
  }
}
