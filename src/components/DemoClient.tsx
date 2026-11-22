'use client'

import { useState, useCallback, useEffect } from 'react'
import AuthForm from '@/components/AuthForm'
import FounderFormComponent from '@/components/FounderForm'
import DashboardClient from '@/components/DashboardClient'
import StartProgramClient from '@/components/StartProgramClient'
import PaymentClient from '@/components/PaymentClient'
import MentorDashboard from '@/components/MentorDashboard'
import type { User as PayloadUser } from '@/payload-types'

// ─── Types ──────────────────────────────────────────────────────────────

type DemoStep =
    | 'registration'
    | 'intake'
    | 'personality'
    | 'start-program'
    | 'payment'
    | 'dashboard-prework'
    | 'prework-form'
    | 'dashboard-active'
    | 'day2-form'
    | 'previous-day'
    | 'mentor-review'
    | 'gate-form'

const STEPS: { key: DemoStep; label: string; shortcut: string }[] = [
    { key: 'registration', label: 'Register', shortcut: '1' },
    { key: 'intake', label: 'Intake', shortcut: '2' },
    { key: 'personality', label: 'PT', shortcut: '3' },
    { key: 'start-program', label: 'Start', shortcut: '4' },
    { key: 'payment', label: 'Payment', shortcut: '5' },
    { key: 'dashboard-prework', label: 'Prework', shortcut: '6' },
    { key: 'prework-form', label: 'PW Form', shortcut: '7' },
    { key: 'dashboard-active', label: 'Active', shortcut: '8' },
    { key: 'day2-form', label: 'Day 2', shortcut: '9' },
    { key: 'previous-day', label: 'Prev Day', shortcut: '0' },
    { key: 'mentor-review', label: 'Mentor', shortcut: '-' },
    { key: 'gate-form', label: 'Gate', shortcut: '=' },
]

// ─── Mock Data ──────────────────────────────────────────────────────────

function mockUser(overrides: Partial<PayloadUser> = {}): PayloadUser {
    return {
        id: 999,
        email: 'test@mesga.eu',
        role: 'founder',
        businessIdea: 'AI platform for local businesses',
        phoneNumber: '+48600123456',
        isOnboarded: true,
        hasPaid100Days: true,
        programStatus: 'active',
        programStartDate: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0],
        programAttempts: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...overrides,
    } as PayloadUser
}

const MOCK_PERSONALITY_SCORES = {
    openness: 78,
    conscientiousness: 82,
    extraversion: 65,
    agreeableness: 71,
    neuroticism: 35,
    selfEfficacy: 85,
    riskTolerance: 72,
    archetype: 'The Visionary Builder',
}

const MOCK_DAY1_ANSWERS: Record<string, any> = {
    Q1: 'Validated hypothesis with initial customer interviews. Spoke with 5 potential clients.',
    Q2: 'https://mesga.eu/prototype',
    Q3: 'Set up meetings for next week with 3 interested pilots.',
}

const MOCK_DAY2_ANSWERS: Record<string, any> = {
    Q1: 'Analyzed Copernicus satellite imagery for agricultural zone classification. Identified 3 viable pilot regions.',
    Q2: 'https://mesga.eu/prototype/v2',
    Q3: 'Scheduled calls with 2 agri-tech companies for partnership discussion. Prepared pitch deck v2.',
}

