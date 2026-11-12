'use client'
import React, { useState, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'
import SiteFooter from '@/components/SiteFooter'
import PublicHeader from '@/components/PublicHeader'
import FaqSection from '@/components/FaqSection'
import { setPreferredTrackCookie } from '@/lib/preferredTrack'
import { setLandingTrackIntakeContext } from '@/lib/intakeContext'
import { resolveLocalizedLegalDocument } from '@/lib/legalDocuments'
import { useLanguage, createT } from '@/lib/i18n'
import {
    getTrackPartnerTiles,
    normalizeLandingPartner,
    type LandingPartner,
} from '@/lib/landingTracks'

interface TrackData {
    key: string
    icon: string
    name: string
    enabled: boolean
    badge: string
    tagline: string
    desc: string
    color: string
    applyUrl: string
    applyButtonText: string
    startTrackSlug: string
    partners: LandingPartner[]
    challenges: { key: string; title: string; desc: string }[]
    whatYouGet: { text: string }[]
    graphicUrl: string | null
}

interface PillData {
    key: string
    label: string
}

const LEGACY_PARTNERS_SUBTITLE = 'Each logo links directly to the partner behind the MESGA ecosystem. Manage visibility, logo, and destination URL from the Partners collection.'
const DEFAULT_PARTNERS_SUBTITLE = 'These organizations help shape the MESGA ecosystem through expertise, market access, education, and real startup opportunities.'

const PLACEHOLDER_TRACK_PARTNERS: LandingPartner[] = [
    { id: 'ph-1', name: 'Amber Hill Studio', websiteUrl: 'https://amberhillstudio.com', logoUrl: null },
    { id: 'ph-2', name: 'Copernic Space', websiteUrl: 'https://copernicspace.com', logoUrl: null },
    { id: 'ph-3', name: 'EUSPA', websiteUrl: 'https://euspa.europa.eu', logoUrl: null },
]

const DEFAULT_FALLBACK_TRACKS = [
    {
        key: 'general',
        icon: '01',
        name: 'General Track',
        enabled: true,
        badge: 'Open Track · All Sectors Welcome',
        tagline: 'For strong founders building outside a specialist lane.',
        desc: 'A flexible entry point for founders whose company does not fit a dedicated thematic track. Bring your product, market problem, and execution plan, and we will pressure-test the fundamentals with you from Day 1.',
        color: '#ffcc00',
        applyUrl: '/login?role=founder',
        applyButtonText: 'Apply for General Track →',
        startTrackSlug: 'general',
        partners: [],
        challenges: [
            { key: 'general', title: 'General', desc: 'Use the 100-day MESGA structure for a sector-agnostic startup: sharpen the problem, validate demand, build evidence, and prepare for review without forcing the company into a specialist track.' },
        ],
        whatYouGet: [
            { text: 'Generalist founder support across validation, positioning, and go-to-market' },
            { text: 'Mentor feedback focused on execution quality rather than sector branding' },
            { text: 'Structured pressure-testing of the problem, solution, and commercial wedge' },
            { text: 'Access to the same MESGA platform, workflow, and review process from Day 1' },
        ],
        graphicUrl: null,
    },
    {
        key: 'satc',
        icon: '02',
        name: 'Space & the City',
        enabled: true,
        badge: 'EUSPA Beta Cohort · Now Open',
        tagline: 'Satellite data. Everyday life. Your idea.',
        desc: "You don't need to build a rocket. This track is for founders using satellite imagery, geolocation data, and Earth observation to solve real urban, civic, agricultural, or consumer problems.",
        color: '#38bdf8',
        applyUrl: '/login?role=founder',
        applyButtonText: 'Apply for Space & the City →',
        startTrackSlug: 'satc',
        partners: [],
        challenges: [
            { key: 'space', title: 'Space', desc: 'Build infrastructure, tooling, or services that make space data more accessible, processable, or commercially viable: APIs, analytics platforms, or data pipelines.' },
            { key: 'urban', title: 'Urban', desc: 'Turn satellite imagery, Copernicus EO data, or Galileo positioning into a product people actually use for urban planning, mobility, or climate monitoring.' },
            { key: 'other', title: 'Other', desc: 'Use space-derived data in agriculture, insurance, logistics, environmental monitoring, or consumer products.' },
        ],
        whatYouGet: [
            { text: 'Free-tier satellite data: Copernicus, Planet Labs, Sentinel Hub, NASA' },
            { text: 'Geo-data specialists as track mentors' },
            { text: 'Introductions to downstream data buyers: insurance, agri-tech, logistics' },
            { text: 'Working API access to Earth observation datasets from Day 1' },
        ],
        graphicUrl: null,
    },
    {
        key: 'edutech',
        icon: '03',
        name: 'EduTech',
        enabled: true,
        badge: 'Sponsored by TechniSchool',
        tagline: 'Build the future of learning — in 100 days.',
        desc: 'Transform education through technology. K–12, higher education, workforce learning, and corporate training. With TechniSchool as anchor sponsor, get direct access to school networks and a real testbed from Day 1.',
        color: '#34d399',
        applyUrl: '/login?role=founder',
        applyButtonText: 'Apply for EduTech Track →',
        startTrackSlug: 'edutech',
        partners: [],
        challenges: [
            { key: 'education', title: 'Education', desc: 'Build a product that changes how students learn, teachers teach, or institutions measure outcomes — schools, universities, and corporate learning.' },
        ],
        whatYouGet: [
            { text: "Access to TechniSchool's school network for live user testing" },
            { text: 'Pedagogical advisors and curriculum experts as mentors' },
            { text: 'Potential Letter of Intent from TechniSchool if product shows traction' },
            { text: 'EduTech-specific curriculum: regulation, product-led growth, procurement cycles' },
        ],
        graphicUrl: null,
    },
    {
        key: 'dadu',
        icon: '04',
        name: 'Defence & Dual Use',
        enabled: true,
        badge: 'Dual-use cohort',
        tagline: 'Solve security, resilience, and critical infrastructure problems with commercial-grade execution.',
        desc: 'Build startups for defence, civil resilience, critical infrastructure, and dual-use markets. This track focuses on strong problem framing, operator access, and products that can survive procurement reality.',
        color: '#fee5b1',
        applyUrl: '/login?role=founder',
        applyButtonText: 'Apply for Defence & Dual Use →',
        startTrackSlug: 'dadu',
        partners: [],
        challenges: [
            { key: 'dualuse', title: 'Dual Use', desc: 'Build products that can serve defence, public-sector resilience, or critical industries while still working in commercial markets: cybersecurity, readiness tooling, or logistics.' },
        ],
        whatYouGet: [
            { text: 'Operator-informed feedback on security and resilience problem selection' },
            { text: 'Support for dual-use positioning, procurement readiness, and market sequencing' },
            { text: 'Mentorship on trust, compliance, and adoption barriers in regulated environments' },
        ],
        graphicUrl: null,
    },
]

const DEFAULT_SOCIAL_PROOF_QUOTES = [
    {
        quote: 'The structure is simple enough for first-time founders, but strict enough to create investor-grade proof.',
        role: 'Founder mentor',
    },
    {
        quote: 'A daily mission beats vague support. People know what to do next and why it matters.',
        role: 'Ecosystem operator',
    },
    {
        quote: 'What stands out is the execution trail. You can see progress, not just hear a pitch.',
        role: 'Investment scout',
    },
] as const

const mentorAvatarFrameClass = 'mb-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-[#1a2634]/80'
const mentorLogoFrameClass = 'mb-4 flex h-16 w-28 items-center justify-center overflow-hidden rounded-xl border border-white/15 bg-[#1a2634]/80 px-3 py-2'

export interface MentorEntry {
    id?: number | string
    name: string
    partnerName?: string | null
    avatarUrl?: string | null
    logoUrl?: string | null
    linkUrl?: string | null
}

function getLandingMentors(rawMentors: MentorEntry[] = []): MentorEntry[] {
    const activeMentors = rawMentors.filter((mentor) => mentor && typeof mentor.name === 'string' && mentor.name.trim().length > 0)
    return activeMentors
}

function PartnersShowcase({ settings, partners, theme }: { settings: any; partners: LandingPartner[]; theme: 'dark' | 'light' }) {
    const { lang } = useLanguage()
    const t = createT(settings, lang)
    const landing = settings || {}
    const isLight = theme === 'light'

    if (partners.length === 0) return null

    const sectionLabel = t('partnersSectionLabel', landing.partnersSectionLabel || 'Ecosystem Partners')
    const sectionTitle = t('partnersSectionTitle', landing.partnersSectionTitle || 'Built with operators, institutions, and corporates who move markets.')
    const storedSubtitle = typeof landing.partnersSectionSubtitle === 'string' ? landing.partnersSectionSubtitle.trim() : ''
    const sectionSubtitle =
        !storedSubtitle || storedSubtitle === LEGACY_PARTNERS_SUBTITLE
            ? DEFAULT_PARTNERS_SUBTITLE
            : storedSubtitle

    return (
        <section className={`mb-36 sm:mb-44 border-t pt-20 sm:pt-28 ${isLight ? 'border-[#1a2634]/10' : 'border-white/[0.08]'}`}>
            <div className="grid gap-12 lg:grid-cols-12 mb-14">
                <div className="lg:col-span-5">
                    <div className={`font-mono text-xs font-semibold uppercase tracking-[0.22em] mb-4 ${isLight ? 'text-[#203e5f]/70' : 'text-[#eaeaea]/55'}`}>
                        // {sectionLabel}
                    </div>
                    <h2 className={`text-3xl sm:text-4xl font-bold leading-tight ${isLight ? 'text-[#1a2634]' : 'text-white'}`}>
                        {sectionTitle}
                    </h2>
                </div>
                <div className="lg:col-span-7 flex items-end">
                    <p className={`text-base leading-relaxed max-w-2xl ${isLight ? 'text-[#1a2634]/75' : 'text-[#eaeaea]/70'}`}>
                        {sectionSubtitle}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
                {partners.map((partner) =>
                    partner.websiteUrl ? (
                        <a
                            key={partner.id}
                            href={partner.websiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`group relative flex min-h-32 items-center justify-center overflow-hidden rounded-2xl border px-6 py-5 backdrop-blur-xl transition-all duration-200 ${
                                isLight
                                    ? 'border-[#1a2634]/10 bg-[#1a2634]/85 hover:bg-[#1a2634]'
                                    : 'border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]'
                            }`}
                            aria-label={`Open ${partner.name}`}
                        >
                            {partner.logoUrl ? (
                                <img
                                    src={partner.logoUrl}
                                    alt={partner.name}
                                    className="max-h-16 w-full object-contain transition-transform duration-200 group-hover:scale-[1.03]"
                                    loading="lazy"
                                />
                            ) : (
                                <span className="text-sm font-bold text-[#eaeaea]">{partner.name}</span>
                            )}
                        </a>
                    ) : (
                        <div
                            key={partner.id}
                            className="flex min-h-32 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl px-6 py-5"
                            aria-label={partner.name}
                        >
                            {partner.logoUrl ? (
                                <img
                                    src={partner.logoUrl}
                                    alt={partner.name}
                                    className="max-h-16 w-full object-contain"
                                    loading="lazy"
                                />
                            ) : (
                                <span className="text-sm font-bold text-[#eaeaea]">{partner.name}</span>
                            )}
                        </div>
                    ),
                )}
            </div>
        </section>
    )
}

function SocialProofQuotes({ theme = 'dark' }: { theme?: 'dark' | 'light' }) {
    const isLight = theme === 'light'
    return (
        <section className={`mb-36 sm:mb-44 border-t pt-20 sm:pt-28 ${isLight ? 'border-[#1a2634]/10' : 'border-white/[0.08]'}`}>
            <div className="grid gap-14 lg:grid-cols-12 lg:gap-16 items-start">
                <div className="lg:col-span-5 space-y-5">
                    <div className={`font-mono text-xs font-semibold uppercase tracking-[0.22em] ${isLight ? 'text-[#203e5f]/70' : 'text-[#eaeaea]/55'}`}>
                        02 // FIELD PERSPECTIVE
                    </div>
                    <h2 className={`text-3xl sm:text-4xl font-bold leading-tight ${isLight ? 'text-[#1a2634]' : 'text-white'}`}>
                        Backed by founders, operators, and ecosystem partners who care about execution clarity.
                    </h2>
                    <p className={`text-base leading-relaxed ${isLight ? 'text-[#1a2634]/70' : 'text-[#eaeaea]/65'}`}>
                        MESGA is designed with people who see the same pattern repeatedly: early founders do better when the next action is explicit, visible, and reviewable.
                    </p>
                </div>

                <div className="lg:col-span-7 grid gap-6 sm:grid-cols-3">
                    {DEFAULT_SOCIAL_PROOF_QUOTES.map((item, idx) => (
                        <div
                            key={item.role}
                            className={`flex flex-col justify-between rounded-2xl border p-7 backdrop-blur-xl ${
                                isLight
                                    ? 'border-[#1a2634]/[0.08] bg-white/60 text-[#1a2634]'
                                    : 'border-white/[0.08] bg-white/[0.03] text-[#eaeaea]'
                            }`}
                        >
                            <div>
                                <div className={`font-mono text-xs font-semibold mb-4 ${isLight ? 'text-[#203e5f]/60' : 'text-[#eaeaea]/45'}`}>
                                    /0{idx + 1}
                                </div>
                                <p className={`text-sm leading-relaxed font-medium ${isLight ? 'text-[#1a2634]/90' : 'text-[#eaeaea]/90'}`}>
                                    “{item.quote}”
                                </p>
                            </div>
                            <div
                                className={`mt-8 pt-4 border-t font-mono text-[11px] font-semibold uppercase tracking-wider ${
                                    isLight
                                        ? 'border-[#1a2634]/[0.08] text-[#203e5f]'
                                        : 'border-white/[0.08] text-[#fee5b1]/85'
                                }`}
                            >
                                {item.role}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}

function EcosystemShowcase({
    partners = [],
    rawMentors = [],
    theme = 'dark',
}: {
    partners?: LandingPartner[]
    rawMentors?: MentorEntry[]
    theme?: 'dark' | 'light'
}) {
    const mentors = getLandingMentors(rawMentors)
    const hasPartners = partners.length > 0
    const hasMentors = mentors.length > 0
    const isLight = theme === 'light'

    if (!hasPartners && !hasMentors) return null

    return (
        <section className="mb-36 sm:mb-44">
            {hasMentors && (
                <div>
                    <div className="mb-8 flex items-center gap-4">
                        <span
                            className={`font-mono text-xs font-semibold uppercase tracking-[0.22em] ${
                                isLight ? 'text-[#203e5f]/75' : 'text-[#eaeaea]/55'
                            }`}
                        >
                            // Ecosystem Mentors
                        </span>
                        <div className={`h-px flex-1 ${isLight ? 'bg-[#1a2634]/10' : 'bg-white/10'}`} />
                    </div>
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {mentors.slice(0, 6).map((mentor, index) => {
                            const initials = mentor.name
                                .split(' ')
                                .map((part) => part[0])
                                .join('')
                                .slice(0, 2)
                                .toUpperCase()
                            const card = (
                                <>
                                    <div className={mentor.logoUrl ? mentorLogoFrameClass : mentorAvatarFrameClass}>
                                        {mentor.logoUrl ? (
                                            <img
                                                src={mentor.logoUrl}
                                                alt={mentor.name}
                                                className="max-h-10 w-full object-contain transition-transform duration-200 group-hover:scale-[1.03]"
                                                loading="lazy"
                                            />
                                        ) : mentor.avatarUrl ? (
                                            <img
                                                src={mentor.avatarUrl}
                                                alt={mentor.name}
                                                className="h-full w-full object-cover"
                                                loading="lazy"
                                            />
                                        ) : (
                                            <span className="text-lg font-bold text-[#fee5b1]">{initials}</span>
                                        )}
                                    </div>
                                    <div className={`text-base font-bold leading-snug ${isLight ? 'text-[#1a2634]' : 'text-white'}`}>
                                        {mentor.name}
                                    </div>
                                    {mentor.partnerName && (
                                        <div
                                            className={`mt-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${
                                                isLight ? 'text-[#203e5f]/75' : 'text-[#eaeaea]/60'
                                            }`}
                                        >
                                            {mentor.partnerName}
                                        </div>
                                    )}
                                </>
                            )
                            const className = `group block rounded-2xl border p-7 text-left backdrop-blur-xl transition-all duration-200 ${
                                isLight
                                    ? 'border-[#1a2634]/10 bg-white/60 hover:bg-white/85'
                                    : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]'
                            }`

                            return mentor.linkUrl ? (
                                <a
                                    key={mentor.id ?? `${mentor.name}-${index}`}
                                    href={mentor.linkUrl}
                                    target={mentor.linkUrl.startsWith('/') ? undefined : '_blank'}
                                    rel={mentor.linkUrl.startsWith('/') ? undefined : 'noopener noreferrer'}
                                    className={className}
                                    aria-label={`Open ${mentor.name}`}
                                >
                                    {card}
                                </a>
                            ) : (
                                <div key={mentor.id ?? `${mentor.name}-${index}`} className={className}>
                                    {card}
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </section>
    )
}

function TrackPartnerTiles({
    partners,
    accentColor,
    isPlaceholder,
    trackMentors = [],
    isLight = false,
}: {
    partners: LandingPartner[]
    accentColor: string
    isPlaceholder?: boolean
    trackMentors?: MentorEntry[]
    isLight?: boolean
}) {
    const tiles = isPlaceholder ? partners : getTrackPartnerTiles(partners)
    const mentors = getLandingMentors(trackMentors)

    if (tiles.length === 0 && mentors.length === 0) return null

    const singlePartner = tiles.length === 1

    return (
        <div className={`flex flex-col border-t pt-5 mt-3 ${isLight ? 'border-[#1a2634]/10' : 'border-white/10'}`}>
            <div className="flex items-center gap-2.5 mb-3">
                <span className={`font-mono text-[10px] font-semibold uppercase tracking-[0.2em] ${isLight ? 'text-[#1a2634]/60' : 'text-[#eaeaea]/55'}`}>
                    Partners
                </span>
                {isPlaceholder && (
                    <span
                        className={`font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                            isLight
                                ? 'bg-white/60 border-[#1a2634]/15 text-[#1a2634]/60'
                                : 'bg-white/[0.04] border-white/10 text-[#eaeaea]/55'
                        }`}
                    >
                        coming soon
                    </span>
                )}
            </div>
            {singlePartner ? (
                <div className="w-full max-w-[190px]">
                    <TrackPartnerTile partner={tiles[0]} accentColor={accentColor} size="single" isLight={isLight} />
                </div>
            ) : (
                <TrackPartnerCarousel partners={tiles} accentColor={accentColor} isLight={isLight} />
            )}
            {mentors.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                    {mentors.map((m, idx) => (
                        <div
                            key={m.id ?? idx}
                            className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${
                                isLight ? 'border-[#1a2634]/10 bg-white/70 text-[#1a2634]' : 'border-white/10 bg-white/[0.04] text-[#eaeaea]'
                            }`}
                        >
                            {m.logoUrl && <img src={m.logoUrl} alt={m.name} className="max-h-8 w-full object-contain" />}
                            <span className="text-[11px] font-semibold">{m.name}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

function TrackPartnerTile({
    partner,
    accentColor,
    size,
    isLight = false,
}: {
    partner: LandingPartner
    accentColor: string
    size: 'single' | 'carousel'
    isLight?: boolean
}) {
    const isSingle = size === 'single'
    const tileClasses = isSingle
        ? `group block rounded-xl border p-3.5 transition-all duration-200 hover:-translate-y-0.5 ${
              isLight ? 'border-[#1a2634]/10 bg-white/60' : 'border-white/10 bg-white/[0.03]'
          }`
        : 'group block'
    const content = (
        <>
            <div
                className={`flex items-center justify-center overflow-hidden rounded-lg border ${
                    isLight ? 'border-[#1a2634]/10 bg-[#1a2634]/90' : 'border-white/10 bg-[#1a2634]/75'
                } ${isSingle ? 'min-h-[56px] px-3 py-2' : 'min-h-[72px] px-3 py-3'}`}
            >
                {partner.logoUrl ? (
                    <img
                        src={partner.logoUrl}
                        alt={partner.name}
                        className={`w-full object-contain transition-transform duration-200 group-hover:scale-[1.03] ${isSingle ? 'max-h-10' : 'max-h-14'}`}
                    />
                ) : (
                    <span className="text-center text-xs font-semibold leading-relaxed text-[#eaeaea]">
                        {partner.name}
                    </span>
                )}
            </div>
            <div
                className={`text-center font-semibold ${
                    isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'
                } ${isSingle ? 'mt-1.5 text-[11px] leading-tight' : 'mt-2 text-[11px] leading-snug'}`}
            >
                {partner.name}
            </div>
            <div
                className={`mx-auto h-px ${isSingle ? 'mt-1.5 w-14' : 'mt-2 w-12'}`}
                style={{ background: `linear-gradient(90deg, transparent, ${accentColor}88, transparent)` }}
            />
        </>
    )

    return partner.websiteUrl ? (
        <a
            href={partner.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${partner.name}`}
            className={tileClasses}
        >
            {content}
        </a>
    ) : (
        <div className={tileClasses} aria-label={partner.name}>
            {content}
        </div>
    )
}

function TrackPartnerCarousel({
    partners,
    accentColor,
    isLight = false,
}: {
    partners: LandingPartner[]
    accentColor: string
    isLight?: boolean
}) {
    const [activeIndex, setActiveIndex] = useState(0)
    const visibleIndex = Math.min(activeIndex, Math.max(partners.length - 1, 0))

    useEffect(() => {
        if (partners.length <= 1) return
        const id = window.setInterval(() => {
            setActiveIndex((c) => (c + 1) % partners.length)
        }, 3000)
        return () => window.clearInterval(id)
    }, [partners.length])

    return (
        <div
            className={`relative w-full max-w-[190px] rounded-xl border p-2.5 overflow-hidden backdrop-blur-md ${
                isLight ? 'border-[#1a2634]/10 bg-white/50' : 'border-white/10 bg-white/[0.03]'
            }`}
        >
            <div className="relative" style={{ minHeight: '112px' }}>
                {partners.map((partner, index) => (
                    <div
                        key={partner.id}
                        className="absolute inset-0 transition-opacity duration-700"
                        style={{ opacity: index === visibleIndex ? 1 : 0 }}
                    >
                        <TrackPartnerTile partner={partner} accentColor={accentColor} size="carousel" isLight={isLight} />
                    </div>
                ))}
            </div>
        </div>
    )
}

function NewTrackCard({
    newTrackLabel,
    newTrackSubtitle,
    newTrackEmail,
    newTrackCta,
    theme = 'dark',
}: {
    newTrackLabel: string
    newTrackSubtitle: string
    newTrackEmail: string
    newTrackCta: string
    theme?: 'dark' | 'light'
}) {
    const isLight = theme === 'light'
    return (
        <div
            className={`h-full w-full rounded-2xl border border-dashed flex flex-col justify-between p-9 min-h-[420px] backdrop-blur-xl transition-colors ${
                isLight
                    ? 'border-[#1a2634]/20 bg-white/45 text-[#1a2634]'
                    : 'border-white/15 bg-white/[0.02] text-[#eaeaea]'
            }`}
        >
            <div>
                <div
                    className={`font-mono text-xs font-semibold uppercase tracking-widest inline-block px-3 py-1 rounded-lg mb-5 border ${
                        isLight
                            ? 'bg-white/70 border-[#1a2634]/10 text-[#203e5f]'
                            : 'bg-white/[0.05] border-white/10 text-[#fee5b1]'
                    }`}
                >
                    + EXPANSION LANE
                </div>
                <div className="text-2xl font-bold mb-3">{newTrackLabel}</div>
                <div className={`text-sm leading-relaxed max-w-xs ${isLight ? 'text-[#1a2634]/70' : 'text-[#eaeaea]/65'}`}>
                    {newTrackSubtitle}
                </div>
            </div>
            <a
                href={`mailto:${newTrackEmail}`}
                className={`inline-flex w-fit items-center gap-2 rounded-xl border px-5 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${
                    isLight
                        ? 'border-[#1a2634]/15 bg-white/80 text-[#1a2634] hover:bg-[#1a2634] hover:text-white'
                        : 'border-white/15 bg-white/[0.06] text-white hover:bg-white/[0.12]'
                }`}
            >
                {newTrackCta}
            </a>
        </div>
    )
}

interface TrackCardProps {
    track: TrackData
    trackPartners: LandingPartner[]
    pills: PillData[]
    activePillKey: string
    challengeTypeLabel: string
    viewDetailsBtn: string
    startTrackBtn: string
    challenge: { title: string; desc: string }
    hasGraphic: boolean
    isPrimaryTrack: boolean
    theme?: 'dark' | 'light'
    onSelectPill: (pillKey: string) => void
    onOpenDetails: () => void
    onStartTrack: () => void
    onGraphicError: () => void
}

function TrackCard({
    track,
    trackPartners,
    pills,
    activePillKey,
    challengeTypeLabel,
    viewDetailsBtn,
    startTrackBtn,
    challenge,
    hasGraphic,
    theme = 'dark',
    onSelectPill,
    onOpenDetails,
    onStartTrack,
    onGraphicError,
}: TrackCardProps) {
    const isLight = theme === 'light'
    const realPartners = getTrackPartnerTiles(trackPartners)
    const isPlaceholder = realPartners.length === 0
    const renderablePartners = isPlaceholder ? PLACEHOLDER_TRACK_PARTNERS : realPartners
    const accent = track.color || '#ffcc00'

    return (
        <div
            className={`h-full w-full flex flex-col rounded-2xl border overflow-hidden backdrop-blur-2xl transition-all ${
                isLight
                    ? 'border-[#1a2634]/10 bg-white/65 text-[#1a2634] shadow-lg shadow-[#1a2634]/[0.04]'
                    : 'border-white/10 bg-white/[0.03] text-[#eaeaea] shadow-2xl shadow-black/20'
            }`}
        >
            <div className="h-1 w-full opacity-85" style={{ backgroundColor: accent }} />

            <div className="px-7 pt-7 pb-6 flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
                <div className="flex-1 flex flex-col">
                    <div className="flex items-center justify-between gap-3 mb-4">
                        <span
                            className={`font-mono text-[10px] font-semibold uppercase tracking-wider px-3 py-1 rounded-lg border ${
                                isLight
                                    ? 'bg-[#1a2634]/[0.05] border-[#1a2634]/10 text-[#203e5f]'
                                    : 'bg-white/[0.05] border-white/10 text-[#eaeaea]/90'
                            }`}
                        >
                            {track.badge}
                        </span>
                        <span className={`font-mono text-xs font-semibold ${isLight ? 'text-[#1a2634]/40' : 'text-[#eaeaea]/40'}`}>
                            /{track.icon}
                        </span>
                    </div>
                    <h3 className={`text-2xl font-bold mb-1.5 tracking-tight ${isLight ? 'text-[#1a2634]' : 'text-white'}`}>
                        {track.name}
                    </h3>
                    <div className={`text-xs mb-5 ${isLight ? 'text-[#203e5f]/80' : 'text-[#eaeaea]/65'}`}>
                        {track.tagline}
                    </div>

                    {renderablePartners.length > 0 && (
                        <TrackPartnerTiles
                            partners={renderablePartners}
                            accentColor={accent}
                            isPlaceholder={isPlaceholder}
                            isLight={isLight}
                        />
                    )}
                </div>

                {hasGraphic && (
                    <div className="hidden lg:flex shrink-0 w-[180px] xl:w-[200px] items-start justify-end">
                        <div className={`relative w-full overflow-hidden rounded-xl border ${isLight ? 'border-[#1a2634]/10' : 'border-white/10'}`}>
                            <img
                                src={track.graphicUrl!}
                                alt={`${track.name} Graphic`}
                                className="block w-full h-auto object-cover"
                                onError={(e) => {
                                    e.currentTarget.onerror = null
                                    onGraphicError()
                                }}
                            />
                        </div>
                    </div>
                )}
            </div>

            <div className={`mx-7 h-px ${isLight ? 'bg-[#1a2634]/[0.08]' : 'bg-white/[0.08]'}`} />

            <div className="px-7 pt-6 pb-7 flex flex-col flex-1">
                <p className={`text-sm leading-relaxed mb-6 ${isLight ? 'text-[#1a2634]/75' : 'text-[#eaeaea]/75'}`}>
                    {track.desc}
                </p>

                <div className={`font-mono text-[10px] font-semibold tracking-[0.2em] uppercase mb-2.5 ${isLight ? 'text-[#1a2634]/50' : 'text-[#eaeaea]/50'}`}>
                    {challengeTypeLabel}
                </div>
                <div className="flex flex-wrap gap-2 mb-5">
                    {pills.map((pill) => {
                        const active = activePillKey === pill.key
                        return (
                            <button
                                key={pill.key}
                                onClick={() => onSelectPill(pill.key)}
                                className={`text-[11px] font-semibold px-3.5 py-1.5 rounded-lg transition-all cursor-pointer border ${
                                    active
                                        ? isLight
                                            ? 'border-[#1a2634] bg-[#1a2634] text-white'
                                            : 'border-white/30 bg-white/15 text-white'
                                        : isLight
                                          ? 'border-[#1a2634]/10 bg-white/50 text-[#1a2634]/70 hover:bg-white'
                                          : 'border-white/10 bg-white/[0.03] text-[#eaeaea]/65 hover:bg-white/[0.07]'
                                }`}
                            >
                                {pill.label}
                            </button>
                        )
                    })}
                </div>

                <div
                    className={`rounded-xl p-4.5 mb-7 border text-sm leading-relaxed min-h-[92px] ${
                        isLight
                            ? 'bg-white/60 border-[#1a2634]/[0.08] text-[#1a2634]/85'
                            : 'bg-white/[0.03] border-white/[0.08] text-[#eaeaea]/85'
                    }`}
                >
                    <span className={`font-bold ${isLight ? 'text-[#1a2634]' : 'text-white'}`}>{challenge.title}: </span>
                    {challenge.desc}
                </div>

                <div className="mt-auto grid sm:grid-cols-2 gap-3">
                    <button
                        onClick={onOpenDetails}
                        className={`w-full rounded-xl px-4 py-3 text-xs font-semibold uppercase tracking-wider transition-colors border cursor-pointer ${
                            isLight
                                ? 'border-[#1a2634]/15 bg-white/50 text-[#1a2634] hover:bg-white'
                                : 'border-white/15 bg-white/[0.03] text-[#eaeaea] hover:bg-white/[0.08]'
                        }`}
                    >
                        {viewDetailsBtn}
                    </button>
                    <button
                        onClick={onStartTrack}
                        className="w-full rounded-xl px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#1a2634] bg-[#ffcc00] hover:bg-[#fee5b1] transition-colors cursor-pointer"
                    >
                        {startTrackBtn}
                    </button>
                </div>
            </div>
        </div>
    )
}

function TracksCarousel({ settings, theme = 'dark' }: { settings: any; theme?: 'dark' | 'light' }) {
    const { lang } = useLanguage()
    const ti = createT(settings, lang)
    const landing = settings || {}
    const isLight = theme === 'light'

    const pillsRaw: PillData[] = landing.challengePills?.length
        ? landing.challengePills
        : [
            { key: 'general', label: 'General' },
            { key: 'education', label: 'Education' },
            { key: 'space', label: 'Space' },
            { key: 'urban', label: 'Urban' },
            { key: 'other', label: 'Other' },
            { key: 'dualuse', label: 'Dual Use' },
        ]

    const tracksRaw: TrackData[] = landing.tracks?.length
        ? landing.tracks
            .map((tr: any, idx: number) => {
                const defaultColors = ['#ffcc00', '#38bdf8', '#34d399', '#fee5b1']
                return {
                    key: tr.key || '',
                    icon: tr.icon || `0${idx + 1}`,
                    name: tr.name || '',
                    enabled: tr.enabled !== false,
                    badge: (tr.badge || '').replace(/^(Beta Cohort)/i, 'EUSPA Beta Cohort'),
                    tagline: tr.tagline || '',
                    desc: tr.desc || '',
                    color: tr.color || defaultColors[idx % defaultColors.length],
                    applyUrl: tr.applyUrl || '/login?role=founder',
                    applyButtonText: tr.applyButtonText || `Apply for ${tr.name || 'this track'} →`,
                    startTrackSlug:
                        tr.startTrack && typeof tr.startTrack === 'object' && typeof tr.startTrack.slug === 'string' && tr.startTrack.slug.trim()
                            ? tr.startTrack.slug.trim().toLowerCase()
                            : String(tr.key || '').trim().toLowerCase(),
                    partners: Array.isArray(tr.partners)
                        ? (tr.partners.map((partner: any) => normalizeLandingPartner(partner)).filter(Boolean) as LandingPartner[])
                        : [],
                    challenges: (tr.challenges || []).map((c: any) => ({ key: c.key, title: c.title, desc: c.desc })),
                    whatYouGet: (tr.whatYouGet || []).map((w: any) => ({ text: w.text })),
                    graphicUrl: tr.graphic && typeof tr.graphic === 'object' ? (tr.graphic.url ?? null) : null,
                }
            })
            .filter((track: TrackData) => track.enabled)
        : DEFAULT_FALLBACK_TRACKS

    const sectionLabel = ti('tracksSectionLabel', landing.tracksSectionLabel || 'Specialised Tracks')
    const sectionTitle = ti('tracksSectionTitle', landing.tracksSectionTitle || 'Choose your track.')
    const sectionHighlight = ti('tracksSectionTitleHighlight', landing.tracksSectionTitleHighlight || 'Define your focus.')
    const sectionSubtitle = ti(
        'tracksSectionSubtitle',
        landing.tracksSectionSubtitle ||
            'Focused domain tracks with real partner challenges and an ecosystem built for your industry. This helps us route you to the most relevant programme path and reviewers.',
    )
    const challengeTypeLabel = ti('tracksChallengeTypeLabel', landing.tracksChallengeTypeLabel || 'Challenge type')
    const viewDetailsBtn = ti('tracksViewDetailsBtn', landing.tracksViewDetailsBtn || 'Full track details')
    const startTrackBtn = ti('tracksStartTrackBtn', landing.tracksStartTrackBtn || 'Start this track →')
    const newTrackLabel = ti('tracksNewTrackLabel', landing.tracksNewTrackLabel || 'New Track')
    const newTrackSubtitle = ti('tracksNewTrackSubtitle', landing.tracksNewTrackSubtitle || 'Have an industry network, technical mentors, or corporate challenge?')
    const newTrackCta = ti('tracksNewTrackCta', landing.tracksNewTrackCta || 'Sponsor a track →')
    const newTrackEmail = landing.tracksNewTrackEmail || 'hello@mesga.eu'

    const defaultPill = pillsRaw[0]?.key || 'education'
    const initialPills = useMemo(() => {
        const map: Record<string, string> = {}
        tracksRaw.forEach((t) => {
            map[t.key] = defaultPill
        })
        return map
    }, [tracksRaw, defaultPill])

    const [activePill, setActivePill] = useState<Record<string, string>>(initialPills)
    const [activeModal, setActiveModal] = useState<string | null>(null)
    const [activeIndex, setActiveIndex] = useState(0)
    const [hiddenGraphics, setHiddenGraphics] = useState<Record<string, boolean>>({})
    const containerRef = useRef<HTMLDivElement>(null)
    const [cardWidth, setCardWidth] = useState(0)

    useEffect(() => {
        const measure = () => {
            if (containerRef.current) {
                setCardWidth(containerRef.current.offsetWidth / 1.55)
            }
        }
        measure()
        window.addEventListener('resize', measure)
        return () => window.removeEventListener('resize', measure)
    }, [])

    const totalSlides = tracksRaw.length + 1
    const nextSlide = () => setActiveIndex((p) => (p + 1) % totalSlides)
    const prevSlide = () => setActiveIndex((p) => (p - 1 + totalSlides) % totalSlides)

    const modalTrack = activeModal ? tracksRaw.find((t) => t.key === activeModal) : null
    const modalTrackPartners = modalTrack ? modalTrack.partners : []

    const getChallengeForTrack = (track: TrackData, pillKey: string) => {
        const ch = track.challenges.find((c) => c.key === pillKey)
        return ch || { title: '', desc: '' }
    }

    const getAvailablePillsAndKey = (track: TrackData) => {
        const availablePills = pillsRaw.filter((p) => {
            const ch = track.challenges.find((c) => c.key === p.key)
            if (!ch) return false
            const isDash = (text: string) => !text || text.trim() === '-' || text.trim() === '–'
            return !(isDash(ch.title) && isDash(ch.desc))
        })
        const fallbackPills = track.challenges.map((challenge) => ({
            key: challenge.key,
            label: challenge.title,
        }))
        const resolvedPills = availablePills.length > 0 ? availablePills : fallbackPills
        const currentPill = activePill[track.key] || defaultPill
        const hasCurrent = resolvedPills.some((p) => p.key === currentPill)
        const activePillKey = hasCurrent ? currentPill : resolvedPills[0]?.key || defaultPill
        return { availablePills: resolvedPills, activePillKey }
    }

    const resolveTrackDestination = (applyUrl: string) => {
        const trimmed = applyUrl.trim()
        if (!trimmed) return '/login?role=founder&next=/intake'
        if (!trimmed.startsWith('/login')) return trimmed
        if (trimmed.includes('next=')) return trimmed
        return `${trimmed}${trimmed.includes('?') ? '&' : '?'}next=/intake`
    }

    const handleTrackNavigation = (track: TrackData) => {
        const targetTrackSlug = (track.startTrackSlug || track.key || 'general').trim().toLowerCase()
        setPreferredTrackCookie(targetTrackSlug)
        setLandingTrackIntakeContext(targetTrackSlug)
        window.location.assign(resolveTrackDestination(track.applyUrl))
    }

    if (tracksRaw.length === 0) return null

    return (
        <section id="tracks" className={`mb-36 sm:mb-44 border-t pt-20 sm:pt-28 ${isLight ? 'border-[#1a2634]/10' : 'border-white/[0.08]'}`}>
            <div className="grid gap-10 lg:grid-cols-12 mb-14 items-end">
                <div className="lg:col-span-7">
                    <div className={`font-mono text-xs font-semibold uppercase tracking-[0.22em] mb-4 ${isLight ? 'text-[#203e5f]/70' : 'text-[#eaeaea]/55'}`}>
                        01 // {sectionLabel}
                    </div>
                    <h2 className={`text-3xl sm:text-5xl font-bold leading-[1.08] tracking-tight ${isLight ? 'text-[#1a2634]' : 'text-white'}`}>
                        {sectionTitle}{' '}
                        <span className={isLight ? 'text-[#203e5f]/75' : 'text-[#eaeaea]/65'}>
                            {sectionHighlight}
                        </span>
                    </h2>
                </div>
                <div className="lg:col-span-5 flex flex-col justify-between gap-6">
                    <p className={`text-sm sm:text-base leading-relaxed ${isLight ? 'text-[#1a2634]/70' : 'text-[#eaeaea]/65'}`}>
                        {sectionSubtitle}
                    </p>
                    <div className="hidden md:flex items-center gap-2.5">
                        <button
                            onClick={prevSlide}
                            className={`h-11 w-11 flex items-center justify-center rounded-xl border backdrop-blur-md transition-colors cursor-pointer ${
                                isLight
                                    ? 'border-[#1a2634]/15 bg-white/60 text-[#1a2634] hover:bg-white'
                                    : 'border-white/15 bg-white/[0.04] text-[#eaeaea] hover:bg-white/[0.1]'
                            }`}
                            aria-label="Previous tracks"
                        >
                            ←
                        </button>
                        <button
                            onClick={nextSlide}
                            className={`h-11 w-11 flex items-center justify-center rounded-xl border backdrop-blur-md transition-colors cursor-pointer ${
                                isLight
                                    ? 'border-[#1a2634]/15 bg-white/60 text-[#1a2634] hover:bg-white'
                                    : 'border-white/15 bg-white/[0.04] text-[#eaeaea] hover:bg-white/[0.1]'
                            }`}
                            aria-label="Next tracks"
                        >
                            →
                        </button>
                        <span className={`ml-3 font-mono text-xs ${isLight ? 'text-[#1a2634]/55' : 'text-[#eaeaea]/50'}`}>
                            {String(activeIndex + 1).padStart(2, '0')} / {String(totalSlides).padStart(2, '0')}
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-7 md:hidden">
                {tracksRaw.map((track, itemIndex) => {
                    const { availablePills, activePillKey: pillKey } = getAvailablePillsAndKey(track)
                    const challenge = getChallengeForTrack(track, pillKey)
                    const trackPartners = track.partners

                    return (
                        <TrackCard
                            key={track.key}
                            track={track}
                            trackPartners={trackPartners}
                            pills={availablePills}
                            activePillKey={pillKey}
                            challengeTypeLabel={challengeTypeLabel}
                            viewDetailsBtn={viewDetailsBtn}
                            startTrackBtn={startTrackBtn}
                            challenge={challenge}
                            hasGraphic={false}
                            isPrimaryTrack={itemIndex === 0}
                            theme={theme}
                            onSelectPill={(pillKey) => setActivePill((prev) => ({ ...prev, [track.key]: pillKey }))}
                            onOpenDetails={() => setActiveModal(track.key)}
                            onStartTrack={() => handleTrackNavigation(track)}
                            onGraphicError={() => setHiddenGraphics((prev) => ({ ...prev, [track.key]: true }))}
                        />
                    )
                })}
                <NewTrackCard
                    newTrackLabel={newTrackLabel}
                    newTrackSubtitle={newTrackSubtitle}
                    newTrackEmail={newTrackEmail}
                    newTrackCta={newTrackCta}
                    theme={theme}
                />
            </div>

            <div className="relative min-h-[480px] hidden items-center md:flex">
                <div className="w-full overflow-hidden" ref={containerRef}>
                    <div
                        className="flex transition-transform duration-500 ease-[cubic-bezier(0.25,1,0.5,1)]"
                        style={{
                            transform: `translateX(-${activeIndex * cardWidth}px)`,
                        }}
                    >
                        {Array.from({ length: totalSlides }).map((_, itemIndex) => {
                            if (itemIndex < tracksRaw.length) {
                                const track = tracksRaw[itemIndex]
                                const { availablePills, activePillKey: pillKey } = getAvailablePillsAndKey(track)
                                const challenge = getChallengeForTrack(track, pillKey)
                                const trackPartners = track.partners
                                return (
                                    <div key={track.key} className="flex-none pr-8" style={{ width: cardWidth ? `${cardWidth}px` : '62%' }}>
                                        <TrackCard
                                            track={track}
                                            trackPartners={trackPartners}
                                            pills={availablePills}
                                            activePillKey={pillKey}
                                            challengeTypeLabel={challengeTypeLabel}
                                            viewDetailsBtn={viewDetailsBtn}
                                            startTrackBtn={startTrackBtn}
                                            challenge={challenge}
                                            hasGraphic={!!track.graphicUrl && !hiddenGraphics[track.key]}
                                            isPrimaryTrack={itemIndex === 0}
                                            theme={theme}
                                            onSelectPill={(pillKey) => setActivePill((prev) => ({ ...prev, [track.key]: pillKey }))}
                                            onOpenDetails={() => setActiveModal(track.key)}
                                            onStartTrack={() => handleTrackNavigation(track)}
                                            onGraphicError={() => setHiddenGraphics((prev) => ({ ...prev, [track.key]: true }))}
                                        />
                                    </div>
                                )
                            }

                            return (
                                <div key={`new-track-${itemIndex}`} className="flex-none pr-8" style={{ width: cardWidth ? `${cardWidth}px` : '62%' }}>
                                    <NewTrackCard
                                        newTrackLabel={newTrackLabel}
                                        newTrackSubtitle={newTrackSubtitle}
                                        newTrackEmail={newTrackEmail}
                                        newTrackCta={newTrackCta}
                                        theme={theme}
                                    />
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {activeModal && modalTrack && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    style={{ background: 'rgba(15, 23, 34, 0.78)', backdropFilter: 'blur(12px)' }}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setActiveModal(null)
                    }}
                >
                    <div
                        className="relative bg-[#1a2634]/95 backdrop-blur-2xl border border-white/15 rounded-2xl w-full max-w-2xl max-h-[88vh] overflow-y-auto text-[#eaeaea] shadow-2xl"
                        style={{ animation: 'tcModalIn 0.2s ease' }}
                    >
                        <div className="h-1" style={{ backgroundColor: modalTrack.color || '#ffcc00' }} />

                        <div className="flex items-start justify-between px-8 pt-8 pb-6">
                            <div>
                                <div className="font-mono text-xs text-[#fee5b1] mb-1.5">{modalTrack.badge}</div>
                                <div className="text-2xl font-bold text-white">{modalTrack.name}</div>
                                <div className="text-xs text-[#eaeaea]/65 mt-1">{modalTrack.tagline}</div>
                            </div>
                            <button
                                onClick={() => setActiveModal(null)}
                                className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-[#eaeaea]/75 hover:text-white transition-colors cursor-pointer border border-white/15 hover:bg-white/10 bg-transparent ml-4"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="mx-8 h-px bg-white/10 mb-7" />

                        <div className="px-8 pb-8 space-y-7">
                            <div>
                                <div className="font-mono text-[10px] font-semibold tracking-[2px] uppercase mb-2 text-[#eaeaea]/55">
                                    About this track
                                </div>
                                <p className="text-sm text-[#eaeaea]/85 leading-7">{modalTrack.desc}</p>
                            </div>

                            {getTrackPartnerTiles(modalTrackPartners).length > 0 && (
                                <div>
                                    <div className="font-mono text-[10px] font-semibold tracking-[2px] uppercase mb-3 text-[#eaeaea]/55">
                                        Partners
                                    </div>
                                    <TrackPartnerTiles partners={modalTrackPartners} accentColor={modalTrack.color || '#ffcc00'} />
                                </div>
                            )}

                            {modalTrack.whatYouGet.length > 0 && (
                                <div>
                                    <div className="font-mono text-[10px] font-semibold tracking-[2px] uppercase mb-3 text-[#eaeaea]/55">
                                        What you get
                                    </div>
                                    <div className="grid sm:grid-cols-2 gap-3">
                                        {modalTrack.whatYouGet.map((item, i) => (
                                            <div
                                                key={i}
                                                className="flex items-start gap-2.5 p-4 rounded-xl text-xs text-[#eaeaea]/90 leading-relaxed bg-white/[0.04] border border-white/10"
                                            >
                                                <span className="text-emerald-400 font-bold shrink-0">✓</span>
                                                {item.text}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {modalTrack.challenges.length > 0 && (
                                <div>
                                    <div className="font-mono text-[10px] font-semibold tracking-[2px] uppercase mb-3 text-[#eaeaea]/55">
                                        Partner challenges
                                    </div>
                                    <div className="space-y-3">
                                        {modalTrack.challenges.map((ch) => (
                                            <div
                                                key={ch.key}
                                                className="p-4.5 rounded-xl border border-white/10 bg-white/[0.03] text-sm text-[#eaeaea]/85 leading-7"
                                            >
                                                <div className="font-bold text-white mb-1">{ch.title}</div>
                                                {ch.desc}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={() => {
                                    setActiveModal(null)
                                    handleTrackNavigation(modalTrack)
                                }}
                                className="block w-full rounded-xl px-5 py-3.5 text-xs font-bold uppercase tracking-wider transition-colors bg-[#ffcc00] text-[#1a2634] hover:bg-[#fee5b1] text-center cursor-pointer"
                            >
                                {modalTrack.applyButtonText}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes tcModalIn {
                    from { opacity:0; transform:translateY(12px) scale(0.98); }
                    to   { opacity:1; transform:translateY(0) scale(1); }
                }
            `}</style>
        </section>
    )
}

interface LandingPageProps {
    settings?: any
    partners?: LandingPartner[]
    mentors?: MentorEntry[]
}

const THEME_STORAGE_KEY = 'mesga-landing-theme'

export default function LandingPage({ settings, partners = [], mentors = [] }: LandingPageProps) {
    const companyName = settings?.companyName || 'MESGA'
    const logoUrl = settings?.logo?.url
    const { lang } = useLanguage()
    const t = createT(settings, lang)
    const [pricingLang, setPricingLang] = useState<'en' | 'pl'>('en')
    const [theme, setTheme] = useState<'dark' | 'light'>('dark')

    useEffect(() => {
        setPricingLang(lang)
    }, [lang])

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const saved = window.localStorage.getItem(THEME_STORAGE_KEY)
            if (saved === 'light' || saved === 'dark') {
                setTheme(saved)
            }
        }
    }, [])

    const toggleTheme = () => {
        setTheme((prev) => {
            const next = prev === 'dark' ? 'light' : 'dark'
            if (typeof window !== 'undefined') {
                window.localStorage.setItem(THEME_STORAGE_KEY, next)
            }
            return next
        })
    }

    const isLight = theme === 'light'
    const landing = settings || {}

    const heroTitlePrefix = t('landingHeroTitlePrefix', landing.landingHeroTitlePrefix || '100 Days')
    const heroTitleHighlight = t('landingHeroTitleHighlight', landing.landingHeroTitleHighlight || 'Acceleration OS')
    const heroSubtitle = t(
        'landingHeroSubtitle',
        landing.landingHeroSubtitle ||
            "Built to solve a predictable early-stage failure mode: first-time founders don't fail because they lack information \u2014 they fail because they lack a repeatable execution system.",
    )
    const founderBtn = t('founderLoginBtn', landing.founderLoginBtn || 'Login dla Startup / Founder')
    const investorBtn = t('investorLoginBtn', landing.investorLoginBtn || 'Login dla Inwestora')

    const execTitle = t('execSummaryTitle', landing.execSummaryTitle || 'Executive Summary: Architecture of Success')
    const execSubtitle = t('execSummarySubtitle', landing.execSummarySubtitle || 'From incubation to acceleration \u2014 and now to execution systems.')
    const execBody = t(
        'execSummaryBody',
        landing.execSummaryBody ||
            'The global startup ecosystem has moved away from passive incubation toward intensive, structured accelerators that act as catalysts for human and social capital. MESGA 100 Days OS takes the next step: it operationalizes acceleration as a daily execution OS, replacing \u201ccontent + inspiration\u201d with cadence + proof + gates.',
    )
    const execPoints = landing.execSummaryPoints || [
        { text: 'What top accelerators do best (compressed learning loops)' },
        { text: 'What investors actually need (de-risking + proof trails)' },
        { text: 'What adult learning science confirms (learning-by-doing + feedback + spacing)' },
    ]

    const whatItIsTitle = t('whatItIsTitle', landing.whatItIsTitle || 'What it is')
    const whatItIsBody = t(
        'whatItIsBody',
        landing.whatItIsBody || 'Not a course. Not a bootcamp. It is an operating system for venture execution. Every day has:',
    )
    const whatItIsPoints = landing.whatItIsPoints || [
        { text: 'One mission' },
        { text: 'One deliverable' },
        { text: 'One proof submission' },
        { text: 'Fast review' },
        { text: 'Next-step unlock' },
    ]
    const whatItIsFooter = t('whatItIsFooter', landing.whatItIsFooter || 'No drift. No fluff. No \u201cstorytelling without evidence\u201d.')
    const whoIsThisForTitle = t('landingWhoIsThisForTitle', landing.landingWhoIsThisForTitle || 'Is this for me?')
    const whoIsThisForBody = t(
        'landingWhoIsThisForBody',
        landing.landingWhoIsThisForBody ||
            "MESGA is for first-time founders who want a clear, day-by-day system instead of another course or vague mentorship. You don't need startup jargon — just commitment.",
    )
    const whoIsThisForBullets = landing.landingWhoIsThisForBullets || [
        { text: "You have an idea but aren't sure what to do on Monday morning." },
        { text: 'You already have a startup but lack rhythm and accountability.' },
        { text: 'You want to join a startup team and need structured onboarding.' },
    ]

    const execGapTitle = t('executionGapTitle', landing.executionGapTitle || 'Why we built it (Execution Gap)')
    const execGapBody = t(
        'executionGapBody',
        landing.executionGapBody || 'Europe produces world-class founders and technical talent \u2014 but teams still face predictable friction:',
    )
    const execGapPoints = landing.executionGapPoints || [
        { text: 'Fragmented markets' },
        { text: 'Regulatory complexity' },
        { text: 'Distribution barriers' },
        { text: 'A persistent growth-capital \u201ccommitment gap\u201d' },
    ]
    const execGapQuote = t(
        'executionGapQuote',
        landing.executionGapQuote ||
            "MESGA is designed for this reality: it assumes founders must execute with discipline, collect proof quickly, and build distribution early \u2014 because the environment won\u2019t \u201csolve it for you.\u201d",
    )

    const howItWorksTitle = t('howItWorksTitle', landing.howItWorksTitle || 'How it works: the MESGA OS loop')
    const howItWorksSteps = landing.howItWorksSteps || [
        { step: '01', title: 'Mission', desc: 'Single daily focus' },
        { step: '02', title: 'Deliverable', desc: 'One concrete output' },
        { step: '03', title: 'Proof', desc: 'Artifact link + check' },
        { step: '04', title: 'Review', desc: 'Mentor / IC logic' },
        { step: '05', title: 'Unlock', desc: 'Pass to proceed' },
    ]
    const howItWorksFooter = t(
        'howItWorksFooter',
        landing.howItWorksFooter || 'This creates an auditable execution trail (the thing investors actually trust).',
    )

    const structTitle = t('structureTitle', landing.structureTitle || 'The 100-day structure (3 phases)')
    const defaultPhases = [
        {
            phase: 'Phase 1 — Days 1–30',
            title: 'Validation',
            target: 'Prove the pain is real.',
            description: 'Customer discovery dominates. Evidence first.',
        },
        {
            phase: 'Phase 2 — Days 31–70',
            title: 'Build & Launch',
            target: 'First activation / first transaction.',
            description: 'MVP + instrumentation + live experiments.',
        },
        {
            phase: 'Phase 3 — Days 71–100',
            title: 'Growth & Capital',
            target: 'Unit economics + investor readiness.',
            description: 'GTM system + data room + fundraising workflow.',
        },
    ]
    const phases = landing.phases && landing.phases.length > 0 ? landing.phases : defaultPhases
    const hardGatesTitle = t('hardGatesTitle', landing.hardGatesTitle || 'Hard gates: Days 15 / 30 / 50 / 70 / 94')
    const hardGatesDesc = t('hardGatesDesc', landing.hardGatesDesc || 'Each gate forces a decision: pass / revise / stop.')

    const compEvidenceTitle = t(
        'compEvidenceTitle',
        landing.compEvidenceTitle || 'Comparative evidence: what accelerators optimize for (and where MESGA goes further)',
    )
    const compEvidenceBody = t('compEvidenceBody', landing.compEvidenceBody || 'Modern accelerators share three primitives:')
    const compEvidencePoints = landing.compEvidencePoints || [
        { text: 'Fixed term' },
        { text: 'Cohort dynamics' },
        { text: 'Mentorship + feedback loops' },
    ]
    const compEvidenceFooter = t(
        'compEvidenceFooter',
        landing.compEvidenceFooter ||
            'However, their effectiveness varies dramatically depending on density of support and operational discipline. The success driver for first-time founders is often not the largest network \u2014 it\u2019s support density + operational precision. MESGA is designed to behave like a \u201chigh-density accelerator\u201d by turning mentorship into a scalable daily proof + feedback system.',
    )

    const invTitle = t('investorTitle', landing.investorTitle || 'Investor reality: Angels vs Venture Capital')
    const invIntro = t(
        'investorIntro',
        landing.investorIntro || 'Founders often treat acceleration as an end goal. Investors treat it as a de-risking mechanism.',
    )
    const angelsTitle = t('angelsTitle', landing.angelsTitle || 'What angels look for')
    const angelsPoints = landing.angelsPoints || [
        { text: 'Early validation signals' },
        { text: 'Founder coachability' },
        { text: 'Credible selection filters' },
        { text: 'A deal flow pipeline they can trust' },
    ]
    const vcsTitle = t('vcsTitle', landing.vcsTitle || 'What VCs require (\u201cinvestment readiness\u201d)')
    const vcsPoints = landing.vcsPoints || [
        { text: 'Product + proof' },
        { text: 'Cap table hygiene' },
        { text: 'Repeatable GTM logic' },
        { text: 'Traction metrics and cohort/activation evidence' },
        { text: 'Documentation that survives diligence' },
    ]
    const invFooter = t(
        'investorFooter',
        landing.investorFooter ||
            'MESGA integrates \u201ccorporate hygiene\u201d and \u201ccapital readiness\u201d tasks directly into the OS, so teams leave with an investor-grade proof package, not just a pitch.',
    )

    const sciTitle = t(
        'learningScienceTitle',
        landing.learningScienceTitle || 'Adult learning science: why daily task-based systems work',
    )
    const sciSubtitle = t(
        'learningScienceSubtitle',
        landing.learningScienceSubtitle || 'MESGA is designed to match what is consistently shown to outperform passive education for adults:',
    )
    const sciPoints = landing.learningSciencePoints || [
        { text: 'Learning by doing > consuming content' },
        { text: 'Fast feedback loops outperform delayed workshops' },
        { text: 'Spacing + repetition improve retention and skill transfer' },
        { text: 'Reducing cognitive load helps novices execute' },
        { text: 'Microlearning fits founders\u2019 real time constraints' },
    ]
    const sciFooter = t(
        'learningScienceFooter',
        landing.learningScienceFooter ||
            'Founders operate under constant information overload. A \u201cone task per day\u201d system reduces paralysis and turns progress into a habit.',
    )

    const whyStrongTitle = t('whyStrongTitle', landing.whyStrongTitle || 'Why MESGA is especially strong for first-time founders')
    const whyStrongIntro = t(
        'whyStrongIntro',
        landing.whyStrongIntro || 'A task-based acceleration OS is disproportionately valuable for founders at the start because it:',
    )
    const whyStrongPoints = landing.whyStrongPoints || [
        { text: 'Eliminates decision paralysis (forces the right priority each day)' },
        { text: 'Creates VC-grade credibility (a 100-day evidence trail)' },
        { text: 'Scales support efficiently (standardized review reduces mentor overhead)' },
    ]

    const whatDiffTitle = t('whatDiffTitle', landing.whatDiffTitle || 'What makes it different')
    const whatDiffPoints = landing.whatDiffPoints || [
        { text: 'Daily cadence (not weekly check-ins)' },
        { text: 'Evidence-first submissions (not opinions)' },
        { text: 'Milestone gates that force decisions (not endless iteration)' },
        { text: 'Mentor feedback that scales (standardized, reviewable)' },
        { text: 'Ecosystem map + intro requests built in (distribution starts early)' },
    ]

    const metricsTitle = t('metricsTitle', landing.metricsTitle || 'Core metrics we track (so progress is real)')
    const metricsPoints = landing.metricsPoints || [
        { text: 'Daily evidence completion rate' },
        { text: 'Median mentor review time + SLA hit rate' },
        { text: 'Gate on-time pass rate + revise cycles' },
        { text: 'Customer evidence throughput (with quality proxies)' },
        { text: 'Time-to-MVP + time-to-activation' },
        { text: 'Ecosystem readiness (map completeness and weekly delta)' },
        { text: 'Intro pipeline conversion (requests \u2192 meetings \u2192 follow-ups)' },
        { text: 'Post-program outcomes (pilots, LOIs, revenue, investor meetings)' },
    ]

    const pricing = {
        en: {
            sectionTitle: landing.pricingSectionTitle || 'Pricing & Service',
            serviceName: landing.pricingServiceName || '100 Days Acceleration Program — Platform Access',
            serviceDescription:
                landing.pricingServiceDescription ||
                '100-day acceleration program for founders. Daily mission, deliverable, proof submission, and mentor review.',
            vatInfo: landing.pricingVatInfo || 'gross price (includes 23% VAT)',
            paymentMethods: landing.pricingPaymentMethods || 'Online payment — PayNow (operated by mBank S.A.)',
            activationInfo:
                landing.pricingActivationInfo || 'Program access is activated automatically upon payment confirmation.',
            returnPolicy:
                landing.pricingReturnPolicy || 'Consumers have the right to withdraw within 14 days of contract conclusion.',
            complaintProcedure:
                landing.pricingComplaintProcedure || 'Complaints: support@bakery.vc — response within 14 days.',
            activationLabel: landing.pricingActivationLabel || 'Service Activation',
            returnLabel: landing.pricingReturnLabel || 'Right of Withdrawal',
            complaintLabel: landing.pricingComplaintLabel || 'Complaints',
            individualNote: landing.pricingIndividualNote || 'Price for individual participants.',
            partnerNote:
                landing.pricingPartnerNote ||
                'Different pricing or free access may be available through partner & sponsorship offers.',
            features: landing.pricingFeatures?.length
                ? landing.pricingFeatures
                : [
                    { text: '100-day acceleration program' },
                    { text: 'Daily mission + deliverable + mentor review' },
                    { text: 'Platform & educational materials access' },
                ],
        },
        pl: {
            sectionTitle: landing.pricingSectionTitlePl || 'Oferta i cennik',
            serviceName: landing.pricingServiceNamePl || 'Program 100 Dni — dostęp do platformy akceleracyjnej',
            serviceDescription:
                landing.pricingServiceDescriptionPl ||
                '100-dniowy program akceleracyjny dla founderów. Codzienna misja, deliverable, proof submission i mentor review.',
            vatInfo: landing.pricingVatInfoPl || 'cena brutto (zawiera 23% VAT)',
            paymentMethods: landing.pricingPaymentMethodsPl || 'Płatność online — PayNow (obsługiwana przez mBank S.A.)',
            activationInfo:
                landing.pricingActivationInfoPl ||
                'Dostęp do programu aktywowany jest automatycznie po potwierdzeniu płatności przez system PayNow.',
            returnPolicy:
                landing.pricingReturnPolicyPl ||
                'Konsumentowi przysługuje prawo odstąpienia od umowy w terminie 14 dni od dnia zawarcia umowy, bez podania przyczyny.',
            complaintProcedure:
                landing.pricingComplaintProcedurePl ||
                'Reklamacje można składać drogą elektroniczną na adres: support@bakery.vc. Reklamacje rozpatrywane są w terminie 14 dni.',
            activationLabel: landing.pricingActivationLabelPl || 'Aktywacja usługi',
            returnLabel: landing.pricingReturnLabelPl || 'Prawo odstąpienia',
            complaintLabel: landing.pricingComplaintLabelPl || 'Reklamacje',
            individualNote: landing.pricingIndividualNotePl || 'Cena dla uczestników indywidualnych.',
            partnerNote:
                landing.pricingPartnerNotePl ||
                'Inna cena lub bezpłatny dostęp mogą być dostępne w ramach ofert partnerskich i sponsorskich.',
            features: landing.pricingFeaturesPl?.length
                ? landing.pricingFeaturesPl
                : [
                    { text: '100 dni programu akceleracyjnego' },
                    { text: 'Codzienna misja + deliverable + mentor review' },
                    { text: 'Dostęp do platformy i materiałów edukacyjnych' },
                ],
        },
    }
    const pricingPriceDisplay = landing.pricingPriceDisplay || '1 999,00 PLN'
    const pricingPriceDisplayEur = landing.pricingPriceDisplayEur || '500,00 EUR'

    const addProductToCart = () => {
        if (typeof window === 'undefined') return

        const cartItem = {
            sku: 'mesga-100-days-program',
            name: pricing.pl.serviceName,
            description: pricing.pl.serviceDescription,
            priceDisplay: pricingPriceDisplay,
            quantity: 1,
            addedAt: new Date().toISOString(),
        }

        window.localStorage.setItem('mesga-cart-v1', JSON.stringify(cartItem))
        window.location.assign('/cart')
    }

    return (
        <div
            className={`landing-readable relative min-h-screen overflow-x-hidden font-sans selection:bg-[#ffcc00] selection:text-[#1a2634] transition-colors duration-300 ${
                isLight ? 'landing-theme-light bg-[#eaeaea] text-[#1a2634]' : 'landing-theme-dark bg-[#1a2634] text-[#eaeaea]'
            }`}
        >
            {/* Ambient background depth glows for glassmorphism */}
            <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
                <div
                    className={`absolute -top-32 -left-24 h-[520px] w-[520px] rounded-full blur-[140px] ${
                        isLight ? 'bg-[#203e5f]/12' : 'bg-[#203e5f]/55'
                    }`}
                />
                <div
                    className={`absolute top-[18%] right-[-8%] h-[460px] w-[460px] rounded-full blur-[150px] ${
                        isLight ? 'bg-[#fee5b1]/55' : 'bg-[#38bdf8]/[0.07]'
                    }`}
                />
                <div
                    className={`absolute top-[55%] left-[12%] h-[420px] w-[420px] rounded-full blur-[150px] ${
                        isLight ? 'bg-white/80' : 'bg-[#fee5b1]/[0.05]'
                    }`}
                />
            </div>

            <PublicHeader
                companyName={companyName}
                logoUrl={logoUrl}
                founderButtonText={founderBtn}
                investorButtonText={investorBtn}
                theme={theme}
                onToggleTheme={toggleTheme}
            />

            <main className="relative z-10 max-w-7xl mx-auto px-5 sm:px-10 pt-14 md:pt-24 pb-28">
                {/* ASYMMETRIC EDITORIAL HERO WITH GENEROUS BREATHING ROOM */}
                <section className="mb-36 sm:mb-44">
                    <div className="grid gap-16 lg:grid-cols-12 lg:gap-20 items-center">
                        {/* Left Column: Manifesto & Primary Actions */}
                        <div className="lg:col-span-7">
                            <div
                                className={`inline-flex items-center gap-3 rounded-full border px-4 py-1.5 backdrop-blur-md mb-8 ${
                                    isLight
                                        ? 'border-[#1a2634]/10 bg-white/60 text-[#1a2634]/80'
                                        : 'border-white/10 bg-white/[0.04] text-[#eaeaea]/80'
                                }`}
                            >
                                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                                <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em]">
                                    EUROPEAN VENTURE EXECUTION SYSTEM · COHORT 2026
                                </span>
                            </div>

                            <h1
                                className={`text-4xl sm:text-6xl xl:text-[4.35rem] font-bold tracking-tight mb-8 leading-[1.06] ${
                                    isLight ? 'text-[#1a2634]' : 'text-white'
                                }`}
                            >
                                {companyName} {heroTitlePrefix}
                                <span
                                    className={`block mt-2 ${
                                        isLight
                                            ? 'text-[#203e5f]'
                                            : 'text-transparent bg-clip-text bg-gradient-to-r from-white via-[#eaeaea] to-[#fee5b1]'
                                    }`}
                                >
                                    {heroTitleHighlight}
                                    <span className="text-[#ffcc00]">.</span>
                                </span>
                            </h1>

                            <p
                                className={`text-base sm:text-lg leading-relaxed max-w-xl mb-11 ${
                                    isLight ? 'text-[#1a2634]/75' : 'text-[#eaeaea]/75'
                                }`}
                            >
                                {heroSubtitle}
                            </p>

                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                                <Link
                                    href="/login?role=founder"
                                    className="inline-flex items-center justify-between sm:justify-center gap-4 px-8 py-4 rounded-xl text-sm font-bold uppercase tracking-wider text-[#1a2634] bg-[#ffcc00] hover:bg-[#fee5b1] shadow-lg shadow-[#ffcc00]/10 transition-all"
                                >
                                    <span>{founderBtn}</span>
                                    <span>→</span>
                                </Link>
                                <Link
                                    href="/login?role=investor"
                                    className={`inline-flex items-center justify-between sm:justify-center gap-3 rounded-xl border px-8 py-4 text-sm font-semibold uppercase tracking-wider backdrop-blur-md transition-all ${
                                        isLight
                                            ? 'border-[#1a2634]/15 bg-white/55 text-[#1a2634] hover:bg-white/90'
                                            : 'border-white/15 bg-white/[0.04] text-[#eaeaea] hover:bg-white/[0.09] hover:border-white/25'
                                    }`}
                                >
                                    <span>{investorBtn}</span>
                                </Link>
                            </div>

                            {/* Bottom Specs Row — Clean, Neutral & Airy */}
                            <div
                                className={`mt-16 pt-10 border-t grid grid-cols-3 gap-8 ${
                                    isLight ? 'border-[#1a2634]/10' : 'border-white/10'
                                }`}
                            >
                                <div>
                                    <div className={`font-mono text-2xl sm:text-3xl font-bold ${isLight ? 'text-[#1a2634]' : 'text-white'}`}>
                                        100
                                    </div>
                                    <div className={`text-xs mt-1.5 leading-relaxed ${isLight ? 'text-[#1a2634]/65' : 'text-[#eaeaea]/60'}`}>
                                        Consecutive execution days
                                    </div>
                                </div>
                                <div>
                                    <div className={`font-mono text-2xl sm:text-3xl font-bold ${isLight ? 'text-[#1a2634]' : 'text-white'}`}>
                                        05
                                    </div>
                                    <div className={`text-xs mt-1.5 leading-relaxed ${isLight ? 'text-[#1a2634]/65' : 'text-[#eaeaea]/60'}`}>
                                        Hard decision gates
                                    </div>
                                </div>
                                <div>
                                    <div className={`font-mono text-2xl sm:text-3xl font-bold ${isLight ? 'text-[#1a2634]' : 'text-white'}`}>
                                        24h
                                    </div>
                                    <div className={`text-xs mt-1.5 leading-relaxed ${isLight ? 'text-[#1a2634]/65' : 'text-[#eaeaea]/60'}`}>
                                        Mission &amp; proof cadence
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Translucent Frosted-Glass Operational Dossier */}
                        <div className="lg:col-span-5">
                            <div
                                className={`rounded-2xl border p-7 sm:p-9 backdrop-blur-2xl transition-all ${
                                    isLight
                                        ? 'border-[#1a2634]/10 bg-white/65 text-[#1a2634] shadow-xl shadow-[#1a2634]/[0.05]'
                                        : 'border-white/12 bg-white/[0.035] text-[#eaeaea] shadow-2xl shadow-black/30'
                                }`}
                            >
                                <div
                                    className={`flex items-center justify-between border-b pb-5 mb-6 ${
                                        isLight ? 'border-[#1a2634]/10' : 'border-white/10'
                                    }`}
                                >
                                    <div>
                                        <div className={`font-mono text-[10px] uppercase tracking-[0.2em] ${isLight ? 'text-[#203e5f]/70' : 'text-[#eaeaea]/55'}`}>
                                            OPERATIONAL DOSSIER // LIVE LOG
                                        </div>
                                        <div className={`text-base font-bold mt-1 ${isLight ? 'text-[#1a2634]' : 'text-white'}`}>
                                            100-Day Venture Execution Trail
                                        </div>
                                    </div>
                                    <span
                                        className={`font-mono text-[10px] font-semibold uppercase px-3 py-1 rounded-full border ${
                                            isLight
                                                ? 'bg-emerald-500/10 text-emerald-700 border-emerald-600/20'
                                                : 'bg-emerald-400/10 text-emerald-300 border-emerald-400/25'
                                        }`}
                                    >
                                        AUDIT READY
                                    </span>
                                </div>

                                <div className="space-y-4 font-mono text-xs">
                                    <div
                                        className={`rounded-xl p-4 border-l-2 border-emerald-400 transition-colors ${
                                            isLight ? 'bg-white/75 border border-[#1a2634]/[0.06]' : 'bg-white/[0.035]'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between text-[10px] mb-1.5">
                                            <span className={isLight ? 'text-[#1a2634]/60' : 'text-[#eaeaea]/60'}>DAY 01 — HYPOTHESIS</span>
                                            <span className={isLight ? 'text-emerald-700 font-bold' : 'text-emerald-400 font-bold'}>PASSED ✓</span>
                                        </div>
                                        <div className={`font-sans text-xs leading-relaxed ${isLight ? 'text-[#1a2634]/85' : 'text-[#eaeaea]/85'}`}>
                                            Problem statement + 15 target customer profiles logged in workspace.
                                        </div>
                                    </div>

                                    <div
                                        className={`rounded-xl p-4 border-l-2 border-emerald-400 transition-colors ${
                                            isLight ? 'bg-white/75 border border-[#1a2634]/[0.06]' : 'bg-white/[0.035]'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between text-[10px] mb-1.5">
                                            <span className={isLight ? 'text-[#1a2634]/60' : 'text-[#eaeaea]/60'}>GATE 15 — DISCOVERY AUDIT</span>
                                            <span className={isLight ? 'text-emerald-700 font-bold' : 'text-emerald-400 font-bold'}>CLEARED ✓</span>
                                        </div>
                                        <div className={`font-sans text-xs leading-relaxed ${isLight ? 'text-[#1a2634]/85' : 'text-[#eaeaea]/85'}`}>
                                            Verified interview transcripts &amp; pain quantification reviewed by mentor.
                                        </div>
                                    </div>

                                    <div
                                        className={`rounded-xl p-4 border transition-colors ${
                                            isLight
                                                ? 'bg-[#fee5b1]/35 border-[#203e5f]/15'
                                                : 'bg-white/[0.05] border-[#ffcc00]/30'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between text-[10px] mb-1.5">
                                            <span className={isLight ? 'text-[#1a2634] font-bold' : 'text-[#fee5b1] font-bold'}>
                                                DAY 34 — ACTIVE MISSION
                                            </span>
                                            <span className={isLight ? 'text-[#203e5f] font-bold' : 'text-[#ffcc00] font-bold'}>
                                                IN REVIEW →
                                            </span>
                                        </div>
                                        <div className={`font-sans text-xs leading-relaxed ${isLight ? 'text-[#1a2634]' : 'text-white'}`}>
                                            First commercial wedge &amp; live transaction instrumentation check.
                                        </div>
                                    </div>
                                </div>

                                <div
                                    className={`mt-7 pt-6 border-t ${
                                        isLight ? 'border-[#1a2634]/10' : 'border-white/10'
                                    }`}
                                >
                                    <div className={`flex items-center justify-between font-mono text-[10px] mb-3 ${isLight ? 'text-[#1a2634]/60' : 'text-[#eaeaea]/55'}`}>
                                        <span>HARD GATE SCHEDULE</span>
                                        <span>DAYS 15 · 30 · 50 · 70 · 94</span>
                                    </div>
                                    <div className="grid grid-cols-5 gap-2">
                                        {['G15', 'G30', 'G50', 'G70', 'G94'].map((g, i) => (
                                            <div
                                                key={g}
                                                className={`py-2 text-center font-mono text-[10px] font-semibold rounded-lg border ${
                                                    i < 2
                                                        ? isLight
                                                            ? 'bg-emerald-500/12 border-emerald-600/25 text-emerald-800'
                                                            : 'bg-emerald-400/15 border-emerald-400/30 text-emerald-300'
                                                        : i === 2
                                                          ? isLight
                                                              ? 'bg-[#ffcc00]/25 border-[#1a2634]/20 text-[#1a2634]'
                                                              : 'bg-[#ffcc00]/15 border-[#ffcc00]/35 text-[#fee5b1]'
                                                          : isLight
                                                            ? 'bg-white/50 border-[#1a2634]/10 text-[#1a2634]/50'
                                                            : 'bg-white/[0.03] border-white/10 text-[#eaeaea]/45'
                                                }`}
                                            >
                                                {g}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Tracks Carousel */}
                <TracksCarousel settings={settings} theme={theme} />

                <PartnersShowcase settings={settings} partners={partners} theme={theme} />
                <SocialProofQuotes theme={theme} />
                <EcosystemShowcase partners={partners} rawMentors={mentors} theme={theme} />

                {/* 03 // EXECUTIVE SUMMARY — Editorial Split */}
                <section className={`mb-36 sm:mb-44 border-t pt-20 sm:pt-28 ${isLight ? 'border-[#1a2634]/10' : 'border-white/[0.08]'}`}>
                    <div className="grid gap-14 lg:grid-cols-12 lg:gap-20">
                        <div className="lg:col-span-5">
                            <div className={`font-mono text-xs font-semibold uppercase tracking-[0.22em] mb-4 ${isLight ? 'text-[#203e5f]/70' : 'text-[#eaeaea]/55'}`}>
                                03 // THESIS &amp; ARCHITECTURE
                            </div>
                            <h2 className={`text-3xl sm:text-4xl font-bold leading-tight mb-5 ${isLight ? 'text-[#1a2634]' : 'text-white'}`}>
                                {execTitle}
                            </h2>
                            <p className={`text-base font-medium border-l-2 border-[#ffcc00]/70 pl-4 ${isLight ? 'text-[#203e5f]' : 'text-[#eaeaea]/75'}`}>
                                {execSubtitle}
                            </p>
                        </div>

                        <div className="lg:col-span-7 flex flex-col justify-between">
                            <p className={`text-base sm:text-lg leading-relaxed mb-10 ${isLight ? 'text-[#1a2634]/80' : 'text-[#eaeaea]/80'}`}>
                                {execBody}
                            </p>

                            <div className="space-y-3.5">
                                {execPoints.map((p: any, i: number) => (
                                    <div
                                        key={i}
                                        className={`p-5 rounded-2xl border backdrop-blur-xl flex items-start gap-4 ${
                                            isLight
                                                ? 'border-[#1a2634]/[0.08] bg-white/55'
                                                : 'border-white/[0.08] bg-white/[0.025]'
                                        }`}
                                    >
                                        <span className={`font-mono text-xs font-semibold pt-0.5 ${isLight ? 'text-[#203e5f]/65' : 'text-[#eaeaea]/45'}`}>
                                            /0{i + 1}
                                        </span>
                                        <span className={`text-sm sm:text-base font-medium ${isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'}`}>
                                            {p.text}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* 04 // WHAT IT IS / FOUNDER FIT / EXECUTION GAP — 3 Separate Translucent Glass Cards */}
                <section className={`mb-36 sm:mb-44 border-t pt-20 sm:pt-28 ${isLight ? 'border-[#1a2634]/10' : 'border-white/[0.08]'}`}>
                    <div className="mb-12">
                        <div className={`font-mono text-xs font-semibold uppercase tracking-[0.22em] ${isLight ? 'text-[#203e5f]/70' : 'text-[#eaeaea]/55'}`}>
                            04 // SYSTEM SPECIFICATION
                        </div>
                    </div>

                    <div className="grid gap-8 lg:grid-cols-3 lg:gap-10">
                        {/* Card 1: What it is */}
                        <div
                            className={`rounded-2xl border p-8 sm:p-10 flex flex-col justify-between backdrop-blur-xl ${
                                isLight
                                    ? 'border-[#1a2634]/[0.08] bg-white/60'
                                    : 'border-white/[0.08] bg-white/[0.025]'
                            }`}
                        >
                            <div>
                                <div className={`font-mono text-[11px] font-semibold uppercase tracking-wider mb-3 ${isLight ? 'text-[#203e5f]/70' : 'text-[#eaeaea]/55'}`}>
                                    A. OPERATING MODEL
                                </div>
                                <h3 className={`text-2xl font-bold mb-4 ${isLight ? 'text-[#1a2634]' : 'text-white'}`}>
                                    {whatItIsTitle}
                                </h3>
                                <p className={`text-sm leading-relaxed mb-7 ${isLight ? 'text-[#1a2634]/75' : 'text-[#eaeaea]/70'}`}>
                                    {whatItIsBody}
                                </p>
                                <ul className="space-y-3.5 pl-0 list-none">
                                    {whatItIsPoints.map((p: any, i: number) => (
                                        <li key={i} className="flex items-center gap-3.5 text-sm font-medium">
                                            <span
                                                className={`font-mono text-xs font-semibold px-2.5 py-0.5 rounded-md border ${
                                                    isLight
                                                        ? 'bg-[#1a2634]/[0.05] border-[#1a2634]/10 text-[#1a2634]'
                                                        : 'bg-white/[0.05] border-white/10 text-[#eaeaea]'
                                                }`}
                                            >
                                                {i + 1}
                                            </span>
                                            <span>{p.text}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <p className={`mt-10 pt-5 border-t text-xs font-semibold uppercase tracking-wider ${isLight ? 'border-[#1a2634]/10 text-[#203e5f]' : 'border-white/10 text-[#eaeaea]/65'}`}>
                                {whatItIsFooter}
                            </p>
                        </div>

                        {/* Card 2: Founder Fit */}
                        <div
                            className={`rounded-2xl border p-8 sm:p-10 flex flex-col justify-between backdrop-blur-xl ${
                                isLight
                                    ? 'border-[#1a2634]/12 bg-white/80 shadow-lg shadow-[#1a2634]/[0.03]'
                                    : 'border-white/15 bg-white/[0.05] shadow-xl shadow-black/20'
                            }`}
                        >
                            <div>
                                <div className={`font-mono text-[11px] font-semibold uppercase tracking-wider mb-3 ${isLight ? 'text-[#203e5f]' : 'text-[#fee5b1]'}`}>
                                    B. FOUNDER FIT
                                </div>
                                <h3 className={`text-2xl font-bold mb-4 ${isLight ? 'text-[#1a2634]' : 'text-white'}`}>{whoIsThisForTitle}</h3>
                                <p className={`text-sm leading-relaxed mb-7 ${isLight ? 'text-[#1a2634]/75' : 'text-[#eaeaea]/75'}`}>{whoIsThisForBody}</p>
                                <ul className="space-y-4 pl-0 list-none">
                                    {whoIsThisForBullets.map((point: any, i: number) => (
                                        <li key={i} className={`flex items-start gap-3.5 text-sm ${isLight ? 'text-[#1a2634]/90' : 'text-[#eaeaea]/90'}`}>
                                            <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 bg-[#ffcc00]" />
                                            <span className="leading-relaxed">{point.text}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className={`mt-10 pt-5 border-t font-mono text-[11px] ${isLight ? 'border-[#1a2634]/10 text-[#203e5f]' : 'border-white/10 text-[#fee5b1]/85'}`}>
                                COMMITMENT &gt; CREDENTIALS
                            </div>
                        </div>

                        {/* Card 3: Execution Gap */}
                        <div
                            className={`rounded-2xl border p-8 sm:p-10 flex flex-col justify-between backdrop-blur-xl ${
                                isLight
                                    ? 'border-[#1a2634]/[0.08] bg-white/60'
                                    : 'border-white/[0.08] bg-white/[0.025]'
                            }`}
                        >
                            <div>
                                <div className={`font-mono text-[11px] font-semibold uppercase tracking-wider mb-3 ${isLight ? 'text-[#203e5f]/70' : 'text-[#eaeaea]/55'}`}>
                                    C. EUROPEAN REALITY
                                </div>
                                <h3 className={`text-2xl font-bold mb-4 ${isLight ? 'text-[#1a2634]' : 'text-white'}`}>
                                    {execGapTitle}
                                </h3>
                                <p className={`text-sm leading-relaxed mb-7 ${isLight ? 'text-[#1a2634]/75' : 'text-[#eaeaea]/70'}`}>
                                    {execGapBody}
                                </p>
                                <ul className="space-y-3 pl-0 list-none">
                                    {execGapPoints.map((p: any, i: number) => (
                                        <li key={i} className="flex items-center gap-3 text-sm font-medium">
                                            <span className={`font-mono text-xs ${isLight ? 'text-[#203e5f]/60' : 'text-[#eaeaea]/45'}`}>
                                                —
                                            </span>
                                            <span>{p.text}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <p className={`mt-10 border-l-2 border-[#203e5f]/40 pl-4 text-xs italic leading-relaxed ${isLight ? 'text-[#1a2634]/75' : 'text-[#eaeaea]/70'}`}>
                                {execGapQuote}
                            </p>
                        </div>
                    </div>
                </section>

                {/* 05 // HOW IT WORKS LOOP — 5 Separate Translucent Cards */}
                <section className={`mb-36 sm:mb-44 border-t pt-20 sm:pt-28 ${isLight ? 'border-[#1a2634]/10' : 'border-white/[0.08]'}`}>
                    <div className="flex flex-col md:flex-row md:items-end justify-between mb-14 gap-6">
                        <div>
                            <div className={`font-mono text-xs font-semibold uppercase tracking-[0.22em] mb-4 ${isLight ? 'text-[#203e5f]/70' : 'text-[#eaeaea]/55'}`}>
                                05 // DAILY PROTOCOL
                            </div>
                            <h2 className={`text-3xl sm:text-4xl font-bold tracking-tight ${isLight ? 'text-[#1a2634]' : 'text-white'}`}>
                                {howItWorksTitle}
                            </h2>
                        </div>
                        <p className={`text-sm font-medium max-w-md ${isLight ? 'text-[#1a2634]/70' : 'text-[#eaeaea]/65'}`}>
                            {howItWorksFooter}
                        </p>
                    </div>

                    <div className="grid gap-5 sm:grid-cols-5">
                        {howItWorksSteps.map((s: any, i: number) => (
                            <div
                                key={i}
                                className={`rounded-2xl border p-7 flex flex-col justify-between min-h-[180px] backdrop-blur-xl transition-all ${
                                    isLight
                                        ? 'border-[#1a2634]/[0.08] bg-white/60 hover:bg-white/85'
                                        : 'border-white/[0.08] bg-white/[0.025] hover:bg-white/[0.045]'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className={`font-mono text-xs font-semibold ${isLight ? 'text-[#203e5f]/65' : 'text-[#eaeaea]/50'}`}>
                                        0{i + 1}
                                    </span>
                                    <span className={`font-mono text-xs opacity-35 ${isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'}`}>
                                        →
                                    </span>
                                </div>
                                <div className="mt-8">
                                    <h4 className={`text-xl font-bold mb-1.5 ${isLight ? 'text-[#1a2634]' : 'text-white'}`}>
                                        {s.title}
                                    </h4>
                                    <p className={`text-xs m-0 leading-relaxed ${isLight ? 'text-[#1a2634]/70' : 'text-[#eaeaea]/65'}`}>
                                        {s.desc}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* 06 // THE 100-DAY STRUCTURE (3 PHASES) */}
                <section className={`mb-36 sm:mb-44 border-t pt-20 sm:pt-28 ${isLight ? 'border-[#1a2634]/10' : 'border-white/[0.08]'}`}>
                    <div className="grid gap-10 lg:grid-cols-12 mb-14 items-end">
                        <div className="lg:col-span-6">
                            <div className={`font-mono text-xs font-semibold uppercase tracking-[0.22em] mb-4 ${isLight ? 'text-[#203e5f]/70' : 'text-[#eaeaea]/55'}`}>
                                06 // PROGRAMME TIMELINE
                            </div>
                            <h2 className={`text-3xl sm:text-4xl font-bold tracking-tight ${isLight ? 'text-[#1a2634]' : 'text-white'}`}>
                                {structTitle}
                            </h2>
                        </div>
                        <div className="lg:col-span-6">
                            <div
                                className={`rounded-2xl border px-6 py-5 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                    isLight
                                        ? 'border-[#1a2634]/10 bg-white/60 text-[#1a2634]'
                                        : 'border-white/10 bg-white/[0.03] text-[#eaeaea]'
                                }`}
                            >
                                <span className="font-mono text-xs font-bold uppercase tracking-wider">
                                    {hardGatesTitle}
                                </span>
                                <span className={`text-xs ${isLight ? 'text-[#203e5f]' : 'text-[#eaeaea]/65'}`}>{hardGatesDesc}</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8 lg:gap-10">
                        {phases.map((p: any, i: number) => {
                            let targetText = p.target || ''
                            let descText = p.description || ''
                            if (!targetText && descText) {
                                const match = descText.match(/^Target:\s*(.+?)\.\s*(.+)$/)
                                if (match) {
                                    targetText = match[1] + '.'
                                    descText = match[2]
                                }
                            }
                            return (
                                <div
                                    key={i}
                                    className={`rounded-2xl border p-8 sm:p-10 flex flex-col justify-between backdrop-blur-xl ${
                                        isLight
                                            ? 'bg-white/60 border-[#1a2634]/[0.08]'
                                            : 'bg-white/[0.025] border-white/[0.08]'
                                    }`}
                                >
                                    <div>
                                        <div className="flex items-center justify-between mb-5">
                                            <span className={`font-mono text-xs font-semibold uppercase tracking-wider ${isLight ? 'text-[#203e5f]/75' : 'text-[#eaeaea]/60'}`}>
                                                {p.phase}
                                            </span>
                                            <span
                                                className={`font-mono text-xs font-semibold px-2.5 py-0.5 rounded-md border ${
                                                    isLight
                                                        ? 'bg-white/80 border-[#1a2634]/10 text-[#1a2634]/70'
                                                        : 'bg-white/[0.04] border-white/10 text-[#eaeaea]/70'
                                                }`}
                                            >
                                                P0{i + 1}
                                            </span>
                                        </div>
                                        <h3 className={`text-2xl font-bold mb-6 ${isLight ? 'text-[#1a2634]' : 'text-white'}`}>
                                            {p.title}
                                        </h3>
                                        {targetText && (
                                            <div
                                                className={`rounded-xl p-4 mb-6 border ${
                                                    isLight
                                                        ? 'bg-white/70 border-[#1a2634]/[0.06]'
                                                        : 'bg-white/[0.03] border-white/[0.06]'
                                                }`}
                                            >
                                                <span className={`font-mono text-[10px] uppercase tracking-wider block mb-1 ${isLight ? 'text-[#203e5f]/70' : 'text-[#eaeaea]/50'}`}>
                                                    Primary Objective
                                                </span>
                                                <span className={`text-sm font-bold ${isLight ? 'text-[#1a2634]' : 'text-white'}`}>
                                                    {targetText}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <p className={`text-sm m-0 leading-relaxed ${isLight ? 'text-[#1a2634]/75' : 'text-[#eaeaea]/70'}`}>
                                        {descText}
                                    </p>
                                </div>
                            )
                        })}
                    </div>
                </section>

                {/* 07 // INVESTOR REALITY & COMPARATIVE EVIDENCE */}
                <section className={`mb-36 sm:mb-44 border-t pt-20 sm:pt-28 ${isLight ? 'border-[#1a2634]/10' : 'border-white/[0.08]'}`}>
                    <div className="grid gap-14 lg:grid-cols-12 lg:gap-16">
                        {/* Left Column: Comparative Evidence */}
                        <div className="lg:col-span-5 flex flex-col justify-between">
                            <div>
                                <div className={`font-mono text-xs font-semibold uppercase tracking-[0.22em] mb-4 ${isLight ? 'text-[#203e5f]/70' : 'text-[#eaeaea]/55'}`}>
                                    07 // CAPITAL DE-RISKING
                                </div>
                                <h2 className={`text-2xl sm:text-3xl font-bold leading-tight mb-5 ${isLight ? 'text-[#1a2634]' : 'text-white'}`}>
                                    {compEvidenceTitle}
                                </h2>
                                <p className={`text-sm mb-5 ${isLight ? 'text-[#1a2634]/75' : 'text-[#eaeaea]/70'}`}>
                                    {compEvidenceBody}
                                </p>
                                <div className="flex flex-wrap gap-2.5 mb-7">
                                    {compEvidencePoints.map((p: any, i: number) => (
                                        <span
                                            key={i}
                                            className={`font-mono text-xs font-semibold px-3.5 py-1.5 rounded-lg border backdrop-blur-md ${
                                                isLight
                                                    ? 'border-[#1a2634]/10 bg-white/65 text-[#1a2634]'
                                                    : 'border-white/10 bg-white/[0.04] text-[#eaeaea]'
                                            }`}
                                        >
                                            {p.text}
                                        </span>
                                    ))}
                                </div>
                                <p className={`text-sm leading-relaxed ${isLight ? 'text-[#1a2634]/75' : 'text-[#eaeaea]/75'}`}>
                                    {compEvidenceFooter}
                                </p>
                            </div>

                            <div
                                className={`mt-10 rounded-2xl p-7 border backdrop-blur-xl ${
                                    isLight
                                        ? 'bg-white/65 border-[#1a2634]/10 text-[#1a2634]'
                                        : 'bg-white/[0.03] border-white/10 text-[#eaeaea]'
                                }`}
                            >
                                <div className={`font-mono text-[10px] font-semibold uppercase tracking-widest mb-2 ${isLight ? 'text-[#203e5f]' : 'text-[#fee5b1]'}`}>
                                    INVESTOR OUTCOME
                                </div>
                                <p className={`text-sm leading-relaxed m-0 ${isLight ? 'text-[#1a2634]/85' : 'text-[#eaeaea]/85'}`}>
                                    {invFooter}
                                </p>
                            </div>
                        </div>

                        {/* Right Column: Angels vs VCs */}
                        <div className="lg:col-span-7">
                            <div
                                className={`rounded-2xl border p-8 sm:p-11 h-full flex flex-col justify-between backdrop-blur-xl ${
                                    isLight ? 'border-[#1a2634]/[0.08] bg-white/60' : 'border-white/[0.08] bg-white/[0.025]'
                                }`}
                            >
                                <div>
                                    <h3 className={`text-2xl sm:text-3xl font-bold mb-3 ${isLight ? 'text-[#1a2634]' : 'text-white'}`}>
                                        {invTitle}
                                    </h3>
                                    <p className={`text-sm italic mb-10 ${isLight ? 'text-[#1a2634]/70' : 'text-[#eaeaea]/65'}`}>
                                        {invIntro}
                                    </p>

                                    <div className="grid sm:grid-cols-2 gap-10">
                                        <div>
                                            <div
                                                className={`font-mono text-xs font-semibold uppercase tracking-wider inline-block px-3 py-1 rounded-lg border mb-5 ${
                                                    isLight
                                                        ? 'bg-white/80 border-[#1a2634]/10 text-[#203e5f]'
                                                        : 'bg-white/[0.05] border-white/10 text-[#eaeaea]/80'
                                                }`}
                                            >
                                                01 / BUSINESS ANGELS
                                            </div>
                                            <h4 className={`text-lg font-bold mb-4 ${isLight ? 'text-[#1a2634]' : 'text-white'}`}>
                                                {angelsTitle}
                                            </h4>
                                            <ul className="space-y-3.5 pl-0 list-none">
                                                {angelsPoints.map((p: any, i: number) => (
                                                    <li key={i} className="flex items-start gap-3 text-sm">
                                                        <span className={isLight ? 'text-[#203e5f]/60' : 'text-[#eaeaea]/45'}>—</span>
                                                        <span className={isLight ? 'text-[#1a2634]/80' : 'text-[#eaeaea]/80'}>{p.text}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>

                                        <div>
                                            <div
                                                className={`font-mono text-xs font-semibold uppercase tracking-wider inline-block px-3 py-1 rounded-lg border mb-5 ${
                                                    isLight
                                                        ? 'bg-emerald-500/10 border-emerald-600/20 text-emerald-800'
                                                        : 'bg-emerald-400/10 border-emerald-400/25 text-emerald-300'
                                                }`}
                                            >
                                                02 / VENTURE CAPITAL
                                            </div>
                                            <h4 className={`text-lg font-bold mb-4 ${isLight ? 'text-[#1a2634]' : 'text-white'}`}>
                                                {vcsTitle}
                                            </h4>
                                            <ul className="space-y-3.5 pl-0 list-none">
                                                {vcsPoints.map((p: any, i: number) => (
                                                    <li key={i} className="flex items-start gap-3 text-sm">
                                                        <span className={isLight ? 'text-emerald-700 font-bold' : 'text-emerald-400 font-bold'}>✓</span>
                                                        <span className={isLight ? 'text-[#1a2634] font-medium' : 'text-[#eaeaea]/90'}>{p.text}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 08 // LEARNING SCIENCE, WHY STRONG & METRICS — Editorial Ledger */}
                <section className={`mb-36 sm:mb-44 border-t pt-20 sm:pt-28 ${isLight ? 'border-[#1a2634]/10' : 'border-white/[0.08]'}`}>
                    <div className="grid gap-14 lg:grid-cols-12 lg:gap-16 mb-20">
                        <div className="lg:col-span-6">
                            <div className={`font-mono text-xs font-semibold uppercase tracking-[0.22em] mb-4 ${isLight ? 'text-[#203e5f]/70' : 'text-[#eaeaea]/55'}`}>
                                08 // METHODOLOGY &amp; METRICS
                            </div>
                            <h2 className={`text-2xl sm:text-3xl font-bold mb-4 ${isLight ? 'text-[#1a2634]' : 'text-white'}`}>
                                {sciTitle}
                            </h2>
                            <p className={`text-sm mb-8 ${isLight ? 'text-[#1a2634]/75' : 'text-[#eaeaea]/70'}`}>
                                {sciSubtitle}
                            </p>
                            <div className={`divide-y border-t border-b ${isLight ? 'divide-[#1a2634]/10 border-[#1a2634]/10' : 'divide-white/10 border-white/10'}`}>
                                {sciPoints.map((p: any, i: number) => (
                                    <div key={i} className="py-4 flex items-center justify-between gap-4 text-sm font-medium">
                                        <span>{p.text}</span>
                                        <span className={`font-mono text-xs ${isLight ? 'text-[#1a2634]/45' : 'text-[#eaeaea]/45'}`}>
                                            0{i + 1}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <p className={`mt-6 text-xs italic ${isLight ? 'text-[#1a2634]/70' : 'text-[#eaeaea]/60'}`}>
                                {sciFooter}
                            </p>
                        </div>

                        <div className="lg:col-span-6 flex flex-col justify-between gap-10">
                            <div>
                                <h3 className={`text-xl font-bold mb-3 ${isLight ? 'text-[#1a2634]' : 'text-white'}`}>
                                    {whyStrongTitle}
                                </h3>
                                <p className={`text-sm mb-5 ${isLight ? 'text-[#1a2634]/75' : 'text-[#eaeaea]/70'}`}>
                                    {whyStrongIntro}
                                </p>
                                <div className="space-y-3.5">
                                    {whyStrongPoints.map((p: any, i: number) => (
                                        <div
                                            key={i}
                                            className={`p-5 rounded-2xl border backdrop-blur-xl flex items-start gap-3.5 text-sm font-medium ${
                                                isLight
                                                    ? 'bg-white/60 border-[#1a2634]/[0.08] text-[#1a2634]'
                                                    : 'bg-white/[0.025] border-white/[0.08] text-[#eaeaea]'
                                            }`}
                                        >
                                            <span
                                                className={`font-mono text-xs font-semibold px-2.5 py-0.5 rounded-md border ${
                                                    isLight
                                                        ? 'bg-white border-[#1a2634]/10 text-[#203e5f]'
                                                        : 'bg-white/[0.05] border-white/10 text-[#eaeaea]/75'
                                                }`}
                                            >
                                                0{i + 1}
                                            </span>
                                            <span>{p.text}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h3 className={`text-xl font-bold mb-4 ${isLight ? 'text-[#1a2634]' : 'text-white'}`}>
                                    {whatDiffTitle}
                                </h3>
                                <div className="flex flex-wrap gap-2.5">
                                    {whatDiffPoints.map((p: any, i: number) => (
                                        <div
                                            key={i}
                                            className={`px-4 py-2 rounded-xl border text-xs font-semibold backdrop-blur-md ${
                                                isLight
                                                    ? 'bg-white/65 border-[#1a2634]/10 text-[#1a2634]'
                                                    : 'bg-white/[0.04] border-white/10 text-[#eaeaea]/85'
                                            }`}
                                        >
                                            {p.text}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Core Metrics Grid */}
                    <div
                        className={`rounded-2xl border p-8 sm:p-11 backdrop-blur-xl ${
                            isLight ? 'border-[#1a2634]/[0.08] bg-white/55' : 'border-white/[0.08] bg-white/[0.02]'
                        }`}
                    >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-8 pb-5 border-b border-current/10">
                            <h3 className={`text-2xl font-bold m-0 ${isLight ? 'text-[#1a2634]' : 'text-white'}`}>
                                {metricsTitle}
                            </h3>
                            <span className={`font-mono text-xs font-semibold uppercase ${isLight ? 'text-[#203e5f]/70' : 'text-[#eaeaea]/55'}`}>
                                8 TELEMETRY INDICATORS
                            </span>
                        </div>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
                            {metricsPoints.map((p: any, i: number) => (
                                <div
                                    key={i}
                                    className={`p-5 rounded-xl border flex flex-col justify-between backdrop-blur-md ${
                                        isLight
                                            ? 'border-[#1a2634]/[0.08] bg-white/70 text-[#1a2634]'
                                            : 'border-white/[0.08] bg-white/[0.03] text-[#eaeaea]'
                                    }`}
                                >
                                    <span className={`font-mono text-[10px] font-semibold mb-2.5 ${isLight ? 'text-[#203e5f]/65' : 'text-[#eaeaea]/45'}`}>
                                        KPI / 0{i + 1}
                                    </span>
                                    <span className="text-sm font-medium leading-snug">{p.text}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <FaqSection settings={settings} theme={theme} />

                {/* 10 // PRICING & LEGAL — Required for PayNow / Polish e-commerce compliance */}
                <section id="pricing" className={`mb-20 border-t pt-20 sm:pt-28 ${isLight ? 'border-[#1a2634]/10' : 'border-white/[0.08]'}`}>
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-12 gap-6">
                        <div>
                            <div className={`font-mono text-xs font-semibold uppercase tracking-[0.22em] mb-3 ${isLight ? 'text-[#203e5f]/70' : 'text-[#eaeaea]/55'}`}>
                                10 // COMMERCIAL TERMS &amp; ACCESS
                            </div>
                            <h2 className={`text-3xl sm:text-4xl font-bold m-0 ${isLight ? 'text-[#1a2634]' : 'text-white'}`}>
                                {pricing[pricingLang].sectionTitle}
                            </h2>
                        </div>
                        <div
                            className={`inline-flex self-start items-center gap-1 border rounded-xl p-1 backdrop-blur-md ${
                                isLight ? 'bg-white/60 border-[#1a2634]/12' : 'bg-white/[0.04] border-white/12'
                            }`}
                        >
                            <button
                                onClick={() => setPricingLang('en')}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                                    pricingLang === 'en'
                                        ? isLight
                                            ? 'bg-[#1a2634] text-white'
                                            : 'bg-white/15 text-white'
                                        : isLight
                                          ? 'text-[#1a2634]/65 hover:text-[#1a2634]'
                                          : 'text-[#eaeaea]/65 hover:text-white'
                                }`}
                            >
                                EN (EUR)
                            </button>
                            <button
                                onClick={() => setPricingLang('pl')}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                                    pricingLang === 'pl'
                                        ? isLight
                                            ? 'bg-[#1a2634] text-white'
                                            : 'bg-white/15 text-white'
                                        : isLight
                                          ? 'text-[#1a2634]/65 hover:text-[#1a2634]'
                                          : 'text-[#eaeaea]/65 hover:text-white'
                                }`}
                            >
                                PL (PLN)
                            </button>
                        </div>
                    </div>

                    <div
                        className={`rounded-2xl border overflow-hidden backdrop-blur-2xl ${
                            isLight
                                ? 'bg-white/65 border-[#1a2634]/10 shadow-xl shadow-[#1a2634]/[0.04]'
                                : 'bg-white/[0.025] border-white/10 shadow-2xl shadow-black/25'
                        }`}
                    >
                        <div className={`grid lg:grid-cols-12 border-b ${isLight ? 'border-[#1a2634]/10' : 'border-white/10'}`}>
                            <div className="lg:col-span-7 p-8 sm:p-12 flex flex-col justify-between">
                                <div>
                                    <div
                                        className={`font-mono text-xs font-semibold uppercase tracking-wider inline-block px-3.5 py-1 rounded-lg border mb-5 ${
                                            isLight
                                                ? 'bg-white/80 border-[#1a2634]/10 text-[#203e5f]'
                                                : 'bg-white/[0.05] border-white/10 text-[#fee5b1]'
                                        }`}
                                    >
                                        FULL 100-DAY COHORT LICENSE
                                    </div>
                                    <h3 className={`text-2xl sm:text-3xl font-bold mb-4 ${isLight ? 'text-[#1a2634]' : 'text-white'}`}>
                                        {pricing[pricingLang].serviceName}
                                    </h3>
                                    <p className={`text-sm sm:text-base leading-relaxed mb-8 max-w-xl ${isLight ? 'text-[#1a2634]/75' : 'text-[#eaeaea]/70'}`}>
                                        {pricing[pricingLang].serviceDescription}
                                    </p>
                                    <ul className="space-y-3.5 pl-0 list-none">
                                        {pricing[pricingLang].features.map((f: any, i: number) => (
                                            <li
                                                key={i}
                                                className={`flex items-center gap-3.5 text-sm font-medium ${
                                                    isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'
                                                }`}
                                            >
                                                <span className={isLight ? 'text-emerald-700 font-bold' : 'text-emerald-400 font-bold'}>✓</span>
                                                <span>{f.text}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div className={`mt-10 pt-6 border-t space-y-1.5 ${isLight ? 'border-[#1a2634]/10' : 'border-white/10'}`}>
                                    <p className={`text-xs ${isLight ? 'text-[#1a2634]/70' : 'text-[#eaeaea]/65'}`}>
                                        {pricing[pricingLang].individualNote}
                                    </p>
                                    <p className={`text-xs font-semibold ${isLight ? 'text-[#203e5f]' : 'text-[#eaeaea]/85'}`}>
                                        {pricing[pricingLang].partnerNote}
                                    </p>
                                </div>
                            </div>

                            <div
                                className={`lg:col-span-5 p-8 sm:p-12 flex flex-col justify-between border-t lg:border-t-0 lg:border-l backdrop-blur-xl ${
                                    isLight
                                        ? 'bg-white/55 border-[#1a2634]/10 text-[#1a2634]'
                                        : 'bg-white/[0.03] border-white/10 text-[#eaeaea]'
                                }`}
                            >
                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <span className={`font-mono text-xs uppercase tracking-wider ${isLight ? 'text-[#1a2634]/60' : 'text-[#eaeaea]/60'}`}>
                                            ONE-TIME FEE
                                        </span>
                                        {logoUrl && (
                                            <img src={logoUrl} alt={companyName} className="h-7 object-contain" />
                                        )}
                                    </div>
                                    <div className={`font-mono text-4xl sm:text-5xl font-bold ${isLight ? 'text-[#1a2634]' : 'text-white'}`}>
                                        {pricingLang === 'en' ? pricingPriceDisplayEur : pricingPriceDisplay}
                                    </div>
                                    <div className={`text-xs mt-1.5 ${isLight ? 'text-[#1a2634]/65' : 'text-[#eaeaea]/60'}`}>
                                        {pricing[pricingLang].vatInfo}
                                    </div>

                                    <div className="mt-8 grid gap-3">
                                        <button
                                            onClick={addProductToCart}
                                            className="w-full rounded-xl px-5 py-4 text-xs font-bold uppercase tracking-wider text-[#1a2634] bg-[#ffcc00] hover:bg-[#fee5b1] transition-colors cursor-pointer"
                                        >
                                            {pricingLang === 'pl' ? 'Dodaj do koszyka →' : 'Add to cart →'}
                                        </button>
                                        <Link
                                            href="/cart"
                                            className={`w-full rounded-xl px-5 py-3.5 text-xs font-semibold uppercase tracking-wider border transition-colors text-center ${
                                                isLight
                                                    ? 'border-[#1a2634]/15 bg-white/60 text-[#1a2634] hover:bg-white'
                                                    : 'border-white/15 bg-white/[0.04] text-[#eaeaea] hover:bg-white/[0.09]'
                                            }`}
                                        >
                                            {pricingLang === 'pl' ? 'Zobacz koszyk' : 'View cart'}
                                        </Link>
                                    </div>
                                </div>

                                <div className={`mt-10 pt-6 border-t ${isLight ? 'border-[#1a2634]/10' : 'border-white/10'}`}>
                                    <div className={`text-[11px] ${isLight ? 'text-[#1a2634]/70' : 'text-[#eaeaea]/65'}`}>
                                        {pricing[pricingLang].paymentMethods}
                                    </div>
                                    <p className={`text-[11px] mt-1 ${isLight ? 'text-[#1a2634]/55' : 'text-[#eaeaea]/50'}`}>
                                        {pricingLang === 'pl'
                                            ? 'Podmiotem świadczącym obsługę płatności online w zakresie płatności kartami jest Autopay S.A.'
                                            : 'Card payments are handled online by Autopay S.A.'}
                                    </p>
                                    <img
                                        src="/paynow/banner-payment-methods.png"
                                        alt="Paynow, BLIK, Visa, Mastercard and Google Pay payment methods"
                                        className={`mt-3.5 w-full h-auto rounded-xl border ${isLight ? 'border-[#1a2634]/10' : 'border-white/10'}`}
                                    />
                                    <div className="mt-3.5 flex items-center gap-3">
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
                            </div>
                        </div>

                        {/* Legal info grid */}
                        <div
                            className={`grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x ${
                                isLight ? 'divide-[#1a2634]/10 bg-white/40' : 'divide-white/10 bg-white/[0.015]'
                            }`}
                        >
                            <div className="p-7 sm:p-8">
                                <h4 className={`font-mono text-xs font-semibold uppercase tracking-wider mb-2 ${isLight ? 'text-[#1a2634]' : 'text-white'}`}>
                                    {pricing[pricingLang].activationLabel}
                                </h4>
                                <p className={`text-xs leading-relaxed m-0 ${isLight ? 'text-[#1a2634]/70' : 'text-[#eaeaea]/65'}`}>
                                    {pricing[pricingLang].activationInfo}
                                </p>
                            </div>
                            <div className="p-7 sm:p-8">
                                <h4 className={`font-mono text-xs font-semibold uppercase tracking-wider mb-2 ${isLight ? 'text-[#1a2634]' : 'text-white'}`}>
                                    {pricing[pricingLang].returnLabel}
                                </h4>
                                <p className={`text-xs leading-relaxed m-0 ${isLight ? 'text-[#1a2634]/70' : 'text-[#eaeaea]/65'}`}>
                                    {pricing[pricingLang].returnPolicy}
                                </p>
                            </div>
                            <div className="p-7 sm:p-8">
                                <h4 className={`font-mono text-xs font-semibold uppercase tracking-wider mb-2 ${isLight ? 'text-[#1a2634]' : 'text-white'}`}>
                                    {pricing[pricingLang].complaintLabel}
                                </h4>
                                <p className={`text-xs leading-relaxed m-0 ${isLight ? 'text-[#1a2634]/70' : 'text-[#eaeaea]/65'}`}>
                                    {pricing[pricingLang].complaintProcedure}
                                </p>
                            </div>
                        </div>

                        {/* Terms link footer */}
                        {(() => {
                            const termsLink = resolveLocalizedLegalDocument(
                                landing?.footer?.legalLinks?.termsOfUse,
                                pricingLang,
                                pricingLang === 'pl' ? 'Warunki korzystania' : 'Terms of Use',
                            )
                            const text = pricingLang === 'pl' ? <>Pełna treść warunków dostępna w: </> : <>Full terms available in: </>
                            return (
                                <div className={`px-8 py-4 border-t text-left flex items-center justify-between ${isLight ? 'border-[#1a2634]/10' : 'border-white/10'}`}>
                                    <p className={`text-[11px] m-0 ${isLight ? 'text-[#1a2634]/70' : 'text-[#eaeaea]/60'}`}>
                                        {text}
                                        {termsLink.href ? (
                                            <a
                                                href={termsLink.href}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={`font-bold underline underline-offset-2 transition-colors ${
                                                    isLight ? 'text-[#1a2634] hover:text-[#203e5f]' : 'text-white hover:text-[#fee5b1]'
                                                }`}
                                            >
                                                {termsLink.label}
                                            </a>
                                        ) : (
                                            <span className="font-semibold">{termsLink.label}</span>
                                        )}
                                    </p>
                                    <span className={`font-mono text-[10px] ${isLight ? 'text-[#1a2634]/45' : 'text-[#eaeaea]/40'}`}>
                                        MESGA // PAYNOW COMPLIANT
                                    </span>
                                </div>
                            )
                        })()}
                    </div>
                </section>
            </main>

            <SiteFooter settings={settings} companyName={companyName} variant="full" theme={theme} />
        </div>
    )
}
