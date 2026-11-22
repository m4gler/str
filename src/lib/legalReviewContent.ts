import type { Language } from '@/lib/language'

export interface LegalReviewContext {
  companyName: string
  legalSellerName: string
  sellerAddressLine: string
  sellerCountry: string
  sellerNip: string
  sellerRegon: string
  contactEmail: string
  contactPhone: string
  phoneNeedsInput: boolean
  serviceNameEn: string
  serviceNamePl: string
  serviceDescriptionEn: string
  serviceDescriptionPl: string
  priceDisplayPln: string
  priceDisplayEur: string
  vatInfoEn: string
  vatInfoPl: string
}

export interface LegalReviewBlock {
  type: 'paragraph' | 'list'
  text?: string
  items?: string[]
  changed?: boolean
}

export interface LegalReviewSection {
  anchor: string
  heading: string
  blocks: LegalReviewBlock[]
}

export interface LegalReviewDraft {
  filename: string
  language: Language
  sourceKey: 'terms' | 'privacy'
  title: string
  subtitle: string
  reviewNotice: string
  sections: LegalReviewSection[]
}

function compactParts(parts: Array<string | null | undefined>): string[] {
  return parts
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean)
}

export function buildLegalReviewContext(settings: any): LegalReviewContext {
  const invoicing = settings?.invoicing || {}
  const companyName = settings?.companyName || 'MESGA'
  const legalSellerName = invoicing?.sellerName || companyName
  const sellerAddressLine = compactParts([
    invoicing?.sellerAddress,
    compactParts([invoicing?.sellerPostalCode, invoicing?.sellerCity]).join(' '),
  ]).join(', ')

  const rawPhone = typeof invoicing?.sellerPhone === 'string' ? invoicing.sellerPhone.trim() : ''
  const phoneNeedsInput = !rawPhone

  return {
    companyName,
    legalSellerName,
    sellerAddressLine: sellerAddressLine || '[ADD REGISTERED ADDRESS]',
    sellerCountry: invoicing?.sellerCountry || 'Poland',
    sellerNip: invoicing?.sellerNip || '[ADD NIP]',
    sellerRegon: invoicing?.sellerRegon || '[ADD REGON]',
    contactEmail: invoicing?.contactEmail || invoicing?.sellerEmail || 'support@example.com',
    contactPhone: rawPhone || '[ADD SELLER PHONE NUMBER IN PLATFORM SETTINGS]',
    phoneNeedsInput,
    serviceNameEn: settings?.pricingServiceName || '100 Days Acceleration Program - platform access',
    serviceNamePl: settings?.pricingServiceNamePl || settings?.pricingServiceName || 'Program 100 Dni - dostep do platformy',
    serviceDescriptionEn:
      settings?.pricingServiceDescription ||
      'Digital access to the 100-day founder acceleration program, including daily tasks, submissions, mentor reviews, and platform tools.',
    serviceDescriptionPl:
      settings?.pricingServiceDescriptionPl ||
      settings?.pricingServiceDescription ||
      'Cyfrowy dostep do 100-dniowego programu akceleracyjnego dla founderow, obejmujacy codzienne zadania, submissiony, mentor review i narzedzia platformowe.',
    priceDisplayPln: settings?.pricingPriceDisplay || '1 999,00 PLN',
    priceDisplayEur: settings?.pricingPriceDisplayEur || '500,00 EUR',
    vatInfoEn: settings?.pricingVatInfo || 'gross price (includes VAT)',
    vatInfoPl: settings?.pricingVatInfoPl || settings?.pricingVatInfo || 'cena brutto (zawiera VAT)',
  }
}

