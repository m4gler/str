'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import {
    DEFAULT_LANGUAGE,
    LANGUAGE_COOKIE_KEY,
    LANGUAGE_COOKIE_MAX_AGE,
    LANGUAGE_STORAGE_KEY,
    isLanguage,
    normalizeLanguage,
    type Language,
} from '@/lib/language'

export type { Language } from '@/lib/language'

interface LanguageContextValue {
    lang: Language
    setLang: (lang: Language) => void
    t: (key: string, fallback?: string) => string
}

const LanguageContext = createContext<LanguageContextValue>({
    lang: 'en',
    setLang: () => {},
    t: (_key: string, fallback?: string) => fallback || '',
})

export function useLanguage() {
    return useContext(LanguageContext)
}

/**
 * Default Polish translations for UI strings.
 * Keys match the flat settings field names (e.g. `landingHeroTitlePrefix`)
 * or `dashboard.fieldName` for dashboard-nested fields.
 *
 * Admins can override any of these via the `polishTranslations` JSON field
 * in PlatformSettings.
 */
export const defaultPolishTranslations: Record<string, string> = {
    // ── Landing: Hero ──
    landingHeroTitlePrefix: '100 Dni',
    landingHeroTitleHighlight: 'System Akceleracji',
    landingHeroSubtitle: 'Zbudowany, by rozwiązać przewidywalny problem wczesnego etapu: założyciele nie przegrywają, bo brakuje im wiedzy — przegrywają, bo brakuje im powtarzalnego systemu realizacji.',
    founderLoginBtn: 'Logowanie dla Startupu / Foundera',
    investorLoginBtn: 'Logowanie dla Inwestora',

    // ── Landing: Executive Summary ──
    execSummaryTitle: 'Podsumowanie: Architektura Sukcesu',
    execSummarySubtitle: 'Od inkubacji do akceleracji — i dalej do systemów realizacji.',
    execSummaryBody: 'Globalny ekosystem startupowy odszedł od pasywnej inkubacji w kierunku intensywnych, ustrukturyzowanych akceleratorów. MESGA 100 Days OS idzie o krok dalej: operacjonalizuje akcelerację jako codzienny system realizacji, zastępując „treść + inspirację" kadencją + dowodami + bramkami.',

    // ── Landing: What It Is ──
    whatItIsTitle: 'Czym jest MESGA',
    whatItIsBody: 'To nie kurs. Nie bootcamp. To system operacyjny realizacji przedsięwzięcia. Każdy dzień ma:',
    whatItIsFooter: 'Bez dryfu. Bez lania wody. Bez „opowiadania historii bez dowodów".',

    // ── Landing: Execution Gap ──
    executionGapTitle: 'Dlaczego to zbudowaliśmy (Luka Realizacji)',
    executionGapBody: 'Europa produkuje światowej klasy founderów i talent techniczny — ale zespoły wciąż napotykają przewidywalne tarcia:',

    // ── Landing: How It Works ──
    howItWorksTitle: 'Jak to działa: pętla MESGA OS',
    howItWorksFooter: 'To tworzy audytowalny ślad realizacji (rzecz, której inwestorzy faktycznie ufają).',

    // ── Landing: Structure ──
    structureTitle: 'Struktura 100 dni (3 fazy)',
    hardGatesTitle: 'Twarde bramki: Dni 15 / 30 / 50 / 70 / 94',
    hardGatesDesc: 'Każda bramka wymusza decyzję: zalicz / popraw / zatrzymaj.',

    // ── Landing: Comparative Evidence ──
    compEvidenceTitle: 'Dowody porównawcze: co optymalizują akceleratory (i gdzie MESGA idzie dalej)',
    compEvidenceBody: 'Nowoczesne akceleratory dzielą trzy prymitywy:',
    compEvidenceFooter: 'Jednak ich skuteczność różni się dramatycznie w zależności od gęstości wsparcia i dyscypliny operacyjnej. Kluczowym czynnikiem sukcesu dla początkujących founderów jest często nie największa sieć — lecz gęstość wsparcia + precyzja operacyjna.',

    // ── Landing: Investor Reality ──
    investorTitle: 'Rzeczywistość inwestorska: Aniołowie vs Venture Capital',
    investorIntro: 'Founderzy często traktują akcelerację jako cel sam w sobie. Inwestorzy traktują ją jako mechanizm de-riskingu.',
    angelsTitle: 'Czego szukają aniołowie',
    vcsTitle: 'Czego wymagają VC („gotowość inwestycyjna")',
    investorFooter: 'MESGA integruje „higienę korporacyjną" i „gotowość kapitałową" bezpośrednio w OS, więc zespoły kończą z pakietem dowodów klasy inwestorskiej, a nie tylko pitchem.',

    // ── Landing: Learning Science ──
    learningScienceTitle: 'Nauka o uczeniu dorosłych: dlaczego codzienne systemy zadaniowe działają',
    learningScienceSubtitle: 'MESGA jest zaprojektowana tak, by pasować do tego, co konsekwentnie przewyższa pasywną edukację dorosłych:',
    learningScienceFooter: 'Founderzy działają pod ciągłym przeciążeniem informacyjnym. System „jedno zadanie dziennie" redukuje paraliż i zamienia postęp w nawyk.',

    // ── Landing: Why Strong ──
    whyStrongTitle: 'Dlaczego MESGA jest szczególnie silna dla początkujących founderów',
    whyStrongIntro: 'Zadaniowy system akceleracji jest nieproporcjonalnie wartościowy dla founderów na starcie, ponieważ:',

    // ── Landing: What Makes It Different ──
    whatDiffTitle: 'Co ją wyróżnia',

    // ── Landing: Metrics ──
    metricsTitle: 'Kluczowe metryki, które śledzimy (by postęp był realny)',

    // ── Landing: Partners ──
    partnersSectionLabel: 'Partnerzy Ekosystemu',
    partnersSectionTitle: 'Zbudowane z operatorami, instytucjami i korporacjami, które poruszają rynki.',

    // ── Landing: FAQ ──
    faqSectionLabel: 'FAQ dla founderów',
    faqSectionTitle: 'MESGA startup accelerator FAQ',
    faqSectionIntro: 'Pytania i odpowiedzi dla founderów szukających akceleracji startupów w Polsce, CEE oraz Europie.',
    faqSectionScope: 'Główny zakres geograficzny: Europa Środkowo-Wschodnia.',

    // ── Landing: Tracks ──
    tracksSectionLabel: 'Ścieżki Specjalizacji',
    tracksSectionTitle: 'Wybierz swoją',
    tracksSectionTitleHighlight: 'ścieżkę',
    tracksSectionSubtitle: 'Każda ścieżka oferuje wyspecjalizowaną infrastrukturę, mentorów i partnerów dopasowanych do Twojego rynku.',
    tracksChallengeTypeLabel: 'Wyzwania',
    tracksViewDetailsBtn: 'Zobacz szczegóły',
    tracksStartTrackBtn: 'Rozpocznij ścieżkę',
    tracksNewTrackLabel: 'Nowa ścieżka wkrótce',
    tracksNewTrackSubtitle: 'Masz sieć partnerów, ekspertów lub dostęp do rynku?',
    tracksNewTrackCta: 'Zostań operatorem ścieżki',

    // ── Dashboard: Welcome ──
    'dashboard.welcomeTitle': 'Witaj ponownie,',
    'dashboard.founderWelcomeTitle': 'Witaj ponownie,',
    'dashboard.founderWelcomeSubtitle': 'Twój 100-dniowy system realizacji. Wykonuj dzisiejszą misję, śledź postępy i buduj audytowalny ślad realizacji.',
    'dashboard.investorWelcomeTitle': 'Witaj ponownie,',
    'dashboard.investorWelcomeSubtitle': '',
    'dashboard.logoutButtonText': 'Wyloguj się',

    // ── Dashboard: Personality Test ──
    'dashboard.personalityTestPromptTitle': 'Wypełnij Test Osobowości',
    'dashboard.personalityTestPromptDescription': 'Aby kontynuować na platformie, wypełnij test osobowości. Pomaga nam to dopasować Cię do odpowiednich inwestorów, mentorów i ścieżki.',
    'dashboard.personalityTestButtonText': 'Rozpocznij Test Osobowości →',

    // ── Dashboard: Program Cards ──
    'dashboard.wipBadgeText': 'Wkrótce',
    'dashboard.readyToStartBadge': 'Gotowy do startu',
    'dashboard.readyToStartTitle': 'Program 100 Dni czeka na Ciebie',
    'dashboard.readyToStartDescription': 'Opłacono — rozpocznij, gdy będziesz gotowy.',
    'dashboard.readyToStartButtonText': 'Rozpocznij Program',

    // ── Dashboard: Prework ──
    'dashboard.preworkTitle': 'Prework — przygotowanie do programu',
    'dashboard.preworkDescription': 'Ukończ zadania przygotowawcze przed rozpoczęciem programu 100 dni.',
    'dashboard.preworkButtonText': 'Kontynuuj Prework →',
    'dashboard.preworkCompletedText': 'Prework ukończony!',

    // ── Dashboard: Start Program (not paid yet) ──
    'dashboard.startProgramBadge': 'Gotowy do uruchomienia',
    'dashboard.startProgramTitle': 'Uruchom MESGA 100 Dni',
    'dashboard.startProgramDescription': 'Ukończyłeś proces rekrutacji i test osobowości. Jesteś gotowy, by rozpocząć 100-dniowy program dla founderów. Aktywuj swoją podróż i zacznij budować.',
    'dashboard.startProgramButtonText': 'Rozpocznij 100 Dni →',

    // ── Dashboard: Failed / No Attempts ──
    'dashboard.failedBadge': 'Próba nieudana',
    'dashboard.failedTitle': 'Próba programu zakończona',
    'dashboard.failedDescription': 'Twoja aktualna próba się nie powiodła. Możesz spróbować ponownie.',
    'dashboard.failedButtonText': 'Spróbuj ponownie',
    'dashboard.noAttemptsBadge': 'Brak prób',
    'dashboard.noAttemptsTitle': 'Wykorzystano wszystkie próby',
    'dashboard.noAttemptsDescription': 'Wykorzystałeś wszystkie dostępne próby programu.',

    // ── Dashboard: Completed ──
    'dashboard.completedBadge': 'Ukończono',
    'dashboard.completedTitle': 'Program ukończony!',
    'dashboard.completedDescription': 'Gratulacje! Ukończyłeś program 100 dni.',

    // ── Dashboard: Today's Mission ──
    'dashboard.todaysMissionTitle': 'Dzisiejsza Misja',
    'dashboard.todaysMissionSubtitle': 'Twoje dzisiejsze zadanie do wykonania',
    'dashboard.todaysMissionButtonText': 'Otwórz Misję →',
    'dashboard.todaysMissionCompletedText': 'Misja wykonana!',
    'dashboard.noMissionText': 'Brak misji na dziś',

    // ── Dashboard: Progress ──
    'dashboard.programSectionTitle': 'Postęp programu',
    'dashboard.currentDayLabel': 'Dzień',
    'dashboard.daysRemainingLabel': 'dni pozostało',

    // ── Dashboard: Phase labels ──
    'dashboard.mix': 'Mix',
    'dashboard.mixSubtitle': 'Walidacja',
    'dashboard.proof': 'Proof',
    'dashboard.proofSubtitle': 'Buduj & Uruchom',
    'dashboard.bake': 'Bake',
    'dashboard.bakeSubtitle': 'Wzrost',
    'dashboard.glaze': 'Glaze',
    'dashboard.glazeSubtitle': 'Kapitał',

    // ── Dashboard: Cards ──
    'dashboard.personalityProfileCard.title': 'Profil Osobowości',
    'dashboard.personalityProfileCard.description': 'Przeglądaj szczegóły archetypu, mocne strony, słabe punkty i najlepsze role w zespole.',
    'dashboard.personalityProfileCard.buttonText': 'Zobacz Wyniki',

    'dashboard.ecosystemCard.title': 'Mapa Ekosystemu',
    'dashboard.ecosystemCard.description': 'Mapuj swój lokalny ekosystem: grupy online, przestrzenie fizyczne, eventy, aniołów biznesu, VC i operatorów. Proś o intro.',

    'dashboard.mentorsCard.title': 'Mentorzy i Feedback',
    'dashboard.mentorsCard.description': 'Łącz się z przypisanymi mentorami, otrzymuj ustrukturyzowany feedback do swoich zgłoszeń i loguj sesje coachingowe.',

    'dashboard.projectCard.title': 'Twój Projekt',
    'dashboard.projectCard.description': 'Opisz swój projekt i wybierz specjalistyczną ścieżkę, aby rozpocząć.',

    'dashboard.investorProfileCard.title': 'Twój Profil Inwestora',
    'dashboard.investorProfileCard.description': 'Przeglądaj i edytuj dane z formularza, preferencje inwestycyjne i dane kontaktowe.',
    'dashboard.investorProfileCard.buttonText': 'Zobacz Profil',

    'dashboard.dealflowCard.title': 'Dealflow',
    'dashboard.dealflowCard.description': 'Przeglądaj wyselekcjonowane profile startupów, uzyskuj podsumowania i śledź swoje intro od zespołu MESGA.',

    'dashboard.applicationsCard.title': 'Matchmaking',
    'dashboard.applicationsCard.description': 'Dopasowanie founder-inwestor oparte na wielowymiarowym scoringu: etap, sektor, geografia, wartość dodana i dopasowanie archetypu.',

    'dashboard.resourcesCard.title': 'Zasoby i Poradniki',
    'dashboard.resourcesCard.description': 'Dostęp do ekskluzywnej dokumentacji, playbooków dla founderów, memo dla inwestorów i szablonów od zespołu MESGA.',

    'dashboard.statusCard.title': 'Aktualizacja Platformy',
    'dashboard.statusCard.statusText': 'Systemy sprawne',

    'dashboard.projectApplicationsCardTitle': 'Zgłoszenia Projektów',
    'dashboard.projectApplicationsCardDescription': 'Przeglądaj zgłoszenia projektów founderów. Zatwierdzaj lub odrzucaj aplikacje i dodawaj komentarze.',
    'dashboard.partnerPanelCardTitle': 'Panel Partnera',
    'dashboard.partnerPanelCardDescription': 'Przeglądaj zgłoszenia projektów Twoich founderów. Zatwierdzaj lub odrzucaj i zarządzaj listą zakazanych słów.',
    'dashboard.mentorDashboardCardTitle': 'Panel Mentora',
    'dashboard.mentorDashboardCardDescription': 'Przeglądaj zgłoszenia founderów, dawaj feedback i oceny oraz podejmuj decyzje na bramkach.',
    'dashboard.attemptQueueCardTitle': 'Kolejka Prób',
    'dashboard.attemptQueueCardDescription': 'Przeglądaj nieudane próby, monitoruj decyzje partnerów i zarządzaj founderami wymagającymi uwagi.',
    'dashboard.payloadAdminCardTitle': 'Panel Administracyjny',
    'dashboard.payloadAdminCardDescription': 'Zarządzaj użytkownikami, formularzami, treściami i ustawieniami platformy z panelu Payload CMS.',

    'dashboard.openPanelText': 'Otwórz Panel',
    'dashboard.openAdminText': 'Otwórz Admin',

    // ── Dashboard: Space Data card ──
    'dashboard.spaceDataTitle': 'Integracja z Danymi Kosmicznymi UE',
    'dashboard.spaceDataRelevanceLabel': '% trafność',
    'dashboard.spaceDataPoweredBy': 'Obsługiwane przez Copernicus Data Space Ecosystem & Galileo GNSS',
    'dashboard.spaceDataDatasetsLabel': 'Zestawy danych Copernicus — Zweryfikowane via STAC API',
    'dashboard.spaceDataLiveDataLabel': 'Dane na żywo potwierdzone',
    'dashboard.spaceDataGalileoLabel': 'Integracja Galileo / EGNOS',
    'dashboard.spaceDataPendingText': 'Analiza danych kosmicznych w toku — wyniki pojawią się po zatwierdzeniu projektu.',

    // ── Dashboard: Project Review ──
    'dashboard.projectReviewPendingBadge': 'W trakcie przeglądu',
    'dashboard.projectReviewPendingTitle': 'Twój projekt jest w trakcie przeglądu',
    'dashboard.projectReviewPendingDescription': 'Koordynator przegląda opis Twojego projektu. Otrzymasz powiadomienie po podjęciu decyzji.',
    'dashboard.projectReviewDeniedBadge': 'Nie zaakceptowano',
    'dashboard.projectReviewDeniedTitle': 'Projekt wymaga zmian',
    'dashboard.projectReviewDeniedDescription': 'Koordynator poprosił o zmiany w opisie projektu.',

    // ── Auth labels ──
    'auth.loginTitle': 'Witaj ponownie',
    'auth.loginSubtitle': 'Zaloguj się, aby uzyskać dostęp do konta',
    'auth.registerTitle': 'Dołącz do MESGA',
    'auth.registerSubtitle': 'Rozpocznij swoją podróż z nami',
    'auth.emailLabel': 'Adres email',
    'auth.passwordLabel': 'Hasło',
    'auth.roleLabel': 'Jestem',
    'auth.loginButtonText': 'Zaloguj się',
    'auth.registerButtonText': 'Utwórz konto',
    'auth.noAccountText': 'Nie masz konta?',
    'auth.hasAccountText': 'Masz już konto?',
    'auth.founderRoleLabel': 'Founder',
    'auth.investorRoleLabel': 'Inwestor',
    'auth.partnerRoleLabel': 'Partner',
    'auth.adminRoleLabel': 'Admin',
    'auth.forgotPasswordLinkText': 'Zapomniałeś hasła?',
    'auth.forgotPasswordTitle': 'Resetuj hasło',
    'auth.forgotPasswordSubtitle': 'Wyślemy Ci link do resetowania hasła',
    'auth.sendResetLinkButtonText': 'Wyślij link resetujący',
    'auth.backToLoginText': 'Powrót do logowania',
    'auth.resetLinkSentMessage': 'Link do resetowania hasła został wysłany na Twój email.',

    // ── Footer ──
    'footer.privacyPolicy': 'Polityka Prywatności',
    'footer.termsOfUse': 'Regulamin',

    // ── Misc UI ──
    'viewProject': 'Zobacz Projekt',
    'setUpProject': 'Ustaw Projekt',
    'openMap': 'Otwórz Mapę',
    'viewFeedback': 'Zobacz Feedback',
    'openInbox': 'Otwórz Skrzynkę',
    'viewQueue': 'Zobacz Kolejkę',

    // ── Payment page ──
    'payment.badgePartner': 'Dostęp Partnerski',
    'payment.badgeSecure': 'Bezpieczna Płatność',
    'payment.headingFree': 'Aktywuj Dostęp',
    'payment.headingPaid': 'Sfinalizuj Zamówienie',
    'payment.oneTimePayment': 'jednorazowa płatność',
    'payment.productLabel': 'Produkt',
    'payment.accessLabel': 'Dostęp',
    'payment.totalLabel': 'Suma',
    'payment.freeLabel': 'Bezpłatny',
    'payment.programLabel': 'Program 100 Dni',
    'payment.partnerPricing': 'Zastosowano cenę partnerską',
    'payment.discountApplied': '% zniżki zastosowano',
    'payment.discountOff': 'PLN taniej',
    'payment.attempt': 'próba',
    'payment.attempts': 'próby',
    'payment.noAdditionalCharges': 'brak dodatkowych opłat',
    'payment.sectionPrice': 'Cena',
    'payment.sectionPaymentMethods': 'Metody płatności',
    'payment.sectionActivation': 'Aktywacja usługi / dostawa',
    'payment.sectionReturns': 'Zwroty',
    'payment.sectionComplaints': 'Reklamacje',
    'payment.discountCodeLabel': 'Kod rabatowy',
    'payment.removeCode': 'Usuń',
    'payment.applyCode': 'Zastosuj',
    'payment.invoiceToggleTitle': 'Potrzebuję faktury VAT',
    'payment.invoiceToggleHint': 'Uzupełnij dane firmy — faktura zostanie wysłana emailem po potwierdzeniu płatności',
    'payment.billingDetailsLabel': 'Dane rozliczeniowe',
    'payment.fieldCompanyName': 'Nazwa firmy / Imię i nazwisko *',
    'payment.fieldNipHint': '(opcjonalne — dla firm)',
    'payment.fieldStreet': 'Ulica i numer *',
    'payment.fieldPostalCode': 'Kod pocztowy *',
    'payment.fieldCity': 'Miasto *',
    'payment.fieldCountry': 'Kraj',
    'payment.fieldCountryHint': 'Kod ISO (2 litery)',
    'payment.fieldInvoiceEmail': 'Email do faktury',
    'payment.fieldInvoiceEmailHint': '(zostaw puste, aby użyć emaila konta)',
    'payment.consentTermsPrefix': 'Zapoznałem/-am się i akceptuję',
    'payment.termsOfUse': 'Regulamin',
    'payment.consentPrivacyPrefix': 'Zapoznałem/-am się z informacją o przetwarzaniu danych osobowych i',
    'payment.privacyPolicy': 'Polityką Prywatności',
    'payment.consentWithdrawal': 'Żądam natychmiastowego wykonania usługi cyfrowej po płatności i przyjmuję do wiadomości, że po aktywacji mogę utracić 14-dniowe prawo odstąpienia od umowy w przypadkach przewidzianych prawem.',
    'payment.errorLegalRequired': 'Zaakceptuj wymagane oświadczenia prawne, aby kontynuować.',
    'payment.errorInvalidNip': 'Nieprawidłowy NIP. Sprawdź i spróbuj ponownie.',
    'payment.errorCodeValidate': 'Nie udało się zweryfikować kodu. Spróbuj ponownie.',
    'payment.errorGeneral': 'Coś poszło nie tak. Spróbuj ponownie.',
    'payment.btnActivating': 'Aktywowanie…',
    'payment.btnRedirecting': 'Przekierowanie do płatności...',
    'payment.btnActivateFree': 'Aktywuj bezpłatnie →',
    'payment.btnPay': 'Zapłać',
    'payment.secureFooter': 'Bezpieczna płatność obsługiwana przez PayNow · mBank',
    'payment.backToDashboard': '← Wróć do panelu',
    'payment.sellerDetails': 'Dane sprzedawcy',
    // Payment success/failure
    'payment.success.title': 'Płatność potwierdzona!',
    'payment.success.desc': 'Twoja płatność została przetworzona. Możesz teraz',
    'payment.success.descHighlight': 'uruchomić Program 100 Dni',
    'payment.success.descSuffix': 'kiedy tylko będziesz gotowy/-a.',
    'payment.success.hint': 'Wróć do panelu i kliknij „Rozpocznij 100 Dni", gdy będziesz gotowy/-a.',
    'payment.success.dashboardBtn': 'Przejdź do panelu →',
    'payment.failure.title': 'Płatność nieudana',
    'payment.failure.statusError': 'Wystąpił błąd podczas przetwarzania płatności.',
    'payment.failure.statusRejected': 'Twoja płatność została odrzucona przez bank.',
    'payment.failure.statusAbandoned': 'Płatność została porzucona.',
    'payment.failure.statusExpired': 'Sesja płatności wygasła.',
    'payment.failure.fallback': 'Nie udało się zrealizować płatności.',
    'payment.tryAgain': 'Spróbuj ponownie',
    'payment.dashboard': 'Panel',
    'payment.errorPage.title': 'Błąd płatności',
    // Payment poller
    'payment.poller.confirmingTitle': 'Potwierdzanie płatności…',
    'payment.poller.confirmingDesc': 'Twoja płatność jest potwierdzana. Zazwyczaj zajmuje to tylko kilka sekund.',
    'payment.poller.checkingEvery': 'Sprawdzanie automatycznie co 3 sekundy…',
    'payment.poller.waitingTitle': 'Wciąż czekamy…',
    'payment.poller.waitingDesc': 'Potwierdzenie płatności trwa dłużej niż oczekiwano. Po zakończeniu program uruchomi się automatycznie.',
    'payment.poller.waitingHint': 'Możesz bezpiecznie wrócić do panelu — program aktywuje się automatycznie po potwierdzeniu płatności.',
    'payment.poller.checkAgain': 'Sprawdź ponownie',
    'payment.poller.dashboard': 'Panel',

    // ── Start Program page ──
    'startProgram.badge': 'Program 100 Dni',
    'startProgram.heading': 'Rozpocznij swoje',
    'startProgram.headingHighlight': '100 Dni',
    'startProgram.subtitle': 'Zanim zaczniesz, przeczytaj i zaakceptuj zasady programu.',
    'startProgram.attemptUsed': 'Użyta',
    'startProgram.attemptTry': 'Próba',
    'startProgram.rulesTitle': 'Zasady Programu',
    'startProgram.rule1Title': 'Limit nieobecności',
    'startProgram.rule1Desc': 'Możesz opuścić maksymalnie 2 dzienne terminy podczas tej próby. Przy 3. nieobecności Twoja próba automatycznie się kończy.',
    'startProgram.rule2Title': 'Spóźnione zgłoszenia',
    'startProgram.rule2Desc': 'Możesz przesłać opuszczony dzień po jego terminie (backfill). Jednak przesłanie spóźnionego dnia NIE odblokowuje automatycznie następnego dnia — musisz również przesłać zadanie bieżącego dnia do 23:59 tego samego dnia.',
    'startProgram.rule3Title': 'Brak pauz',
    'startProgram.rule3Desc': 'Po uruchomieniu program działa nieprzerwanie. Nie możesz zatrzymać, zawiesić ani odroczyć swoich 100 dni.',
    'startProgram.rule4Title': 'Próby',
    'startProgram.rule4Desc': 'Twój przydział daje Ci maksymalnie tyle prób, ile wskazano. Każda nieudana próba zużywa 1 szansę.',
    'startProgram.rule5Title': 'Ukończenie',
    'startProgram.rule5Desc': 'Program kończy się sukcesem w momencie ukończenia Dnia 100 w dowolnej próbie (1., 2. lub 3.). Pozostałe niewykorzystane próby nie są zużywane — program jest ukończony.',
    'startProgram.servicePriceTitle': 'Usługa i Cena',
    'startProgram.consentRules': 'Przeczytałem/-am i rozumiem zasady 100-dniowego programu. Akceptuję, że opuszczenie 3 dziennych terminów zakończy moją bieżącą próbę, i rozumiem zasady backfill oraz alokacji prób.',
    'startProgram.consentTermsPrefix': 'Zgadzam się na',
    'startProgram.termsOfUse': 'Regulamin',
    'startProgram.consentTermsSuffix': 'i rozumiem wszystkie warunki programu.',
    'startProgram.consentWithdrawal': 'Żądam natychmiastowego dostępu do usługi cyfrowej po płatności i przyjmuję do wiadomości, że tym samym tracę 14-dniowe prawo do odstąpienia od umowy (art. 38 pkt 13 ustawy o prawach konsumenta).',
    'startProgram.btnStarting': 'Uruchamianie...',
    'startProgram.btnProceedPayment': 'Zgadzam się i przechodzę do płatności →',
    'startProgram.btnRestartPrefix': 'Zgadzam się i rozpoczynam próbę',
    'startProgram.btnStart': 'Zgadzam się i uruchamiam program →',
    'startProgram.backToDashboard': '← Wróć do panelu',
    'startProgram.errorFallback': 'Nie udało się uruchomić programu. Spróbuj ponownie.',

    // ── Cart page ──
    'cart.breadcrumb': 'Koszyk',
    'cart.heading': 'Twoje zamówienie,',
    'cart.headingHighlight': 'gotowe do realizacji.',
    'cart.intro': 'Przejrzyj usługę MESGA, warunki płatności i szczegóły aktywacji przed przejściem do płatności. Jedno zamówienie, jedna płatność, pełny dostęp do systemu akceleracji.',
    'cart.orderPath': 'Ścieżka zamówienia',
    'cart.stage.cart': 'Koszyk',
    'cart.stage.checkout': 'Płatność',
    'cart.stage.activation': 'Aktywacja',
    'cart.loading': 'Ładowanie koszyka…',
    'cart.emptyBadge': 'Koszyk pusty',
    'cart.emptyTitle': 'Nic nie czeka na realizację.',
    'cart.emptyDescription': 'Dodaj Program 100 Dni ze strony głównej MESGA, aby zobaczyć podsumowanie zamówienia, szczegóły prawne i bezpieczny proces płatności.',
    'cart.backToOffer': 'Powrót do oferty',
    'cart.digitalService': 'Usługa cyfrowa MESGA',
    'cart.singlePurchase': 'Jednorazowy zakup',
    'cart.secureCheckout': 'Bezpieczna płatność PayNow',
    'cart.activationAfterPayment': 'Aktywacja po płatności',
    'cart.currentProduct': 'Aktualny produkt',
    'cart.totalDue': 'Do zapłaty',
    'cart.highlight.executionSystem': 'System realizacji',
    'cart.highlight.executionSystemValue': '100-dniowy rytm operacyjny',
    'cart.highlight.executionSystemDesc': 'Codzienne misje, zbieranie dowodów i logika odblokowywania zamiast pasywnych treści.',
    'cart.highlight.humanReview': 'Przegląd mentora',
    'cart.highlight.humanReviewValue': 'Wbudowany feedback mentora',
    'cart.highlight.humanReviewDesc': 'Ustrukturyzowane cykle przeglądu zaprojektowane tak, by founderzy nie tracili tempa.',
    'cart.highlight.activation': 'Aktywacja',
    'cart.highlight.activationValue': 'Dostęp cyfrowy po płatności',
    'cart.highlight.activationDesc': 'Płatność aktywuje program i od razu otwiera kolejny krok MESGA.',
    'cart.cartItem': 'Pozycja w koszyku',
    'cart.quantity': 'Ilość',
    'cart.singleDigitalOrder': 'Pojedyncze zamówienie cyfrowe',
    'cart.removeFromCart': 'Usuń z koszyka',
    'cart.purchaseConditions': 'Warunki zakupu',
    'cart.whatYouAgree': 'Na co się zgadzasz',
    'cart.beforeCheckout': 'Przed płatnością',
    'cart.label.payment': 'Płatność',
    'cart.label.delivery': 'Dostawa',
    'cart.label.returns': 'Zwroty',
    'cart.label.complaints': 'Reklamacje',
    'cart.orderSummary': 'Podsumowanie zamówienia',
    'cart.readyToContinue': 'Gotowe do kontynuacji.',
    'cart.product': 'Produkt',
    'cart.total': 'Suma',
    'cart.removeItem': 'Usuń pozycję',
    'cart.loginToContinue': 'Zaloguj się, aby kontynuować',
    'cart.proceedToCheckout': 'Przejdź do płatności',
    'cart.loginHelper': 'Zaloguj się najpierw, aby zamówienie zostało przypisane do Twojego konta MESGA przed płatnością.',
    'cart.checkoutHelper': 'Przejdziesz do bezpiecznego procesu płatności MESGA obsługiwanego przez PayNow.',
    'cart.seller': 'Sprzedawca',
    'cart.chip.executionOs': '100-dniowy system realizacji',
    'cart.chip.mentorReview': 'przegląd mentora',
    'cart.chip.digitalActivation': 'aktywacja cyfrowa',
}

