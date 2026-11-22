'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { QuestionRenderer } from '@/components/QuestionRenderer';
import { submitFounderForm } from '@/app/actions';
import { SerializeRichText } from '@/components/SerializeRichText';
import { useRouter } from 'next/navigation';
import { sections as defaultSections } from './data';
import { Section } from './types';
import Link from 'next/link';
import SiteFooter from '@/components/SiteFooter';
import MesgaHorizontalLogo from '@/components/MesgaHorizontalLogo';
import PersonalityResults from '@/components/PersonalityResults';
import { useFormAutoSave, type FormAutoSaveType } from '@/hooks/useFormAutoSave';
import { calculateScores, extractScoringConfig, type PersonalityScores } from '@/lib/scoring';
import { type BrandingColors, computeProgramProgress, getPhaseTextColor, getPhaseBackground, getPhaseBarColor, getPhaseColorConfig } from '@/lib/partnerBranding';
import { normalizeEstimatedTimeHrs } from '@/lib/estimatedTime';
import { useLanguage } from '@/lib/i18n';
import { resolveLocalizedLegalDocument } from '@/lib/legalDocuments';
import {
    getPreferredTrackVisual,
    resolvePreferredTrackSlug,
    setPreferredTrackCookie,
} from '@/lib/preferredTrack';
import { setLandingTrackIntakeContext } from '@/lib/intakeContext';
import { makePreworkSectionsOptional } from './preworkRequirements';

interface DayDefinitionContext {
    title?: string | null;
    activity?: string | null;
    blockType?: string | null;
    theme?: string | null;
    founderCommandment?: string | null;
    mainSoetMission?: string | null;
    deliverable?: string | null;
    exampleProject?: string | null;
    whereHowTips?: string | null;
    autoCheckCriteria?: string | null;
    mesgaIntegration?: string | null;
    estimatedTimeHrs?: number | null;
    eduType?: string | null;
    eduLinks?: Array<{ label: string; url: string; type?: string }> | null;
    blockFocus?: string | null;
    weekNumber?: number | null;
    coachingNote?: string | null;
}

interface FounderFormProps {
    form?: any;
    partners?: { id: number; name: string }[];
    initialPartnerId?: number | null;
    platformSettings?: any;
    availableTracks?: { id: number; name: string; slug: string; description?: string | null }[];
    preferredTrackSlug?: string | null;
    partnerSelectionLocked?: boolean;
    lockedPartner?: { id: number; name: string; slug?: string | null; logoUrl?: string | null } | null;
    trackSelectionLocked?: boolean;
    lockedTrack?: { id: number; name: string; slug: string; description?: string | null } | null;
    dayDefinitionContext?: DayDefinitionContext | null;
    isDailyForm?: boolean;
    isPrework?: boolean;
    dayNumber?: number | null;
    partnerBrandingColors?: BrandingColors | null;
    readOnly?: boolean;
    existingAnswers?: Record<string, any> | null;
    projectWorkspaceUrl?: string | null;
}

const CURRENT_LOCATION_FIELDS = ['F2_CURRENT_COUNTRY', 'F2_CURRENT_CITY'] as const
const RELOCATION_FIELDS = [
    'F2_RELOC_FROM_COUNTRY',
    'F2_RELOC_FROM_CITY',
    'F2_RELOC_TO_COUNTRY',
    'F2_RELOC_TO_CITY',
] as const
const DAILY_SUMMARY_NOTE_HELPER = "Summarize today's work in 2–3 sentences. The full artifact lives in your project workspace doc."
const OPTIONAL_PROFILE_NOTICE_SECTION_ID = 'optional_profile_notice'
const OPTIONAL_PROFILE_SECTION_IDS = ['geography', 'education', 'work_activity', 'socioeconomic', 'foaled'] as const
const OPTIONAL_PROFILE_SECTION_SET = new Set<string>(OPTIONAL_PROFILE_SECTION_IDS)
const OPTIONAL_PROFILE_QUESTION_PREFIXES = ['F2_', 'F3_', 'F3B_', 'F4_', 'F5_'] as const
const MAIN_INTAKE_FINAL_SECTION_IDS = ['foaled', 'quality_control', 'big_five', 'self_efficacy', 'risk_taking', 'behavioral_anchors', 'mesga_fit'] as const
const MAIN_INTAKE_FINAL_SECTION_SET = new Set<string>(MAIN_INTAKE_FINAL_SECTION_IDS)
const MAIN_INTAKE_TOTAL_STEPS = 3 as const
const LEGACY_OPTIONAL_PROFILE_STEP_DESCRIPTION = 'Completing this section helps us match you with more relevant investors, partners, and programme opportunities. You can skip it, but better context leads to better introductions.'
const OPTIONAL_PROFILE_STEP_DESCRIPTION = 'Helps us match you with the right investors, mentors, and programme route.'
const LEGACY_OPTIONAL_PROFILE_NOTICE_BADGE = 'Recommended for better matching'
const OPTIONAL_PROFILE_NOTICE_BADGE = 'Affects your matching score'
const LEGACY_OPTIONAL_PROFILE_NOTICE_TITLE = 'Improve your investor matching'
const LEGACY_OPTIONAL_PROFILE_NOTICE_TITLE_ALT = 'Additional information'
const OPTIONAL_PROFILE_NOTICE_TITLE = 'This section directly affects your programme route and investor introductions.'
const LEGACY_OPTIONAL_PROFILE_NOTICE_BODY = 'These answers help us match you with more relevant investors, partners, and the right programme route. You can skip this section, but completing it gives us better context for stronger introductions.'
const OPTIONAL_PROFILE_NOTICE_BODY = [
    'Skip it and you get a generic experience. Complete it and we match you with the right investors, mentors, and 100-day track — based on where you actually are, not where the average founder is.',
    'Why this matters',
    '01 Investor & mentor matching — We rank investor and mentor profiles by fit with your stage, vertical, and geography — not alphabetically.',
    '02 Your 100-day route — Your answers personalise which challenges, sessions, and introductions you get access to first — and in what order.',
    '3× more relevant introductions on average for founders who complete this section vs. those who skip it.',
    'Takes approximately 3 minutes to complete.',
].join('\n\n')
const DEFAULT_MAIN_INTAKE_STEP_META = {
    1: {
        eyebrow: 'Step 1 of 3',
        title: 'Track + basics',
        description: 'Choose the most relevant track and complete your core founder/application details.',
    },
    2: {
        eyebrow: 'Step 2 of 3',
        title: 'Additional information',
        description: OPTIONAL_PROFILE_STEP_DESCRIPTION,
    },
    3: {
        eyebrow: 'Step 3 of 3',
        title: 'Founder mindset',
        description: 'Finish your leadership archetype and mindset/personality sections.',
    },
} as const

function isOptionalProfileQuestion(questionId: string) {
    return OPTIONAL_PROFILE_QUESTION_PREFIXES.some((prefix) => questionId.startsWith(prefix))
}

function buildOptionalProfileNoticeSection(optionalProfileNoticeBody: string): Section {
    return {
        id: OPTIONAL_PROFILE_NOTICE_SECTION_ID,
        title: '🟠 Additional information',
        questions: [
            {
                question_id: 'OPTIONAL_PROFILE_NOTICE',
                question_text: optionalProfileNoticeBody,
                question_type: 'statement',
                statementVariant: 'optional_profile_notice',
            },
        ],
    }
}

function resolveFounderFormCopy(value: unknown, fallback: string, legacyValues: string[] = []) {
    if (typeof value !== 'string') return fallback

    const trimmed = value.trim()
    if (!trimmed || legacyValues.includes(trimmed)) return fallback

    return value
}

function isAffirmativeAnswer(value: unknown) {
    return value === 'Yes' || value === true
}