function buildTermsEn(context: LegalReviewContext): LegalReviewDraft {
  return {
    filename: 'Terms_of_Use_MESGA_EN_review.pdf',
    language: 'en',
    sourceKey: 'terms',
    title: 'Terms of Use - Review Insertions',
    subtitle: 'Append the following colored clauses to the current Terms PDF.',
    reviewNotice:
      'This review file keeps the current PDF intact and appends colored insertion pages with the missing clauses to add.',
    sections: [
      {
        anchor: 'Insert into seller details / introductory section',
        heading: 'Seller details and contact',
        blocks: [
          {
            type: 'paragraph',
            text: `${context.legalSellerName}, registered at ${context.sellerAddressLine}, ${context.sellerCountry}, NIP ${context.sellerNip}, REGON ${context.sellerRegon}, is the seller and service provider operating the ${context.companyName} website and the digital service described in these Terms.`,
            changed: true,
          },
          {
            type: 'paragraph',
            text: `Customer contact details: email ${context.contactEmail}, phone ${context.contactPhone}.`,
            changed: true,
          },
          context.phoneNeedsInput
            ? {
                type: 'paragraph',
                text: 'Before publishing, replace the phone placeholder with the final seller phone number from Platform Settings.',
                changed: true,
              }
            : {
                type: 'paragraph',
                text: 'The seller publishes both email and phone contact details on the website and in the checkout flow.',
                changed: true,
              },
        ],
      },
      {
        anchor: 'Insert into price / service description section',
        heading: 'Price and scope clarification',
        blocks: [
          {
            type: 'paragraph',
            text: `${context.serviceNameEn} is a digital service. Current website description: ${context.serviceDescriptionEn}`,
            changed: true,
          },
          {
            type: 'paragraph',
            text: `The displayed price is ${context.priceDisplayPln} (${context.priceDisplayEur} in the English display) and is the final gross price. ${context.vatInfoEn}. Unless expressly stated otherwise on the checkout page, the price includes all taxes and all costs payable by the customer.`,
            changed: true,
          },
        ],
      },
      {
        anchor: 'Insert into payment methods section',
        heading: 'Payment methods and card operator',
        blocks: [
          {
            type: 'paragraph',
            text: 'Available payment methods include online payments via PayNow operated by mBank S.A. For card payments, the online payment service provider is Autopay S.A.',
            changed: true,
          },
          {
            type: 'paragraph',
            text: 'Available card schemes:',
            changed: true,
          },
          {
            type: 'list',
            items: ['Visa', 'Visa Electron', 'Mastercard', 'MasterCard Electronic', 'Maestro'],
            changed: true,
          },
        ],
      },
      {
        anchor: 'Insert into order fulfilment / delivery section',
        heading: 'Service activation and delivery',
        blocks: [
          {
            type: 'paragraph',
            text: 'The order is processed from the moment the seller receives a positive payment authorization or payment confirmation from the payment provider.',
            changed: true,
          },
          {
            type: 'paragraph',
            text: 'The service is delivered digitally. No physical shipment, shipping method, shipping costs, customs restrictions, or export limitations apply to this service.',
            changed: true,
          },
          {
            type: 'paragraph',
            text: 'Platform access is activated automatically after payment confirmation, unless the website or the checkout page expressly states otherwise.',
            changed: true,
          },
        ],
      },
      {
        anchor: 'Insert into withdrawal / refunds section',
        heading: 'Withdrawal and refunds',
        blocks: [
          {
            type: 'paragraph',
            text: 'A consumer who concludes a distance contract may withdraw from it without giving any reason within 14 days from the date of contract conclusion.',
            changed: true,
          },
          {
            type: 'paragraph',
            text: 'If the consumer explicitly requests immediate performance of the digital service before expiry of the 14-day withdrawal period and acknowledges the loss of the right of withdrawal, the right of withdrawal expires after the service begins in the cases provided by applicable law.',
            changed: true,
          },
          {
            type: 'paragraph',
            text: 'If a refund of a transaction paid by payment card is required, the seller refunds the payment using the same payment method used by the consumer, unless the consumer expressly agrees to a different refund method that does not generate any cost for the consumer.',
            changed: true,
          },
          {
            type: 'paragraph',
            text: 'For card transactions, the refund may be made to the bank account or settlement channel assigned to the card used for the payment.',
            changed: true,
          },
        ],
      },
      {
        anchor: 'Insert into complaints / statutory rights section',
        heading: 'Complaints and statutory remedies',
        blocks: [
          {
            type: 'paragraph',
            text: `Complaints may be submitted by email to ${context.contactEmail} or by phone at ${context.contactPhone}. The seller responds within 14 days.`,
            changed: true,
          },
          {
            type: 'paragraph',
            text: 'Consumers are entitled to the statutory remedies available under applicable law for lack of conformity of the digital service with the contract. These rights apply independently of any voluntary commercial guarantee unless the law provides otherwise.',
            changed: true,
          },
        ],
      },
      {
        anchor: 'Insert near privacy / personal data references',
        heading: 'Privacy reference',
        blocks: [
          {
            type: 'paragraph',
            text: 'Personal data is processed for the purposes described in the Privacy Policy, including account management, service delivery, payment handling, invoicing, complaint handling, fraud prevention, and legal compliance.',
            changed: true,
          },
        ],
      },
    ],
  }
}