/**
 * Resolve a translation key.
 *
 * Priority:
 *   1. `settings.polishTranslations[key]` (admin override in Payload)
 *   2. `defaultPolishTranslations[key]` (hardcoded defaults above)
 *   3. `fallback` argument (the English value from settings or hardcoded)
 */
function resolve(
    key: string,
    lang: Language,
    settings: any,
    fallback: string,
): string {
    if (lang === 'en') return fallback

    // Check admin overrides in PlatformSettings
    const adminPl = settings?.polishTranslations
    if (adminPl && typeof adminPl === 'object' && adminPl[key]) {
        return adminPl[key]
    }

    // Check hardcoded defaults
    if (defaultPolishTranslations[key]) {
        return defaultPolishTranslations[key]
    }

    return fallback
}

/**
 * Create a bound `t()` helper for a given settings object.
 * Usage: `const t = createT(settings, lang)`
 *        `t('landingHeroTitlePrefix', settings.landingHeroTitlePrefix || '100 Days')`
 */
export function createT(settings: any, lang: Language) {
    return (key: string, fallback: string = ''): string =>
        resolve(key, lang, settings, fallback)
}

interface LanguageProviderProps {
    children: React.ReactNode
    initialLang?: Language
}

function readCookieLanguage(): Language | null {
    if (typeof document === 'undefined') {
        return null
    }

    const cookie = document.cookie
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${LANGUAGE_COOKIE_KEY}=`))

    if (!cookie) {
        return null
    }

    const value = cookie.slice(LANGUAGE_COOKIE_KEY.length + 1)

    return isLanguage(value) ? value : null
}

function persistLanguage(next: Language) {
    if (typeof document !== 'undefined') {
        document.cookie = `${LANGUAGE_COOKIE_KEY}=${next}; path=/; max-age=${LANGUAGE_COOKIE_MAX_AGE}; samesite=lax`
        document.documentElement.lang = next
    }

    if (typeof window !== 'undefined') {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, next)
    }
}

export function LanguageProvider({ children, initialLang = DEFAULT_LANGUAGE }: LanguageProviderProps) {
    const [lang, setLangState] = useState<Language>(initialLang)

    useEffect(() => {
        const cookieLang = readCookieLanguage()
        const storedLang = normalizeLanguage(
            typeof window !== 'undefined' ? localStorage.getItem(LANGUAGE_STORAGE_KEY) : null,
            initialLang,
        )
        const resolved = cookieLang ?? storedLang

        if (resolved !== lang) {
            setLangState(resolved)
        }
    }, [initialLang])

    useEffect(() => {
        persistLanguage(lang)
    }, [lang])

    const setLang = useCallback((next: Language) => {
        setLangState(next)
    }, [])

    const t = useCallback(
        (key: string, fallback?: string) => resolve(key, lang, {}, fallback || ''),
        [lang],
    )

    return (
        <LanguageContext.Provider value={{ lang, setLang, t }}>
            {children}
        </LanguageContext.Provider>
    )
}
