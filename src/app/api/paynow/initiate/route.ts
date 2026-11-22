import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import {
  applyPaymentCookies,
  initiatePaymentForUser,
  type PaymentConsents,
  type InvoiceFormData,
} from '@/lib/paymentFlow'
import { findUserFromPayloadToken } from '@/lib/payloadUserToken'

async function getAuthenticatedUser(request: NextRequest, payload: any) {
  const token = request.cookies.get('payload-token')?.value

  let user: any = null

  try {
    const { user: authUser } = await payload.auth({ headers: request.headers })
    user = authUser
  } catch {}

  if (!user && token) {
    try {
      user = await findUserFromPayloadToken(payload, token)
    } catch {}
  }

  return user
}

function redirectWithCookies(
  request: NextRequest,
  target: string | URL,
  cookiesToPersist: Parameters<typeof applyPaymentCookies>[1],
) {
  const resolvedTarget = target instanceof URL ? target : new URL(target, request.url)
  const response = NextResponse.redirect(resolvedTarget, { status: 303 })
  applyPaymentCookies(response.cookies, cookiesToPersist)
  return response
}

function redirectToError(request: NextRequest, message: string) {
  const target = new URL('/payment', request.url)
  target.searchParams.set('error', message)
  return NextResponse.redirect(target, { status: 303 })
}

function formDataToInvoiceData(formData: FormData): InvoiceFormData {
  const wantInvoice = String(formData.get('wantInvoice') || '') === 'true'

  return {
    wantInvoice,
    companyName: String(formData.get('companyName') || '').trim(),
    nip: String(formData.get('nip') || '').trim(),
    address: String(formData.get('address') || '').trim(),
    city: String(formData.get('city') || '').trim(),
    postalCode: String(formData.get('postalCode') || '').trim(),
    country: String(formData.get('country') || 'PL').trim().toUpperCase(),
    invoiceEmail: String(formData.get('invoiceEmail') || '').trim(),
  }
}

function formValueIsTrue(value: FormDataEntryValue | null): boolean {
  const normalized = String(value || '').trim().toLowerCase()
  return normalized === 'true' || normalized === '1' || normalized === 'on'
}

function formDataToPaymentConsents(formData: FormData): PaymentConsents {
  return {
    acceptedTerms: formValueIsTrue(formData.get('acceptedTerms')),
    acceptedPrivacy: formValueIsTrue(formData.get('acceptedPrivacy')),
    acceptedWithdrawal: formValueIsTrue(formData.get('acceptedWithdrawal')),
  }
}

async function handleInitiation(
  request: NextRequest,
  params?: {
    invoiceData?: InvoiceFormData
    discountCode?: string | null
    consents?: PaymentConsents
    lang?: string | null
  },
) {
  const payload = await getPayload({ config })
  const user = await getAuthenticatedUser(request, payload)

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url), { status: 303 })
  }
  if (user.role !== 'founder' || (user as any).hasPaid100Days) {
    return NextResponse.redirect(new URL('/', request.url), { status: 303 })
  }

  const settings: any = await payload.findGlobal({ slug: 'platform-settings' }).catch(() => ({}))
  if (settings?.paymentEnabled === false) {
    return NextResponse.redirect(new URL('/', request.url), { status: 303 })
  }

  const lang = params?.lang || request.cookies.get('mesga-lang')?.value || 'en'
  // Map mesga lang codes to PayNow locale codes
  const localeMap: Record<string, string> = { pl: 'pl', en: 'en', uk: 'uk' }
  const locale = localeMap[lang] ?? 'en'

  const result = await initiatePaymentForUser({
    payload,
    user,
    invoiceData: params?.invoiceData,
    discountCode: params?.discountCode,
    locale,
    lang,
    consents: params?.consents,
  })

  if (!result.ok) {
    return redirectToError(request, result.error)
  }

  return redirectWithCookies(request, result.redirectUrl, result.cookies)
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handleInitiation(request)
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const formData = await request.formData()

  return handleInitiation(request, {
    invoiceData: formDataToInvoiceData(formData),
    discountCode: String(formData.get('discountCode') || '').trim() || null,
    consents: formDataToPaymentConsents(formData),
    lang: String(formData.get('consentLang') || '').trim() || null,
  })
}