function buildTermsPl(context: LegalReviewContext): LegalReviewDraft {
  return {
    filename: 'Terms_of_Use_MESGA_PL_review.pdf',
    language: 'pl',
    sourceKey: 'terms',
    title: 'Regulamin - Dopiski Review',
    subtitle: 'Dolacz ponizsze kolorowe zapisy do obecnego PDF regulaminu.',
    reviewNotice:
      'Ten plik zachowuje obecny PDF i dolacza na koncu kolorowe strony z brakujacymi zapisami do wstawienia.',
    sections: [
      {
        anchor: 'Wstaw do sekcji z danymi sprzedawcy / we wstepie',
        heading: 'Dane sprzedawcy i kontakt',
        blocks: [
          {
            type: 'paragraph',
            text: `${context.legalSellerName}, z siedziba pod adresem ${context.sellerAddressLine}, ${context.sellerCountry}, NIP ${context.sellerNip}, REGON ${context.sellerRegon}, jest sprzedawca i uslugodawca prowadzacym serwis ${context.companyName} oraz usluge cyfrowa opisana w Regulaminie.`,
            changed: true,
          },
          {
            type: 'paragraph',
            text: `Dane kontaktowe sprzedawcy: email ${context.contactEmail}, telefon ${context.contactPhone}.`,
            changed: true,
          },
          context.phoneNeedsInput
            ? {
                type: 'paragraph',
                text: 'Przed publikacja podmien placeholder telefonu na finalny numer sprzedawcy z Platform Settings.',
                changed: true,
              }
            : {
                type: 'paragraph',
                text: 'Sprzedawca publikuje na stronie oraz w checkoutcie adres email i numer telefonu.',
                changed: true,
              },
        ],
      },
      {
        anchor: 'Wstaw do sekcji o cenie / opisie uslugi',
        heading: 'Cena i doprecyzowanie zakresu uslugi',
        blocks: [
          {
            type: 'paragraph',
            text: `${context.serviceNamePl} jest usluga cyfrowa. Aktualny opis w serwisie: ${context.serviceDescriptionPl}`,
            changed: true,
          },
          {
            type: 'paragraph',
            text: `Prezentowana cena wynosi ${context.priceDisplayPln} (${context.priceDisplayEur} w angielskiej wersji prezentacji) i stanowi finalna cene brutto. ${context.vatInfoPl}. O ile checkout wyraznie nie wskazuje inaczej, cena obejmuje wszystkie podatki oraz wszystkie koszty nalezne od klienta.`,
            changed: true,
          },
        ],
      },
      {
        anchor: 'Wstaw do sekcji o metodach platnosci',
        heading: 'Formy platnosci i operator kart',
        blocks: [
          {
            type: 'paragraph',
            text: 'Dostepne formy platnosci obejmuja platnosci online PayNow obslugiwane przez mBank S.A. W zakresie platnosci kartami podmiotem swiadczacym obsluge platnosci online jest Autopay S.A.',
            changed: true,
          },
          {
            type: 'paragraph',
            text: 'Dostepne karty platnicze:',
            changed: true,
          },
          {
            type: 'list',
            items: ['Visa', 'Visa Electron', 'Mastercard', 'MasterCard Electronic', 'Maestro'],
            changed: true,
          },
        ],
      },
      {
        anchor: 'Wstaw do sekcji o realizacji zamowienia / dostawie',
        heading: 'Aktywacja uslugi i dostarczenie',
        blocks: [
          {
            type: 'paragraph',
            text: 'Czas realizacji zamowienia liczony jest od momentu uzyskania pozytywnej autoryzacji platnosci albo potwierdzenia platnosci przez operatora platnosci.',
            changed: true,
          },
          {
            type: 'paragraph',
            text: 'Usluga jest dostarczana wylacznie cyfrowo. Nie wystepuje dostawa fizyczna, koszty dostawy, ograniczenia eksportowe ani inne koszty wysylki.',
            changed: true,
          },
          {
            type: 'paragraph',
            text: 'Dostep do platformy aktywowany jest automatycznie po potwierdzeniu platnosci, o ile serwis lub checkout wyraznie nie stanowi inaczej.',
            changed: true,
          },
        ],
      },
      {
        anchor: 'Wstaw do sekcji o odstapieniu / zwrotach',
        heading: 'Odstapienie i zwroty srodkow',
        blocks: [
          {
            type: 'paragraph',
            text: 'Konsument, ktory zawarl umowe na odleglosc, ma prawo odstapic od niej bez podawania przyczyny w terminie 14 dni od dnia zawarcia umowy.',
            changed: true,
          },
          {
            type: 'paragraph',
            text: 'Jezeli konsument wyraznie zazada rozpoczecia swiadczenia uslugi cyfrowej przed uplywem terminu do odstapienia i potwierdzi utrate prawa odstapienia, prawo to wygasa po rozpoczeciu swiadczenia w przypadkach przewidzianych przepisami prawa.',
            changed: true,
          },
          {
            type: 'paragraph',
            text: 'W przypadku koniecznosci zwrotu srodkow za transakcje oplacona karta platnicza sprzedawca dokonuje zwrotu przy uzyciu takiego samego sposobu platnosci, jakiego uzyl konsument, chyba ze konsument wyraznie zgodzi sie na inny sposob zwrotu niewiazacy sie dla niego z zadnymi kosztami.',
            changed: true,
          },
          {
            type: 'paragraph',
            text: 'Dla transakcji kartowych zwrot moze zostac dokonany na rachunek bankowy lub kanal rozliczeniowy przypisany do karty wykorzystanej przy platnosci.',
            changed: true,
          },
        ],
      },
      {
        anchor: 'Wstaw do sekcji o reklamacjach / prawach ustawowych',
        heading: 'Reklamacje i ustawowe srodki ochrony',
        blocks: [
          {
            type: 'paragraph',
            text: `Reklamacje mozna skladac mailowo na adres ${context.contactEmail} albo telefonicznie pod numerem ${context.contactPhone}. Sprzedawca udziela odpowiedzi w terminie 14 dni.`,
            changed: true,
          },
          {
            type: 'paragraph',
            text: 'Konsumentowi przysluguja ustawowe srodki ochrony prawnej wynikajace z braku zgodnosci uslugi cyfrowej z umowa, niezaleznie od ewentualnej dobrowolnej gwarancji handlowej, chyba ze przepisy stanowia inaczej.',
            changed: true,
          },
        ],
      },
      {
        anchor: 'Wstaw przy odniesieniach do prywatnosci / danych osobowych',
        heading: 'Odwolanie do prywatnosci',
        blocks: [
          {
            type: 'paragraph',
            text: 'Dane osobowe sa przetwarzane w celach opisanych w Polityce Prywatnosci, w szczegolnosci dla potrzeb prowadzenia konta, realizacji uslugi, obslugi platnosci, wystawiania faktur, rozpatrywania reklamacji, zapobiegania naduzyciom oraz wykonania obowiazkow prawnych.',
            changed: true,
          },
        ],
      },
    ],
  }
}