const MOCK_MENTOR_SUBMISSIONS = [
    {
        id: 1,
        founderEmail: 'test@mesga.eu',
        founderId: 999,
        dayNumber: 1,
        dayType: 'standard',
        programDay: 1,
        submittedAt: new Date(Date.now() - 86400000).toISOString(),
        isBackfill: false,
        submissionData: MOCK_DAY1_ANSWERS,
        formTitle: 'Day 1 — Hypothesis Validation',
        formSections: null,
        aiSummary: {
            summary_3s: 'Founder validated initial hypothesis by conducting 5 interviews and scheduling 3 pilot meetings.',
            key_output: 'Initial prototype and meeting schedules.',
            decision: 'PASS — Clear evidence of customer discovery.',
            learnings: 'Customers are very interested in automation features.',
            mentor_ask: 'Review initial architecture for the prototype.',
            checks_passed: true,
            link_reachable: true,
        },
        checksPassed: true,
        linkUrl: 'https://mesga.eu/prototype',
        linkReachable: true,
        attemptNumber: 1,
        theme: 'Hypothesis Validation',
        deliverable: 'Written hypothesis + initial evidence',
        autoCheckCriteria: 'Link provided and reachable, min 50 words',
        blockFocus: 'Validate your core hypothesis with data',
        review: null,
    },
    {
        id: 2,
        founderEmail: 'founder2@example.com',
        founderId: 998,
        dayNumber: 1,
        dayType: 'standard',
        programDay: 1,
        submittedAt: new Date(Date.now() - 80000000).toISOString(),
        isBackfill: false,
        submissionData: { Q1: 'Completed market analysis for drone delivery logistics in rural areas.', Q2: 'https://skylogistics.io/demo' },
        formTitle: 'Day 1 — Hypothesis Validation',
        formSections: null,
        aiSummary: {
            summary_3s: 'Market analysis completed for drone delivery service targeting rural EU communities.',
            key_output: 'Demo site with service map at skylogistics.io.',
            decision: 'PASS — Good market research foundation.',
            checks_passed: true,
            link_reachable: true,
        },
        checksPassed: true,
        linkUrl: 'https://skylogistics.io/demo',
        linkReachable: true,
        attemptNumber: 1,
        theme: 'Hypothesis Validation',
        deliverable: 'Written hypothesis + initial evidence',
        autoCheckCriteria: 'Link provided and reachable, min 50 words',
        blockFocus: 'Validate your core hypothesis with data',
        review: null,
    },
]

// ─── Component ──────────────────────────────────────────────────────────

type DemoClientProps = {
    settings: any
    intakeForm: any
    ptForm: any
    dayForms: any
    dayDefs: Record<string, any>
    tracks: any
}

