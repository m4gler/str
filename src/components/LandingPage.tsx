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
        color: '#fee5b1',
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
        color: '#ffcc00',
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

const mentorAvatarFrameClass = 'mb-4 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 border-[#ffcc00] bg-[#1a2634]'
const mentorLogoFrameClass = 'mb-4 flex h-14 w-28 items-center justify-center overflow-hidden rounded-md border border-[#ffcc00]/40 bg-[#1a2634] px-3 py-2'

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

    const sectionTitle = t('partnersSectionTitle', landing.partnersSectionTitle || 'Built with operators, institutions, and corporates who move markets.')
    const storedSubtitle = typeof landing.partnersSectionSubtitle === 'string' ? landing.partnersSectionSubtitle.trim() : ''
    const sectionSubtitle =
        !storedSubtitle || storedSubtitle === LEGACY_PARTNERS_SUBTITLE
            ? DEFAULT_PARTNERS_SUBTITLE
            : storedSubtitle

    return (
        <section className={`mb-32 sm:mb-40 border-t-2 pt-16 sm:pt-20 ${isLight ? 'border-[#203e5f]/20' : 'border-[#203e5f]'}`}>
            <div className="grid gap-10 md:grid-cols-12 mb-12 items-baseline">
                <div className="md:col-span-6">
                    <h2 className={`text-3xl sm:text-4xl font-bold leading-tight tracking-tight ${isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'}`}>
                        {sectionTitle}
                    </h2>
                </div>
                <div className="md:col-span-6">
                    <p className={`text-base leading-relaxed ${isLight ? 'text-[#203e5f]' : 'text-[#fee5b1]'}`}>
                        {sectionSubtitle}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4">
                {partners.map((partner) =>
                    partner.websiteUrl ? (
                        <a
                            key={partner.id}
                            href={partner.websiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`group relative flex min-h-28 items-center justify-center overflow-hidden rounded-lg border px-6 py-5 transition-colors ${
                                isLight
                                    ? 'border-[#203e5f]/25 bg-[#1a2634] hover:border-[#ffcc00]'
                                    : 'border-[#203e5f] bg-[#203e5f]/60 hover:border-[#ffcc00] hover:bg-[#203e5f]'
                            }`}
                            aria-label={`Open ${partner.name}`}
                        >
                            {partner.logoUrl ? (
                                <img
                                    src={partner.logoUrl}
                                    alt={partner.name}
                                    className="max-h-14 w-full object-contain"
                                    loading="lazy"
                                />
                            ) : (
                                <span className="text-sm font-bold text-[#eaeaea]">{partner.name}</span>
                            )}
                        </a>
                    ) : (
                        <div
                            key={partner.id}
                            className="flex min-h-28 items-center justify-center overflow-hidden rounded-lg border border-[#203e5f] bg-[#203e5f]/60 px-6 py-5"
                            aria-label={partner.name}
                        >
                            {partner.logoUrl ? (
                                <img
                                    src={partner.logoUrl}
                                    alt={partner.name}
                                    className="max-h-14 w-full object-contain"
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
        <section className={`mb-32 sm:mb-40 border-t-2 pt-16 sm:pt-20 ${isLight ? 'border-[#203e5f]/20' : 'border-[#203e5f]'}`}>
            <div className="grid gap-10 md:grid-cols-12 mb-12 items-end">
                <div className="md:col-span-7">
                    <div className={`text-xs font-bold uppercase tracking-widest mb-3 ${isLight ? 'text-[#203e5f]' : 'text-[#ffcc00]'}`}>
                        Ecosystem Perspective
                    </div>
                    <h2 className={`text-3xl sm:text-4xl font-bold leading-tight tracking-tight m-0 ${isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'}`}>
                        Backed by founders, operators, and ecosystem partners who care about execution clarity.
                    </h2>
                </div>
                <div className="md:col-span-5">
                    <p className={`text-sm leading-relaxed m-0 ${isLight ? 'text-[#203e5f]' : 'text-[#fee5b1]'}`}>
                        Early founders do better when the next action is explicit, visible, and reviewable every single day.
                    </p>
                </div>
            </div>

            <div className="grid gap-8 md:grid-cols-3">
                {DEFAULT_SOCIAL_PROOF_QUOTES.map((item) => (
                    <div
                        key={item.role}
                        className={`flex flex-col justify-between border-l-4 border-[#ffcc00] pl-6 py-3 ${
                            isLight ? 'bg-white/60 pr-6 rounded-r-lg' : 'bg-[#203e5f]/40 pr-6 rounded-r-lg'
                        }`}
                    >
                        <blockquote className={`m-0 text-lg font-medium leading-relaxed ${isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'}`}>
                            “{item.quote}”
                        </blockquote>
                        <div className={`mt-6 text-xs font-bold uppercase tracking-wider ${isLight ? 'text-[#203e5f]' : 'text-[#fee5b1]'}`}>
                            — {item.role}
                        </div>
                    </div>
                ))}
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
        <section className="mb-32 sm:mb-40">
            {hasMentors && (
                <div>
                    <h3 className={`text-lg font-bold mb-8 ${isLight ? 'text-[#203e5f]' : 'text-[#ffcc00]'}`}>
                        Ecosystem Mentors
                    </h3>
                    <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-3">
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
                                                className="max-h-9 w-full object-contain"
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
                                            <span className="text-base font-bold text-[#ffcc00]">{initials}</span>
                                        )}
                                    </div>
                                    <div className={`text-base font-bold leading-snug ${isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'}`}>
                                        {mentor.name}
                                    </div>
                                    {mentor.partnerName && (
                                        <div
                                            className={`mt-1 text-xs font-semibold ${
                                                isLight ? 'text-[#203e5f]' : 'text-[#fee5b1]'
                                            }`}
                                        >
                                            {mentor.partnerName}
                                        </div>
                                    )}
                                </>
                            )
                            const className = `group block border-t-2 pt-6 text-left transition-colors ${
                                isLight
                                    ? 'border-[#203e5f]/25 hover:border-[#1a2634]'
                                    : 'border-[#203e5f] hover:border-[#ffcc00]'
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
        <div className={`flex flex-col border-t pt-4 mt-2 ${isLight ? 'border-[#203e5f]/15' : 'border-white/10'}`}>
            <div className="flex items-center gap-2 mb-2.5">
                <span className={`text-xs font-bold ${isLight ? 'text-[#203e5f]' : 'text-[#fee5b1]'}`}>
                    Track partners {isPlaceholder ? '(coming soon)' : ''}
                </span>
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
                            className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1 ${
                                isLight ? 'border-[#203e5f]/15 bg-white text-[#1a2634]' : 'border-white/10 bg-[#1a2634] text-[#eaeaea]'
                            }`}
                        >
                            {m.logoUrl && <img src={m.logoUrl} alt={m.name} className="max-h-7 w-full object-contain" />}
                            <span className="text-[11px] font-medium">{m.name}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

function TrackPartnerTile({
    partner,
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
        ? `group block rounded-lg border p-3 transition-all duration-200 ${
              isLight ? 'border-[#203e5f]/20 bg-white' : 'border-white/15 bg-[#1a2634]'
          }`
        : 'group block'
    const content = (
        <>
            <div
                className={`flex items-center justify-center overflow-hidden rounded-md ${
                    isLight ? 'bg-[#1a2634]' : 'bg-[#1a2634] border border-[#203e5f]'
                } ${isSingle ? 'min-h-[52px] px-3 py-2' : 'min-h-[64px] px-3 py-2.5'}`}
            >
                {partner.logoUrl ? (
                    <img
                        src={partner.logoUrl}
                        alt={partner.name}
                        className={`w-full object-contain ${isSingle ? 'max-h-9' : 'max-h-12'}`}
                    />
                ) : (
                    <span className="text-center text-xs font-bold leading-relaxed text-[#fee5b1]">
                        {partner.name}
                    </span>
                )}
            </div>
            <div
                className={`text-center font-semibold ${
                    isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'
                } ${isSingle ? 'mt-1.5 text-[11px] leading-tight' : 'mt-1.5 text-[11px] leading-snug'}`}
            >
                {partner.name}
            </div>
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
            className={`relative w-full max-w-[190px] rounded-lg border p-2 overflow-hidden ${
                isLight ? 'border-[#203e5f]/20 bg-white' : 'border-white/15 bg-[#1a2634]/80'
            }`}
        >
            <div className="relative" style={{ minHeight: '96px' }}>
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
            className={`h-full w-full rounded-xl border-2 border-dashed flex flex-col justify-between p-9 min-h-[400px] transition-colors ${
                isLight
                    ? 'border-[#203e5f]/35 bg-white/70 text-[#1a2634]'
                    : 'border-[#fee5b1]/30 bg-[#203e5f]/35 text-[#eaeaea]'
            }`}
        >
            <div>
                <div className={`text-xs font-bold uppercase tracking-wider mb-3 ${isLight ? 'text-[#203e5f]' : 'text-[#ffcc00]'}`}>
                    Institutional &amp; Corporate Partnerships
                </div>
                <div className="text-2xl font-bold mb-3">{newTrackLabel}</div>
                <div className={`text-sm leading-relaxed max-w-xs ${isLight ? 'text-[#203e5f]' : 'text-[#fee5b1]'}`}>
                    {newTrackSubtitle}
                </div>
            </div>
            <a
                href={`mailto:${newTrackEmail}`}
                className="inline-flex w-fit items-center gap-2 rounded-md bg-[#ffcc00] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-[#1a2634] hover:bg-[#fee5b1] transition-colors"
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
            className={`h-full w-full flex flex-col rounded-xl border border-t-4 border-t-[#ffcc00] overflow-hidden backdrop-blur-md transition-all ${
                isLight
                    ? 'border-[#203e5f]/20 bg-white/85 text-[#1a2634]'
                    : 'border-[#203e5f] bg-[#203e5f]/65 text-[#eaeaea]'
            }`}
        >
            <div className="p-8 sm:p-9 flex flex-col flex-1 justify-between">
                <div>
                    <div className="flex items-start justify-between gap-4 mb-6">
                        <div>
                            <div className={`text-xs font-bold uppercase tracking-wider mb-1.5 ${isLight ? 'text-[#203e5f]' : 'text-[#ffcc00]'}`}>
                                {track.badge}
                            </div>
                            <h3 className={`text-2xl sm:text-3xl font-bold tracking-tight ${isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'}`}>
                                {track.name}
                            </h3>
                            <p className={`text-sm font-semibold mt-1 ${isLight ? 'text-[#203e5f]' : 'text-[#fee5b1]'}`}>
                                {track.tagline}
                            </p>
                        </div>

                        {hasGraphic && (
                            <div className="hidden lg:block shrink-0 w-28 overflow-hidden rounded-md">
                                <img
                                    src={track.graphicUrl!}
                                    alt={`${track.name}`}
                                    className="block w-full h-auto object-cover"
                                    onError={(e) => {
                                        e.currentTarget.onerror = null
                                        onGraphicError()
                                    }}
                                />
                            </div>
                        )}
                    </div>

                    <p className={`text-sm leading-relaxed mb-6 ${isLight ? 'text-[#1a2634]/85' : 'text-[#eaeaea]/90'}`}>
                        {track.desc}
                    </p>

                    {pills.length > 1 && (
                        <div className={`flex flex-wrap gap-5 border-b mb-4 ${isLight ? 'border-[#203e5f]/20' : 'border-white/15'}`}>
                            {pills.map((pill) => {
                                const active = activePillKey === pill.key
                                return (
                                    <button
                                        key={pill.key}
                                        onClick={() => onSelectPill(pill.key)}
                                        className={`pb-2.5 text-xs font-bold transition-colors cursor-pointer border-b-2 -mb-px ${
                                            active
                                                ? isLight
                                                    ? 'border-[#203e5f] text-[#1a2634]'
                                                    : 'border-[#ffcc00] text-[#ffcc00]'
                                                : isLight
                                                  ? 'border-transparent text-[#203e5f]/60 hover:text-[#1a2634]'
                                                  : 'border-transparent text-[#fee5b1]/65 hover:text-white'
                                        }`}
                                    >
                                        {pill.label}
                                    </button>
                                )
                            })}
                        </div>
                    )}

                    <div className={`text-sm leading-relaxed mb-6 ${isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'}`}>
                        <strong className={isLight ? 'text-[#203e5f]' : 'text-[#ffcc00]'}>{challenge.title} — </strong>
                        {challenge.desc}
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

                <div className={`mt-8 pt-6 border-t flex flex-wrap items-center justify-between gap-4 ${isLight ? 'border-[#203e5f]/15' : 'border-white/15'}`}>
                    <button
                        onClick={onOpenDetails}
                        className={`text-xs font-bold underline decoration-[#ffcc00] decoration-2 underline-offset-4 transition-colors cursor-pointer ${
                            isLight ? 'text-[#1a2634] hover:text-[#203e5f]' : 'text-[#fee5b1] hover:text-[#ffcc00]'
                        }`}
                    >
                        {viewDetailsBtn}
                    </button>
                    <button
                        onClick={onStartTrack}
                        className="rounded-md px-5 py-2.5 text-xs font-extrabold text-[#1a2634] bg-[#ffcc00] hover:bg-[#fee5b1] transition-colors cursor-pointer"
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
            .map((tr: any, idx: number) => ({
                key: tr.key || '',
                icon: tr.icon || `0${idx + 1}`,
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
                setCardWidth(containerRef.current.offsetWidth / 1.85)
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
        <section id="tracks" className={`mb-32 sm:mb-40 border-t-2 pt-16 sm:pt-20 ${isLight ? 'border-[#203e5f]/20' : 'border-[#203e5f]'}`}>
            <div className="grid gap-10 md:grid-cols-12 mb-12 items-end">
                <div className="md:col-span-7">
                    <div className={`text-xs font-bold uppercase tracking-widest mb-3 ${isLight ? 'text-[#203e5f]' : 'text-[#ffcc00]'}`}>
                        {sectionLabel}
                    </div>
                    <h2 className={`text-3xl sm:text-5xl font-bold leading-[1.08] tracking-tight ${isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'}`}>
                        {sectionTitle}{' '}
                        <span className={isLight ? 'text-[#203e5f]' : 'text-[#fee5b1]'}>
                            {sectionHighlight}
                        </span>
                    </h2>
                </div>
                <div className="md:col-span-5 flex flex-col justify-between gap-6">
                    <p className={`text-base leading-relaxed m-0 ${isLight ? 'text-[#203e5f]' : 'text-[#eaeaea]/85'}`}>
                        {sectionSubtitle}
                    </p>
                    <div className="hidden md:flex items-center gap-3">
                        <button
                            onClick={prevSlide}
                            className={`h-10 w-10 flex items-center justify-center rounded-md border font-bold transition-colors cursor-pointer ${
                                isLight
                                    ? 'border-[#203e5f] bg-white text-[#1a2634] hover:bg-[#203e5f] hover:text-[#ffcc00]'
                                    : 'border-[#fee5b1]/35 bg-[#203e5f] text-[#ffcc00] hover:bg-[#ffcc00] hover:text-[#1a2634]'
                            }`}
                            aria-label="Previous tracks"
                        >
                            ←
                        </button>
                        <button
                            onClick={nextSlide}
                            className={`h-10 w-10 flex items-center justify-center rounded-md border font-bold transition-colors cursor-pointer ${
                                isLight
                                    ? 'border-[#203e5f] bg-white text-[#1a2634] hover:bg-[#203e5f] hover:text-[#ffcc00]'
                                    : 'border-[#fee5b1]/35 bg-[#203e5f] text-[#ffcc00] hover:bg-[#ffcc00] hover:text-[#1a2634]'
                            }`}
                            aria-label="Next tracks"
                        >
                            →
                        </button>
                        <span className={`ml-2 text-xs font-bold ${isLight ? 'text-[#203e5f]' : 'text-[#fee5b1]'}`}>
                            {activeIndex + 1} / {totalSlides}
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-6 md:hidden">
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

            <div className="relative min-h-[430px] hidden items-center md:flex">
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
                                    <div key={track.key} className="flex-none pr-6" style={{ width: cardWidth ? `${cardWidth}px` : '54%' }}>
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
                                <div key={`new-track-${itemIndex}`} className="flex-none pr-6" style={{ width: cardWidth ? `${cardWidth}px` : '54%' }}>
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
                    style={{ background: 'rgba(26, 38, 52, 0.85)', backdropFilter: 'blur(8px)' }}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setActiveModal(null)
                    }}
                >
                    <div
                        className="relative bg-[#1a2634] border-2 border-[#ffcc00] rounded-xl w-full max-w-2xl max-h-[88vh] overflow-y-auto text-[#eaeaea] shadow-2xl p-8 sm:p-10"
                    >
                        <div className="flex items-start justify-between pb-6 border-b border-[#203e5f]">
                            <div>
                                <div className="text-xs font-bold text-[#ffcc00] mb-1">{modalTrack.badge}</div>
                                <div className="text-2xl font-bold text-[#eaeaea]">{modalTrack.name}</div>
                                <div className="text-sm text-[#fee5b1] mt-1">{modalTrack.tagline}</div>
                            </div>
                            <button
                                onClick={() => setActiveModal(null)}
                                className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-[#eaeaea] hover:text-[#ffcc00] transition-colors cursor-pointer border border-[#203e5f]"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="pt-6 space-y-6">
                            <p className="text-sm text-[#eaeaea] leading-7">{modalTrack.desc}</p>

                            {getTrackPartnerTiles(modalTrackPartners).length > 0 && (
                                <TrackPartnerTiles partners={modalTrackPartners} accentColor={modalTrack.color || '#ffcc00'} />
                            )}

                            {modalTrack.whatYouGet.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#ffcc00] mb-3">
                                        What is included
                                    </h4>
                                    <ul className="space-y-2 pl-0 list-none">
                                        {modalTrack.whatYouGet.map((item, i) => (
                                            <li key={i} className="text-sm text-[#eaeaea] flex items-start gap-2.5">
                                                <span className="text-[#ffcc00] font-bold">—</span>
                                                <span>{item.text}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={() => {
                                    setActiveModal(null)
                                    handleTrackNavigation(modalTrack)
                                }}
                                className="block w-full rounded-md px-5 py-3.5 text-xs font-extrabold uppercase tracking-wider transition-colors bg-[#ffcc00] text-[#1a2634] hover:bg-[#fee5b1] text-center cursor-pointer"
                            >
                                {modalTrack.applyButtonText}
                            </button>
                        </div>
                    </div>
                </div>
            )}
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

    const execTitle = t('execSummaryTitle', landing.execSummaryTitle || 'Architecture of Venture Execution')
    const execSubtitle = t('execSummarySubtitle', landing.execSummarySubtitle || 'From passive incubation to structured daily cadence.')
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

    const defaultPhases = [
        {
            phase: 'Days 01–30',
            title: 'Validation',
            target: 'Prove the pain is real.',
            description: 'Customer discovery dominates. Evidence first.',
        },
        {
            phase: 'Days 31–70',
            title: 'Build & Launch',
            target: 'First activation & transaction.',
            description: 'MVP + instrumentation + live experiments.',
        },
        {
            phase: 'Days 71–100',
            title: 'Growth & Capital',
            target: 'Unit economics & readiness.',
            description: 'GTM system + data room + fundraising workflow.',
        },
    ]
    const phases = landing.phases && landing.phases.length > 0 ? landing.phases : defaultPhases

    const compEvidenceFooter = t(
        'compEvidenceFooter',
        landing.compEvidenceFooter ||
            'The success driver for first-time founders is often not the largest network \u2014 it\u2019s support density + operational precision. MESGA is designed to behave like a high-density accelerator by turning mentorship into a scalable daily proof + feedback system.',
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
    const vcsTitle = t('vcsTitle', landing.vcsTitle || 'What VCs require')
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
            'MESGA integrates corporate hygiene and capital readiness tasks directly into the OS, so teams leave with an investor-grade proof package, not just a pitch.',
    )

    const sciTitle = t(
        'learningScienceTitle',
        landing.learningScienceTitle || 'Why daily task-based systems work',
    )
    const sciSubtitle = t(
        'learningScienceSubtitle',
        landing.learningScienceSubtitle || 'Designed around what consistently outperforms passive education for founders:',
    )
    const sciPoints = landing.learningSciencePoints || [
        { text: 'Learning by doing over consuming content' },
        { text: 'Fast feedback loops over delayed workshops' },
        { text: 'Spacing and repetition for skill transfer' },
        { text: 'Reduced cognitive load so novices execute' },
        { text: 'Micro-cadence that fits real founder time constraints' },
    ]

    const metricsTitle = t('metricsTitle', landing.metricsTitle || 'Core metrics we track')
    const metricsPoints = landing.metricsPoints || [
        { text: 'Daily evidence completion rate' },
        { text: 'Median mentor review time + SLA hit rate' },
        { text: 'Gate on-time pass rate + revise cycles' },
        { text: 'Customer evidence throughput' },
        { text: 'Time-to-MVP + time-to-activation' },
        { text: 'Ecosystem readiness & weekly delta' },
        { text: 'Intro pipeline conversion' },
        { text: 'Post-program pilots, LOIs & investor meetings' },
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
            className={`landing-readable relative min-h-screen overflow-x-hidden font-sans selection:bg-[#ffcc00] selection:text-[#1a2634] transition-colors duration-200 ${
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

            <main className="relative z-10 max-w-[1440px] mx-auto px-6 sm:px-10 pt-12 md:pt-20 pb-28">
                {/* HERO — Full-width 2-Column Spread (md:grid-cols-12) with Solid Flat EU Colors (Zero Gradients) */}
                <section className="mb-28 sm:mb-36">
                    <div className="grid gap-12 md:grid-cols-12 md:gap-12 lg:gap-16 items-start">
                        {/* Left Column (7 cols on md+) */}
                        <div className="md:col-span-7 pt-2">
                            <div
                                className={`text-xs font-bold uppercase tracking-[0.18em] mb-6 pb-2.5 border-b-2 border-[#ffcc00] inline-block ${
                                    isLight ? 'text-[#203e5f]' : 'text-[#fee5b1]'
                                }`}
                            >
                                Make European Startups Great Again — 2026 Cohort
                            </div>

                            <h1 className="text-4xl sm:text-5xl lg:text-[4.25rem] font-extrabold tracking-[-0.03em] mb-7 leading-[1.04]">
                                <span className={isLight ? 'text-[#203e5f]' : 'text-[#ffcc00]'}>
                                    {companyName}
                                </span>{' '}
                                <span className={isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'}>
                                    {heroTitlePrefix}
                                </span>
                                <span
                                    className={`block mt-2 ${
                                        isLight ? 'text-[#203e5f]' : 'text-[#fee5b1]'
                                    }`}
                                >
                                    {heroTitleHighlight}
                                    <span className="text-[#ffcc00]">.</span>
                                </span>
                            </h1>

                            <p
                                className={`text-base sm:text-lg leading-relaxed max-w-2xl mb-10 ${
                                    isLight ? 'text-[#203e5f]' : 'text-[#eaeaea]/85'
                                }`}
                            >
                                {heroSubtitle}
                            </p>

                            <div className="flex flex-wrap items-center gap-4">
                                <Link
                                    href="/login?role=founder"
                                    className="inline-flex items-center justify-center gap-3 px-7 py-4 rounded-md text-sm font-extrabold text-[#1a2634] bg-[#ffcc00] hover:bg-[#fee5b1] transition-colors"
                                >
                                    <span>{founderBtn}</span>
                                    <span>→</span>
                                </Link>
                                <Link
                                    href="/login?role=investor"
                                    className={`inline-flex items-center justify-center gap-3 rounded-md border-2 px-7 py-3.5 text-sm font-bold transition-colors ${
                                        isLight
                                            ? 'border-[#203e5f] bg-white text-[#203e5f] hover:bg-[#203e5f] hover:text-white'
                                            : 'border-[#fee5b1]/40 bg-[#203e5f]/70 text-[#fee5b1] hover:bg-[#203e5f] hover:border-[#ffcc00] hover:text-[#ffcc00]'
                                    }`}
                                >
                                    <span>{investorBtn}</span>
                                </Link>
                            </div>
                        </div>

                        {/* Right Column (5 cols on md+): Solid EU Blue / Navy Syllabus Sheet */}
                        <div className="md:col-span-5">
                            <div
                                className={`rounded-xl border border-t-4 border-t-[#ffcc00] p-7 sm:p-9 backdrop-blur-md ${
                                    isLight
                                        ? 'border-[#203e5f]/25 bg-white/85 text-[#1a2634]'
                                        : 'border-[#203e5f] bg-[#203e5f]/70 text-[#eaeaea]'
                                }`}
                            >
                                <div className="flex items-baseline justify-between mb-5">
                                    <h2 className={`text-xs font-extrabold uppercase tracking-widest m-0 ${isLight ? 'text-[#203e5f]' : 'text-[#ffcc00]'}`}>
                                        Programme Syllabus
                                    </h2>
                                    <span className={`text-xs font-bold ${isLight ? 'text-[#1a2634]' : 'text-[#fee5b1]'}`}>
                                        100 consecutive days
                                    </span>
                                </div>

                                <div
                                    className={`divide-y border-t border-b ${
                                        isLight ? 'divide-[#203e5f]/15 border-[#203e5f]/20' : 'divide-white/15 border-white/15'
                                    }`}
                                >
                                    {phases.map((p: any, i: number) => (
                                        <div key={i} className="py-4 first:pt-4 last:pb-4">
                                            <div className="flex items-baseline justify-between gap-3 mb-1">
                                                <span className={`text-base font-bold ${isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'}`}>
                                                    {p.title}
                                                </span>
                                                <span
                                                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded shrink-0 ${
                                                        isLight
                                                            ? 'bg-[#fee5b1] text-[#1a2634]'
                                                            : 'bg-[#1a2634] text-[#ffcc00]'
                                                    }`}
                                                >
                                                    {p.phase}
                                                </span>
                                            </div>
                                            <p className={`text-xs m-0 leading-relaxed ${isLight ? 'text-[#203e5f]' : 'text-[#eaeaea]/85'}`}>
                                                {p.target ? `${p.target} ${p.description}` : p.description}
                                            </p>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-6">
                                    <div className="flex items-center justify-between text-xs mb-3">
                                        <span className={`font-bold ${isLight ? 'text-[#1a2634]' : 'text-[#fee5b1]'}`}>
                                            Decision Gates
                                        </span>
                                        <span className={`font-semibold ${isLight ? 'text-[#203e5f]' : 'text-[#ffcc00]'}`}>
                                            Pass · Revise · Stop
                                        </span>
                                    </div>
                                    <div className="relative pt-2">
                                        <div className={`h-0.5 w-full ${isLight ? 'bg-[#203e5f]/30' : 'bg-[#fee5b1]/35'}`} />
                                        <div className="flex justify-between -mt-1.5">
                                            {['Day 15', 'Day 30', 'Day 50', 'Day 70', 'Day 94'].map((gate) => (
                                                <div key={gate} className="flex flex-col items-center">
                                                    <div className="h-3 w-0.5 bg-[#ffcc00]" />
                                                    <span className={`mt-1.5 text-[11px] font-bold ${isLight ? 'text-[#203e5f]' : 'text-[#fee5b1]'}`}>
                                                        {gate}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Full-width Architectural Key Figures Bar across the page */}
                    <div
                        className={`mt-14 grid grid-cols-2 md:grid-cols-4 rounded-xl border overflow-hidden divide-y md:divide-y-0 md:divide-x ${
                            isLight
                                ? 'bg-[#203e5f] border-[#1a2634] divide-white/15 text-[#eaeaea]'
                                : 'bg-[#203e5f]/55 border-[#203e5f] divide-white/12 text-[#eaeaea]'
                        }`}
                    >
                        <div className="p-6 sm:p-7">
                            <div className="text-3xl sm:text-4xl font-extrabold text-[#ffcc00]">100 Days</div>
                            <div className="text-xs font-medium text-[#fee5b1] mt-1">Structured daily execution cadence</div>
                        </div>
                        <div className="p-6 sm:p-7">
                            <div className="text-3xl sm:text-4xl font-extrabold text-[#ffcc00]">5 Gates</div>
                            <div className="text-xs font-medium text-[#fee5b1] mt-1">Mandatory pass / revise / stop reviews</div>
                        </div>
                        <div className="p-6 sm:p-7">
                            <div className="text-3xl sm:text-4xl font-extrabold text-[#ffcc00]">24h Loop</div>
                            <div className="text-xs font-medium text-[#fee5b1] mt-1">One mission, deliverable &amp; proof per day</div>
                        </div>
                        <div className="p-6 sm:p-7">
                            <div className="text-3xl sm:text-4xl font-extrabold text-[#ffcc00]">4 Tracks</div>
                            <div className="text-xs font-medium text-[#fee5b1] mt-1">General, Space, EduTech &amp; Dual Use</div>
                        </div>
                    </div>
                </section>

                {/* Tracks Carousel */}
                <TracksCarousel settings={settings} theme={theme} />

                <PartnersShowcase settings={settings} partners={partners} theme={theme} />
                <SocialProofQuotes theme={theme} />
                <EcosystemShowcase partners={partners} rawMentors={mentors} theme={theme} />

                {/* THESIS & ARCHITECTURE — Full-Width 2-Column Spread */}
                <section className={`mb-32 sm:mb-40 border-t-2 pt-16 sm:pt-20 ${isLight ? 'border-[#203e5f]/20' : 'border-[#203e5f]'}`}>
                    <div className="grid gap-12 md:grid-cols-12 md:gap-16">
                        <div className="md:col-span-5">
                            <div className={`text-xs font-bold uppercase tracking-widest mb-3 ${isLight ? 'text-[#203e5f]' : 'text-[#ffcc00]'}`}>
                                Executive Summary
                            </div>
                            <h2 className={`text-3xl sm:text-4xl font-bold leading-tight tracking-tight mb-5 ${isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'}`}>
                                {execTitle}
                            </h2>
                            <p className={`text-lg font-semibold leading-relaxed border-l-4 border-[#ffcc00] pl-4 ${isLight ? 'text-[#203e5f]' : 'text-[#fee5b1]'}`}>
                                {execSubtitle}
                            </p>
                        </div>

                        <div className="md:col-span-7">
                            <p className={`text-base sm:text-lg leading-relaxed mb-8 ${isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]/90'}`}>
                                {execBody}
                            </p>

                            <div
                                className={`divide-y border-t-2 border-b-2 ${
                                    isLight ? 'divide-[#203e5f]/15 border-[#203e5f]/20' : 'divide-[#203e5f] border-[#203e5f]'
                                }`}
                            >
                                {execPoints.map((p: any, i: number) => (
                                    <div key={i} className="py-4 flex items-baseline gap-5">
                                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-[#ffcc00] text-[#1a2634] shrink-0">
                                            0{i + 1}
                                        </span>
                                        <span className={`text-base font-bold ${isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'}`}>
                                            {p.text}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* OPERATING MODEL & FOUNDER FIT — Full-Width Spread with Warm Cream (#fee5b1) Contrast Block */}
                <section id="program" className={`mb-32 sm:mb-40 border-t-2 pt-16 sm:pt-20 ${isLight ? 'border-[#203e5f]/20' : 'border-[#203e5f]'}`}>
                    <div className="grid gap-12 md:grid-cols-12 md:gap-14 items-stretch">
                        {/* Left 5 cols: What it is */}
                        <div className="md:col-span-5 flex flex-col justify-between">
                            <div>
                                <div className={`text-xs font-bold uppercase tracking-widest mb-3 ${isLight ? 'text-[#203e5f]' : 'text-[#ffcc00]'}`}>
                                    Operating System
                                </div>
                                <h2 className={`text-3xl sm:text-4xl font-bold tracking-tight mb-4 ${isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'}`}>
                                    {whatItIsTitle}
                                </h2>
                                <p className={`text-base leading-relaxed mb-8 ${isLight ? 'text-[#203e5f]' : 'text-[#fee5b1]'}`}>
                                    {whatItIsBody}
                                </p>

                                <ol
                                    className={`divide-y border-t-2 border-b-2 pl-0 list-none m-0 ${
                                        isLight ? 'divide-[#203e5f]/15 border-[#203e5f]/20' : 'divide-[#203e5f] border-[#203e5f]'
                                    }`}
                                >
                                    {whatItIsPoints.map((p: any, i: number) => (
                                        <li key={i} className="py-4 flex items-center justify-between text-base font-bold">
                                            <span className={isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'}>{p.text}</span>
                                            <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-[#203e5f] text-[#ffcc00]">
                                                0{i + 1}
                                            </span>
                                        </li>
                                    ))}
                                </ol>
                            </div>

                            <p className={`mt-6 text-sm font-bold m-0 ${isLight ? 'text-[#203e5f]' : 'text-[#ffcc00]'}`}>
                                {whatItIsFooter}
                            </p>
                        </div>

                        {/* Right 7 cols: Solid Warm Cream (#fee5b1) + EU Blue (#203e5f) Architectural Split */}
                        <div className="md:col-span-7 grid gap-6">
                            {/* Warm Cream (#fee5b1) card with Deep Navy (#1a2634) text — breaks up the dark blue */}
                            <div className="rounded-xl bg-[#fee5b1] text-[#1a2634] p-8 sm:p-10 border-l-8 border-[#ffcc00]">
                                <div className="text-xs font-extrabold uppercase tracking-widest text-[#203e5f] mb-2">
                                    Founder Profile
                                </div>
                                <h3 className="text-2xl sm:text-3xl font-extrabold text-[#1a2634] mb-3">
                                    {whoIsThisForTitle}
                                </h3>
                                <p className="text-base leading-relaxed text-[#203e5f] font-medium mb-6">
                                    {whoIsThisForBody}
                                </p>
                                <ul className="space-y-3 pl-0 list-none m-0">
                                    {whoIsThisForBullets.map((point: any, i: number) => (
                                        <li key={i} className="flex items-start gap-3 text-sm sm:text-base font-bold text-[#1a2634]">
                                            <span className="text-[#203e5f] font-extrabold">■</span>
                                            <span className="leading-relaxed">{point.text}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* EU Blue (#203e5f) card for Execution Gap */}
                            <div className="rounded-xl bg-[#203e5f] text-[#eaeaea] p-8 sm:p-10 border border-[#fee5b1]/20">
                                <h3 className="text-xl sm:text-2xl font-bold text-[#ffcc00] mb-2">
                                    {execGapTitle}
                                </h3>
                                <p className="text-sm leading-relaxed text-[#eaeaea] mb-5">
                                    {execGapBody}
                                </p>
                                <div className="grid sm:grid-cols-2 gap-3 mb-5">
                                    {execGapPoints.map((p: any, i: number) => (
                                        <div
                                            key={i}
                                            className="text-sm font-bold py-2.5 px-4 rounded-md bg-[#1a2634] text-[#fee5b1] border border-[#ffcc00]/25"
                                        >
                                            {p.text}
                                        </div>
                                    ))}
                                </div>
                                <p className="text-xs sm:text-sm italic leading-relaxed m-0 text-[#fee5b1]">
                                    {execGapQuote}
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* DAILY LOOP — Full-Width 5-Column Strip */}
                <section className={`mb-32 sm:mb-40 border-t-2 pt-16 sm:pt-20 ${isLight ? 'border-[#203e5f]/20' : 'border-[#203e5f]'}`}>
                    <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
                        <div>
                            <div className={`text-xs font-bold uppercase tracking-widest mb-3 ${isLight ? 'text-[#203e5f]' : 'text-[#ffcc00]'}`}>
                                Daily Cadence
                            </div>
                            <h2 className={`text-3xl sm:text-4xl font-bold tracking-tight m-0 ${isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'}`}>
                                {howItWorksTitle}
                            </h2>
                        </div>
                        <p className={`text-base font-semibold m-0 max-w-md ${isLight ? 'text-[#203e5f]' : 'text-[#fee5b1]'}`}>
                            {howItWorksFooter}
                        </p>
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-5">
                        {howItWorksSteps.map((s: any, i: number) => (
                            <div
                                key={i}
                                className={`rounded-lg p-6 border-t-4 border-t-[#ffcc00] border ${
                                    isLight
                                        ? 'bg-white border-[#203e5f]/20 text-[#1a2634]'
                                        : 'bg-[#203e5f]/60 border-[#203e5f] text-[#eaeaea]'
                                }`}
                            >
                                <div className={`text-xs font-extrabold mb-4 ${isLight ? 'text-[#203e5f]' : 'text-[#ffcc00]'}`}>
                                    STEP 0{i + 1}
                                </div>
                                <h3 className={`text-xl font-bold mb-1.5 ${isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'}`}>
                                    {s.title}
                                </h3>
                                <p className={`text-sm m-0 leading-relaxed ${isLight ? 'text-[#203e5f]' : 'text-[#fee5b1]'}`}>
                                    {s.desc}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* INVESTOR REALITY — Full-Width Side-by-Side Comparison */}
                <section className={`mb-32 sm:mb-40 border-t-2 pt-16 sm:pt-20 ${isLight ? 'border-[#203e5f]/20' : 'border-[#203e5f]'}`}>
                    <div className="grid gap-12 md:grid-cols-12 md:gap-14">
                        <div className="md:col-span-5">
                            <div className={`text-xs font-bold uppercase tracking-widest mb-3 ${isLight ? 'text-[#203e5f]' : 'text-[#ffcc00]'}`}>
                                Capital Readiness
                            </div>
                            <h2 className={`text-3xl sm:text-4xl font-bold leading-tight tracking-tight mb-5 ${isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'}`}>
                                {invTitle}
                            </h2>
                            <p className={`text-base font-semibold leading-relaxed mb-5 ${isLight ? 'text-[#203e5f]' : 'text-[#fee5b1]'}`}>
                                {invIntro}
                            </p>
                            <p className={`text-sm leading-relaxed mb-6 ${isLight ? 'text-[#1a2634]/85' : 'text-[#eaeaea]/85'}`}>
                                {compEvidenceFooter}
                            </p>
                            <div className="p-5 rounded-lg bg-[#203e5f] text-[#fee5b1] border-l-4 border-[#ffcc00] text-sm font-medium leading-relaxed">
                                {invFooter}
                            </div>
                        </div>

                        <div className="md:col-span-7 grid sm:grid-cols-2 gap-8">
                            <div
                                className={`rounded-xl p-7 border-t-4 border-t-[#fee5b1] border ${
                                    isLight ? 'bg-white border-[#203e5f]/20' : 'bg-[#203e5f]/45 border-[#203e5f]'
                                }`}
                            >
                                <h3 className={`text-xl font-bold mb-5 ${isLight ? 'text-[#203e5f]' : 'text-[#fee5b1]'}`}>
                                    {angelsTitle}
                                </h3>
                                <ul
                                    className={`divide-y border-t pl-0 list-none m-0 ${
                                        isLight ? 'divide-[#203e5f]/15 border-[#203e5f]/15' : 'divide-white/12 border-white/15'
                                    }`}
                                >
                                    {angelsPoints.map((p: any, i: number) => (
                                        <li key={i} className={`py-3.5 text-sm font-semibold ${isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'}`}>
                                            {p.text}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div
                                className={`rounded-xl p-7 border-t-4 border-t-[#ffcc00] border ${
                                    isLight ? 'bg-white border-[#203e5f]/20' : 'bg-[#203e5f]/75 border-[#ffcc00]/30'
                                }`}
                            >
                                <h3 className={`text-xl font-bold mb-5 ${isLight ? 'text-[#1a2634]' : 'text-[#ffcc00]'}`}>
                                    {vcsTitle}
                                </h3>
                                <ul
                                    className={`divide-y border-t pl-0 list-none m-0 ${
                                        isLight ? 'divide-[#203e5f]/15 border-[#203e5f]/15' : 'divide-white/12 border-white/15'
                                    }`}
                                >
                                    {vcsPoints.map((p: any, i: number) => (
                                        <li key={i} className={`py-3.5 text-sm font-bold flex items-center gap-2.5 ${isLight ? 'text-[#1a2634]' : 'text-white'}`}>
                                            <span className="text-[#ffcc00]">✓</span>
                                            <span>{p.text}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </section>

                {/* LEARNING SCIENCE & TELEMETRY — Full-Width 2-Column Spread */}
                <section className={`mb-32 sm:mb-40 border-t-2 pt-16 sm:pt-20 ${isLight ? 'border-[#203e5f]/20' : 'border-[#203e5f]'}`}>
                    <div className="grid gap-14 md:grid-cols-12 md:gap-16">
                        <div className="md:col-span-5">
                            <h2 className={`text-2xl sm:text-3xl font-bold tracking-tight mb-3 ${isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'}`}>
                                {sciTitle}
                            </h2>
                            <p className={`text-sm font-medium leading-relaxed mb-7 ${isLight ? 'text-[#203e5f]' : 'text-[#fee5b1]'}`}>
                                {sciSubtitle}
                            </p>
                            <ul
                                className={`divide-y border-t-2 border-b-2 pl-0 list-none m-0 ${
                                    isLight ? 'divide-[#203e5f]/15 border-[#203e5f]/20' : 'divide-[#203e5f] border-[#203e5f]'
                                }`}
                            >
                                {sciPoints.map((p: any, i: number) => (
                                    <li key={i} className="py-4 text-sm font-bold flex items-center gap-3">
                                        <span className="text-[#ffcc00]">■</span>
                                        <span>{p.text}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="md:col-span-7">
                            <h2 className={`text-2xl sm:text-3xl font-bold tracking-tight mb-3 ${isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'}`}>
                                {metricsTitle}
                            </h2>
                            <p className={`text-sm font-medium leading-relaxed mb-7 ${isLight ? 'text-[#203e5f]' : 'text-[#fee5b1]'}`}>
                                Measurable programme outputs recorded across every 100-day cohort:
                            </p>
                            <div
                                className={`grid sm:grid-cols-2 gap-x-8 divide-y border-t-2 border-b-2 ${
                                    isLight ? 'divide-[#203e5f]/15 border-[#203e5f]/20' : 'divide-[#203e5f] border-[#203e5f]'
                                }`}
                            >
                                {metricsPoints.map((p: any, i: number) => (
                                    <div key={i} className="py-4 flex items-baseline gap-3.5 text-sm">
                                        <span className={`text-xs font-extrabold shrink-0 ${isLight ? 'text-[#203e5f]' : 'text-[#ffcc00]'}`}>
                                            0{i + 1}
                                        </span>
                                        <span className={`font-semibold ${isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'}`}>{p.text}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                <FaqSection settings={settings} theme={theme} />

                {/* PRICING & LEGAL — Required for PayNow / Polish e-commerce compliance */}
                <section id="pricing" className={`mb-20 border-t-2 pt-16 sm:pt-20 ${isLight ? 'border-[#203e5f]/20' : 'border-[#203e5f]'}`}>
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-10 gap-6">
                        <div>
                            <div className={`text-xs font-bold uppercase tracking-widest mb-2 ${isLight ? 'text-[#203e5f]' : 'text-[#ffcc00]'}`}>
                                Programme Access
                            </div>
                            <h2 className={`text-3xl sm:text-5xl font-bold tracking-tight m-0 ${isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'}`}>
                                {pricing[pricingLang].sectionTitle}
                            </h2>
                        </div>
                        <div
                            className={`inline-flex self-start items-center gap-1 border rounded-md p-1 ${
                                isLight ? 'bg-white border-[#203e5f]/25' : 'bg-[#203e5f] border-[#fee5b1]/25'
                            }`}
                        >
                            <button
                                onClick={() => setPricingLang('en')}
                                className={`px-4 py-1.5 rounded text-xs font-extrabold transition-colors cursor-pointer ${
                                    pricingLang === 'en'
                                        ? 'bg-[#ffcc00] text-[#1a2634]'
                                        : isLight
                                          ? 'text-[#203e5f] hover:text-[#1a2634]'
                                          : 'text-[#fee5b1] hover:text-white'
                                }`}
                            >
                                EUR
                            </button>
                            <button
                                onClick={() => setPricingLang('pl')}
                                className={`px-4 py-1.5 rounded text-xs font-extrabold transition-colors cursor-pointer ${
                                    pricingLang === 'pl'
                                        ? 'bg-[#ffcc00] text-[#1a2634]'
                                        : isLight
                                          ? 'text-[#203e5f] hover:text-[#1a2634]'
                                          : 'text-[#fee5b1] hover:text-white'
                                }`}
                            >
                                PLN
                            </button>
                        </div>
                    </div>

                    <div
                        className={`rounded-xl border border-t-4 border-t-[#ffcc00] overflow-hidden ${
                            isLight
                                ? 'bg-white border-[#203e5f]/25'
                                : 'bg-[#203e5f]/55 border-[#203e5f]'
                        }`}
                    >
                        <div className={`grid md:grid-cols-12 border-b ${isLight ? 'border-[#203e5f]/15' : 'border-white/15'}`}>
                            <div className="md:col-span-7 p-8 sm:p-12 flex flex-col justify-between">
                                <div>
                                    <h3 className={`text-2xl sm:text-3xl font-bold mb-4 ${isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'}`}>
                                        {pricing[pricingLang].serviceName}
                                    </h3>
                                    <p className={`text-base leading-relaxed mb-8 max-w-xl ${isLight ? 'text-[#203e5f]' : 'text-[#eaeaea]/85'}`}>
                                        {pricing[pricingLang].serviceDescription}
                                    </p>
                                    <ul className="space-y-3 pl-0 list-none">
                                        {pricing[pricingLang].features.map((f: any, i: number) => (
                                            <li
                                                key={i}
                                                className={`flex items-center gap-3 text-sm font-bold ${
                                                    isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'
                                                }`}
                                            >
                                                <span className="text-[#ffcc00] font-extrabold">✓</span>
                                                <span>{f.text}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div className={`mt-10 pt-6 border-t space-y-1 ${isLight ? 'border-[#203e5f]/15' : 'border-white/15'}`}>
                                    <p className={`text-xs ${isLight ? 'text-[#203e5f]' : 'text-[#eaeaea]/80'}`}>
                                        {pricing[pricingLang].individualNote}
                                    </p>
                                    <p className={`text-xs font-bold ${isLight ? 'text-[#1a2634]' : 'text-[#fee5b1]'}`}>
                                        {pricing[pricingLang].partnerNote}
                                    </p>
                                </div>
                            </div>

                            <div className="md:col-span-5 p-8 sm:p-12 flex flex-col justify-between border-t md:border-t-0 md:border-l bg-[#1a2634] border-white/15 text-[#eaeaea]">
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-xs font-bold text-[#fee5b1]">
                                            Programme access fee
                                        </span>
                                        {logoUrl && (
                                            <img src={logoUrl} alt={companyName} className="h-6 object-contain" />
                                        )}
                                    </div>
                                    <div className="text-4xl sm:text-5xl font-extrabold tracking-tight text-[#ffcc00]">
                                        {pricingLang === 'en' ? pricingPriceDisplayEur : pricingPriceDisplay}
                                    </div>
                                    <div className="text-xs mt-1.5 text-[#fee5b1]">
                                        {pricing[pricingLang].vatInfo}
                                    </div>

                                    <div className="mt-8 grid gap-3">
                                        <button
                                            onClick={addProductToCart}
                                            className="w-full rounded-md px-5 py-3.5 text-xs font-extrabold uppercase tracking-wider text-[#1a2634] bg-[#ffcc00] hover:bg-[#fee5b1] transition-colors cursor-pointer"
                                        >
                                            {pricingLang === 'pl' ? 'Dodaj do koszyka →' : 'Add to cart →'}
                                        </button>
                                        <Link
                                            href="/cart"
                                            className="w-full rounded-md px-5 py-3 text-xs font-bold uppercase tracking-wider border border-[#fee5b1]/35 bg-[#203e5f]/60 text-[#fee5b1] hover:border-[#ffcc00] hover:text-[#ffcc00] transition-colors text-center"
                                        >
                                            {pricingLang === 'pl' ? 'Zobacz koszyk' : 'View cart'}
                                        </Link>
                                    </div>
                                </div>

                                <div className="mt-10 pt-6 border-t border-white/15">
                                    <div className="text-[11px] text-[#eaeaea]/80">
                                        {pricing[pricingLang].paymentMethods}
                                    </div>
                                    <p className="text-[11px] mt-1 text-[#eaeaea]/60">
                                        {pricingLang === 'pl'
                                            ? 'Podmiotem świadczącym obsługę płatności online w zakresie płatności kartami jest Autopay S.A.'
                                            : 'Card payments are handled online by Autopay S.A.'}
                                    </p>
                                    <img
                                        src="/paynow/banner-payment-methods.png"
                                        alt="Paynow, BLIK, Visa, Mastercard and Google Pay payment methods"
                                        className="mt-3 w-full h-auto rounded-md border border-white/15"
                                    />
                                    <div className="mt-3 flex items-center gap-3">
                                        <img
                                            src="/paynow/banner-autopay-cards.png"
                                            alt="Visa, Mastercard"
                                            className="h-7 w-auto object-contain"
                                        />
                                        <img
                                            src="/paynow/logo-autopay.webp"
                                            alt="Autopay"
                                            className="h-4.5 w-auto object-contain"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Legal info grid */}
                        <div
                            className={`grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x ${
                                isLight ? 'divide-[#203e5f]/15 bg-[#fee5b1]/35' : 'divide-white/15 bg-[#1a2634]/70'
                            }`}
                        >
                            <div className="p-7 sm:p-8">
                                <h4 className={`text-xs font-bold mb-1.5 ${isLight ? 'text-[#1a2634]' : 'text-[#ffcc00]'}`}>
                                    {pricing[pricingLang].activationLabel}
                                </h4>
                                <p className={`text-xs leading-relaxed m-0 ${isLight ? 'text-[#203e5f]' : 'text-[#eaeaea]/85'}`}>
                                    {pricing[pricingLang].activationInfo}
                                </p>
                            </div>
                            <div className="p-7 sm:p-8">
                                <h4 className={`text-xs font-bold mb-1.5 ${isLight ? 'text-[#1a2634]' : 'text-[#ffcc00]'}`}>
                                    {pricing[pricingLang].returnLabel}
                                </h4>
                                <p className={`text-xs leading-relaxed m-0 ${isLight ? 'text-[#203e5f]' : 'text-[#eaeaea]/85'}`}>
                                    {pricing[pricingLang].returnPolicy}
                                </p>
                            </div>
                            <div className="p-7 sm:p-8">
                                <h4 className={`text-xs font-bold mb-1.5 ${isLight ? 'text-[#1a2634]' : 'text-[#ffcc00]'}`}>
                                    {pricing[pricingLang].complaintLabel}
                                </h4>
                                <p className={`text-xs leading-relaxed m-0 ${isLight ? 'text-[#203e5f]' : 'text-[#eaeaea]/85'}`}>
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
                                <div className={`px-8 py-4 border-t text-left flex items-center justify-between ${isLight ? 'border-[#203e5f]/15' : 'border-white/15'}`}>
                                    <p className={`text-xs m-0 ${isLight ? 'text-[#203e5f]' : 'text-[#eaeaea]/75'}`}>
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