function buildPrivacyEn(context: LegalReviewContext): LegalReviewDraft {
  return {
    filename: 'Privacy_Policy_MESGA_EN_review.pdf',
    language: 'en',
    sourceKey: 'privacy',
    title: 'Privacy Policy - Review Insertions',
    subtitle: 'Append the following colored clauses to the current Privacy PDF.',
    reviewNotice:
      'This review file keeps the current PDF intact and appends colored insertion pages with the missing clauses to add.',
    sections: [
      {
        anchor: 'Insert into controller details section',
        heading: 'Controller details',
        blocks: [
          {
            type: 'paragraph',
            text: `${context.legalSellerName}, ${context.sellerAddressLine}, ${context.sellerCountry}, NIP ${context.sellerNip}, REGON ${context.sellerRegon}, is the controller of personal data processed through the ${context.companyName} website and services.`,
            changed: true,
          },
          {
            type: 'paragraph',
            text: `Privacy contact details: ${context.contactEmail}, phone ${context.contactPhone}.`,
            changed: true,
          },
        ],
      },
      {
        anchor: 'Insert into categories of processed data section',
        heading: 'Payment, billing, and consent audit data',
        blocks: [
          {
            type: 'paragraph',
            text: 'We may process payment and billing data, including selected payment method, payment status, billing name, tax number, postal address, invoice email, charged amount, discount code linkage, and the timestamped acceptance of the Terms, Privacy Policy, and withdrawal statement shown at checkout.',
            changed: true,
          },
          {
            type: 'paragraph',
            text: 'We also store a legal consent audit created at payment initiation, including the identifiers, titles, update timestamps, accepted language, and acceptance timestamps of the active legal documents presented to the customer.',
            changed: true,
          },
        ],
      },
      {
        anchor: 'Insert into purposes and legal bases section',
        heading: 'Additional processing purposes',
        blocks: [
          {
            type: 'list',
            items: [
              'payment handling, invoicing, accounting, fraud prevention, and refund processing - performance of a contract, legal obligation, and legitimate interest',
              'complaint handling and defense of claims - legal obligation and legitimate interest',
              'maintenance of a legal consent audit for checkout compliance - legal obligation and legitimate interest',
            ],
            changed: true,
          },
        ],
      },
      {
        anchor: 'Insert into recipients section',
        heading: 'Payment recipients',
        blocks: [
          {
            type: 'paragraph',
            text: 'For online payments we may share data with PayNow and mBank S.A. For card payments, data may also be processed by Autopay S.A. to handle card authorization, settlement, and refunds.',
            changed: true,
          },
        ],
      },
    ],
  }
}