function normalizeLocationValue(value: unknown) {
    return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function isSamePlace(countryA: unknown, cityA: unknown, countryB: unknown, cityB: unknown) {
    const normCountryA = normalizeLocationValue(countryA)
    const normCityA = normalizeLocationValue(cityA)
    const normCountryB = normalizeLocationValue(countryB)
    const normCityB = normalizeLocationValue(cityB)

    return Boolean(normCountryA && normCityA && normCountryA === normCountryB && normCityA === normCityB)
}

function getMainIntakeStepForSection(sectionId: string): 1 | 2 | 3 {
    if (OPTIONAL_PROFILE_SECTION_SET.has(sectionId) || sectionId === OPTIONAL_PROFILE_NOTICE_SECTION_ID) return 2
    if (MAIN_INTAKE_FINAL_SECTION_SET.has(sectionId)) return 3
    return 1
}

function TrackSelectionPanel({
    tracks,
    selectedTrackSlug,
    onSelect,
}: {
    tracks: { id: number; name: string; slug: string; description?: string | null }[]
    selectedTrackSlug: string | null
    onSelect: (trackSlug: string) => void
}) {
    return (
        <div className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="rounded-[28px] border border-white/10 bg-[#111113]/90 overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
                <div className="h-1 w-full bg-linear-to-r from-[#2CB1A1] via-[#ffcc00] to-[#ffcc00]" />
                <div className="px-6 py-6 md:px-8 md:py-7">
                    <div className="mb-5">
                        <p className="text-[11px] font-bold uppercase tracking-[3px] text-[#ffcc00] mb-2">Specialised Tracks</p>
                        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                            <div>
                                <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white">Choose your track before you apply.</h2>
                                <p className="text-sm text-white/70 max-w-2xl mt-2">
                                    This helps us route you to the most relevant programme path and reviewers. You can still adjust it later in your project setup.
                                </p>
                            </div>
                            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[2px] text-white/65">
                                Default applied automatically
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                        {tracks.map((track) => {
                            const active = selectedTrackSlug === track.slug
                            const visual = getPreferredTrackVisual(track.slug)

                            return (
                                <button
                                    key={track.id}
                                    type="button"
                                    onClick={() => onSelect(track.slug)}
                                    className="group relative overflow-hidden rounded-3xl border text-left transition-all duration-200 cursor-pointer"
                                    style={{
                                        borderColor: active ? `${visual.color}55` : 'rgba(255,255,255,0.08)',
                                        background: active ? `${visual.color}12` : 'rgba(255,255,255,0.02)',
                                        boxShadow: active ? `0 24px 50px -30px ${visual.color}` : 'none',
                                    }}
                                >
                                    <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${visual.color}, transparent)` }} />
                                    <div className="p-5">
                                        <div className="flex items-start justify-between gap-4 mb-4">
                                            <div
                                                className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl border"
                                                style={{ background: `${visual.color}18`, borderColor: `${visual.color}30` }}
                                            >
                                                {visual.icon}
                                            </div>
                                            <div
                                                className="shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[2px]"
                                                style={{
                                                    borderColor: active ? `${visual.color}45` : 'rgba(255,255,255,0.08)',
                                                    color: active ? visual.color : 'rgba(255,255,255,0.28)',
                                                    background: active ? `${visual.color}12` : 'rgba(255,255,255,0.03)',
                                                }}
                                            >
                                                {active ? 'Selected' : 'Available'}
                                            </div>
                                        </div>

                                        <div className="mb-2 text-lg font-bold text-white">{track.name}</div>
                                        <p className="text-sm leading-relaxed" style={{ color: active ? 'rgba(255,255,255,0.86)' : 'rgba(255,255,255,0.45)' }}>
                                            {track.description || 'Track focus will be attached to your application and project review.'}
                                        </p>
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>
    )
}

function LockedTrackPanel({
    track,
    title = 'Selected track',
    description = 'This intake is using a single track, so other track options are hidden here.',
    badgeLabel = 'Locked',
}: {
    track: { id: number; name: string; slug: string; description?: string | null }
    title?: string
    description?: string
    badgeLabel?: string
}) {
    const visual = getPreferredTrackVisual(track.slug)

    return (
        <div className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div
                className="overflow-hidden rounded-[28px] border shadow-[0_24px_80px_rgba(0,0,0,0.35)]"
                style={{ borderColor: `${visual.color}30`, background: `${visual.color}10` }}
            >
                <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${visual.color}, transparent)` }} />
                <div className="px-6 py-6 md:px-8 md:py-7">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="flex items-start gap-4">
                            <div
                                className="flex h-14 w-14 items-center justify-center rounded-2xl border text-2xl"
                                style={{ background: `${visual.color}18`, borderColor: `${visual.color}35` }}
                            >
                                {visual.icon}
                            </div>
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-[3px]" style={{ color: visual.color }}>
                                    {title}
                                </p>
                                <h2 className="mt-2 text-2xl font-black tracking-tight text-white">{track.name}</h2>
                                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/72">
                                    {description}
                                </p>
                            </div>
                        </div>
                        <div
                            className="inline-flex rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[2px]"
                            style={{ borderColor: `${visual.color}40`, color: visual.color, background: `${visual.color}12` }}
                        >
                            {badgeLabel}
                        </div>
                    </div>
                    {track.description && (
                        <p className="mt-5 max-w-3xl text-sm leading-relaxed text-white/68">
                            {track.description}
                        </p>
                    )}
                </div>
            </div>
        </div>
    )
}

function LockedPartnerPanel({ partnerName, logoUrl = null }: { partnerName: string; logoUrl?: string | null }) {
    return (
        <div className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center gap-4 mb-2">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#ffcc00]/10 border border-[#ffcc00]/20 flex items-center justify-center text-[#ffcc00] text-sm font-bold">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-white/90">Referred by</h2>
                </div>
                <div className="h-px bg-white/10 flex-1"></div>
            </div>

            <div className="rounded-2xl border border-[#ffcc00]/20 bg-[#ffcc00]/[0.08] px-5 py-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#ffcc00]">Partner Invite</p>
                <p className="mt-2 text-lg font-bold text-white">You&apos;re coming from {partnerName}.</p>
                {logoUrl && (
                    <div className="mt-4 flex min-h-[88px] items-center justify-start overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                        <img
                            src={logoUrl}
                            alt={`${partnerName} logo`}
                            className="max-h-14 w-auto max-w-full object-contain"
                        />
                    </div>
                )}
            </div>
        </div>
    )
}

function DayNumberBadge({ dayNumber, compact = false }: { dayNumber: number; compact?: boolean }) {
    return (
        <div
            className={`inline-flex items-center gap-2 rounded-full border border-[#ffcc00]/25 bg-[#ffcc00]/12 text-[#F6D97A] shadow-[0_14px_40px_-28px_rgba(228,185,77,0.8)] ${compact ? 'px-3.5 py-1.5' : 'px-4 py-2'}`}
        >
            <span className={`font-black uppercase tracking-[0.28em] ${compact ? 'text-[11px]' : 'text-xs'}`}>Day</span>
            <span className={compact ? 'text-base font-black leading-none' : 'text-lg font-black leading-none'}>{dayNumber}</span>
        </div>
    )
}

function hasWorkspaceUrl(value: string | null | undefined): boolean {
    return (value ?? '').trim().length > 0
}

function WorkspaceStatementCard({
    workspaceUrl,
    dashboard,
    body,
    helperText,
}: {
    workspaceUrl: string | null | undefined
    dashboard: any
    body?: string
    helperText?: string
}) {
    const hasWorkspace = hasWorkspaceUrl(workspaceUrl)
    const title = dashboard?.projectWorkspaceCardTitle || 'Project workspace'
    const readyBody = body || dashboard?.projectWorkspaceCardBody || 'Keep all daily deliverables, notes, links, and artifacts in one working document so reviews stay anchored in the same place.'
    const missingBody = dashboard?.projectWorkspaceCardMissingBody || 'Add one workspace link before you continue. This is where your missions, proofs, and weekly outputs should live.'
    const openLabel = dashboard?.projectWorkspaceCardOpenLabel || 'Open workspace'
    const missingLabel = dashboard?.projectWorkspaceCardMissingLabel || 'Add workspace link'

    return (
        <section className={`rounded-3xl border p-6 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-700 ${hasWorkspace ? 'border-[#ffcc00]/20 bg-[#ffcc00]/[0.06]' : 'border-[#F59E0B]/25 bg-[#F59E0B]/[0.08]'}`}>
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                    <div className={`mb-2 text-[10px] font-bold uppercase tracking-[0.24em] ${hasWorkspace ? 'text-[#ffcc00]' : 'text-[#F59E0B]'}`}>
                        {title}
                    </div>
                    <h3 className="text-xl font-bold text-white">{hasWorkspace ? 'Your execution hub is ready' : 'Set up your execution hub'}</h3>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/60">
                        {hasWorkspace ? readyBody : missingBody}
                    </p>
                    {helperText && (
                        <p className="mt-3 max-w-2xl text-xs leading-relaxed text-white/55">
                            {helperText}
                        </p>
                    )}
                    {hasWorkspace && (
                        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-white/70">
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">All deliverables should live here</span>
                            <span className="truncate max-w-full">{workspaceUrl}</span>
                        </div>
                    )}
                </div>

                <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                    {hasWorkspace ? (
                        <a
                            href={workspaceUrl ?? ''}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center rounded-full bg-[#ffcc00] px-5 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
                        >
                            {openLabel}
                        </a>
                    ) : (
                        <Link
                            href="/?project=1"
                            className="inline-flex items-center justify-center rounded-full bg-[#F59E0B] px-5 py-3 text-sm font-bold text-[#1a2634] transition-opacity hover:opacity-90"
                        >
                            {missingLabel}
                        </Link>
                    )}
                </div>
            </div>
        </section>
    )
}

function WorkflowIntroStatementCard({
    question,
}: {
    question: { question_text?: string; helperText?: string }
}) {
    const helperText = typeof question.helperText === 'string' ? question.helperText : ''
    const helperParts = helperText
        .split('|')
        .map((part) => part.trim())
        .filter(Boolean)

    const labeledParts = helperParts.map((part) => {
        const match = part.match(/^([^:]+):\s*(.+)$/)
        if (!match) return { label: '', value: part }
        return { label: match[1].trim(), value: match[2].trim() }
    })

    const themeValue = labeledParts.find((part) => part.label.toLowerCase() === 'theme')?.value
    const deliverableValue = labeledParts.find((part) => part.label.toLowerCase() === 'deliverable')?.value
    const otherParts = labeledParts.filter((part) => {
        const key = part.label.toLowerCase()
        return key !== 'theme' && key !== 'deliverable'
    })

    return (
        <div className="mb-8 rounded-2xl border border-white/10 bg-white/2 p-5 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-700">
            {themeValue && (
                <div className="mb-3 flex items-center gap-3 flex-wrap">
                    <span className="text-sm font-semibold text-[#ffcc00]/80">{themeValue}</span>
                </div>
            )}
            <div className="rounded-xl bg-white/3 border border-white/10 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50 mb-1">Focus</p>
                <p className="text-white/90 text-[15px] md:text-base leading-relaxed">{question.question_text}</p>
            </div>
            {deliverableValue && (
                <div className="mt-3 rounded-xl bg-[#ffcc00]/6 border border-[#ffcc00]/15 px-4 py-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#ffcc00]/70 mb-1">Deliverable</p>
                    <p className="text-white/90 text-[15px] md:text-base leading-relaxed">{deliverableValue}</p>
                </div>
            )}
            {otherParts.map((part, index) => (
                <div key={`${part.label}-${index}`} className="mt-3 rounded-xl bg-white/3 border border-white/10 px-4 py-2.5">
                    {part.label && (
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50 mb-1">{part.label}</p>
                    )}
                    <p className="text-white/80 text-[14px] md:text-[15px] leading-relaxed">{part.value}</p>
                </div>
            ))}
        </div>
    )
}

function OptionalProfileNoticeCard({
    badge,
    title,
    body,
}: {
    badge: string
    title: string
    body: string
}) {
    const paragraphs = body
        .split(/\n+/)
        .map((part) => part.trim())
        .filter(Boolean)
    const introParagraphs: string[] = []
    const numberedItems: Array<{ number: string; title: string; text: string }> = []
    let sectionLabel = ''
    let statNumber = ''
    let statText = ''
    let timeNote = ''

    paragraphs.forEach((paragraph) => {
        const numberedMatch = paragraph.match(/^(\d{2})\s+(.+?)\s+—\s+(.+)$/)
        const statMatch = paragraph.match(/^(\d+×)\s+(.+)$/)

        if (/^why this matters$/i.test(paragraph)) {
            sectionLabel = paragraph
        } else if (numberedMatch) {
            numberedItems.push({
                number: numberedMatch[1],
                title: numberedMatch[2],
                text: numberedMatch[3],
            })
        } else if (statMatch) {
            statNumber = statMatch[1]
            statText = statMatch[2]
        } else if (/^takes approximately/i.test(paragraph)) {
            timeNote = paragraph
        } else {
            introParagraphs.push(paragraph)
        }
    })

    return (
        <section className="rounded-[28px] border border-[#f59e0b]/30 bg-linear-to-br from-[#f59e0b]/[0.16] via-[#fb923c]/[0.1] to-[#111113]/85 p-6 shadow-[0_24px_80px_-56px_rgba(249,115,22,0.95)] backdrop-blur-sm">
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                    <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#fdba74]/30 bg-[#fdba74]/12 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-[#fdba74]">
                        <span className="inline-flex h-2 w-2 rounded-full bg-[#fb923c]" />
                        {badge}
                    </div>
                    <h3 className="text-xl font-black tracking-tight text-[#fff4e6] md:text-2xl">{title}</h3>
                    <div className="mt-3 space-y-3 text-sm leading-relaxed text-[#ffedd5]/85">
                        {(numberedItems.length > 0 ? introParagraphs : paragraphs).map((paragraph, index) => (
                            <p key={`${paragraph}-${index}`}>{paragraph}</p>
                        ))}
                    </div>
                    {numberedItems.length > 0 && (
                        <div className="mt-6 border-t border-[#fdba74]/18 pt-5">
                            {sectionLabel && (
                                <div className="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.24em] text-[#fdba74]/80">
                                    <span className="text-base leading-none">↳</span>
                                    <span>{sectionLabel}</span>
                                </div>
                            )}
                            <div className="grid gap-4 md:grid-cols-2">
                                {numberedItems.map((item) => (
                                    <div key={item.number} className="flex gap-4 border-l border-[#fdba74]/22 pl-4">
                                        <div className="shrink-0 text-2xl font-black leading-none text-[#fdba74]">
                                            {item.number}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold leading-snug text-[#fff4e6]">{item.title}</p>
                                            <p className="mt-1 text-sm leading-relaxed text-[#ffedd5]/68">{item.text}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {statText && (
                                <div className="mt-5 flex items-center gap-4 border-y border-[#fdba74]/16 py-4">
                                    <div className="shrink-0 text-3xl font-black leading-none text-[#fdba74]">{statNumber}</div>
                                    <p className="text-sm leading-relaxed text-[#ffedd5]/72">{statText}</p>
                                </div>
                            )}
                            {timeNote && (
                                <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-[#ffedd5]/52">
                                    <span aria-hidden="true">⏱</span>
                                    <span>{timeNote}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <div className="shrink-0 rounded-3xl border border-[#fdba74]/25 bg-[#111113]/35 p-4 text-[#fdba74]">
                    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 1 0-7.18 0M12 18.75a6.75 6.75 0 0 0 6.75-6.75V9.75a6.75 6.75 0 1 0-13.5 0V12A6.75 6.75 0 0 0 12 18.75Zm0 0v2.25m-3-2.25h6" />
                    </svg>
                </div>
            </div>
        </section>
    )
}

function DailyFormHeader({ dayNumber, branding, dayDefinitionContext, formTitle, showMesgaTool }: {
    dayNumber: number
    branding: BrandingColors
    dayDefinitionContext: DayDefinitionContext | null
    formTitle: string
    showMesgaTool: boolean
}) {
    const progress = computeProgramProgress(dayNumber, branding)
    const estimatedTimeHrs = normalizeEstimatedTimeHrs(dayDefinitionContext?.estimatedTimeHrs)
    if (!progress) return null

    const { phases, gates, totalDays, daysRemaining, weekNumber, activePhaseIndex } = progress
    const activePhase = phases[activePhaseIndex]
    const activeColorCfg = getPhaseColorConfig(branding, activePhase.key)
    const activePhaseColor = getPhaseTextColor(activeColorCfg, activePhase.key)

    const barGradientStops = phases.map(ph => {
        const cfg = getPhaseColorConfig(branding, ph.key)
        const color = getPhaseBarColor(cfg, ph.key)
        const pct = Math.round((ph.startDay / totalDays) * 100)
        return `${color} ${pct}%`
    }).join(', ')

    const dayCounterCfg = branding.dayCounter
    const dayCounterColor = dayCounterCfg ? getPhaseTextColor(dayCounterCfg, 'mix') : activePhaseColor
    const dayCounterBg = dayCounterCfg ? (dayCounterCfg.type === 'gradient' ? getPhaseBackground(dayCounterCfg, 'mix') : null) : null
    const dayCounterIsGrad = dayCounterCfg?.type === 'gradient'

    return (
        <div className="mb-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
            {/* Day counter + title */}
            <div className="mb-6">
                <div className="min-w-0">
                    {dayCounterIsGrad && dayCounterBg ? (
                        <h1
                            className="text-2xl sm:text-3xl md:text-4xl font-black leading-tight"
                            style={{ background: dayCounterBg, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', display: 'inline-block' }}
                        >
                            {formTitle}
                        </h1>
                    ) : (
                        <h1 className="text-2xl sm:text-3xl md:text-4xl font-black leading-tight" style={{ color: dayCounterColor }}>
                            {formTitle}
                        </h1>
                    )}
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                        <DayNumberBadge dayNumber={dayNumber} />
                        <p
                            className="text-sm font-black md:text-base"
                            style={{ color: activePhaseColor }}
                        >
                            Week {weekNumber + 1} · {daysRemaining} days remaining
                        </p>
                        {estimatedTimeHrs && (
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/70">
                                ~{estimatedTimeHrs}h
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Phase labels */}
            <div className="grid gap-1 mb-3" style={{ gridTemplateColumns: `repeat(${phases.length}, minmax(0, 1fr))` }}>
                {phases.map((ph, i) => {
                    const isActive = i === activePhaseIndex
                    const isPast = i < activePhaseIndex
                    const cfg = getPhaseColorConfig(branding, ph.key)
                    const solidColor = getPhaseTextColor(cfg, ph.key)
                    return (
                        <div key={ph.key} className="text-center">
                            <div
                                className="text-xs font-bold tracking-widest uppercase mb-0.5"
                                style={{ color: isActive ? solidColor : isPast ? `${solidColor}70` : 'rgba(255,255,255,0.2)' }}
                            >
                                {ph.label}
                            </div>
                            <div className="text-[10px] text-white/50 hidden sm:block">{ph.subtitle}</div>
                        </div>
                    )
                })}
            </div>

            {/* Progress bar */}
            <div className="relative h-3 bg-white/5 rounded-full overflow-hidden mb-3">
                <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{
                        width: `${(dayNumber / totalDays) * 100}%`,
                        background: `linear-gradient(90deg, ${barGradientStops})`,
                    }}
                />
                {gates.map(gate => (
                    <div
                        key={gate.day}
                        className="absolute top-0 bottom-0 w-0.5 bg-white/20"
                        style={{ left: `${(gate.day / totalDays) * 100}%` }}
                    />
                ))}
            </div>
            <div className="flex justify-between text-[10px] text-white/50 mb-6">
                <span>Day 1</span>
                {gates.map(gate => (
                    <span key={gate.day}>Day {gate.day}</span>
                ))}
            </div>

            {/* Curriculum metadata card */}
            {dayDefinitionContext && (
                <div className="rounded-2xl border border-white/10 bg-white/2 backdrop-blur-sm p-5 space-y-1.5">
                    {dayDefinitionContext.theme && (
                        <div className="flex items-center gap-3 flex-wrap mb-2">
                            {dayDefinitionContext.weekNumber != null && (
                                <span className="text-[10px] font-bold uppercase tracking-widest text-white/65 px-2 py-0.5 rounded bg-white/5 border border-white/10">
                                    Week {dayDefinitionContext.weekNumber}
                                </span>
                            )}
                            <span className="text-sm font-semibold text-[#ffcc00]/80">{dayDefinitionContext.theme}</span>
                            {estimatedTimeHrs && (
                                <span className="text-[10px] text-white/65 px-2 py-0.5 rounded bg-white/5 border border-white/10">
                                    ~{estimatedTimeHrs}h
                                </span>
                            )}
                        </div>
                    )}
                    {/* YOUR TASK — main concrete action for this day */}
                    {dayDefinitionContext.mainSoetMission && (
                        <div className="rounded-xl border-2 border-[#2CB1A1]/50 bg-[#2CB1A1]/10 px-4 py-3.5 mb-1">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#2CB1A1] px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-[#1a2634]">
                                    YOUR TASK
                                </span>
                            </div>
                            <p className="text-white font-semibold text-[15px] md:text-base leading-relaxed">{dayDefinitionContext.mainSoetMission}</p>
                        </div>
                    )}
                    {dayDefinitionContext.founderCommandment && (
                        <div className="rounded-xl bg-[#ffcc00]/6 border border-[#ffcc00]/15 px-4 py-2.5">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#ffcc00]/70 mb-1">Commandment</p>
                            <p className="text-white/90 text-[15px] md:text-base italic leading-relaxed">&ldquo;{dayDefinitionContext.founderCommandment}&rdquo;</p>
                        </div>
                    )}
                    {dayDefinitionContext.deliverable && (
                        <div className="rounded-xl bg-[#ffcc00]/6 border border-[#ffcc00]/15 px-4 py-2.5">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#ffcc00]/70 mb-1">Deliverable</p>
                            <p className="text-white/90 text-[15px] md:text-base leading-relaxed">{dayDefinitionContext.deliverable}</p>
                        </div>
                    )}
                    {dayDefinitionContext.exampleProject && (
                        <div className="rounded-xl bg-violet-500/6 border border-violet-500/15 px-4 py-2.5 select-none">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-300/70 mb-1">Example Project</p>
                            <p className="text-white/90 text-[15px] md:text-base leading-relaxed">{dayDefinitionContext.exampleProject}</p>
                        </div>
                    )}
                    {dayDefinitionContext.whereHowTips && (
                        <div className="rounded-xl bg-emerald-500/6 border border-emerald-500/15 px-4 py-2.5">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400/70 mb-1">Tips</p>
                            <p className="text-white/90 text-[15px] md:text-base leading-relaxed">{dayDefinitionContext.whereHowTips}</p>
                        </div>
                    )}
                    {dayDefinitionContext.coachingNote && (
                        <div className="rounded-xl bg-fuchsia-500/6 border border-fuchsia-500/15 px-4 py-2.5">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-fuchsia-300/70 mb-1">Coaching Lens</p>
                            <p className="text-white/90 text-[15px] md:text-base leading-relaxed">{dayDefinitionContext.coachingNote}</p>
                        </div>
                    )}
                    {dayDefinitionContext.autoCheckCriteria && (
                        <div className="rounded-xl bg-purple-500/6 border border-purple-500/15 px-4 py-2.5">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-purple-400/70 mb-1">Criteria</p>
                            <p className="text-white/90 text-[15px] md:text-base leading-relaxed">{dayDefinitionContext.autoCheckCriteria}</p>
                        </div>
                    )}
                    {showMesgaTool && dayDefinitionContext.mesgaIntegration && (
                        <div className="rounded-xl bg-white/3 border border-white/10 px-4 py-2.5">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50 mb-1">MESGA Tool</p>
                            <p className="text-white/90 text-[15px] md:text-base leading-relaxed">{dayDefinitionContext.mesgaIntegration}</p>
                        </div>
                    )}
                    {dayDefinitionContext.eduLinks && dayDefinitionContext.eduLinks.length > 0 && (
                        <div className="rounded-xl bg-amber-500/6 border border-amber-500/15 px-4 py-2.5">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-400/70 mb-1">Learn</p>
                            <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                                {dayDefinitionContext.eduLinks.map((link: any, i: number) => (
                                    <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                                        className="text-[#ffcc00] text-[13px] hover:underline hover:text-[#ffcc00]/80 transition-colors">{link.label}</a>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

export default function FounderForm({
    form,
    partners = [],
    initialPartnerId = null,
    platformSettings,
    availableTracks = [],
    preferredTrackSlug = null,
    partnerSelectionLocked = false,
    lockedPartner = null,
    trackSelectionLocked = false,
    lockedTrack = null,
    dayDefinitionContext = null,
    isDailyForm = false,
    isPrework = false,
    dayNumber = null,
    partnerBrandingColors = null,
    readOnly = false,
    existingAnswers = null,
    projectWorkspaceUrl = null,
}: FounderFormProps) {
    const voluntaryHelperText: string = platformSettings?.founderForm?.voluntaryHelperText
        || 'Optional — used only for aggregated ecosystem reporting. You can skip this.'
    const industryHelperText: string = platformSettings?.founderForm?.industryHelperText
        || 'Pick the closest fit — you can refine later. If none fit, choose "Other".'
    const optionalProfileStepTitle: string = platformSettings?.founderForm?.optionalProfileStepTitle
        || DEFAULT_MAIN_INTAKE_STEP_META[2].title
    const optionalProfileStepDescription: string = resolveFounderFormCopy(
        platformSettings?.founderForm?.optionalProfileStepDescription,
        DEFAULT_MAIN_INTAKE_STEP_META[2].description,
        [LEGACY_OPTIONAL_PROFILE_STEP_DESCRIPTION],
    )
    const optionalProfileNoticeBadge: string = resolveFounderFormCopy(
        platformSettings?.founderForm?.optionalProfileNoticeBadge,
        OPTIONAL_PROFILE_NOTICE_BADGE,
        [LEGACY_OPTIONAL_PROFILE_NOTICE_BADGE],
    )
    const optionalProfileNoticeTitle: string = resolveFounderFormCopy(
        platformSettings?.founderForm?.optionalProfileNoticeTitle,
        OPTIONAL_PROFILE_NOTICE_TITLE,
        [LEGACY_OPTIONAL_PROFILE_NOTICE_TITLE, LEGACY_OPTIONAL_PROFILE_NOTICE_TITLE_ALT],
    )
    const optionalProfileNoticeBody: string = resolveFounderFormCopy(
        platformSettings?.founderForm?.optionalProfileNoticeBody,
        OPTIONAL_PROFILE_NOTICE_BODY,
        [LEGACY_OPTIONAL_PROFILE_NOTICE_BODY],
    )
    const VOLUNTARY_QUESTION_IDS = ['F1_GENDER', 'F1_GENDER_SELF', 'F1_AGE_RANGE']
    const INDUSTRY_QUESTION_IDS = ['F7A_INDUSTRY_GEN', 'F7B_INDUSTRY_GEN', 'F7C_INDUSTRY_GEN']
    const mainIntakeStepMeta = {
        ...DEFAULT_MAIN_INTAKE_STEP_META,
        2: {
            ...DEFAULT_MAIN_INTAKE_STEP_META[2],
            title: optionalProfileStepTitle,
            description: optionalProfileStepDescription,
        },
    } as const

    const sections: Section[] = useMemo(() => {
        const rawSections: Section[] = form?.sections || defaultSections
        const isProgramWorkflowForm = isDailyForm || isPrework

        const buildWorkspaceStatement = (question: any) => {
            const originalText = String(question.question_text || '').trim()
            const deliverableTarget = dayDefinitionContext?.deliverable || "today's deliverable"
            const blockType = dayDefinitionContext?.blockType

            const statementMap: Record<string, { title: string; body: string; helperText: string }> = {
                'Link / Resource': {
                    title: 'Project workspace',
                    body: blockType === 'weekly'
                        ? "Add this week's artifact or summary to your project workspace document."
                        : `Submit link to: ${deliverableTarget}`,
                    helperText: blockType === 'weekly'
                        ? 'Do not upload a separate link here. Keep the weekly artifact in the same workspace document.'
                        : 'Write this in your project workspace document for today.',
                },
                'Link to weekly artifact/summary': {
                    title: 'Project workspace',
                    body: "Add this week's artifact or summary to your project workspace document.",
                    helperText: 'Do not upload a separate link here. Keep the weekly artifact in the same workspace document.',
                },
                'Artifact link (all gate deliverables)': {
                    title: 'Project workspace',
                    body: 'Save all gate deliverables in your project workspace document.',
                    helperText: 'Use the single project workspace URL as the hub for every gate artifact.',
                },
                'Artifact link': {
                    title: 'Project workspace',
                    body: 'Save the prework artifact in your project workspace document.',
                    helperText: 'Use the same project workspace URL instead of pasting a separate artifact link here.',
                },
            }

            const mapped = statementMap[originalText]
            if (!mapped) return question

            return {
                ...question,
                question_type: 'statement',
                question_text: mapped.title,
                statementVariant: 'workspace_card',
                statementBody: mapped.body,
                helperText: mapped.helperText,
                required: false,
            }
        }

        const injectHelpers = (section: Section): Section => ({
            ...section,
            questions: section.questions.map((question) => {
                if (section.id === OPTIONAL_PROFILE_NOTICE_SECTION_ID && question.question_id === 'OPTIONAL_PROFILE_NOTICE') {
                    return {
                        ...question,
                        question_text: optionalProfileNoticeBody,
                        statementVariant: 'optional_profile_notice',
                        required: false,
                    }
                }
                if (VOLUNTARY_QUESTION_IDS.includes(question.question_id) && !question.helperText) {
                    return { ...question, helperText: voluntaryHelperText }
                }
                if (INDUSTRY_QUESTION_IDS.includes(question.question_id) && !question.helperText) {
                    return { ...question, helperText: industryHelperText }
                }
                if (isOptionalProfileQuestion(question.question_id) && question.required) {
                    return { ...question, required: false }
                }
                return question
            }),
        })

        const ensureOptionalProfileNotice = (inputSections: Section[]): Section[] => {
            const hasOptionalProfileQuestions = inputSections.some((section) =>
                section.questions.some((question) => isOptionalProfileQuestion(question.question_id)),
            )

            if (!hasOptionalProfileQuestions || inputSections.some((section) => section.id === OPTIONAL_PROFILE_NOTICE_SECTION_ID)) {
                return inputSections
            }

            const insertIndex = inputSections.findIndex((section) => OPTIONAL_PROFILE_SECTION_SET.has(section.id))
            if (insertIndex === -1) return inputSections

            return [
                ...inputSections.slice(0, insertIndex),
                buildOptionalProfileNoticeSection(optionalProfileNoticeBody),
                ...inputSections.slice(insertIndex),
            ]
        }

        if (!isProgramWorkflowForm) {
            return ensureOptionalProfileNotice(rawSections.map(injectHelpers))
        }

        const workflowSections = rawSections.map((section) => {
            const withHelpers = injectHelpers(section)
            return {
                ...withHelpers,
                title: dayDefinitionContext?.activity || dayDefinitionContext?.title || withHelpers.title,
                questions: withHelpers.questions.map((question) =>
                    question.question_text === 'Summary Note'
                        ? { ...question, helperText: DAILY_SUMMARY_NOTE_HELPER }
                        : buildWorkspaceStatement(question),
                ),
            }
        })

        return makePreworkSectionsOptional(
            ensureOptionalProfileNotice(workflowSections),
            isPrework,
        )
    }, [form?.sections, isDailyForm, isPrework, dayDefinitionContext?.activity, dayDefinitionContext?.title, dayDefinitionContext?.deliverable, voluntaryHelperText, industryHelperText, optionalProfileNoticeBody])
    const router = useRouter();
    const [answers, setAnswers] = useState<Record<string, any>>(existingAnswers ?? {});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [completed, setCompleted] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(initialPartnerId);
    const [personalityScores, setPersonalityScores] = useState<PersonalityScores | null>(null);
    const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
    const estimatedTimeHrs = normalizeEstimatedTimeHrs(dayDefinitionContext?.estimatedTimeHrs)

    const s = platformSettings?.founderForm || {};
    const dashboard = platformSettings?.dashboard || {};
    const v = platformSettings?.validation || {};
    const formTitle = s.title || 'Founder';
    const formSubtitle = s.subtitle;
    const warningText = s.warningText || 'This form can only be submitted once — please fill it carefully.';
    const referredByLabel = s.referredByLabel || 'Referred by';
    const notFromPartnerText = s.notFromPartnerText || 'Not from a partner';
    const submitButtonText = s.submitButtonText || 'Save';
    const savingButtonText = s.savingButtonText || 'Saving...';
    const requiredMsg = v.requiredFieldMessage || 'This field is required';
    const fixFieldsMsg = v.fixHighlightedFieldsMessage || 'Please fix the highlighted fields.';
    const unexpectedErrorMsg = v.unexpectedErrorMessage || 'An unexpected error occurred.';
    const invalidEmailMsg = v.invalidEmailMessage || 'Please enter a valid email address';
    const invalidUrlMsg = v.invalidUrlMessage || 'Please enter a valid URL';
    const resolvedDailyTitle = dayDefinitionContext?.activity || dayDefinitionContext?.title || form?.title || (dayNumber ? `Day ${dayNumber}` : formTitle)

    const companyName = platformSettings?.companyName || 'MESGA';
    const logoUrl = platformSettings?.logo?.url;
    const isWeeklyWorkflow = Boolean(
        dayDefinitionContext?.blockType === 'weekly'
        || form?.slug?.startsWith('daily-week-block-')
        || String(form?.title || dayDefinitionContext?.title || '').toLowerCase().includes('weekly retro'),
    )

    const activePTForm = platformSettings?.activePersonalityTestForm;
    const activePTFormId = typeof activePTForm === 'object' ? activePTForm?.id : activePTForm;
    const isPersonalityTest = form?.id && activePTFormId && String(form.id) === String(activePTFormId);
    const activeFounderForm = platformSettings?.activeFounderForm;
    const activeFounderFormId = typeof activeFounderForm === 'object' ? activeFounderForm?.id : activeFounderForm;
    const isMainFounderIntake = Boolean(
        form?.id &&
        activeFounderFormId &&
        String(form.id) === String(activeFounderFormId) &&
        !isPersonalityTest &&
        !isDailyForm &&
        !isPrework,
    );
    const resolvedPreferredTrackSlug = useMemo(
        () => resolvePreferredTrackSlug(preferredTrackSlug, availableTracks),
        [preferredTrackSlug, availableTracks],
    );
    const [selectedTrackSlug, setSelectedTrackSlug] = useState<string | null>(resolvedPreferredTrackSlug);
    const { lang } = useLanguage();
    const privacyPolicy = resolveLocalizedLegalDocument(
        platformSettings?.footer?.legalLinks?.privacyPolicy,
        lang,
        lang === 'pl' ? 'Polityka prywatności' : 'Privacy Policy',
    );
    const disclaimerText = s.personalityDisclaimerText || 'This is not a clinical or psychological evaluation. Your answers are used solely to help us personalise your experience within the program. Data is handled in accordance with our';
    const showMesgaTool = s.showMesgaTool === true
    const backButtonLabel = s.formBackButtonLabel || '← Back to dashboard'
    const autoSaveSavedLabel = s.autoSaveLabel || 'Draft saved'
    const autoSaveSavingLabel = s.autoSaveSavingLabel || 'Saving draft…'
    const personalityPurposeTitle = s.personalityPurposeTitle || 'Why we run this test'
    const personalityPurposeBullets: Array<{ label?: string; body?: string }> = Array.isArray(s.personalityPurposeBullets) ? s.personalityPurposeBullets : []

    const dayFormType = dayDefinitionContext?.blockType === 'weekly'
        ? 'weekly'
        : dayDefinitionContext?.blockType === 'gate'
            ? 'gate'
            : isPrework || dayDefinitionContext?.blockType === 'prework'
                ? 'prework'
                : 'daily'

    const autoSaveFormType: FormAutoSaveType = isPersonalityTest
        ? 'personality'
        : (isDailyForm || isPrework)
            ? dayFormType
            : form?.slug === 'founder-intake-v1'
                ? 'founder_intake'
                : form?.slug === 'personality_test'
                    ? 'personality'
                    : 'founder_intake'
    const autoSaveSlug = !readOnly && form?.slug ? form.slug : ''
    const autoSave = useFormAutoSave({
        formSlug: autoSaveSlug,
        formType: autoSaveFormType,
        answers,
        enabled: !readOnly && Boolean(autoSaveSlug),
        onHydrate: (draft) => {
            setAnswers((prev) => (Object.keys(prev).length === 0 ? { ...draft } : prev))
        },
    })

    useEffect(() => {
        setSelectedTrackSlug(resolvedPreferredTrackSlug);
    }, [resolvedPreferredTrackSlug]);

    useEffect(() => {
        if (!selectedTrackSlug) return;

        setPreferredTrackCookie(selectedTrackSlug);
        if (isMainFounderIntake && !trackSelectionLocked) {
            setLandingTrackIntakeContext(selectedTrackSlug);
        }
    }, [selectedTrackSlug, isMainFounderIntake, trackSelectionLocked]);

    useEffect(() => {
        if (!isMainFounderIntake && currentStep !== 1) {
            setCurrentStep(1)
        }
    }, [isMainFounderIntake, currentStep])

    useEffect(() => {
        if (!isMainFounderIntake) return
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }, [currentStep, isMainFounderIntake])

    const handleAnswerChange = (questionId: string, value: any) => {
        const dependentFields =
            questionId === 'F2_CURRENT_DIFF' && !isAffirmativeAnswer(value)
                ? CURRENT_LOCATION_FIELDS
                : questionId === 'F2_RELOCATED_5Y' && !isAffirmativeAnswer(value)
                    ? RELOCATION_FIELDS
                    : []

        setAnswers((prev) => {
            const next = {
                ...prev,
                [questionId]: value,
            }

            for (const field of dependentFields) {
                delete next[field]
            }

            return next
        })

        setFieldErrors((prev) => {
            const hasRelevantErrors =
                Boolean(prev[questionId]) || dependentFields.some((field) => Boolean(prev[field]))
            if (!hasRelevantErrors) return prev

            const next = { ...prev }
            delete next[questionId]
            for (const field of dependentFields) {
                delete next[field]
            }
            return next
        })
    };

    const hasPathBranching = useMemo(() => {
        return sections.some(s => s.questions.some(q => q.question_id === 'F0_PATH'));
    }, [sections]);

    const activeSections = useMemo(() => {
        if (!hasPathBranching) return sections;

        const path = answers['F0_PATH'];

        return sections.filter(section => {
            const coreSections = [
                'registration',
                'demographics',
                OPTIONAL_PROFILE_NOTICE_SECTION_ID,
                'geography',
                'education',
                'work_activity',
                'socioeconomic',
                'foaled',
                'quality_control',
                'big_five',
                'self_efficacy',
                'risk_taking',
                'behavioral_anchors',
                'mesga_fit',
                'needs_expectations',
                'contact_role'
            ];

            if (coreSections.includes(section.id)) return true;

            if (path === 'idea') {
                if (['idea_a', 'idea_b', 'idea_c'].includes(section.id)) return true;
            }

            if (path === 'existing') {
                if (['existing_a', 'existing_b', 'existing_c', 'existing_d', 'existing_e'].includes(section.id)) return true;
            }

            if (path === 'join') {
                if (['join'].includes(section.id)) return true;
            }

            return false;
        });
    }, [answers['F0_PATH'], hasPathBranching, sections]); // eslint-disable-line react-hooks/exhaustive-deps

    const isQuestionVisible = (questionId: string) => {
        if ((CURRENT_LOCATION_FIELDS as readonly string[]).includes(questionId)) {
            return isAffirmativeAnswer(answers['F2_CURRENT_DIFF'])
        }

        if ((RELOCATION_FIELDS as readonly string[]).includes(questionId)) {
            return isAffirmativeAnswer(answers['F2_RELOCATED_5Y'])
        }

        return true
    }

    const isQuestionRequired = (question: { question_id: string; required?: boolean }) => {
        if (isPrework) {
            return false
        }

        if (isOptionalProfileQuestion(question.question_id)) {
            return false
        }

        if ((CURRENT_LOCATION_FIELDS as readonly string[]).includes(question.question_id)) {
            return isAffirmativeAnswer(answers['F2_CURRENT_DIFF'])
        }

        if ((RELOCATION_FIELDS as readonly string[]).includes(question.question_id)) {
            return isAffirmativeAnswer(answers['F2_RELOCATED_5Y'])
        }

        return Boolean(question.required)
    }

    const visibleSections = useMemo(() => {
        return activeSections
            .map((section) => ({
                ...section,
                questions: section.questions.filter((question) => isQuestionVisible(question.question_id)),
            }))
            .filter((section) => section.questions.length > 0)
    }, [activeSections, answers['F2_CURRENT_DIFF'], answers['F2_RELOCATED_5Y']]) // eslint-disable-line react-hooks/exhaustive-deps

    const currentVisibleSections = useMemo(() => {
        if (!isMainFounderIntake) return visibleSections
        return visibleSections.filter((section) => getMainIntakeStepForSection(section.id) === currentStep)
    }, [currentStep, isMainFounderIntake, visibleSections])

    const workflowTopCards = useMemo(() => {
        if (!(isDailyForm || isPrework)) return []

        return currentVisibleSections.flatMap((section) => {
            const introCards: Array<{ type: 'intro'; question: any }> = []

            for (const question of section.questions) {
                if (question.question_type !== 'statement' || question.statementVariant === 'workspace_card') break
                introCards.push({ type: 'intro', question })
            }

            const workspaceCards = section.questions
                .filter((question) =>
                    !isWeeklyWorkflow
                    && question.question_type === 'statement'
                    && question.statementVariant === 'workspace_card',
                )
                .map((question) => ({ type: 'workspace' as const, question }))

            return [...introCards, ...workspaceCards]
        })
    }, [currentVisibleSections, isDailyForm, isPrework, isWeeklyWorkflow])

    const renderedSections = useMemo(() => {
        if (!(isDailyForm || isPrework)) return currentVisibleSections

        return currentVisibleSections.map((section) => {
            let firstNonIntroIndex = 0
            while (
                firstNonIntroIndex < section.questions.length &&
                section.questions[firstNonIntroIndex]?.question_type === 'statement' &&
                section.questions[firstNonIntroIndex]?.statementVariant !== 'workspace_card'
            ) {
                firstNonIntroIndex += 1
            }

            return {
                ...section,
                questions: section.questions
                    .slice(firstNonIntroIndex)
                    .filter((question) => !(question.question_type === 'statement' && question.statementVariant === 'workspace_card')),
            }
        }).filter((section) => section.questions.length > 0)
    }, [currentVisibleSections, isDailyForm, isPrework])

    const validateFormat = (q: any, value: any): string | null => {
        if (value === undefined || value === null || value === '') return null;
        if (q.question_type === 'email') {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return invalidEmailMsg;
        }
        if (q.question_type === 'url') {
            try {
                const href = /^https?:\/\//i.test(value) ? value : `https://${value}`;
                const parsed = new URL(href);
                if (!parsed.hostname.includes('.')) return invalidUrlMsg;
            } catch {
                return invalidUrlMsg;
            }
        }
        if (q.question_type === 'number') {
            const num = parseFloat(value);
            if (isNaN(num)) return 'Please enter a valid number';
            if (q.numberMinType === 'custom' && q.numberMinValue != null && num < q.numberMinValue) {
                return `Value must be at least ${q.numberMinValue}`;
            }
            if (q.numberMaxType === 'custom' && q.numberMaxValue != null && num > q.numberMaxValue) {
                return `Value must be at most ${q.numberMaxValue}`;
            }
        }
        return null;
    };

    const validateSections = (sectionsToValidate: Section[]) => {
        const missingFields: string[] = [];
        const newFieldErrors: Record<string, string> = {};

        for (const section of sectionsToValidate) {
            for (const q of section.questions) {
                if (q.question_type === 'statement') continue;
                const isRequired = isQuestionRequired(q)
                const questionValue = answers[q.question_id]
                const isMissing =
                    questionValue == null ||
                    questionValue === '' ||
                    (Array.isArray(questionValue) && questionValue.length === 0)

                if (isRequired && isMissing) {
                    missingFields.push(q.question_id);
                } else {
                    const formatErr = validateFormat(q, questionValue);
                    if (formatErr) newFieldErrors[q.question_id] = formatErr;
                }
            }
        }

        const sectionQuestionIds = new Set(
            sectionsToValidate.flatMap((section) => section.questions.map((question) => question.question_id)),
        )

        if (
            sectionQuestionIds.has('F2_CURRENT_CITY') &&
            isAffirmativeAnswer(answers['F2_CURRENT_DIFF']) &&
            isSamePlace(
                answers['F2_RESIDENCY_COUNTRY'],
                answers['F2_RESIDENCY_CITY'],
                answers['F2_CURRENT_COUNTRY'],
                answers['F2_CURRENT_CITY'],
            )
        ) {
            newFieldErrors['F2_CURRENT_CITY'] = 'Current location must be different from your residency.'
        }

        if (
            sectionQuestionIds.has('F2_RELOC_TO_CITY') &&
            isAffirmativeAnswer(answers['F2_RELOCATED_5Y']) &&
            isSamePlace(
                answers['F2_RELOC_FROM_COUNTRY'],
                answers['F2_RELOC_FROM_CITY'],
                answers['F2_RELOC_TO_COUNTRY'],
                answers['F2_RELOC_TO_CITY'],
            )
        ) {
            newFieldErrors['F2_RELOC_TO_CITY'] = 'Relocation origin and destination must be different.'
        }

        return {
            hasErrors: missingFields.length > 0 || Object.keys(newFieldErrors).length > 0,
            newFieldErrors,
            firstErrorId: missingFields[0] ?? Object.keys(newFieldErrors)[0] ?? null,
        }
    }

    const revealValidationErrors = (validationResult: ReturnType<typeof validateSections>) => {
        setError(fixFieldsMsg);
        setFieldErrors(validationResult.newFieldErrors);
        setCompleted(true);

        setTimeout(() => {
            if (!validationResult.firstErrorId) {
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return
            }

            const element = document.getElementById(validationResult.firstErrorId);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }, 100);
    }

    const handleNextStep = () => {
        const validationResult = validateSections(currentVisibleSections)
        if (validationResult.hasErrors) {
            revealValidationErrors(validationResult)
            return
        }

        setCompleted(false)
        setError(null)
        setFieldErrors({})
        setCurrentStep((prev) => Math.min(prev + 1, MAIN_INTAKE_TOTAL_STEPS) as 1 | 2 | 3)
    }

    const handleBack = () => {
        if (isMainFounderIntake && currentStep > 1) {
            setCompleted(false)
            setError(null)
            setFieldErrors({})
            setCurrentStep((prev) => Math.max(prev - 1, 1) as 1 | 2 | 3)
            return
        }

        router.push('/')
    }

    const handleSubmit = async () => {
        setIsSubmitting(true);
        setError(null);
        setCompleted(false);
        const validationResult = validateSections(visibleSections)
        if (validationResult.hasErrors) {
            setIsSubmitting(false);
            revealValidationErrors(validationResult)
            return;
        }

        try {
            const formId = form?.id;
            if (!formId) throw new Error('Form ID not found');

            // Upload any File objects before submitting
            const processedAnswers = { ...answers };
            for (const [key, val] of Object.entries(processedAnswers)) {
                if (val instanceof File) {
                    const fd = new FormData();
                    fd.append('file', val);
                    const res = await fetch('/api/upload-file', { method: 'POST', body: fd });
                    const data = await res.json();
                    if (!res.ok) {
                        setError(data.error || 'File upload failed');
                        setIsSubmitting(false);
                        return;
                    }
                    processedAnswers[key] = data.url;
                }
            }

            const isPersonalityTest = form?.id && activePTFormId && String(formId) === String(activePTFormId);

            let scores: PersonalityScores | null = null;

            if (isPersonalityTest) {
                try {
                    const scoringConfig = extractScoringConfig(platformSettings);
                    scores = calculateScores(answers, scoringConfig);
                } catch (e) {
                    console.warn('Client-side scoring failed:', e);
                }
            }

            if (scores) {
                const result = await submitFounderForm(
                    formId,
                    processedAnswers,
                    selectedPartnerId,
                    isDailyForm ? dayNumber : null,
                    form?.slug,
                    selectedTrackSlug,
                );
                if (result.error) {
                    setError(result.error);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    return;
                }

                setPersonalityScores(scores);
                void autoSave.clear();
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }

            const result = await submitFounderForm(
                formId,
                processedAnswers,
                selectedPartnerId,
                isDailyForm ? dayNumber : null,
                form?.slug,
                selectedTrackSlug,
            );
            if (result.error) {
                setError(result.error);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                void autoSave.clear();
                router.push('/');
            }
        } catch (e) {
            setError(unexpectedErrorMsg);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (personalityScores) {
        return <PersonalityResults scores={personalityScores} onContinue={() => router.push('/?project=1')} platformSettings={platformSettings} />;
    }

    return (
        <div className="relative w-full min-h-screen bg-[#1a2634] text-white flex flex-col font-sans selection:bg-[#ffcc00]/30 overflow-hidden">
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#ffcc00]/8 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#203e5f]/8 blur-[120px] rounded-full" />
            </div>

            <header className="sticky top-0 z-50 flex items-center justify-center px-4 sm:px-6 py-4 backdrop-blur-md border-b border-white/5 bg-[#1a2634]/80">
                <div className="flex w-full max-w-5xl items-center justify-between">
                    <Link href="/" className="group flex items-center">
                        <MesgaHorizontalLogo
                            companyName={companyName}
                            logoUrl={logoUrl}
                            size="header"
                            className="transition-opacity group-hover:opacity-85"
                        />
                    </Link>
                    <div className="flex items-center gap-3">
                        {!readOnly && (
                            isMainFounderIntake ? (
                                <button
                                    type="button"
                                    onClick={handleBack}
                                    className="hidden sm:inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-white/80 hover:bg-white/10 hover:text-white hover:border-white/20 transition-all active:scale-95"
                                >
                                    {currentStep > 1 ? '← Back' : backButtonLabel}
                                </button>
                            ) : (
                            <Link
                                href="/"
                                className="hidden sm:inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-white/80 hover:bg-white/10 hover:text-white hover:border-white/20 transition-all active:scale-95"
                            >
                                {backButtonLabel}
                            </Link>
                            )
                        )}
                        <form action="/logout" method="POST">
                            <button
                                type="submit"
                                className="rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm font-medium text-white hover:bg-white/10 hover:border-white/20 transition-all active:scale-95"
                            >
                                Log out
                            </button>
                        </form>
                    </div>
                </div>
            </header>

            <div className="relative z-10 w-full max-w-3xl mx-auto p-6 md:p-12 pb-26 md:pb-32">
                {isPrework ? (
                    <div className="mb-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                            <div>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-[#a78bfa]">Prework</span>
                                <h1 className="text-3xl md:text-4xl font-black text-[#a78bfa]">
                                    {form?.title || `Prework ${dayNumber || ''}`}
                                </h1>
                                <p className="text-white/65 text-sm mt-1">Complete at your own pace — no deadlines</p>
                            </div>
                            {estimatedTimeHrs && (
                                <span className="text-[10px] text-white/65 px-2.5 py-1 rounded bg-white/5 border border-white/10 self-start">
                                    ~{estimatedTimeHrs}h
                                </span>
                            )}
                        </div>
                        {dayDefinitionContext && (
                            <div className="rounded-2xl border border-white/10 bg-white/2 backdrop-blur-sm p-5 space-y-2">
                                {dayDefinitionContext.theme && (
                                    <div className="flex items-center gap-3 flex-wrap mb-2">
                                        <span className="text-sm font-semibold text-[#a78bfa]/80">{dayDefinitionContext.theme}</span>
                                    </div>
                                )}
                                {dayDefinitionContext.founderCommandment && (
                                    <div className="rounded-xl bg-[#a78bfa]/6 border border-[#a78bfa]/15 px-4 py-2.5">
                                        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#a78bfa]/70 mb-1">Commandment</p>
                                        <p className="text-white/90 text-[15px] md:text-base italic leading-relaxed">&ldquo;{dayDefinitionContext.founderCommandment}&rdquo;</p>
                                    </div>
                                )}
                                {dayDefinitionContext.blockFocus && (
                                    <div className="rounded-xl bg-white/3 border border-white/10 px-4 py-2.5">
                                        <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50 mb-1">Focus</p>
                                        <p className="text-white/70 text-[13px] leading-relaxed">{dayDefinitionContext.blockFocus}</p>
                                    </div>
                                )}
                                {dayDefinitionContext.deliverable && (
                                    <div className="rounded-xl bg-[#ffcc00]/6 border border-[#ffcc00]/15 px-4 py-2.5">
                                        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#ffcc00]/70 mb-1">Deliverable</p>
                                        <p className="text-white/90 text-[15px] md:text-base leading-relaxed">{dayDefinitionContext.deliverable}</p>
                                    </div>
                                )}
                                {dayDefinitionContext.exampleProject && (
                                    <div className="rounded-xl bg-violet-500/6 border border-violet-500/15 px-4 py-2.5 select-none">
                                        <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-300/70 mb-1">Example Project</p>
                                        <p className="text-white/90 text-[15px] md:text-base leading-relaxed">{dayDefinitionContext.exampleProject}</p>
                                    </div>
                                )}
                                {dayDefinitionContext.whereHowTips && (
                                    <div className="rounded-xl bg-emerald-500/6 border border-emerald-500/15 px-4 py-2.5">
                                        <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400/70 mb-1">Tips</p>
                                        <p className="text-white/90 text-[15px] md:text-base leading-relaxed">{dayDefinitionContext.whereHowTips}</p>
                                    </div>
                                )}
                                {dayDefinitionContext.coachingNote && (
                                    <div className="rounded-xl bg-fuchsia-500/6 border border-fuchsia-500/15 px-4 py-2.5">
                                        <p className="text-[11px] font-semibold uppercase tracking-wider text-fuchsia-300/70 mb-1">Coaching Lens</p>
                                        <p className="text-white/90 text-[15px] md:text-base leading-relaxed">{dayDefinitionContext.coachingNote}</p>
                                    </div>
                                )}
                                {dayDefinitionContext.autoCheckCriteria && (
                                    <div className="rounded-xl bg-purple-500/6 border border-purple-500/15 px-4 py-2.5">
                                        <p className="text-[11px] font-semibold uppercase tracking-wider text-purple-400/70 mb-1">Criteria</p>
                                        <p className="text-white/90 text-[15px] md:text-base leading-relaxed">{dayDefinitionContext.autoCheckCriteria}</p>
                                    </div>
                                )}
                                {showMesgaTool && dayDefinitionContext.mesgaIntegration && (
                                    <div className="rounded-xl bg-white/3 border border-white/10 px-4 py-2.5">
                                        <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50 mb-1">MESGA Tool</p>
                                        <p className="text-white/90 text-[15px] md:text-base leading-relaxed">{dayDefinitionContext.mesgaIntegration}</p>
                                    </div>
                                )}
                                {dayDefinitionContext.eduLinks && dayDefinitionContext.eduLinks.length > 0 && (
                                    <div className="rounded-xl bg-amber-500/6 border border-amber-500/15 px-4 py-2.5">
                                        <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-400/70 mb-1">Learn</p>
                                        <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                                            {dayDefinitionContext.eduLinks.map((link: any, i: number) => (
                                                <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                                                    className="text-[#ffcc00] text-[13px] hover:underline hover:text-[#ffcc00]/80 transition-colors">{link.label}</a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ) : isDailyForm && dayNumber ? (
                    <DailyFormHeader
                        dayNumber={dayNumber}
                        branding={partnerBrandingColors || {}}
                        dayDefinitionContext={dayDefinitionContext}
                        formTitle={resolvedDailyTitle}
                        showMesgaTool={showMesgaTool}
                    />
                ) : (
                    <div className="text-center mb-16 space-y-5 animate-in fade-in slide-in-from-bottom-8 duration-700">
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white uppercase">
                            {formTitle}
                        </h1>
                        <p className="text-white/50 text-lg">
                            <SerializeRichText
                                content={formSubtitle}
                                boldClassName="text-[#ffcc00] font-semibold"
                                disableParagraphs
                            />
                        </p>
                        {!(form as any).allowMultipleSubmissions && (
                            <div className="inline-flex items-center gap-2 text-[#ffcc00]/80 text-sm border border-[#ffcc00]/20 bg-[#ffcc00]/5 rounded-xl px-5 py-3">
                                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                                </svg>
                                {warningText}
                            </div>
                        )}
                        {isPersonalityTest && personalityPurposeBullets.length > 0 && (
                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-5 text-left max-w-xl mx-auto w-full">
                                <h3 className="text-base font-bold text-white mb-3">{personalityPurposeTitle}</h3>
                                <ul className="space-y-2.5">
                                    {personalityPurposeBullets.map((b, i) => (
                                        <li key={i} className="text-sm text-white/70 leading-relaxed">
                                            {b?.label && <span className="font-semibold text-white">{b.label}. </span>}
                                            {b?.body}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {isPersonalityTest && (
                            <div className="flex items-start gap-3 rounded-xl border border-[#ffcc00]/40 bg-[#ffcc00]/8 px-5 py-4 text-left max-w-xl mx-auto w-full">
                                <svg className="w-5 h-5 text-[#ffcc00] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                                </svg>
                                <p className="text-sm text-[#ffcc00] leading-relaxed">
                                    {disclaimerText}{' '}
                                    {privacyPolicy.href ? (
                                        <a
                                            href={privacyPolicy.href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="underline underline-offset-2 font-semibold hover:text-[#ffcc00]/70 transition-colors"
                                        >
                                            {privacyPolicy.label}
                                        </a>
                                    ) : (
                                        <span className="underline underline-offset-2 font-semibold">{privacyPolicy.label}</span>
                                    )}
                                    .
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Day Definition Context — shown for non-daily forms that have context but no progress bar */}
                {dayDefinitionContext && !isDailyForm && (
                    <div className="mb-10 rounded-2xl border border-white/10 bg-white/2 backdrop-blur-sm p-6 space-y-4 animate-in fade-in slide-in-from-bottom-6 duration-700">
                        {dayDefinitionContext.theme && (
                            <div className="flex items-center gap-3 flex-wrap">
                                {dayDefinitionContext.weekNumber != null && (
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/55 px-2 py-0.5 rounded bg-white/5 border border-white/10">
                                        Week {dayDefinitionContext.weekNumber}
                                    </span>
                                )}
                                <span className="text-sm font-semibold text-[#ffcc00]/80">{dayDefinitionContext.theme}</span>
                            </div>
                        )}
                    </div>
                )}

                {error && (
                    <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-center text-sm sticky top-20 backdrop-blur-md z-40 flex items-center justify-center gap-2">
                        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                        </svg>
                        {error}
                    </div>
                )}

                {workflowTopCards.length > 0 && (
                    <div className="mb-10">
                        {workflowTopCards.map((card, index) => (
                            card.type === 'intro' ? (
                                <WorkflowIntroStatementCard
                                    key={`${card.question.question_id || 'intro'}-${index}`}
                                    question={card.question}
                                />
                            ) : (
                                <WorkspaceStatementCard
                                    key={`${card.question.question_id || 'workspace'}-${index}`}
                                    workspaceUrl={projectWorkspaceUrl}
                                    dashboard={dashboard}
                                    body={card.question.statementBody}
                                    helperText={card.question.helperText}
                                />
                            )
                        ))}
                    </div>
                )}

                {isMainFounderIntake && (
                    <div className="mb-10 rounded-[28px] border border-white/10 bg-[#111113]/70 px-5 py-5 shadow-[0_24px_60px_-40px_rgba(0,0,0,0.8)] md:px-6">
                        <div className="flex items-center justify-between gap-4 mb-5">
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#ffcc00]">
                                    {mainIntakeStepMeta[currentStep].eyebrow}
                                </p>
                                <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
                                    {mainIntakeStepMeta[currentStep].title}
                                </h2>
                                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
                                    {mainIntakeStepMeta[currentStep].description}
                                </p>
                            </div>
                            <div className="hidden min-w-[72px] items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.22em] whitespace-nowrap text-white/65 md:inline-flex">
                                {currentStep} / {MAIN_INTAKE_TOTAL_STEPS}
                            </div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-3">
                            {([1, 2, 3] as const).map((step) => {
                                const active = step === currentStep
                                const completedStep = step < currentStep
                                return (
                                    <div
                                        key={step}
                                        className="rounded-2xl border px-4 py-4 transition-all duration-200"
                                        style={{
                                            borderColor: active ? 'rgba(228,185,77,0.35)' : completedStep ? 'rgba(44,177,161,0.25)' : 'rgba(255,255,255,0.08)',
                                            background: active ? 'rgba(228,185,77,0.08)' : completedStep ? 'rgba(44,177,161,0.06)' : 'rgba(255,255,255,0.02)',
                                        }}
                                    >
                                        <div className="mb-2 flex items-center gap-2">
                                            <div
                                                className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-black"
                                                style={{
                                                    background: active ? 'rgba(228,185,77,0.18)' : completedStep ? 'rgba(44,177,161,0.18)' : 'rgba(255,255,255,0.06)',
                                                    color: active ? '#ffcc00' : completedStep ? '#2CB1A1' : 'rgba(255,255,255,0.45)',
                                                }}
                                            >
                                                {completedStep ? '✓' : step}
                                            </div>
                                            <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/60">
                                                Step {step}
                                            </span>
                                        </div>
                                        <div className="text-sm font-semibold text-white">{mainIntakeStepMeta[step].title}</div>
                                        <div className="mt-1 text-xs leading-relaxed text-white/70">{mainIntakeStepMeta[step].description}</div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {isMainFounderIntake && currentStep === 1 && trackSelectionLocked && lockedTrack && (
                    <LockedTrackPanel
                        track={lockedTrack}
                        title={partnerSelectionLocked ? 'Selected track' : 'Private track invite'}
                        description={partnerSelectionLocked
                            ? 'This partner referral is limited to a single track, so other track options are hidden for this intake.'
                            : 'This invitation is tied to a single track, so other track options are hidden for this intake.'
                        }
                        badgeLabel={partnerSelectionLocked ? 'Assigned' : 'Locked'}
                    />
                )}

                {isMainFounderIntake && currentStep === 1 && !trackSelectionLocked && availableTracks.length > 0 && (
                    <TrackSelectionPanel
                        tracks={availableTracks}
                        selectedTrackSlug={selectedTrackSlug}
                        onSelect={setSelectedTrackSlug}
                    />
                )}

                {partnerSelectionLocked && lockedPartner && (!isMainFounderIntake || currentStep === 1) && (
                    <LockedPartnerPanel partnerName={lockedPartner.name} logoUrl={lockedPartner.logoUrl || null} />
                )}

                {!partnerSelectionLocked && form?.showReferredBy && partners.length > 0 && (!isMainFounderIntake || currentStep === 1) && (
                    <div className="mb-12 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-[#ffcc00]/10 border border-[#ffcc00]/20 flex items-center justify-center text-[#ffcc00] text-sm font-bold">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
                                    </svg>
                                </div>
                                <h2 className="text-xl font-semibold text-white/90">{referredByLabel}</h2>
                            </div>
                            <div className="h-px bg-white/10 flex-1"></div>
                        </div>
                        <div className="relative w-full md:w-1/2">
                            <select
                                value={selectedPartnerId ?? ''}
                                onChange={(e) => setSelectedPartnerId(e.target.value ? Number(e.target.value) : null)}
                                className="w-full appearance-none bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#ffcc00]/50 focus:ring-1 focus:ring-[#ffcc00]/30 transition-all cursor-pointer"
                            >
                                <option value="" className="bg-[#161618] text-white">{notFromPartnerText}</option>
                                {partners.map((p) => (
                                    <option key={p.id} value={p.id} className="bg-[#161618] text-white">{p.name}</option>
                                ))}
                            </select>
                            <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-400">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        </div>
                    </div>
                )}

                {readOnly && (
                    <div className="mb-8 flex items-center gap-3 rounded-xl border border-[#ffcc00]/20 bg-[#ffcc00]/5 px-5 py-3 text-sm text-[#ffcc00]/80">
                        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                        </svg>
                        This submission is read-only. You have already completed this day.
                    </div>
                )}

                <div className={`space-y-12 ${readOnly ? 'pointer-events-none' : ''}`}>
                    {renderedSections.map((section, sIdx) => {
                        const isOptionalProfileNotice = section.id === OPTIONAL_PROFILE_NOTICE_SECTION_ID
                        const isOptionalProfileSection = OPTIONAL_PROFILE_SECTION_SET.has(section.id)
                        const isOptionalProfileBlock = isOptionalProfileNotice || isOptionalProfileSection

                        return (
                            <div
                                key={section.id}
                                className={`space-y-6 animate-in slide-in-from-bottom-4 duration-700 fade-in ${isOptionalProfileBlock ? 'rounded-[28px] border border-[#f59e0b]/25 bg-[#f59e0b]/[0.08] px-5 py-6 shadow-[0_24px_80px_-56px_rgba(249,115,22,0.9)] md:px-6 md:py-7' : ''}`}
                                style={{ animationDelay: `${sIdx * 80}ms` }}
                            >
                                {!isDailyForm && !isPrework && (
                                    <div className="flex items-center gap-4 mb-2">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                                                isOptionalProfileBlock
                                                    ? 'bg-[#f59e0b]/15 border border-[#f59e0b]/30 text-[#fdba74]'
                                                    : 'bg-[#ffcc00]/10 border border-[#ffcc00]/20 text-[#ffcc00]'
                                            }`}>
                                                {sIdx + 1}
                                            </div>
                                            <h2 className={`text-xl font-semibold ${isOptionalProfileBlock ? 'text-[#fed7aa]' : 'text-white/90'}`}>
                                                {section.title}
                                            </h2>
                                        </div>
                                        <div className={`h-px flex-1 ${isOptionalProfileBlock ? 'bg-[#f59e0b]/20' : 'bg-white/10'}`}></div>
                                    </div>
                                )}
                                {section.description && !isDailyForm && !isPrework && (
                                    <p className={`text-sm -mt-2 mb-4 leading-relaxed pl-11 ${isOptionalProfileBlock ? 'text-[#fed7aa]/75' : 'text-white/65'}`}>
                                        {section.description}
                                    </p>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {section.questions.map((question) => {
                                        const questionValue = answers[question.question_id]
                                        const required = isQuestionRequired(question)
                                        const isFullWidth =
                                            question.question_type === 'long_text' ||
                                            question.question_type === 'multiple_choice_multiple' ||
                                            question.question_type === 'range' ||
                                            question.question_type === 'yes_no' ||
                                            question.question_type === 'statement' ||
                                            question.question_type === 'file_upload' ||
                                            (question.question_id ?? '').endsWith('_CONSENT') ||
                                            (question.question_id ?? '').endsWith('_consent') ||
                                            question.question_id === 'F0_PATH' ||
                                            (question.question_text ?? '').length > 50;

                                        const isMissing =
                                            questionValue == null ||
                                            questionValue === '' ||
                                            (Array.isArray(questionValue) && questionValue.length === 0)
                                        const isError = !readOnly && completed && required && isMissing;
                                        const renderedQuestion = { ...question, required }

                                        return (
                                            <div
                                                key={question.question_id}
                                                id={question.question_id}
                                                className={`${isFullWidth ? 'md:col-span-2' : 'md:col-span-1'} h-full`}
                                            >
                                                {question.question_type === 'statement' && question.statementVariant === 'workspace_card' ? (
                                                    <WorkspaceStatementCard
                                                        workspaceUrl={projectWorkspaceUrl}
                                                        dashboard={dashboard}
                                                        body={question.statementBody}
                                                        helperText={question.helperText}
                                                    />
                                                ) : question.question_type === 'statement' && question.statementVariant === 'optional_profile_notice' ? (
                                                    <OptionalProfileNoticeCard
                                                        badge={optionalProfileNoticeBadge}
                                                        title={optionalProfileNoticeTitle}
                                                        body={question.question_text}
                                                    />
                                                ) : (
                                                    <QuestionRenderer
                                                        question={renderedQuestion}
                                                        value={questionValue}
                                                        onChange={(val) => handleAnswerChange(question.question_id, val)}
                                                        error={!!isError}
                                                        errorMessage={
                                                            fieldErrors[question.question_id] ||
                                                            (isError ? requiredMsg : undefined)
                                                        }
                                                        otherValue={answers[question.question_id + '_OTHER'] || ''}
                                                        onOtherChange={(val) => handleAnswerChange(question.question_id + '_OTHER', val)}
                                                        accentColor={isOptionalProfileBlock ? '#F59E0B' : '#0B9DF7'}
                                                    />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </div>

                <div className="mt-16 flex flex-col items-center gap-3">
                    {readOnly ? (
                        <Link
                            href="/"
                            className="px-12 py-4 rounded-full border border-white/10 bg-white/5 text-white font-bold text-lg hover:bg-white/10 hover:border-white/20 transition-all duration-300"
                        >
                            Back to Dashboard
                        </Link>
                    ) : (
                        <>
                            <div className="flex w-full flex-col items-stretch justify-center gap-3 md:w-auto md:min-w-[26rem] md:flex-row">
                                {isMainFounderIntake && (
                                    <button
                                        type="button"
                                        onClick={handleBack}
                                        className="rounded-full border border-white/10 bg-white/5 px-8 py-4 text-base font-bold text-white/80 transition-all duration-300 hover:border-white/20 hover:bg-white/10 hover:text-white"
                                    >
                                        {currentStep > 1 ? 'Back' : 'Exit intake'}
                                    </button>
                                )}
                                <button
                                    onClick={isMainFounderIntake && currentStep < MAIN_INTAKE_TOTAL_STEPS ? handleNextStep : handleSubmit}
                                    disabled={isSubmitting}
                                    className="px-12 py-4 bg-linear-to-r from-[#ffcc00] to-[#203e5f] hover:opacity-90 disabled:opacity-50 text-white font-bold text-lg rounded-full shadow-[0_0_30px_rgba(255,204,0,0.25)] hover:shadow-[0_0_50px_rgba(255,204,0,0.4)] transition-all duration-300 transform hover:-translate-y-1 active:translate-y-0 w-full md:w-auto min-w-50"
                                >
                                    {isMainFounderIntake && currentStep < MAIN_INTAKE_TOTAL_STEPS
                                        ? 'Next step'
                                        : isSubmitting
                                            ? savingButtonText
                                            : submitButtonText}
                                </button>
                            </div>
                            {autoSaveSlug && (autoSave.isSaving || autoSave.lastSavedAt) && (
                                <span className="text-xs text-white/65">
                                    {autoSave.isSaving
                                        ? autoSaveSavingLabel
                                        : `${autoSaveSavedLabel}${autoSave.lastSavedAt ? ` · ${autoSave.lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}`}
                                </span>
                            )}
                        </>
                    )}
                </div>
            </div>

            <SiteFooter settings={platformSettings} companyName={companyName} variant="fixed" />
        </div>
    );
}
