import { getPayload } from 'payload'
import config from '@/payload.config'
import { headers, cookies } from 'next/headers'
import CartClient from '@/components/CartClient'
import { findUserFromPayloadToken } from '@/lib/payloadUserToken'

export const dynamic = 'force-dynamic'

export default async function CartPage() {
  const payload = await getPayload({ config })
  const settings: any = await payload.findGlobal({ slug: 'platform-settings' }).catch(() => ({}))
  const companyName = settings?.companyName || 'MESGA'
  const logoUrl = settings?.logo?.url || null

  const payloadHeaders = await headers()
  const cookieStore = await cookies()
  const token = cookieStore.get('payload-token')?.value

  let user: any = null

  try {
    const authResult = await payload.auth({ headers: payloadHeaders })
    user = authResult.user
  } catch {}

  if (!user && token) {
    try {
      user = await findUserFromPayloadToken(payload, token)
    } catch {}
  }

  const checkoutUrl = user ? '/payment' : '/login?next=/payment'

  return (
    <CartClient
      companyName={companyName}
      logoUrl={logoUrl}
      settings={settings}
      checkoutUrl={checkoutUrl}
      product={{
        sku: 'mesga-100-days-program',
        name: settings?.pricingServiceName || '100 Days Acceleration Program — Platform Access',
        namePl: settings?.pricingServiceNamePl || settings?.pricingServiceName || 'Program 100 Dni — dostęp do platformy akceleracyjnej',
        description: settings?.pricingServiceDescription || '100-day acceleration program for founders. Daily mission, deliverable, proof submission, and mentor review.',
        descriptionPl: settings?.pricingServiceDescriptionPl || settings?.pricingServiceDescription || '100-dniowy program akceleracyjny dla founderów. Codzienna misja, deliverable, proof submission i mentor review.',
        priceDisplay: settings?.pricingPriceDisplay || '1 999,00 PLN',
        priceDisplayEur: settings?.pricingPriceDisplayEur || '500,00 EUR',
        vatInfo: settings?.pricingVatInfo || 'gross price (includes 23% VAT)',
        vatInfoPl: settings?.pricingVatInfoPl || settings?.pricingVatInfo || 'cena brutto (zawiera 23% VAT)',
        paymentMethods: settings?.pricingPaymentMethods || 'Online payment — PayNow (operated by mBank S.A.)',
        paymentMethodsPl: settings?.pricingPaymentMethodsPl || settings?.pricingPaymentMethods || 'Płatność online — PayNow (obsługiwana przez mBank S.A.)',
        activationInfo: settings?.pricingActivationInfo || 'Program access is activated automatically upon payment confirmation by PayNow.',
        activationInfoPl: settings?.pricingActivationInfoPl || settings?.pricingActivationInfo || 'Dostęp do programu aktywowany jest automatycznie po potwierdzeniu płatności przez PayNow.',
        returnPolicy: settings?.pricingReturnPolicy || 'Consumers have the right to withdraw from the contract within 14 days without giving any reason, except where the digital service has begun with explicit consent.',
        returnPolicyPl: settings?.pricingReturnPolicyPl || settings?.pricingReturnPolicy || 'Konsumentowi przysługuje prawo odstąpienia od umowy w terminie 14 dni, z wyjątkiem sytuacji wskazanych w przepisach dla usług cyfrowych rozpoczętych za wyraźną zgodą.',
        complaintProcedure: settings?.pricingComplaintProcedure || 'Complaints can be submitted by email to: support@bakery.vc. Complaints are processed within 14 days.',
        complaintProcedurePl: settings?.pricingComplaintProcedurePl || settings?.pricingComplaintProcedure || 'Reklamacje można składać drogą elektroniczną na adres support@bakery.vc. Reklamacje rozpatrywane są w terminie 14 dni.',
      }}
    />
  )
}