export default function DemoClient({
    settings,
    intakeForm,
    ptForm,
    dayForms,
    dayDefs,
    tracks,
}: DemoClientProps) {
    const [step, setStep] = useState<DemoStep>(() => {
        if (typeof window !== 'undefined' && window.location.hash) {
            const hash = window.location.hash.slice(1) as DemoStep
            if (STEPS.some((s) => s.key === hash)) return hash
        }
        return 'registration'
    })
    const [controlsVisible, setControlsVisible] = useState(true)

    // Global keyboard shortcuts (works with Playwright)
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            // Don't intercept if user is typing in an input/textarea
            const tag = (e.target as HTMLElement)?.tagName
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

            const found = STEPS.find(s => s.shortcut === e.key)
            if (found) {
                e.preventDefault()
                setStep(found.key)
                window.scrollTo({ top: 0 })
            }
            if (e.key === 'h') {
                setControlsVisible(v => !v)
            }
        }
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [])

    function buildDayDefContext(slug: string) {
        const def = dayDefs[slug]
        if (!def) return null
        return {
            theme: def.theme,
            founderCommandment: def.founderCommandment,
            deliverable: def.deliverable,
            exampleProject: def.exampleProject,
            whereHowTips: def.whereHowTips,
            coachingNote: def.coachingNote,
            autoCheckCriteria: def.autoCheckCriteria,
            mesgaIntegration: def.mesgaIntegration,
            estimatedTimeHrs: def.estimatedTimeHrs,
            eduType: def.eduType,
            eduLinks: def.eduLinks,
            blockFocus: def.blockFocus,
            weekNumber: def.weekNumber,
        }
    }

    function buildDashboardDayDef(slug: string) {
        const def = dayDefs[slug]
        if (!def) return null
        return {
            title: def.title || null,
            blockKey: def.blockKey || null,
            blockType: def.blockType || null,
            theme: def.theme || null,
            founderCommandment: def.founderCommandment || null,
            blockFocus: def.blockFocus || null,
            mainSoetMission: def.mainSoetMission || null,
            activity: def.activity || null,
            deliverable: def.deliverable || null,
            exampleProject: def.exampleProject || null,
            whereHowTips: def.whereHowTips || null,
            autoCheckCriteria: def.autoCheckCriteria || null,
            mesgaIntegration: def.mesgaIntegration || null,
            estimatedTimeHrs: def.estimatedTimeHrs || null,
            eduType: def.eduType || null,
            eduDescription: def.eduDescription || null,
            contentType: def.contentType || null,
            contentOwner: def.contentOwner || null,
            eduLinks: def.eduLinks || null,
            weekNumber: def.weekNumber || null,
            coachingNote: def.coachingNote || null,
            questions: def.questions?.map((q: any) => ({
                questionId: q.questionId || q.question_id || '',
                questionTitle: q.questionTitle || q.question_text || '',
                questionType: q.questionType || q.question_type || '',
                required: q.required ?? false,
                description: q.description || null,
                choices: q.choices || null,
                logic: q.logic || null,
            })) || null,
        }
    }

    function renderStep() {
        switch (step) {
            case 'registration':
                return (
                    <div className="min-h-screen bg-[#1a2634] flex flex-col items-center justify-center relative overflow-hidden">
                        {/* Background glows */}
                        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-600/8 rounded-full blur-[120px]" />
                        <div className="absolute bottom-[-15%] right-[-5%] w-[400px] h-[400px] bg-purple-600/6 rounded-full blur-[100px]" />

                        {/* Header */}
                        <div className="mb-8 text-center relative z-10">
                            <div className="text-2xl font-bold tracking-tight text-white">
                                {settings?.companyName || 'MESGA'}
                            </div>
                        </div>

                        <div className="relative z-10 w-full max-w-md px-4">
                            <AuthForm
                                authSettings={settings?.auth}
                                onboardingSettings={settings?.onboarding}
                                redirectTo="/demo"
                            />
                        </div>
                    </div>
                )

            case 'intake':
                return (
                    <div className="min-h-screen bg-[#1a2634]">
                        {intakeForm ? (
                            <FounderFormComponent
                                form={intakeForm}
                                platformSettings={settings}
                            />
                        ) : (
                            <div className="flex items-center justify-center h-screen text-white/50">
                                No intake form found in database
                            </div>
                        )}
                    </div>
                )

            case 'personality':
                return (
                    <div className="min-h-screen bg-[#1a2634]">
                        {ptForm ? (
                            <FounderFormComponent
                                form={ptForm}
                                platformSettings={settings}
                            />
                        ) : (
                            <div className="flex items-center justify-center h-screen text-white/50">
                                No personality test form found in database
                            </div>
                        )}
                    </div>
                )

            case 'start-program':
                return (
                    <StartProgramClient
                        userId={999}
                        programAttempts={0}
                        maxAttempts={3}
                        hasPaid100Days={false}
                        paymentEnabled={true}
                        companyName={settings?.companyName || 'MESGA'}
                    />
                )

            case 'payment':
                return (
                    <PaymentClient
                        companyName={settings?.companyName || 'MESGA'}
                        logoUrl={settings?.logo?.url || null}
                        amountGroszy={49900}
                        partnerAmountGroszy={null}
                        productName={settings?.pricingServiceNamePl || 'Program 100 Dni — dostęp do platformy akceleracyjnej'}
                        productDescription={settings?.pricingServiceDescriptionPl || '100-dniowy program akceleracyjny dla founderów. Codzienna misja, deliverable, proof submission i mentor review.'}
                        vatInfo={settings?.pricingVatInfoPl || 'cena brutto (zawiera 23% VAT)'}
                        paymentMethods={settings?.pricingPaymentMethodsPl || 'Płatność online — PayNow (obsługiwana przez mBank S.A.)'}
                        activationInfo={settings?.pricingActivationInfoPl || 'Dostęp do programu aktywowany jest automatycznie po potwierdzeniu płatności przez system PayNow.'}
                        returnPolicy={settings?.pricingReturnPolicyPl || 'Konsumentowi przysługuje prawo odstąpienia od umowy w terminie 14 dni, z zastrzeżeniem wyjątków dla usług cyfrowych rozpoczętych na wyraźne żądanie klienta.'}
                        complaintProcedure={settings?.pricingComplaintProcedurePl || 'Reklamacje można składać drogą elektroniczną na adres support@bakery.vc. Reklamacje rozpatrywane są w terminie 14 dni.'}
                        termsLink={settings?.footer?.legalLinks?.termsOfUse || null}
                        privacyLink={settings?.footer?.legalLinks?.privacyPolicy || null}
                        seller={{
                            name: settings?.invoicing?.sellerName || settings?.companyName || 'MESGA',
                            nip: settings?.invoicing?.sellerNip || null,
                            regon: settings?.invoicing?.sellerRegon || null,
                            address: settings?.invoicing?.sellerAddress || null,
                            postalCode: settings?.invoicing?.sellerPostalCode || null,
                            city: settings?.invoicing?.sellerCity || null,
                            email: settings?.invoicing?.contactEmail || settings?.invoicing?.sellerEmail || 'support@bakery.vc',
                            phone: settings?.invoicing?.sellerPhone || null,
                        }}
                    />
                )

            case 'dashboard-prework':
                return (
                    <DashboardClient
                        user={mockUser({
                            programStatus: 'prework',
                            hasPaid100Days: true,
                            programAttempts: 1,
                        })}
                        settings={settings}
                        needsPersonalityTest={false}
                        personalityTestSlug={null}
                        founderArchetype="The Visionary Builder"
                        founderTrack={tracks[0]?.name || 'Pioneers'}
                        dailyFormSlug={null}
                        dailyFormTitle={null}
                        hasSubmittedDailyForm={false}
                        personalityScores={MOCK_PERSONALITY_SCORES}
                        programStatus="prework"
                        programAttempts={1}
                        hasPaid100Days={true}
                        paymentEnabled={false}
                        projectSubmission={null}
                        availableTracks={tracks}
                        preworkProgress={{
                            completed: 3,
                            total: 10,
                            nextFormSlug: 'daily-prework-block-4',
                            nextFormTitle: 'Pre-work Module 4',
                        }}
                        attemptData={{
                            attemptNumber: 1,
                            maxAttempts: 3,
                            missCount: 0,
                            status: 'active',
                            missedDays: [],
                        }}
                    />
                )

            case 'prework-form':
                return (
                    <div className="min-h-screen bg-[#1a2634]">
                        {dayForms['daily-prework-block-1'] ? (
                            <FounderFormComponent
                                form={dayForms['daily-prework-block-1']}
                                platformSettings={settings}
                                isDailyForm={true}
                                isPrework={true}
                                dayNumber={0}
                                dayDefinitionContext={buildDayDefContext('daily-prework-block-1')}
                            />
                        ) : (
                            <div className="flex items-center justify-center h-screen text-white/50">
                                No prework form found in database
                            </div>
                        )}
                    </div>
                )

            case 'dashboard-active':
                return (
                    <DashboardClient
                        user={mockUser({
                            programStatus: 'active',
                            programStartDate: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0],
                            programAttempts: 1,
                            hasPaid100Days: true,
                        })}
                        settings={settings}
                        needsPersonalityTest={false}
                        personalityTestSlug={null}
                        founderArchetype="The Visionary Builder"
                        founderTrack={tracks[0]?.name || 'Pioneers'}
                        dailyFormSlug="daily-day-block-2"
                        dailyFormTitle={dayDefs['daily-day-block-2']?.title || 'Day 2 — Customer Discovery'}
                        hasSubmittedDailyForm={false}
                        dayNumber={2}
                        isDayLocked={false}
                        completedDays={[1]}
                        personalityScores={MOCK_PERSONALITY_SCORES}
                        programStatus="active"
                        programAttempts={1}
                        hasPaid100Days={true}
                        paymentEnabled={false}
                        projectSubmission={{
                            id: 1,
                            status: 'approved',
                            projectDescription: 'AI platform for local businesses',
                            trackId: tracks[0]?.id || 1,
                            spaceDataRelevance: {
                                relevanceScore: 100,
                                euSpaceAssets: [
                                    "Copernicus Land Monitoring Service (CLMS)",
                                    "Copernicus Sentinel-3",
                                    "Copernicus Sentinel-5P",
                                    "Galileo / EGNOS"
                                ],
                                summary: "Analyzed 185 Copernicus collections against your project description. Found 8 relevant dataset(s), 4 with verified live data (last 90 days). EU Space Assets: Copernicus Land Monitoring Service (CLMS), Copernicus Sentinel-3, Copernicus Sentinel-5P, Galileo / EGNOS. Galileo / EGNOS positioning applicable.",
                                keywords: ["urban", "carbon", "monoxide", "aerosol"],
                                datasets: [
                                    {
                                        name: "CLMS Urban Atlas Street Tree Layer (0.05ha MMU) - Europe",
                                        euSpaceAsset: "COPERNICUS LAND MONITORING SERVICE (CLMS)",
                                        useCase: "Matched on: urban. The Urban Atlas Street Tree Layer product provides detailed information about street trees in Functional Urban Areas (FUAs) in Europe. The product has a Minimum Mapping Unit (MMU) of 0.05 hectares (500 m²) and a Minimum Mapping Width (MMW) of 10 meters. It is part of the Copernicus Land Monitoring Service (CLMS) and covers urban areas across Europe with a 3-yearly temporal repeat rate. The data is provided in flatgeobuf format with EPSG:3035 projection and includes both the street tree layer and an urban mask auxiliary layer...",
                                        dataUrl: "https://browser.stac.dataspace.copernicus.eu/collections/clms_urban-atlas_street-tree-layer_europe_V005ha_vector_static_v01",
                                        sampleItemCount: 15420
                                    }
                                ],
                                galileoRelevance: true
                            }
                        }}
                        availableTracks={tracks}
                        attemptData={{
                            attemptNumber: 1,
                            maxAttempts: 3,
                            missCount: 0,
                            status: 'active',
                            missedDays: [],
                        }}
                        dayDefinition={buildDashboardDayDef('daily-day-block-2')}
                    />
                )

            case 'day2-form':
                return (
                    <div className="min-h-screen bg-[#1a2634]">
                        {dayForms['daily-day-block-2'] ? (
                            <FounderFormComponent
                                form={dayForms['daily-day-block-2']}
                                platformSettings={settings}
                                isDailyForm={true}
                                dayNumber={2}
                                dayDefinitionContext={buildDayDefContext('daily-day-block-2')}
                            />
                        ) : dayForms['daily-day-block-1'] ? (
                            <FounderFormComponent
                                form={dayForms['daily-day-block-1']}
                                platformSettings={settings}
                                isDailyForm={true}
                                dayNumber={2}
                                dayDefinitionContext={buildDayDefContext('daily-day-block-1')}
                            />
                        ) : (
                            <div className="flex items-center justify-center h-screen text-white/50">
                                No day form found in database
                            </div>
                        )}
                    </div>
                )

            case 'previous-day':
                return (
                    <div className="min-h-screen bg-[#1a2634]">
                        {dayForms['daily-day-block-2'] ? (
                            <FounderFormComponent
                                form={dayForms['daily-day-block-2']}
                                platformSettings={settings}
                                isDailyForm={true}
                                dayNumber={2}
                                dayDefinitionContext={buildDayDefContext('daily-day-block-2')}
                                readOnly={true}
                                existingAnswers={MOCK_DAY2_ANSWERS}
                            />
                        ) : (
                            <div className="flex items-center justify-center h-screen text-white/50">
                                No day 2 form found in database
                            </div>
                        )}
                    </div>
                )

            case 'mentor-review':
                return (
                    <MentorDashboard
                        user={{
                            id: 1,
                            email: 'eduard@mesga.eu',
                            role: 'admin',
                        }}
                        mentorType="admin"
                        pendingSubmissions={MOCK_MENTOR_SUBMISSIONS as any}
                        reviewedSubmissions={[]}
                        recentReviews={[]}
                        founders={[]}
                    />
                )

            case 'gate-form':
                return (
                    <div className="min-h-screen bg-[#1a2634]">
                        {dayForms['daily-gate-block-15'] ? (
                            <FounderFormComponent
                                form={dayForms['daily-gate-block-15']}
                                platformSettings={settings}
                                isDailyForm={true}
                                dayNumber={15}
                                dayDefinitionContext={buildDayDefContext('daily-gate-block-15')}
                            />
                        ) : (
                            <div className="flex items-center justify-center h-screen text-white/50">
                                No gate form found in database (slug: daily-gate-block-15)
                            </div>
                        )}
                    </div>
                )
        }
    }

    return (
        <div className="relative">
            {/* Main content */}
            {renderStep()}

            {/* Floating control panel */}
            {controlsVisible && (
                <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[99999] flex items-center gap-1 bg-black/90 backdrop-blur-xl border border-white/10 rounded-2xl px-3 py-2 shadow-2xl">
                    {STEPS.map((s) => (
                        <button
                            key={s.key}
                            onClick={() => setStep(s.key)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${step === s.key
                                    ? 'bg-blue-500/30 text-blue-300 border border-blue-500/40'
                                    : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                                }`}
                            title={`${s.label} (${s.shortcut})`}
                        >
                            <span className="text-white/20 mr-1">{s.shortcut}</span>
                            {s.label}
                        </button>
                    ))}
                    <button
                        onClick={() => setControlsVisible(false)}
                        className="ml-2 px-2 py-1.5 rounded-xl text-xs text-white/30 hover:text-white/60"
                        title="Hide controls (H)"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Hidden controls hint */}
            {!controlsVisible && (
                <div
                    className="fixed bottom-2 right-2 z-[99999] text-[10px] text-white/10 cursor-pointer"
                    onClick={() => setControlsVisible(true)}
                >
                    press H
                </div>
            )}
        </div>
    )
}
