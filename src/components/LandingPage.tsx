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

// Tymczasowi partnerzy pokazywani w kafelku tracku gdy żaden nie jest przypisany w CMS.
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
        color: '#ffcc00',
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
        color: '#203e5f',
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

const mentorAvatarFrameClass = 'mb-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-[#ffcc00]/35 bg-[#1a2634]'
const mentorLogoFrameClass = 'mb-4 flex h-16 w-28 items-center justify-center overflow-hidden rounded-lg border border-[#ffcc00]/35 bg-[#1a2634] px-3 py-2'

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
        <section className={`mb-24 border-t-2 pt-12 ${isLight ? 'border-[#1a2634]' : 'border-[#eaeaea]/20'}`}>
            <div className="grid gap-10 lg:grid-cols-12 mb-10">
                <div className="lg:col-span-5">
                    <div className={`font-mono text-xs font-bold uppercase tracking-[0.2em] mb-3 ${isLight ? 'text-[#203e5f]' : 'text-[#ffcc00]'}`}>
                        // {sectionLabel}
                    </div>
                    <h2 className={`text-3xl font-bold leading-tight ${isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'}`}>
                        {sectionTitle}
                    </h2>
                </div>
                <div className="lg:col-span-7 flex items-end">
                    <p className={`text-base leading-relaxed max-w-2xl ${isLight ? 'text-[#203e5f]' : 'text-[#eaeaea]/75'}`}>
                        {sectionSubtitle}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {partners.map((partner) =>
                    partner.websiteUrl ? (
                        <a
                            key={partner.id}
                            href={partner.websiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`group relative flex min-h-28 items-center justify-center overflow-hidden rounded-lg border px-5 py-4 transition-all duration-200 ${
                                isLight
                                    ? 'border-[#1a2634]/15 bg-[#1a2634] hover:border-[#ffcc00]'
                                    : 'border-[#eaeaea]/15 bg-[#203e5f]/40 hover:border-[#ffcc00] hover:bg-[#203e5f]/70'
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
                            className="flex min-h-28 items-center justify-center overflow-hidden rounded-lg border border-[#eaeaea]/15 bg-[#1a2634] px-5 py-4"
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
        <section className={`mb-24 border-t-2 pt-12 ${isLight ? 'border-[#1a2634]' : 'border-[#eaeaea]/20'}`}>
            <div className="grid gap-10 lg:grid-cols-12">
                <div className="lg:col-span-5">
                    <div className={`font-mono text-xs font-bold uppercase tracking-[0.2em] mb-3 ${isLight ? 'text-[#203e5f]' : 'text-[#ffcc00]'}`}>
                        02 // FIELD PERSPECTIVE
                    </div>
                    <h2 className={`text-3xl font-bold leading-tight mb-4 ${isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'}`}>
                        Backed by founders, operators, and ecosystem partners who care about execution clarity.
                    </h2>
                    <p className={`text-sm leading-relaxed ${isLight ? 'text-[#203e5f]' : 'text-[#eaeaea]/70'}`}>
                        MESGA is designed with people who see the same pattern repeatedly: early founders do better when the next action is explicit, visible, and reviewable.
                    </p>
                </div>

                <div className="lg:col-span-7 grid gap-4 sm:grid-cols-3">
                    {DEFAULT_SOCIAL_PROOF_QUOTES.map((item, idx) => (
                        <div
                            key={item.role}
                            className={`flex flex-col justify-between border-l-2 border-[#ffcc00] pl-5 py-2 ${
                                isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'
                            }`}
                        >
                            <div>
                                <div className={`font-mono text-[11px] font-bold mb-3 ${isLight ? 'text-[#203e5f]' : 'text-[#fee5b1]'}`}>
                                    0{idx + 1}
                                </div>
                                <p className={`text-sm leading-relaxed font-medium ${isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]/90'}`}>
                                    “{item.quote}”
                                </p>
                            </div>
                            <div
                                className={`mt-6 font-mono text-[11px] font-bold uppercase tracking-wider ${
                                    isLight ? 'text-[#203e5f]' : 'text-[#ffcc00]'
                                }`}
                            >
                                — {item.role}
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
        <section className="mb-24">
            {hasMentors && (
                <div>
                    <div className="mb-6 flex items-center gap-4">
                        <span
                            className={`font-mono text-xs font-bold uppercase tracking-[0.2em] ${
                                isLight ? 'text-[#203e5f]' : 'text-[#ffcc00]'
                            }`}
                        >
                            // Ecosystem Mentors
                        </span>
                        <div className={`h-px flex-1 ${isLight ? 'bg-[#1a2634]/15' : 'bg-[#eaeaea]/15'}`} />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                                            <span className="text-lg font-bold text-[#ffcc00]">{initials}</span>
                                        )}
                                    </div>
                                    <div className={`text-base font-bold leading-snug ${isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'}`}>
                                        {mentor.name}
                                    </div>
                                    {mentor.partnerName && (
                                        <div
                                            className={`mt-1 font-mono text-[10px] font-bold uppercase tracking-wider ${
                                                isLight ? 'text-[#203e5f]' : 'text-[#fee5b1]'
                                            }`}
                                        >
                                            {mentor.partnerName}
                                        </div>
                                    )}
                                </>
                            )
                            const className = `group block rounded-lg border p-6 text-left transition-all duration-200 ${
                                isLight
                                    ? 'border-[#1a2634]/15 bg-white hover:border-[#1a2634]'
                                    : 'border-[#eaeaea]/15 bg-[#203e5f]/35 hover:border-[#ffcc00]'
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
}: {
    partners: LandingPartner[]
    accentColor: string
    isPlaceholder?: boolean
    trackMentors?: MentorEntry[]
}) {
    const tiles = isPlaceholder ? partners : getTrackPartnerTiles(partners)
    const mentors = getLandingMentors(trackMentors)

    if (tiles.length === 0 && mentors.length === 0) return null

    const singlePartner = tiles.length === 1

    return (
        <div className="flex flex-col border-t border-[#eaeaea]/12 pt-4 mt-2">
            <div className="flex items-center gap-2 mb-2.5">
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#fee5b1]">Partners</span>
                {isPlaceholder && (
                    <span className="font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded bg-[#1a2634] border border-[#eaeaea]/15 text-[#eaeaea]/60">
                        coming soon
                    </span>
                )}
            </div>
            {singlePartner ? (
                <div className="w-full max-w-[190px]">
                    <TrackPartnerTile partner={tiles[0]} accentColor={accentColor} size="single" />
                </div>
            ) : (
                <TrackPartnerCarousel partners={tiles} accentColor={accentColor} />
            )}
            {mentors.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                    {mentors.map((m, idx) => (
                        <div key={m.id ?? idx} className="inline-flex items-center gap-2 rounded-lg border border-[#eaeaea]/15 bg-[#1a2634] px-2.5 py-1.5">
                            {m.logoUrl && <img src={m.logoUrl} alt={m.name} className="max-h-8 w-full object-contain" />}
                            <span className="text-[11px] font-semibold text-[#eaeaea]">{m.name}</span>
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
}: {
    partner: LandingPartner
    accentColor: string
    size: 'single' | 'carousel'
}) {
    const isSingle = size === 'single'
    const tileClasses = isSingle
        ? 'group block rounded-xl border border-[#eaeaea]/15 bg-[#1a2634]/80 p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#ffcc00]/50 hover:bg-[#1a2634]'
        : 'group block'
    const content = (
        <>
            <div
                className={`flex items-center justify-center overflow-hidden rounded-lg border border-[#eaeaea]/10 bg-[#1a2634] ${isSingle ? 'min-h-[56px] px-3 py-2' : 'min-h-[72px] px-3 py-3'}`}
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
            <div className={`text-center font-semibold text-[#eaeaea] ${isSingle ? 'mt-1.5 text-[11px] leading-tight' : 'mt-2 text-[11px] leading-snug'}`}>
                {partner.name}
            </div>
            <div
                className={`mx-auto h-px ${isSingle ? 'mt-1.5 w-14' : 'mt-2 w-12'}`}
                style={{ background: `linear-gradient(90deg, transparent, ${accentColor}99, transparent)` }}
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

function TrackPartnerCarousel({ partners, accentColor }: { partners: LandingPartner[]; accentColor: string }) {
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
        <div className="relative w-full max-w-[190px] rounded-xl border border-[#eaeaea]/15 bg-[#1a2634]/80 p-2.5 overflow-hidden">
            <div className="relative" style={{ minHeight: '112px' }}>
                {partners.map((partner, index) => (
                    <div
                        key={partner.id}
                        className="absolute inset-0 transition-opacity duration-700"
                        style={{ opacity: index === visibleIndex ? 1 : 0 }}
                    >
                        <TrackPartnerTile partner={partner} accentColor={accentColor} size="carousel" />
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
            className={`h-full w-full rounded-xl border-2 border-dashed flex flex-col justify-between p-8 min-h-[400px] transition-colors ${
                isLight
                    ? 'border-[#1a2634]/25 bg-white/60 text-[#1a2634]'
                    : 'border-[#eaeaea]/20 bg-[#203e5f]/20 text-[#eaeaea]'
            }`}
        >
            <div>
                <div className="font-mono text-xs font-bold uppercase tracking-widest text-[#ffcc00] bg-[#1a2634] inline-block px-2.5 py-1 rounded mb-4">
                    + EXPANSION LANE
                </div>
                <div className="text-2xl font-bold mb-2">{newTrackLabel}</div>
                <div className={`text-sm leading-relaxed max-w-xs ${isLight ? 'text-[#203e5f]' : 'text-[#eaeaea]/70'}`}>
                    {newTrackSubtitle}
                </div>
            </div>
            <a
                href={`mailto:${newTrackEmail}`}
                className="inline-flex w-fit items-center gap-2 rounded-lg bg-[#1a2634] px-5 py-3 text-xs font-bold uppercase tracking-wider text-[#ffcc00] hover:bg-[#203e5f] transition-colors"
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
    onSelectPill,
    onOpenDetails,
    onStartTrack,
    onGraphicError,
}: TrackCardProps) {
    const realPartners = getTrackPartnerTiles(trackPartners)
    const isPlaceholder = realPartners.length === 0
    const renderablePartners = isPlaceholder ? PLACEHOLDER_TRACK_PARTNERS : realPartners

    return (
        <div className="h-full w-full flex flex-col rounded-xl border border-[#eaeaea]/15 bg-[#1a2634] text-[#eaeaea] overflow-hidden shadow-xl">
            <div className="h-1 w-full bg-[#ffcc00]" />

            <div className="px-6 pt-6 pb-5 flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
                <div className="flex-1 flex flex-col">
                    <div className="flex items-center justify-between gap-3 mb-3">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#ffcc00] bg-[#203e5f] px-2.5 py-1 rounded">
                            {track.badge}
                        </span>
                        <span className="font-mono text-xs font-bold text-[#fee5b1]/60">{track.icon}</span>
                    </div>
                    <h3 className="text-2xl font-bold text-[#eaeaea] mb-1 tracking-tight">{track.name}</h3>
                    <div className="text-xs text-[#fee5b1] mb-4">{track.tagline}</div>

                    {renderablePartners.length > 0 && (
                        <TrackPartnerTiles partners={renderablePartners} accentColor="#ffcc00" isPlaceholder={isPlaceholder} />
                    )}
                </div>

                {hasGraphic && (
                    <div className="hidden lg:flex shrink-0 w-[180px] xl:w-[200px] items-start justify-end">
                        <div className="relative w-full overflow-hidden rounded-lg border border-[#eaeaea]/15">
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

            <div className="mx-6 h-px bg-[#eaeaea]/10" />

            <div className="px-6 pt-5 pb-6 flex flex-col flex-1">
                <p className="text-sm text-[#eaeaea]/80 leading-relaxed mb-5">{track.desc}</p>

                <div className="font-mono text-[10px] font-bold tracking-[0.2em] uppercase text-[#fee5b1]/75 mb-2">
                    {challengeTypeLabel}
                </div>
                <div className="flex flex-wrap gap-1.5 mb-4">
                    {pills.map((pill) => {
                        const active = activePillKey === pill.key
                        return (
                            <button
                                key={pill.key}
                                onClick={() => onSelectPill(pill.key)}
                                className={`text-[11px] font-bold px-3 py-1 rounded transition-colors cursor-pointer border ${
                                    active
                                        ? 'border-[#ffcc00] bg-[#ffcc00] text-[#1a2634]'
                                        : 'border-[#eaeaea]/15 bg-[#203e5f]/40 text-[#eaeaea]/75 hover:border-[#fee5b1]/40'
                                }`}
                            >
                                {pill.label}
                            </button>
                        )
                    })}
                </div>

                <div className="rounded-lg p-4 mb-6 bg-[#203e5f]/45 border-l-2 border-[#ffcc00] text-sm text-[#eaeaea]/90 leading-relaxed min-h-[88px]">
                    <span className="font-bold text-[#ffcc00]">{challenge.title}: </span>
                    {challenge.desc}
                </div>

                <div className="mt-auto grid sm:grid-cols-2 gap-2.5">
                    <button
                        onClick={onOpenDetails}
                        className="w-full rounded-lg px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors border border-[#eaeaea]/20 bg-transparent text-[#eaeaea] hover:border-[#fee5b1] hover:text-[#fee5b1] cursor-pointer"
                    >
                        {viewDetailsBtn}
                    </button>
                    <button
                        onClick={onStartTrack}
                        className="w-full rounded-lg px-4 py-2.5 text-xs font-extrabold uppercase tracking-wider text-[#1a2634] bg-[#ffcc00] hover:bg-[#fee5b1] transition-colors cursor-pointer"
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
            .map((tr: any) => ({
                key: tr.key || '',
                icon: tr.icon || '01',
                name: tr.name || '',
                enabled: tr.enabled !== false,
                badge: (tr.badge || '').replace(/^(Beta Cohort)/i, 'EUSPA Beta Cohort'),
                tagline: tr.tagline || '',
                desc: tr.desc || '',
                color: tr.color || '#ffcc00',
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
            }))
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
        <section id="tracks" className={`mb-24 border-t-2 pt-12 ${isLight ? 'border-[#1a2634]' : 'border-[#eaeaea]/20'}`}>
            {/* Left-aligned asymmetric header */}
            <div className="grid gap-8 lg:grid-cols-12 mb-10 items-end">
                <div className="lg:col-span-7">
                    <div className={`font-mono text-xs font-bold uppercase tracking-[0.2em] mb-3 ${isLight ? 'text-[#203e5f]' : 'text-[#ffcc00]'}`}>
                        01 // {sectionLabel}
                    </div>
                    <h2 className={`text-3xl sm:text-5xl font-bold leading-[1.08] tracking-tight ${isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'}`}>
                        {sectionTitle}{' '}
                        <span className={isLight ? 'text-[#203e5f]' : 'text-[#fee5b1]'}>
                            {sectionHighlight}
                        </span>
                    </h2>
                </div>
                <div className="lg:col-span-5 flex flex-col justify-between gap-4">
                    <p className={`text-sm leading-relaxed ${isLight ? 'text-[#203e5f]' : 'text-[#eaeaea]/75'}`}>
                        {sectionSubtitle}
                    </p>
                    <div className="hidden md:flex items-center gap-2">
                        <button
                            onClick={prevSlide}
                            className={`h-10 w-10 flex items-center justify-center rounded-lg border transition-colors cursor-pointer ${
                                isLight
                                    ? 'border-[#1a2634]/25 bg-white text-[#1a2634] hover:bg-[#1a2634] hover:text-[#ffcc00]'
                                    : 'border-[#eaeaea]/20 bg-[#203e5f]/50 text-[#eaeaea] hover:border-[#ffcc00] hover:text-[#ffcc00]'
                            }`}
                            aria-label="Previous tracks"
                        >
                            ←
                        </button>
                        <button
                            onClick={nextSlide}
                            className={`h-10 w-10 flex items-center justify-center rounded-lg border transition-colors cursor-pointer ${
                                isLight
                                    ? 'border-[#1a2634]/25 bg-white text-[#1a2634] hover:bg-[#1a2634] hover:text-[#ffcc00]'
                                    : 'border-[#eaeaea]/20 bg-[#203e5f]/50 text-[#eaeaea] hover:border-[#ffcc00] hover:text-[#ffcc00]'
                            }`}
                            aria-label="Next tracks"
                        >
                            →
                        </button>
                        <span className={`ml-3 font-mono text-xs ${isLight ? 'text-[#203e5f]' : 'text-[#eaeaea]/60'}`}>
                            {String(activeIndex + 1).padStart(2, '0')} / {String(totalSlides).padStart(2, '0')}
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-5 md:hidden">
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

            <div className="relative min-h-[460px] hidden items-center md:flex">
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
                                    <div key={track.key} className="flex-none pr-6" style={{ width: cardWidth ? `${cardWidth}px` : '62%' }}>
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
                                            onSelectPill={(pillKey) => setActivePill((prev) => ({ ...prev, [track.key]: pillKey }))}
                                            onOpenDetails={() => setActiveModal(track.key)}
                                            onStartTrack={() => handleTrackNavigation(track)}
                                            onGraphicError={() => setHiddenGraphics((prev) => ({ ...prev, [track.key]: true }))}
                                        />
                                    </div>
                                )
                            }

                            return (
                                <div key={`new-track-${itemIndex}`} className="flex-none pr-6" style={{ width: cardWidth ? `${cardWidth}px` : '62%' }}>
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
                    style={{ background: 'rgba(26,38,52,0.85)', backdropFilter: 'blur(6px)' }}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setActiveModal(null)
                    }}
                >
                    <div
                        className="relative bg-[#1a2634] border border-[#eaeaea]/20 rounded-xl w-full max-w-2xl max-h-[88vh] overflow-y-auto text-[#eaeaea] shadow-2xl"
                        style={{ animation: 'tcModalIn 0.2s ease' }}
                    >
                        <div className="h-1 bg-[#ffcc00]" />

                        <div className="flex items-start justify-between px-8 pt-7 pb-5">
                            <div>
                                <div className="font-mono text-xs text-[#ffcc00] mb-1">{modalTrack.badge}</div>
                                <div className="text-2xl font-bold text-[#eaeaea]">{modalTrack.name}</div>
                                <div className="text-xs text-[#fee5b1] mt-1">{modalTrack.tagline}</div>
                            </div>
                            <button
                                onClick={() => setActiveModal(null)}
                                className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-[#eaeaea]/75 hover:text-[#ffcc00] transition-colors cursor-pointer border border-[#eaeaea]/20 hover:border-[#ffcc00] bg-transparent ml-4"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="mx-8 h-px bg-[#eaeaea]/12 mb-6" />

                        <div className="px-8 pb-8 space-y-7">
                            <div>
                                <div className="font-mono text-[10px] font-bold tracking-[2px] uppercase mb-2 text-[#ffcc00]">
                                    About this track
                                </div>
                                <p className="text-sm text-[#eaeaea]/85 leading-7">{modalTrack.desc}</p>
                            </div>

                            {getTrackPartnerTiles(modalTrackPartners).length > 0 && (
                                <div>
                                    <div className="font-mono text-[10px] font-bold tracking-[2px] uppercase mb-3 text-[#ffcc00]">
                                        Partners
                                    </div>
                                    <TrackPartnerTiles partners={modalTrackPartners} accentColor="#ffcc00" />
                                </div>
                            )}

                            {modalTrack.whatYouGet.length > 0 && (
                                <div>
                                    <div className="font-mono text-[10px] font-bold tracking-[2px] uppercase mb-3 text-[#ffcc00]">
                                        What you get
                                    </div>
                                    <div className="grid sm:grid-cols-2 gap-2.5">
                                        {modalTrack.whatYouGet.map((item, i) => (
                                            <div
                                                key={i}
                                                className="flex items-start gap-2.5 p-3.5 rounded-lg text-xs text-[#eaeaea]/90 leading-relaxed bg-[#203e5f]/50 border border-[#eaeaea]/10"
                                            >
                                                <span className="text-[#ffcc00] font-bold shrink-0">—</span>
                                                {item.text}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {modalTrack.challenges.length > 0 && (
                                <div>
                                    <div className="font-mono text-[10px] font-bold tracking-[2px] uppercase mb-3 text-[#ffcc00]">
                                        Partner challenges
                                    </div>
                                    <div className="space-y-2.5">
                                        {modalTrack.challenges.map((ch) => (
                                            <div
                                                key={ch.key}
                                                className="p-4 rounded-lg border border-[#eaeaea]/12 bg-[#203e5f]/35 text-sm text-[#eaeaea]/85 leading-7"
                                            >
                                                <div className="font-bold text-[#ffcc00] mb-1">{ch.title}</div>
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
                                className="block w-full rounded-lg px-5 py-3.5 text-xs font-extrabold uppercase tracking-wider transition-colors bg-[#ffcc00] text-[#1a2634] hover:bg-[#fee5b1] text-center cursor-pointer"
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
            className={`landing-readable relative min-h-screen font-sans selection:bg-[#ffcc00] selection:text-[#1a2634] transition-colors duration-200 ${
                isLight ? 'landing-theme-light bg-[#eaeaea] text-[#1a2634]' : 'landing-theme-dark bg-[#1a2634] text-[#eaeaea]'
            }`}
        >
            <PublicHeader
                companyName={companyName}
                logoUrl={logoUrl}
                founderButtonText={founderBtn}
                investorButtonText={investorBtn}
                theme={theme}
                onToggleTheme={toggleTheme}
            />

            <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 pt-10 md:pt-16 pb-24">
                {/* ASYMMETRIC EDITORIAL HERO */}
                <section className="mb-24">
                    <div className="grid gap-12 lg:grid-cols-12 items-start">
                        {/* Left Column: Manifesto & Primary Actions */}
                        <div className="lg:col-span-7 pt-2">
                            <div className="inline-flex items-center gap-3 mb-6">
                                <span className="h-px w-8 bg-[#ffcc00]" />
                                <span
                                    className={`font-mono text-xs font-bold uppercase tracking-[0.22em] ${
                                        isLight ? 'text-[#203e5f]' : 'text-[#ffcc00]'
                                    }`}
                                >
                                    MAKE EUROPEAN STARTUPS GREAT AGAIN
                                </span>
                            </div>

                            <h1
                                className={`text-4xl sm:text-6xl xl:text-[4.25rem] font-bold tracking-tight mb-6 leading-[1.03] ${
                                    isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'
                                }`}
                            >
                                {companyName} {heroTitlePrefix}
                                <span
                                    className={`block mt-1 ${
                                        isLight ? 'text-[#203e5f]' : 'text-[#ffcc00]'
                                    }`}
                                >
                                    {heroTitleHighlight}.
                                </span>
                            </h1>

                            <p
                                className={`text-base sm:text-lg leading-relaxed max-w-xl mb-9 ${
                                    isLight ? 'text-[#203e5f]' : 'text-[#eaeaea]/80'
                                }`}
                            >
                                {heroSubtitle}
                            </p>

                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
                                <Link
                                    href="/login?role=founder"
                                    className="inline-flex items-center justify-between sm:justify-center gap-4 px-7 py-4 rounded-lg text-sm font-extrabold uppercase tracking-wider text-[#1a2634] bg-[#ffcc00] hover:bg-[#fee5b1] transition-colors"
                                >
                                    <span>{founderBtn}</span>
                                    <span>→</span>
                                </Link>
                                <Link
                                    href="/login?role=investor"
                                    className={`inline-flex items-center justify-between sm:justify-center gap-3 rounded-lg border px-7 py-4 text-sm font-bold uppercase tracking-wider transition-colors ${
                                        isLight
                                            ? 'border-[#1a2634] text-[#1a2634] hover:bg-[#1a2634] hover:text-[#eaeaea]'
                                            : 'border-[#eaeaea]/25 text-[#eaeaea] hover:border-[#fee5b1] hover:text-[#fee5b1]'
                                    }`}
                                >
                                    <span>{investorBtn}</span>
                                </Link>
                            </div>

                            {/* Bottom Specs Row */}
                            <div
                                className={`mt-12 pt-8 border-t grid grid-cols-3 gap-6 ${
                                    isLight ? 'border-[#1a2634]/15' : 'border-[#eaeaea]/15'
                                }`}
                            >
                                <div>
                                    <div className={`font-mono text-2xl sm:text-3xl font-bold ${isLight ? 'text-[#1a2634]' : 'text-[#ffcc00]'}`}>
                                        100
                                    </div>
                                    <div className={`text-xs mt-1 ${isLight ? 'text-[#203e5f]' : 'text-[#eaeaea]/65'}`}>
                                        Consecutive execution days
                                    </div>
                                </div>
                                <div>
                                    <div className={`font-mono text-2xl sm:text-3xl font-bold ${isLight ? 'text-[#1a2634]' : 'text-[#ffcc00]'}`}>
                                        05
                                    </div>
                                    <div className={`text-xs mt-1 ${isLight ? 'text-[#203e5f]' : 'text-[#eaeaea]/65'}`}>
                                        Hard decision gates
                                    </div>
                                </div>
                                <div>
                                    <div className={`font-mono text-2xl sm:text-3xl font-bold ${isLight ? 'text-[#1a2634]' : 'text-[#ffcc00]'}`}>
                                        24h
                                    </div>
                                    <div className={`text-xs mt-1 ${isLight ? 'text-[#203e5f]' : 'text-[#eaeaea]/65'}`}>
                                        Mission &amp; proof cadence
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Live Execution Trail Dossier Mockup */}
                        <div className="lg:col-span-5">
                            <div className="rounded-xl border border-[#eaeaea]/15 bg-[#1a2634] text-[#eaeaea] p-6 sm:p-7 shadow-2xl">
                                <div className="flex items-center justify-between border-b border-[#eaeaea]/12 pb-4 mb-5">
                                    <div>
                                        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#ffcc00]">
                                            OPERATIONAL DOSSIER // LIVE LOG
                                        </div>
                                        <div className="text-base font-bold text-[#eaeaea] mt-0.5">
                                            100-Day Venture Execution Trail
                                        </div>
                                    </div>
                                    <span className="font-mono text-[10px] font-bold uppercase px-2.5 py-1 rounded bg-[#203e5f] text-[#fee5b1] border border-[#ffcc00]/30">
                                        AUDIT READY
                                    </span>
                                </div>

                                <div className="space-y-3 font-mono text-xs">
                                    <div className="rounded-lg bg-[#203e5f]/55 p-3.5 border-l-2 border-[#ffcc00]">
                                        <div className="flex items-center justify-between text-[10px] text-[#fee5b1] mb-1">
                                            <span>DAY 01 — HYPOTHESIS</span>
                                            <span className="text-[#ffcc00] font-bold">PASSED ✓</span>
                                        </div>
                                        <div className="font-sans text-xs text-[#eaeaea]/90">
                                            Problem statement + 15 target customer profiles logged in workspace.
                                        </div>
                                    </div>

                                    <div className="rounded-lg bg-[#203e5f]/55 p-3.5 border-l-2 border-[#ffcc00]">
                                        <div className="flex items-center justify-between text-[10px] text-[#fee5b1] mb-1">
                                            <span>GATE 15 — DISCOVERY AUDIT</span>
                                            <span className="text-[#ffcc00] font-bold">CLEARED ✓</span>
                                        </div>
                                        <div className="font-sans text-xs text-[#eaeaea]/90">
                                            Verified interview transcripts &amp; pain quantification reviewed by mentor.
                                        </div>
                                    </div>

                                    <div className="rounded-lg bg-[#203e5f]/35 p-3.5 border border-[#ffcc00]/40">
                                        <div className="flex items-center justify-between text-[10px] text-[#ffcc00] mb-1">
                                            <span>DAY 34 — ACTIVE MISSION</span>
                                            <span>IN REVIEW →</span>
                                        </div>
                                        <div className="font-sans text-xs text-[#eaeaea]">
                                            First commercial wedge &amp; live transaction instrumentation check.
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-6 pt-5 border-t border-[#eaeaea]/12">
                                    <div className="flex items-center justify-between font-mono text-[10px] text-[#fee5b1] mb-2">
                                        <span>HARD GATE SCHEDULE</span>
                                        <span>DAYS 15 · 30 · 50 · 70 · 94</span>
                                    </div>
                                    <div className="grid grid-cols-5 gap-1.5">
                                        {['G15', 'G30', 'G50', 'G70', 'G94'].map((g, i) => (
                                            <div
                                                key={g}
                                                className={`py-1.5 text-center font-mono text-[10px] font-bold rounded ${
                                                    i < 2
                                                        ? 'bg-[#ffcc00] text-[#1a2634]'
                                                        : 'bg-[#203e5f] text-[#eaeaea]/70 border border-[#eaeaea]/10'
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
                <section className={`mb-24 border-t-2 pt-12 ${isLight ? 'border-[#1a2634]' : 'border-[#eaeaea]/20'}`}>
                    <div className="grid gap-10 lg:grid-cols-12">
                        <div className="lg:col-span-5">
                            <div className={`font-mono text-xs font-bold uppercase tracking-[0.2em] mb-3 ${isLight ? 'text-[#203e5f]' : 'text-[#ffcc00]'}`}>
                                03 // THESIS &amp; ARCHITECTURE
                            </div>
                            <h2 className={`text-3xl sm:text-4xl font-bold leading-tight mb-4 ${isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'}`}>
                                {execTitle}
                            </h2>
                            <p className={`text-base font-semibold border-l-2 border-[#ffcc00] pl-4 ${isLight ? 'text-[#203e5f]' : 'text-[#fee5b1]'}`}>
                                {execSubtitle}
                            </p>
                        </div>

                        <div className="lg:col-span-7 flex flex-col justify-between">
                            <p className={`text-base sm:text-lg leading-relaxed mb-8 ${isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]/85'}`}>
                                {execBody}
                            </p>

                            <div className={`divide-y border-t border-b ${isLight ? 'divide-[#1a2634]/15 border-[#1a2634]/15' : 'divide-[#eaeaea]/12 border-[#eaeaea]/12'}`}>
                                {execPoints.map((p: any, i: number) => (
                                    <div key={i} className="py-4 flex items-start gap-4">
                                        <span className={`font-mono text-xs font-bold pt-0.5 ${isLight ? 'text-[#203e5f]' : 'text-[#ffcc00]'}`}>
                                            0{i + 1}
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

                {/* 04 // WHAT IT IS / FOUNDER FIT / EXECUTION GAP — Asymmetric 3-Column Swiss Grid */}
                <section className={`mb-24 border-t-2 pt-12 ${isLight ? 'border-[#1a2634]' : 'border-[#eaeaea]/20'}`}>
                    <div className="mb-8">
                        <div className={`font-mono text-xs font-bold uppercase tracking-[0.2em] ${isLight ? 'text-[#203e5f]' : 'text-[#ffcc00]'}`}>
                            04 // SYSTEM SPECIFICATION
                        </div>
                    </div>

                    <div
                        className={`grid lg:grid-cols-12 border rounded-xl overflow-hidden ${
                            isLight ? 'border-[#1a2634]/20 bg-white' : 'border-[#eaeaea]/15 bg-[#203e5f]/25'
                        }`}
                    >
                        {/* Col 1: What it is */}
                        <div className={`lg:col-span-4 p-7 sm:p-9 flex flex-col justify-between border-b lg:border-b-0 lg:border-r ${isLight ? 'border-[#1a2634]/15' : 'border-[#eaeaea]/12'}`}>
                            <div>
                                <div className={`font-mono text-[11px] font-bold uppercase tracking-wider mb-2 ${isLight ? 'text-[#203e5f]' : 'text-[#fee5b1]'}`}>
                                    A. OPERATING MODEL
                                </div>
                                <h3 className={`text-2xl font-bold mb-3 ${isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'}`}>
                                    {whatItIsTitle}
                                </h3>
                                <p className={`text-sm leading-relaxed mb-6 ${isLight ? 'text-[#203e5f]' : 'text-[#eaeaea]/75'}`}>
                                    {whatItIsBody}
                                </p>
                                <ul className="space-y-3 pl-0 list-none">
                                    {whatItIsPoints.map((p: any, i: number) => (
                                        <li key={i} className="flex items-center gap-3 text-sm font-semibold">
                                            <span className="font-mono text-xs font-bold text-[#ffcc00] bg-[#1a2634] px-2 py-0.5 rounded">
                                                {i + 1}
                                            </span>
                                            <span>{p.text}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <p className={`mt-8 pt-4 border-t text-xs font-bold uppercase tracking-wider ${isLight ? 'border-[#1a2634]/15 text-[#1a2634]' : 'border-[#eaeaea]/12 text-[#ffcc00]'}`}>
                                {whatItIsFooter}
                            </p>
                        </div>

                        {/* Col 2: Founder Fit (High Contrast Navy Panel) */}
                        <div className="lg:col-span-4 p-7 sm:p-9 bg-[#1a2634] text-[#eaeaea] flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-[#eaeaea]/12">
                            <div>
                                <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#ffcc00] mb-2">
                                    B. FOUNDER FIT
                                </div>
                                <h3 className="text-2xl font-bold mb-3 text-[#eaeaea]">{whoIsThisForTitle}</h3>
                                <p className="text-sm text-[#eaeaea]/75 leading-relaxed mb-6">{whoIsThisForBody}</p>
                                <ul className="space-y-4 pl-0 list-none">
                                    {whoIsThisForBullets.map((point: any, i: number) => (
                                        <li key={i} className="flex items-start gap-3 text-sm text-[#eaeaea]/90">
                                            <span className="mt-1 h-2 w-2 shrink-0 bg-[#ffcc00]" />
                                            <span className="leading-relaxed">{point.text}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="mt-8 pt-4 border-t border-[#eaeaea]/12 font-mono text-[11px] text-[#fee5b1]">
                                COMMITMENT &gt; CREDENTIALS
                            </div>
                        </div>

                        {/* Col 3: Execution Gap */}
                        <div className="lg:col-span-4 p-7 sm:p-9 flex flex-col justify-between">
                            <div>
                                <div className={`font-mono text-[11px] font-bold uppercase tracking-wider mb-2 ${isLight ? 'text-[#203e5f]' : 'text-[#fee5b1]'}`}>
                                    C. EUROPEAN REALITY
                                </div>
                                <h3 className={`text-2xl font-bold mb-3 ${isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'}`}>
                                    {execGapTitle}
                                </h3>
                                <p className={`text-sm leading-relaxed mb-6 ${isLight ? 'text-[#203e5f]' : 'text-[#eaeaea]/75'}`}>
                                    {execGapBody}
                                </p>
                                <ul className="space-y-2.5 pl-0 list-none">
                                    {execGapPoints.map((p: any, i: number) => (
                                        <li key={i} className="flex items-center gap-3 text-sm font-medium">
                                            <span className={`font-mono text-xs font-bold ${isLight ? 'text-[#203e5f]' : 'text-[#ffcc00]'}`}>
                                                —
                                            </span>
                                            <span>{p.text}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <p className={`mt-8 border-l-2 border-[#ffcc00] pl-3.5 text-xs italic leading-relaxed ${isLight ? 'text-[#203e5f]' : 'text-[#fee5b1]'}`}>
                                {execGapQuote}
                            </p>
                        </div>
                    </div>
                </section>

                {/* 05 // HOW IT WORKS LOOP — Horizontal Pipeline Table */}
                <section className={`mb-24 border-t-2 pt-12 ${isLight ? 'border-[#1a2634]' : 'border-[#eaeaea]/20'}`}>
                    <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
                        <div>
                            <div className={`font-mono text-xs font-bold uppercase tracking-[0.2em] mb-3 ${isLight ? 'text-[#203e5f]' : 'text-[#ffcc00]'}`}>
                                05 // DAILY PROTOCOL
                            </div>
                            <h2 className={`text-3xl sm:text-4xl font-bold tracking-tight ${isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'}`}>
                                {howItWorksTitle}
                            </h2>
                        </div>
                        <p className={`text-sm font-medium max-w-md ${isLight ? 'text-[#203e5f]' : 'text-[#fee5b1]'}`}>
                            {howItWorksFooter}
                        </p>
                    </div>

                    <div
                        className={`grid sm:grid-cols-5 border rounded-xl overflow-hidden divide-y sm:divide-y-0 sm:divide-x ${
                            isLight
                                ? 'border-[#1a2634]/20 divide-[#1a2634]/15 bg-white'
                                : 'border-[#eaeaea]/15 divide-[#eaeaea]/12 bg-[#203e5f]/30'
                        }`}
                    >
                        {howItWorksSteps.map((s: any, i: number) => (
                            <div key={i} className="p-6 flex flex-col justify-between min-h-[160px]">
                                <div className="flex items-center justify-between">
                                    <span className={`font-mono text-xs font-bold ${isLight ? 'text-[#203e5f]' : 'text-[#ffcc00]'}`}>
                                        STEP {String(i + 1).padStart(2, '0')}
                                    </span>
                                    <span className={`font-mono text-xs opacity-40 ${isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'}`}>
                                        →
                                    </span>
                                </div>
                                <div className="mt-6">
                                    <h4 className={`text-xl font-bold mb-1 ${isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'}`}>
                                        {s.title}
                                    </h4>
                                    <p className={`text-xs m-0 leading-relaxed ${isLight ? 'text-[#203e5f]' : 'text-[#eaeaea]/70'}`}>
                                        {s.desc}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* 06 // THE 100-DAY STRUCTURE (3 PHASES) */}
                <section className={`mb-24 border-t-2 pt-12 ${isLight ? 'border-[#1a2634]' : 'border-[#eaeaea]/20'}`}>
                    <div className="grid gap-10 lg:grid-cols-12 mb-10 items-end">
                        <div className="lg:col-span-6">
                            <div className={`font-mono text-xs font-bold uppercase tracking-[0.2em] mb-3 ${isLight ? 'text-[#203e5f]' : 'text-[#ffcc00]'}`}>
                                06 // PROGRAMME TIMELINE
                            </div>
                            <h2 className={`text-3xl sm:text-4xl font-bold tracking-tight ${isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'}`}>
                                {structTitle}
                            </h2>
                        </div>
                        <div className="lg:col-span-6">
                            <div className="rounded-lg bg-[#1a2634] border-l-4 border-[#ffcc00] px-5 py-4 text-[#eaeaea] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <span className="font-mono text-xs font-bold text-[#ffcc00] uppercase tracking-wider">
                                    {hardGatesTitle}
                                </span>
                                <span className="text-xs text-[#fee5b1]">{hardGatesDesc}</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6">
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
                                    className={`rounded-xl border p-7 flex flex-col justify-between ${
                                        isLight
                                            ? 'bg-white border-[#1a2634]/20'
                                            : 'bg-[#203e5f]/35 border-[#eaeaea]/15'
                                    }`}
                                >
                                    <div>
                                        <div className="flex items-center justify-between mb-4">
                                            <span className={`font-mono text-xs font-bold uppercase tracking-wider ${isLight ? 'text-[#203e5f]' : 'text-[#ffcc00]'}`}>
                                                {p.phase}
                                            </span>
                                            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#1a2634] text-[#fee5b1]">
                                                P0{i + 1}
                                            </span>
                                        </div>
                                        <h3 className={`text-2xl font-bold mb-5 ${isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'}`}>
                                            {p.title}
                                        </h3>
                                        {targetText && (
                                            <div className={`border-l-2 border-[#ffcc00] pl-3.5 py-1 mb-5`}>
                                                <span className={`font-mono text-[10px] uppercase tracking-wider block ${isLight ? 'text-[#203e5f]' : 'text-[#fee5b1]'}`}>
                                                    Primary Objective
                                                </span>
                                                <span className={`text-sm font-bold ${isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'}`}>
                                                    {targetText}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <p className={`text-sm m-0 leading-relaxed ${isLight ? 'text-[#203e5f]' : 'text-[#eaeaea]/75'}`}>
                                        {descText}
                                    </p>
                                </div>
                            )
                        })}
                    </div>
                </section>

                {/* 07 // INVESTOR REALITY & COMPARATIVE EVIDENCE */}
                <section className={`mb-24 border-t-2 pt-12 ${isLight ? 'border-[#1a2634]' : 'border-[#eaeaea]/20'}`}>
                    <div className="grid gap-12 lg:grid-cols-12">
                        {/* Left Column: Comparative Evidence */}
                        <div className="lg:col-span-5 flex flex-col justify-between">
                            <div>
                                <div className={`font-mono text-xs font-bold uppercase tracking-[0.2em] mb-3 ${isLight ? 'text-[#203e5f]' : 'text-[#ffcc00]'}`}>
                                    07 // CAPITAL DE-RISKING
                                </div>
                                <h2 className={`text-2xl sm:text-3xl font-bold leading-tight mb-4 ${isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'}`}>
                                    {compEvidenceTitle}
                                </h2>
                                <p className={`text-sm mb-4 ${isLight ? 'text-[#203e5f]' : 'text-[#eaeaea]/75'}`}>
                                    {compEvidenceBody}
                                </p>
                                <div className="flex flex-wrap gap-2 mb-6">
                                    {compEvidencePoints.map((p: any, i: number) => (
                                        <span
                                            key={i}
                                            className={`font-mono text-xs font-bold px-3 py-1.5 rounded border ${
                                                isLight
                                                    ? 'border-[#1a2634]/20 bg-white text-[#1a2634]'
                                                    : 'border-[#eaeaea]/15 bg-[#203e5f]/50 text-[#fee5b1]'
                                            }`}
                                        >
                                            {p.text}
                                        </span>
                                    ))}
                                </div>
                                <p className={`text-sm leading-relaxed ${isLight ? 'text-[#203e5f]' : 'text-[#eaeaea]/80'}`}>
                                    {compEvidenceFooter}
                                </p>
                            </div>

                            <div className="mt-8 rounded-xl bg-[#1a2634] p-6 border border-[#ffcc00]/30 text-[#eaeaea]">
                                <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#ffcc00] mb-2">
                                    INVESTOR OUTCOME
                                </div>
                                <p className="text-sm leading-relaxed m-0 text-[#eaeaea]/90">
                                    {invFooter}
                                </p>
                            </div>
                        </div>

                        {/* Right Column: Angels vs VCs */}
                        <div className="lg:col-span-7">
                            <div
                                className={`rounded-xl border p-7 sm:p-9 h-full flex flex-col justify-between ${
                                    isLight ? 'border-[#1a2634]/20 bg-white' : 'border-[#eaeaea]/15 bg-[#203e5f]/30'
                                }`}
                            >
                                <div>
                                    <h3 className={`text-2xl sm:text-3xl font-bold mb-2 ${isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'}`}>
                                        {invTitle}
                                    </h3>
                                    <p className={`text-sm italic mb-8 ${isLight ? 'text-[#203e5f]' : 'text-[#fee5b1]'}`}>
                                        {invIntro}
                                    </p>

                                    <div className="grid sm:grid-cols-2 gap-8">
                                        <div>
                                            <div className="font-mono text-xs font-bold uppercase tracking-wider text-[#ffcc00] bg-[#1a2634] inline-block px-2.5 py-1 rounded mb-4">
                                                01 / BUSINESS ANGELS
                                            </div>
                                            <h4 className={`text-lg font-bold mb-4 ${isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'}`}>
                                                {angelsTitle}
                                            </h4>
                                            <ul className="space-y-3 pl-0 list-none">
                                                {angelsPoints.map((p: any, i: number) => (
                                                    <li key={i} className="flex items-start gap-2.5 text-sm">
                                                        <span className="text-[#ffcc00] font-bold">—</span>
                                                        <span className={isLight ? 'text-[#203e5f]' : 'text-[#eaeaea]/85'}>{p.text}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>

                                        <div>
                                            <div className="font-mono text-xs font-bold uppercase tracking-wider text-[#fee5b1] bg-[#203e5f] border border-[#ffcc00]/30 inline-block px-2.5 py-1 rounded mb-4">
                                                02 / VENTURE CAPITAL
                                            </div>
                                            <h4 className={`text-lg font-bold mb-4 ${isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'}`}>
                                                {vcsTitle}
                                            </h4>
                                            <ul className="space-y-3 pl-0 list-none">
                                                {vcsPoints.map((p: any, i: number) => (
                                                    <li key={i} className="flex items-start gap-2.5 text-sm">
                                                        <span className="text-[#ffcc00] font-bold">✓</span>
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
                <section className={`mb-24 border-t-2 pt-12 ${isLight ? 'border-[#1a2634]' : 'border-[#eaeaea]/20'}`}>
                    <div className="grid gap-12 lg:grid-cols-12 mb-16">
                        <div className="lg:col-span-6">
                            <div className={`font-mono text-xs font-bold uppercase tracking-[0.2em] mb-3 ${isLight ? 'text-[#203e5f]' : 'text-[#ffcc00]'}`}>
                                08 // METHODOLOGY &amp; METRICS
                            </div>
                            <h2 className={`text-2xl sm:text-3xl font-bold mb-3 ${isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'}`}>
                                {sciTitle}
                            </h2>
                            <p className={`text-sm mb-6 ${isLight ? 'text-[#203e5f]' : 'text-[#eaeaea]/75'}`}>
                                {sciSubtitle}
                            </p>
                            <div className={`divide-y border-t border-b ${isLight ? 'divide-[#1a2634]/15 border-[#1a2634]/15' : 'divide-[#eaeaea]/12 border-[#eaeaea]/12'}`}>
                                {sciPoints.map((p: any, i: number) => (
                                    <div key={i} className="py-3 flex items-center justify-between gap-4 text-sm font-semibold">
                                        <span>{p.text}</span>
                                        <span className={`font-mono text-xs ${isLight ? 'text-[#203e5f]' : 'text-[#ffcc00]'}`}>
                                            0{i + 1}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <p className={`mt-4 text-xs italic ${isLight ? 'text-[#203e5f]' : 'text-[#fee5b1]'}`}>
                                {sciFooter}
                            </p>
                        </div>

                        <div className="lg:col-span-6 flex flex-col justify-between gap-8">
                            <div>
                                <h3 className={`text-xl font-bold mb-2 ${isLight ? 'text-[#1a2634]' : 'text-[#ffcc00]'}`}>
                                    {whyStrongTitle}
                                </h3>
                                <p className={`text-sm mb-4 ${isLight ? 'text-[#203e5f]' : 'text-[#eaeaea]/75'}`}>
                                    {whyStrongIntro}
                                </p>
                                <div className="space-y-2.5">
                                    {whyStrongPoints.map((p: any, i: number) => (
                                        <div
                                            key={i}
                                            className={`p-4 rounded-lg border flex items-start gap-3 text-sm font-medium ${
                                                isLight
                                                    ? 'bg-white border-[#1a2634]/15 text-[#1a2634]'
                                                    : 'bg-[#203e5f]/40 border-[#eaeaea]/12 text-[#eaeaea]'
                                            }`}
                                        >
                                            <span className="font-mono text-xs font-bold text-[#ffcc00] bg-[#1a2634] px-2 py-0.5 rounded">
                                                0{i + 1}
                                            </span>
                                            <span>{p.text}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h3 className={`text-xl font-bold mb-3 ${isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'}`}>
                                    {whatDiffTitle}
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {whatDiffPoints.map((p: any, i: number) => (
                                        <div
                                            key={i}
                                            className={`px-3.5 py-2 rounded-lg border text-xs font-bold ${
                                                isLight
                                                    ? 'bg-[#fee5b1]/60 border-[#1a2634]/20 text-[#1a2634]'
                                                    : 'bg-[#1a2634] border-[#ffcc00]/30 text-[#fee5b1]'
                                            }`}
                                        >
                                            {p.text}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Core Metrics Table */}
                    <div
                        className={`rounded-xl border p-7 sm:p-9 ${
                            isLight ? 'border-[#1a2634]/20 bg-white' : 'border-[#eaeaea]/15 bg-[#203e5f]/25'
                        }`}
                    >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6 pb-4 border-b border-current/10">
                            <h3 className={`text-2xl font-bold m-0 ${isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'}`}>
                                {metricsTitle}
                            </h3>
                            <span className={`font-mono text-xs font-bold uppercase ${isLight ? 'text-[#203e5f]' : 'text-[#ffcc00]'}`}>
                                8 TELEMETRY INDICATORS
                            </span>
                        </div>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {metricsPoints.map((p: any, i: number) => (
                                <div
                                    key={i}
                                    className={`p-4 rounded-lg border flex flex-col justify-between ${
                                        isLight
                                            ? 'border-[#1a2634]/12 bg-[#eaeaea]/40 text-[#1a2634]'
                                            : 'border-[#eaeaea]/10 bg-[#1a2634]/70 text-[#eaeaea]'
                                    }`}
                                >
                                    <span className={`font-mono text-[10px] font-bold mb-2 ${isLight ? 'text-[#203e5f]' : 'text-[#ffcc00]'}`}>
                                        KPI / 0{i + 1}
                                    </span>
                                    <span className="text-sm font-semibold leading-snug">{p.text}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <FaqSection settings={settings} theme={theme} />

                {/* 10 // PRICING & LEGAL — Required for PayNow / Polish e-commerce compliance */}
                <section id="pricing" className={`mb-16 border-t-2 pt-12 ${isLight ? 'border-[#1a2634]' : 'border-[#eaeaea]/20'}`}>
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
                        <div>
                            <div className={`font-mono text-xs font-bold uppercase tracking-[0.2em] mb-2 ${isLight ? 'text-[#203e5f]' : 'text-[#ffcc00]'}`}>
                                10 // COMMERCIAL TERMS &amp; ACCESS
                            </div>
                            <h2 className={`text-3xl sm:text-4xl font-bold m-0 ${isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'}`}>
                                {pricing[pricingLang].sectionTitle}
                            </h2>
                        </div>
                        <div
                            className={`inline-flex self-start items-center gap-1 border rounded-lg p-1 ${
                                isLight ? 'bg-white border-[#1a2634]/20' : 'bg-[#203e5f]/50 border-[#eaeaea]/15'
                            }`}
                        >
                            <button
                                onClick={() => setPricingLang('en')}
                                className={`px-3.5 py-1.5 rounded text-xs font-bold transition-colors cursor-pointer ${
                                    pricingLang === 'en'
                                        ? 'bg-[#ffcc00] text-[#1a2634]'
                                        : isLight
                                          ? 'text-[#203e5f] hover:text-[#1a2634]'
                                          : 'text-[#eaeaea]/70 hover:text-[#eaeaea]'
                                }`}
                            >
                                EN (EUR)
                            </button>
                            <button
                                onClick={() => setPricingLang('pl')}
                                className={`px-3.5 py-1.5 rounded text-xs font-bold transition-colors cursor-pointer ${
                                    pricingLang === 'pl'
                                        ? 'bg-[#ffcc00] text-[#1a2634]'
                                        : isLight
                                          ? 'text-[#203e5f] hover:text-[#1a2634]'
                                          : 'text-[#eaeaea]/70 hover:text-[#eaeaea]'
                                }`}
                            >
                                PL (PLN)
                            </button>
                        </div>
                    </div>

                    <div
                        className={`rounded-xl border overflow-hidden ${
                            isLight
                                ? 'bg-white border-[#1a2634]/20 shadow-lg'
                                : 'bg-[#203e5f]/35 border-[#eaeaea]/15'
                        }`}
                    >
                        <div className={`grid lg:grid-cols-12 border-b ${isLight ? 'border-[#1a2634]/15' : 'border-[#eaeaea]/12'}`}>
                            <div className="lg:col-span-7 p-8 sm:p-10 flex flex-col justify-between">
                                <div>
                                    <div className="font-mono text-xs font-bold uppercase tracking-wider text-[#ffcc00] bg-[#1a2634] inline-block px-3 py-1 rounded mb-4">
                                        FULL 100-DAY COHORT LICENSE
                                    </div>
                                    <h3 className={`text-2xl sm:text-3xl font-bold mb-3 ${isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'}`}>
                                        {pricing[pricingLang].serviceName}
                                    </h3>
                                    <p className={`text-sm leading-relaxed mb-6 max-w-xl ${isLight ? 'text-[#203e5f]' : 'text-[#eaeaea]/75'}`}>
                                        {pricing[pricingLang].serviceDescription}
                                    </p>
                                    <ul className="space-y-3 pl-0 list-none">
                                        {pricing[pricingLang].features.map((f: any, i: number) => (
                                            <li
                                                key={i}
                                                className={`flex items-center gap-3 text-sm font-semibold ${
                                                    isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'
                                                }`}
                                            >
                                                <span className="h-2 w-2 bg-[#ffcc00] shrink-0" />
                                                <span>{f.text}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div className={`mt-8 pt-6 border-t space-y-1 ${isLight ? 'border-[#1a2634]/12' : 'border-[#eaeaea]/10'}`}>
                                    <p className={`text-xs ${isLight ? 'text-[#203e5f]' : 'text-[#eaeaea]/75'}`}>
                                        {pricing[pricingLang].individualNote}
                                    </p>
                                    <p className={`text-xs font-bold ${isLight ? 'text-[#1a2634]' : 'text-[#fee5b1]'}`}>
                                        {pricing[pricingLang].partnerNote}
                                    </p>
                                </div>
                            </div>

                            <div className="lg:col-span-5 p-8 sm:p-10 bg-[#1a2634] text-[#eaeaea] flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-[#eaeaea]/12">
                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="font-mono text-xs uppercase tracking-wider text-[#fee5b1]">
                                            ONE-TIME FEE
                                        </span>
                                        {logoUrl && (
                                            <img src={logoUrl} alt={companyName} className="h-7 object-contain" />
                                        )}
                                    </div>
                                    <div className="font-mono text-4xl sm:text-5xl font-bold text-[#ffcc00]">
                                        {pricingLang === 'en' ? pricingPriceDisplayEur : pricingPriceDisplay}
                                    </div>
                                    <div className="text-xs text-[#fee5b1] mt-1">
                                        {pricing[pricingLang].vatInfo}
                                    </div>

                                    <div className="mt-6 grid gap-2.5">
                                        <button
                                            onClick={addProductToCart}
                                            className="w-full rounded-lg px-5 py-3.5 text-xs font-extrabold uppercase tracking-wider text-[#1a2634] bg-[#ffcc00] hover:bg-[#fee5b1] transition-colors cursor-pointer"
                                        >
                                            {pricingLang === 'pl' ? 'Dodaj do koszyka →' : 'Add to cart →'}
                                        </button>
                                        <Link
                                            href="/cart"
                                            className="w-full rounded-lg px-5 py-3 text-xs font-bold uppercase tracking-wider border border-[#eaeaea]/20 text-[#eaeaea] hover:border-[#ffcc00] hover:text-[#ffcc00] transition-colors text-center"
                                        >
                                            {pricingLang === 'pl' ? 'Zobacz koszyk' : 'View cart'}
                                        </Link>
                                    </div>
                                </div>

                                <div className="mt-8 pt-5 border-t border-[#eaeaea]/12">
                                    <div className="text-[11px] text-[#eaeaea]/70">
                                        {pricing[pricingLang].paymentMethods}
                                    </div>
                                    <p className="text-[11px] text-[#eaeaea]/55 mt-1">
                                        {pricingLang === 'pl'
                                            ? 'Podmiotem świadczącym obsługę płatności online w zakresie płatności kartami jest Autopay S.A.'
                                            : 'Card payments are handled online by Autopay S.A.'}
                                    </p>
                                    <img
                                        src="/paynow/banner-payment-methods.png"
                                        alt="Paynow, BLIK, Visa, Mastercard and Google Pay payment methods"
                                        className="mt-3 w-full h-auto rounded-lg border border-[#eaeaea]/10"
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
                            </div>
                        </div>

                        {/* Legal info grid */}
                        <div
                            className={`grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x ${
                                isLight ? 'divide-[#1a2634]/12 bg-[#eaeaea]/40' : 'divide-[#eaeaea]/10 bg-[#1a2634]/40'
                            }`}
                        >
                            <div className="p-6">
                                <h4 className={`font-mono text-xs font-bold uppercase tracking-wider mb-2 ${isLight ? 'text-[#1a2634]' : 'text-[#ffcc00]'}`}>
                                    {pricing[pricingLang].activationLabel}
                                </h4>
                                <p className={`text-xs leading-relaxed m-0 ${isLight ? 'text-[#203e5f]' : 'text-[#eaeaea]/75'}`}>
                                    {pricing[pricingLang].activationInfo}
                                </p>
                            </div>
                            <div className="p-6">
                                <h4 className={`font-mono text-xs font-bold uppercase tracking-wider mb-2 ${isLight ? 'text-[#1a2634]' : 'text-[#ffcc00]'}`}>
                                    {pricing[pricingLang].returnLabel}
                                </h4>
                                <p className={`text-xs leading-relaxed m-0 ${isLight ? 'text-[#203e5f]' : 'text-[#eaeaea]/75'}`}>
                                    {pricing[pricingLang].returnPolicy}
                                </p>
                            </div>
                            <div className="p-6">
                                <h4 className={`font-mono text-xs font-bold uppercase tracking-wider mb-2 ${isLight ? 'text-[#1a2634]' : 'text-[#ffcc00]'}`}>
                                    {pricing[pricingLang].complaintLabel}
                                </h4>
                                <p className={`text-xs leading-relaxed m-0 ${isLight ? 'text-[#203e5f]' : 'text-[#eaeaea]/75'}`}>
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
                                <div className={`px-8 py-3.5 border-t text-left flex items-center justify-between ${isLight ? 'border-[#1a2634]/12' : 'border-[#eaeaea]/10'}`}>
                                    <p className={`text-[11px] m-0 ${isLight ? 'text-[#203e5f]' : 'text-[#eaeaea]/65'}`}>
                                        {text}
                                        {termsLink.href ? (
                                            <a
                                                href={termsLink.href}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={`font-bold underline underline-offset-2 transition-colors ${
                                                    isLight ? 'text-[#1a2634] hover:text-[#203e5f]' : 'text-[#ffcc00] hover:text-[#fee5b1]'
                                                }`}
                                            >
                                                {termsLink.label}
                                            </a>
                                        ) : (
                                            <span className="font-semibold">{termsLink.label}</span>
                                        )}
                                    </p>
                                    <span className={`font-mono text-[10px] ${isLight ? 'text-[#203e5f]' : 'text-[#eaeaea]/40'}`}>
                                        MESGA // PAYNOW COMPLIant
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