function buildPrivacyPl(context: LegalReviewContext): LegalReviewDraft {
  return {
    filename: 'Privacy_Policy_MESGA_PL_review.pdf',
    language: 'pl',
    sourceKey: 'privacy',
    title: 'Polityka Prywatnosci - Dopiski Review',
    subtitle: 'Dolacz ponizsze kolorowe zapisy do obecnego PDF polityki prywatnosci.',
    reviewNotice:
      'Ten plik zachowuje obecny PDF i dolacza na koncu kolorowe strony z brakujacymi zapisami do wstawienia.',
    sections: [
      {
        anchor: 'Wstaw do sekcji z danymi administratora',
        heading: 'Dane administratora',
        blocks: [
          {
            type: 'paragraph',
            text: `${context.legalSellerName}, ${context.sellerAddressLine}, ${context.sellerCountry}, NIP ${context.sellerNip}, REGON ${context.sellerRegon}, jest administratorem danych osobowych przetwarzanych za posrednictwem serwisu i uslug ${context.companyName}.`,
            changed: true,
          },
          {
            type: 'paragraph',
            text: `Kontakt w sprawach prywatnosci: ${context.contactEmail}, telefon ${context.contactPhone}.`,
            changed: true,
          },
        ],
      },
      {
        anchor: 'Wstaw do sekcji kategorii przetwarzanych danych',
        heading: 'Dane platnicze, billingowe i audit zgod',
        blocks: [
          {
            type: 'paragraph',
            text: 'Mozemy przetwarzac dane platnicze i billingowe, w tym wybrana metode platnosci, status platnosci, nazwe nabywcy, NIP, adres pocztowy, email do faktury, pobrana kwote, powiazanie z kodem rabatowym oraz timestampy akceptacji Regulaminu, Polityki Prywatnosci i oswiadczenia o utracie prawa odstapienia wyswietlanych w checkoutcie.',
            changed: true,
          },
          {
            type: 'paragraph',
            text: 'Przechowujemy rowniez audit zgod tworzony przy inicjacji platnosci, obejmujacy identyfikatory, tytuly, daty aktualizacji, zaakceptowany jezyk oraz timestampy akceptacji aktywnych dokumentow prawnych przedstawionych klientowi.',
            changed: true,
          },
        ],
      },
      {
        anchor: 'Wstaw do sekcji celow i podstaw prawnych',
        heading: 'Dodatkowe cele przetwarzania',
        blocks: [
          {
            type: 'list',
            items: [
              'obsluga platnosci, fakturowanie, ksiegowosc, zapobieganie naduzyciom i zwroty srodkow - wykonanie umowy, obowiazek prawny oraz prawnie uzasadniony interes',
              'obsluga reklamacji i obrona przed roszczeniami - obowiazek prawny oraz prawnie uzasadniony interes',
              'prowadzenie audytu zgod wymaganych w checkoutcie - obowiazek prawny oraz prawnie uzasadniony interes',
            ],
            changed: true,
          },
        ],
      },
      {
        anchor: 'Wstaw do sekcji odbiorcow danych',
        heading: 'Odbiorcy zwiazani z platnosciami',
        blocks: [
          {
            type: 'paragraph',
            text: 'W zakresie platnosci online dane moga byc przekazywane do PayNow oraz mBank S.A. W przypadku platnosci kartowych dane moga byc dodatkowo przetwarzane przez Autopay S.A. na potrzeby autoryzacji, rozliczenia i zwrotow transakcji kartowych.',
            changed: true,
          },
        ],
      },
    ],
  }
}

export function buildLegalReviewDrafts(context: LegalReviewContext): LegalReviewDraft[] {
  return [
    buildTermsEn(context),
    buildTermsPl(context),
    buildPrivacyEn(context),
    buildPrivacyPl(context),
  ]
}
