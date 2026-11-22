import 'dotenv/config'
import { getPayload } from 'payload'
import config from '@/payload.config'

const seed = async () => {
  const payload = await getPayload({ config })

  console.log('Seeding bilingual pricing & legal data into PlatformSettings...')

  await payload.updateGlobal({
    slug: 'platform-settings',
    data: {
      // English pricing fields
      pricingSectionTitle: 'Pricing & Service',
      pricingServiceName: '100 Days Acceleration Program — Platform Access',
      pricingServiceDescription: '100-day acceleration program for founders. Daily mission, deliverable, proof submission, and mentor review. Full platform access including educational materials, tools, and an ecosystem of mentors and investors.',
      pricingPriceDisplay: '1 999,00 PLN',
      pricingVatInfo: 'gross price (includes 23% VAT)',
      pricingCurrency: 'PLN',
      pricingPaymentMethods: 'Online payment — PayNow (operated by mBank S.A.)',
      pricingActivationInfo: 'Program access is activated automatically upon payment confirmation by PayNow. Activation occurs within minutes of the payment being processed.',
      pricingReturnPolicy: 'Consumers have the right to withdraw from the contract within 14 days of conclusion, without giving any reason. To exercise this right, notify us by email at: support@bakery.vc. Refunds are processed within 14 days. The right of withdrawal does not apply once the digital service has begun with the consumer\'s explicit consent (Art. 38(13) of the Polish Consumer Rights Act).',
      pricingComplaintProcedure: 'Complaints can be submitted by email to: support@bakery.vc. A complaint should include: your name, email address, description of the issue, and expected resolution. Complaints are processed within 14 days of receipt.',
      pricingActivationLabel: 'Service Activation',
      pricingReturnLabel: 'Right of Withdrawal',
      pricingComplaintLabel: 'Complaints',
      pricingIndividualNote: 'Price for individual participants.',
      pricingPartnerNote: 'Different pricing or free access may be available through partner & sponsorship offers.',
      pricingFeatures: [
        { text: '100-day acceleration program' },
        { text: 'Daily mission + deliverable + mentor review' },
        { text: 'Platform & educational materials access' },
        { text: 'Mentor & investor ecosystem' },
        { text: 'Auditable execution trail for investors' },
        { text: 'Hard gates: Days 15 / 30 / 50 / 70 / 94' },
        { text: 'VAT invoice included' },
      ],

      // Polish pricing fields
      pricingSectionTitlePl: 'Oferta i cennik',
      pricingServiceNamePl: 'Program 100 Dni — dostęp do platformy akceleracyjnej',
      pricingServiceDescriptionPl: '100-dniowy program akceleracyjny dla founderów. Codzienna misja, deliverable, proof submission i mentor review. Pełen dostęp do platformy, materiałów edukacyjnych, narzędzi i ekosystemu mentorów oraz inwestorów.',
      pricingVatInfoPl: 'cena brutto (zawiera 23% VAT)',
      pricingPaymentMethodsPl: 'Płatność online — PayNow (obsługiwana przez mBank S.A.)',
      pricingActivationInfoPl: 'Dostęp do programu aktywowany jest automatycznie po potwierdzeniu płatności przez system PayNow. Aktywacja następuje w ciągu kilku minut od zaksięgowania wpłaty.',
      pricingReturnPolicyPl: 'Konsumentowi przysługuje prawo odstąpienia od umowy w terminie 14 dni od dnia zawarcia umowy, bez podania przyczyny. Aby skorzystać z prawa odstąpienia, należy poinformować nas drogą mailową na adres: support@bakery.vc. Zwrot płatności następuje w ciągu 14 dni. Prawo odstąpienia nie przysługuje po rozpoczęciu świadczenia usługi cyfrowej za wyraźną zgodą konsumenta (art. 38 pkt 13 ustawy o prawach konsumenta).',
      pricingComplaintProcedurePl: 'Reklamacje można składać drogą elektroniczną na adres: support@bakery.vc. Reklamacja powinna zawierać: imię i nazwisko, adres e-mail, opis problemu oraz oczekiwany sposób rozwiązania. Reklamacje rozpatrywane są w terminie 14 dni od daty otrzymania.',
      pricingActivationLabelPl: 'Aktywacja usługi',
      pricingReturnLabelPl: 'Prawo odstąpienia',
      pricingComplaintLabelPl: 'Reklamacje',
      pricingIndividualNotePl: 'Cena dla uczestników indywidualnych.',
      pricingPartnerNotePl: 'Inna cena lub bezpłatny dostęp mogą być dostępne w ramach ofert partnerskich i sponsorskich.',
      pricingFeaturesPl: [
        { text: '100 dni programu akceleracyjnego' },
        { text: 'Codzienna misja + deliverable + mentor review' },
        { text: 'Dostęp do platformy i materiałów edukacyjnych' },
        { text: 'Ekosystem mentorów i inwestorów' },
        { text: 'Audytowalny trail dowodów dla inwestorów' },
        { text: 'Hard gates: Dni 15 / 30 / 50 / 70 / 94' },
        { text: 'Faktura VAT' },
      ],
    } as any,
  })

  console.log('Done — bilingual pricing/legal data seeded.')
  process.exit(0)
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
