'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { acknowledgeDashboardCalendarNotice, getMyProjectSubmissionPreview, saveProjectSubmission, startProgramAfterPrework } from '@/app/actions'
import Link from 'next/link'
import SiteFooter from '@/components/SiteFooter'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import MesgaHorizontalLogo from '@/components/MesgaHorizontalLogo'
import ProfileCard from '@/components/ProfileCard'
import PersonalityResults from '@/components/PersonalityResults'
import AttemptStatusBar from '@/components/AttemptStatusBar'
import TimelineView from '@/components/TimelineView'
import type { User as PayloadUser } from '@/payload-types'
import { type BrandingColors, type ProgramProgress, getPhaseTextColor, getPhaseBackground, getPhaseBarColor, getPhaseColorConfig, computeProgramProgress } from '@/lib/partnerBranding'
import { normalizeEstimatedTimeHrs } from '@/lib/estimatedTime'
import { isTestProgramStatus } from '@/lib/programTestMode'
import { getPreferredTrackVisual, resolvePreferredTrackId } from '@/lib/preferredTrack'
import { normalizeArchetypeKey } from '@/lib/curriculum/constants'
import { buildNormalizedArchetypeMap } from '@/lib/personalityConfig'
import { isSpaceTrackSlug } from '@/lib/availableTracks'
import { useLanguage, createT } from '@/lib/i18n'
import { useFormAutoSave } from '@/hooks/useFormAutoSave'
import { canFounderEditProjectSubmission, isProjectDescriptionRequiredForFounderSave } from '@/lib/projectSubmission'

type FounderVisibleMentorReview = {
    id: number | string
    dayNumber: number
    score: number
    comment: string
    isGateReview: boolean
    gateDecision?: string | null
    mentorName?: string | null
    createdAt: string
}

type AssignedMentor = {
    id: number | string
    title: string
    description: string
    isActive: boolean
}

interface DashboardClientProps {
    user: PayloadUser
    settings: any
    needsPersonalityTest: boolean
    personalityTestSlug: string | null
    founderArchetype: string | null
    founderTrack: string | null
    dailyFormSlug: string | null
    dailyFormTitle: string | null
    hasSubmittedDailyForm: boolean
    dayNumber?: number
    isDayLocked?: boolean
    dayLockReason?: string | null
    nextUnlockTime?: string | null
    completedDays?: number[]
    personalityScores?: any
    nextMissionDayNumber?: number | null
    nextMissionSlug?: string | null
    nextMissionTitle?: string | null
    programStatus?: string
    programAttempts?: number
    hasPaid100Days?: boolean
    paymentEnabled?: boolean
    projectSubmission?: { id: number; status: string; partnerComment?: string | null; spaceDataRelevance?: any; projectDescription?: string | null; workspaceUrl?: string | null; trackId?: number | null } | null
    availableTracks?: { id: number; name: string; slug: string; description?: string | null }[]
    preferredTrackSlug?: string | null
    partnerLogoUrl?: string | null
    partnerName?: string | null
    partnerBrandingColors?: BrandingColors | null
    assignedMentor?: AssignedMentor | null
    dashboardCalendarNotice?: {
        version?: number | null
        seenVersion?: number | null
        reason?: 'partner' | 'track' | 'partner_track' | null
        previousCalendarLabel?: string | null
        nextCalendarLabel?: string | null
        previousPartnerName?: string | null
        nextPartnerName?: string | null
        previousPartnerLogoUrl?: string | null
        nextPartnerLogoUrl?: string | null
        previousTrackName?: string | null
        nextTrackName?: string | null
        changedAt?: string | null
    } | null
    currentDayMentorReview?: FounderVisibleMentorReview | null
    preworkProgress?: { completed: number; total: number; nextFormSlug: string | null; nextFormTitle: string | null } | null
    attemptData?: {
        id?: number | string
        attemptNumber: number
        maxAttempts: number
        missCount: number
        status: string
        missedDays: number[]
        certificate?: {
            fullName?: string | null
            companyName?: string | null
            roleTitle?: string | null
            city?: string | null
            country?: string | null
            profileConfirmedAt?: string | null
            consentGrantedAt?: string | null
            missedSessions?: number | null
            hadWeekOff?: boolean | null
            kind?: 'none' | 'participation' | 'completion' | null
        } | null
        certificatePolicy?: {
            enabled: boolean
            missedSessionsThreshold: number
            weekOffDisqualifies: boolean
            completionLabel: string
            participationLabel: string
            showOnDashboard: boolean
            emailPdfEnabled: boolean
        } | null
        certificateResolution?: {
            kind: 'none' | 'participation' | 'completion'
            label: string | null
            reason: 'disabled' | 'week_off' | 'miss_threshold' | 'completion' | 'participation'
        } | null
    } | null
    dayDefinition?: {
        title: string | null
        blockKey: string | null
        blockType: string | null
        theme: string | null
        founderCommandment: string | null
        blockFocus: string | null
        mainSoetMission: string | null
        activity: string | null
        deliverable: string | null
        exampleProject: string | null
        whereHowTips: string | null
        autoCheckCriteria: string | null
        mesgaIntegration: string | null
        estimatedTimeHrs: number | null
        eduType: string | null
        eduDescription: string | null
        contentType: string | null
        contentOwner: string | null
        eduLinks: Array<{ label: string; url: string; type?: string }> | null
        weekNumber: number | null
        coachingNote: string | null
        questions: Array<{
            questionId: string
            questionTitle: string
            questionType: string
            required: boolean
            description: string | null
            choices: string | null
            logic: string | null
        }> | null
    } | null
    openProjectModalDefault?: boolean
}


function CountdownTimer({ targetTime }: { targetTime: string }) {
    const [remaining, setRemaining] = useState(() => {
        const diff = new Date(targetTime).getTime() - Date.now()
        return Math.max(0, Math.floor(diff / 1000))
    })

    useEffect(() => {
        const interval = setInterval(() => {
            const diff = new Date(targetTime).getTime() - Date.now()
            const secs = Math.max(0, Math.floor(diff / 1000))
            setRemaining(secs)
            if (secs <= 0) {
                clearInterval(interval)
                window.location.reload()
            }
        }, 1000)
        return () => clearInterval(interval)
    }, [targetTime])

    const hours = Math.floor(remaining / 3600)
    const minutes = Math.floor((remaining % 3600) / 60)
    const seconds = remaining % 60
    const pad = (n: number) => String(n).padStart(2, '0')

    return (
        <div className="flex items-center gap-3">
            {[
                { value: pad(hours), label: 'HRS' },
                { value: pad(minutes), label: 'MIN' },
                { value: pad(seconds), label: 'SEC' },
            ].map((item, i) => (
                <div key={i} className="flex flex-col items-center">
                    <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                        <span className="text-2xl font-black text-white tabular-nums">{item.value}</span>
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-white/55 mt-1.5">{item.label}</span>
                </div>
            ))}
        </div>
    )
}

function WipCard({
    icon, title, description, accentColor, wipText,
}: {
    icon: React.ReactNode
    title: string
    description: string
    accentColor: string
    wipText: string
}) {
    return (
        <div className="group relative rounded-3xl border border-white/8 bg-[#203e5f]/50 backdrop-blur-md p-8 transition-all duration-300">
            <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#C96A4A]/15 border border-[#C96A4A]/25">
                <div className="w-1.5 h-1.5 rounded-full bg-[#C96A4A]" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#C96A4A]">{wipText}</span>
            </div>
            <div className="opacity-50">
                <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 border"
                    style={{ backgroundColor: `${accentColor}15`, borderColor: `${accentColor}25` }}
                >
                    <div style={{ color: accentColor }}>{icon}</div>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{description}</p>
            </div>
        </div>
    )
}

const PROJECT_STATUS_CFG = {
    pending:  { color: '#ffcc00', label: 'Under Review',  bg: 'bg-[#ffcc00]/10',  border: 'border-[#ffcc00]/20' },
    approved: { color: '#2CB1A1', label: 'Approved',      bg: 'bg-[#2CB1A1]/10',  border: 'border-[#2CB1A1]/20' },
    denied:   { color: '#C96A4A', label: 'Not Accepted',  bg: 'bg-[#C96A4A]/10',  border: 'border-[#C96A4A]/20' },
} as const

function hasProjectDescription(value: string | null | undefined): boolean {
    return (value ?? '').trim().length > 0
}

function hasWorkspaceUrl(value: string | null | undefined): boolean {
    return (value ?? '').trim().length > 0
}

function ProjectWorkspaceCard({
    workspaceUrl,
    dashboard,
    onOpenProjectModal,
}: {
    workspaceUrl: string
    dashboard: any
    onOpenProjectModal: () => void
}) {
    const hasWorkspace = hasWorkspaceUrl(workspaceUrl)
    const title = dashboard?.projectWorkspaceCardTitle || 'Project workspace'
    const readyBody = dashboard?.projectWorkspaceCardBody || 'Keep all daily deliverables, notes, links, and artifacts in one working document so reviews stay anchored in the same place.'
    const missingBody = dashboard?.projectWorkspaceCardMissingBody || 'Add one workspace link before you continue. This is where your missions, proofs, and weekly outputs should live.'
    const openLabel = dashboard?.projectWorkspaceCardOpenLabel || 'Open workspace'
    const missingLabel = dashboard?.projectWorkspaceCardMissingLabel || 'Add workspace link'

    return (
        <section className={`mb-6 rounded-3xl border p-6 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-700 ${hasWorkspace ? 'border-[#ffcc00]/20 bg-[#ffcc00]/[0.06]' : 'border-[#F59E0B]/25 bg-[#F59E0B]/[0.08]'}`}>
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                    <div className={`mb-2 text-[10px] font-bold uppercase tracking-[0.24em] ${hasWorkspace ? 'text-[#ffcc00]' : 'text-[#F59E0B]'}`}>
                        {title}
                    </div>
                    <h3 className="text-xl font-bold text-white">{hasWorkspace ? 'Your execution hub is ready' : 'Set up your execution hub'}</h3>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/60">
                        {hasWorkspace ? readyBody : missingBody}
                    </p>
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
                            href={workspaceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center rounded-full bg-[#ffcc00] px-5 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
                        >
                            {openLabel}
                        </a>
                    ) : (
                        <button
                            type="button"
                            onClick={onOpenProjectModal}
                            className="inline-flex items-center justify-center rounded-full bg-[#F59E0B] px-5 py-3 text-sm font-bold text-[#1a2634] transition-opacity hover:opacity-90"
                        >
                            {missingLabel}
                        </button>
                    )}
                </div>
            </div>
        </section>
    )
}

function ProjectSubmissionModal({ open, onClose, projectSubmission, availableTracks, preferredTrackSlug, settings, dismissLocked = false, onSaved, spaceDataPreview, isSpaceDataPending, onOpenSpaceDataSection }: {
    open: boolean
    onClose: () => void
    projectSubmission: { id: number; status: string; partnerComment?: string | null; projectDescription?: string | null; workspaceUrl?: string | null; trackId?: number | null } | null
    availableTracks: { id: number; name: string; slug: string; description?: string | null }[]
    preferredTrackSlug?: string | null
    settings?: any
    dismissLocked?: boolean
    onSaved?: (nextDescription: string, nextWorkspaceUrl: string, nextTrackId: number | null, shouldRefreshSpaceData: boolean) => void
    spaceDataPreview?: any
    isSpaceDataPending?: boolean
    onOpenSpaceDataSection?: () => void
}) {
    const isReviewed = !!projectSubmission && projectSubmission.status !== 'pending'
    const editRules = canFounderEditProjectSubmission(projectSubmission)
    const canEditDescription = editRules.canEditDescription
    const canEditWorkspaceUrl = editRules.canEditWorkspaceUrl
    const canEditProject = canEditDescription || canEditWorkspaceUrl
    const descriptionRequiredForSave = isProjectDescriptionRequiredForFounderSave(projectSubmission)
    const cfg = projectSubmission ? PROJECT_STATUS_CFG[projectSubmission.status as keyof typeof PROJECT_STATUS_CFG] ?? PROJECT_STATUS_CFG.pending : null
    const preferredTrackId = resolvePreferredTrackId(preferredTrackSlug, availableTracks) as number | null
    const initialTrackId = projectSubmission?.trackId ?? (canEditDescription ? preferredTrackId : null)
    const dashboard = settings?.dashboard || {}
    const founderForm = settings?.founderForm || {}
    const workspaceUrlLabel = dashboard?.projectWorkspaceUrlLabel || 'Project Workspace URL'
    const workspaceUrlDescription = dashboard?.projectWorkspaceUrlDescription || 'Add one hub link where all daily deliverables live. This can be Notion, Google Docs, Figma, Sheets, Excel, or any workspace you keep updated throughout the program.'
    const workspaceUrlPlaceholder = dashboard?.projectWorkspaceUrlPlaceholder || 'https://your-workspace-link'
    const workspaceUrlRequiredError = dashboard?.workspaceUrlRequiredError || 'Please paste the URL of your project workspace before saving.'
    const autoSaveSavedLabel = founderForm?.autoSaveLabel || 'Draft saved'
    const autoSaveSavingLabel = founderForm?.autoSaveSavingLabel || 'Saving draft…'

    const [text, setText] = useState(projectSubmission?.projectDescription ?? '')
    const [workspaceUrl, setWorkspaceUrl] = useState(projectSubmission?.workspaceUrl ?? '')
    const [selectedTrack, setSelectedTrack] = useState<number | null>(initialTrackId)
    const [saved, setSaved] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()
    const [dismissUnlocked, setDismissUnlocked] = useState(!dismissLocked)

    const canDismiss = !dismissLocked || dismissUnlocked

    const autoSave = useFormAutoSave({
        formSlug: 'project-submission',
        formType: 'project_submission',
        answers: {
            projectDescription: text,
            workspaceUrl,
            trackId: selectedTrack,
        },
        enabled: open && canEditProject,
        onHydrate: (draft) => {
            setText((prev) => (prev.trim().length === 0 && typeof draft.projectDescription === 'string' ? draft.projectDescription : prev))
            setWorkspaceUrl((prev) => (prev.trim().length === 0 && typeof draft.workspaceUrl === 'string' ? draft.workspaceUrl : prev))
            setSelectedTrack((prev) => (
                prev == null && typeof draft.trackId === 'number'
                    ? draft.trackId
                    : prev
            ))
        },
    })

    const dirty =
        (canEditDescription && (
            text.trim() !== (projectSubmission?.projectDescription ?? '').trim()
            || selectedTrack !== (projectSubmission?.trackId ?? null)
        ))
        || (canEditWorkspaceUrl && workspaceUrl.trim() !== (projectSubmission?.workspaceUrl ?? '').trim())
    const hasValidSelectedTrack = selectedTrack != null && availableTracks.some((track) => track.id === selectedTrack)
    const showTrackRequired = canEditDescription && !hasValidSelectedTrack
    const canSubmit = canEditProject
        && (!descriptionRequiredForSave || text.trim().length > 0)
        && workspaceUrl.trim().length > 0
        && (!canEditDescription || hasValidSelectedTrack)
    const showWorkspaceRequired = canEditWorkspaceUrl && workspaceUrl.trim().length === 0

    useEffect(() => {
        setText(projectSubmission?.projectDescription ?? '')
        setWorkspaceUrl(projectSubmission?.workspaceUrl ?? '')
        setSelectedTrack(initialTrackId)
        setSaved(false)
        setError(null)
    }, [projectSubmission?.id, projectSubmission?.projectDescription, projectSubmission?.workspaceUrl, projectSubmission?.trackId, initialTrackId, open])

    useEffect(() => {
        if (!dismissLocked) {
            setDismissUnlocked(true)
            return
        }

        setDismissUnlocked(
            hasProjectDescription(projectSubmission?.projectDescription)
            && hasWorkspaceUrl(projectSubmission?.workspaceUrl)
            && (!canEditDescription || (
                projectSubmission?.trackId != null
                && availableTracks.some((track) => track.id === projectSubmission.trackId)
            )),
        )
    }, [availableTracks, canEditDescription, dismissLocked, projectSubmission?.id, projectSubmission?.projectDescription, projectSubmission?.workspaceUrl, projectSubmission?.trackId])

    function handleSave() {
        setError(null)
        setSaved(false)
        const trimmedText = text.trim()
        const trimmedWorkspaceUrl = workspaceUrl.trim()
        if (canEditDescription && !hasValidSelectedTrack) {
            setError('Please select an active track')
            return
        }
        const shouldRefreshSpaceData =
            trimmedText !== (projectSubmission?.projectDescription ?? '').trim()
            || (canEditDescription && selectedTrack !== (projectSubmission?.trackId ?? null))
        startTransition(async () => {
            const res = await saveProjectSubmission(text, selectedTrack, trimmedWorkspaceUrl)
            if ('error' in res) setError(res.error)
            else {
                setSaved(true)
                await autoSave.clear()
                if (hasProjectDescription(trimmedText) && hasWorkspaceUrl(trimmedWorkspaceUrl)) {
                    setDismissUnlocked(true)
                    onSaved?.(trimmedText, trimmedWorkspaceUrl, selectedTrack, shouldRefreshSpaceData)
                }
            }
        })
    }

    if (!open) return null

    return (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => { if (canDismiss) onClose() }} />
            <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-3xl border border-white/10 bg-[#203e5f] shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col">
                {canDismiss && (
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 z-50 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                )}

                <div className="overflow-y-auto no-scrollbar">
                    <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, #2CB1A1, #ffcc00, transparent)' }} />

                    <div className="px-8 pt-7 pb-2">
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-11 h-11 rounded-2xl bg-[#2CB1A1]/10 border border-[#2CB1A1]/20 flex items-center justify-center">
                                <svg className="w-5 h-5 text-[#2CB1A1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">Your Project</h3>
                                <p className="text-white/55 text-xs">
                                    {!projectSubmission ? 'Describe your project and select a track' : canEditWorkspaceUrl && isReviewed ? 'Approved — add workspace link' : isReviewed ? 'Reviewed — read only' : 'Editable until reviewed'}
                                </p>
                            </div>
                        </div>
                        {cfg && (
                            <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: `${cfg.color}15`, border: `1px solid ${cfg.color}30` }}>
                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />
                                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: cfg.color }}>{cfg.label}</span>
                            </div>
                        )}
                    </div>

                    <div className="mx-8 h-px bg-white/5 my-4" />

                    <div className="px-8 pb-8 space-y-6">
                        {availableTracks.length > 0 && (
                            <div>
                                <div className="text-[10px] font-bold tracking-[2px] uppercase text-white/50 mb-3">Select your track</div>
                                <div className="grid gap-2">
                                    {availableTracks.map(track => {
                                        const active = selectedTrack === track.id
                                        const visual = getPreferredTrackVisual(track.slug)
                                        const icon = visual.icon
                                        const color = visual.color
                                        return (
                                            <button
                                                key={track.id}
                                                onClick={() => canEditDescription && setSelectedTrack(track.id)}
                                                disabled={!canEditDescription}
                                                aria-pressed={active}
                                                className="w-full text-left rounded-2xl border p-4 transition-all duration-200 group"
                                                style={{
                                                    borderColor: active ? `${color}50` : 'rgba(255,255,255,0.08)',
                                                    background: active ? `${color}0c` : 'rgba(255,255,255,0.02)',
                                                    cursor: canEditDescription ? 'pointer' : 'default',
                                                }}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div
                                                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg transition-transform duration-200"
                                                        style={{ background: `${color}15`, border: `1px solid ${color}25` }}
                                                    >
                                                        {icon}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-bold" style={{ color: active ? color : 'rgba(255,255,255,0.85)' }}>{track.name}</span>
                                                            {active && (
                                                                <svg className="w-4 h-4 shrink-0" style={{ color }} fill="currentColor" viewBox="0 0 20 20">
                                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                                                                </svg>
                                                            )}
                                                        </div>
                                                        {track.description && (
                                                            <p className="text-xs leading-relaxed mt-1" style={{ color: active ? `${color}99` : 'rgba(255,255,255,0.35)' }}>
                                                                {track.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                                {showTrackRequired && (
                                    <p className="mt-3 text-xs leading-relaxed text-[#F6C66F]">
                                        Please select a track before saving.
                                    </p>
                                )}
                            </div>
                        )}

                        <div>
                            <div className="text-[10px] font-bold tracking-[2px] uppercase text-white/50 mb-2">Project description</div>
                            <div className="mb-4 overflow-hidden rounded-2xl border border-[#ffcc00]/20 bg-linear-to-br from-[#ffcc00]/[0.12] via-[#172433]/95 to-[#1a2634] shadow-[0_24px_80px_-48px_rgba(255,204,0,0.75)]">
                                <div className="h-1 w-full bg-linear-to-r from-[#ffcc00] via-[#2CB1A1] to-[#ffcc00]" />
                                <div className="px-4 py-4 md:px-5 md:py-5">
                                    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <div className="text-[10px] font-bold tracking-[2.4px] uppercase text-[#7fd3ff] mb-2">{workspaceUrlLabel}</div>
                                            <p className="max-w-2xl text-sm leading-relaxed text-white/78">{workspaceUrlDescription}</p>
                                        </div>
                                        <div className="shrink-0 rounded-full border border-[#ffcc00]/20 bg-[#ffcc00]/12 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-[#8bd8ff]">
                                            Execution hub
                                        </div>
                                    </div>
                                    <div className="mb-3 flex flex-wrap gap-2 text-[11px] text-white/62">
                                        <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1">Notion</span>
                                        <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1">Google Docs</span>
                                        <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1">Figma</span>
                                        <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1">Sheets / Excel</span>
                                    </div>
                                    <div className="rounded-[20px] border border-white/10 bg-black/20 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                                        <input
                                            type="url"
                                            value={workspaceUrl}
                                            onChange={e => { setWorkspaceUrl(e.target.value); setSaved(false) }}
                                            readOnly={!canEditWorkspaceUrl}
                                            required
                                            aria-required="true"
                                            aria-invalid={showWorkspaceRequired}
                                            placeholder={canEditWorkspaceUrl ? workspaceUrlPlaceholder : ''}
                                            className={[
                                                'w-full rounded-2xl border px-4 py-3.5 text-sm md:text-[15px] bg-white/[0.06] text-white placeholder-white/30 outline-none transition-all shadow-[0_10px_30px_-18px_rgba(0,0,0,0.8)]',
                                                !canEditWorkspaceUrl
                                                    ? 'border-white/6 text-white/55 cursor-default'
                                                    : showWorkspaceRequired
                                                        ? 'border-[#F59E0B]/45 focus:border-[#F59E0B]/65 focus:bg-white/[0.09] focus:shadow-[0_0_0_4px_rgba(245,158,11,0.12)]'
                                                        : 'border-[#ffcc00]/20 focus:border-[#ffcc00]/55 focus:bg-white/[0.09] focus:shadow-[0_0_0_4px_rgba(255,204,0,0.12)]',
                                            ].join(' ')}
                                        />
                                    </div>
                                    {showWorkspaceRequired && (
                                        <p className="mt-3 text-xs leading-relaxed text-[#F6C66F]">
                                            {workspaceUrlRequiredError}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="mb-4 rounded-xl bg-violet-500/6 border border-violet-500/15 px-4 py-3">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-300/70 mb-1.5">
                                    Example Project
                                </p>
                                <p className="text-white/90 text-[15px] md:text-base leading-relaxed">
                                    The sample <span className="text-violet-200 font-semibold">“Uber for cleaners”</span> project is demonstration only. Write your own project description and use your own workspace.
                                </p>
                            </div>
                            <textarea
                                rows={6}
                                value={text}
                                onChange={e => { setText(e.target.value); setSaved(false) }}
                                readOnly={!canEditDescription}
                                placeholder={canEditDescription ? 'Describe your project — what problem you solve, who your target user is, and what your solution looks like...' : ''}
                                className={[
                                    'w-full rounded-xl border px-4 py-3 text-sm leading-relaxed bg-white/4 text-white placeholder-white/20 resize-none outline-none transition-colors',
                                    !canEditDescription ? 'border-white/6 text-white/50 cursor-default' : 'border-white/10 focus:border-white/25',
                                ].join(' ')}
                            />
                        </div>

                        {dismissLocked && !canDismiss && (
                            <div className="rounded-xl border border-[#ffcc00]/20 bg-[#ffcc00]/8 px-4 py-3">
                                <p className="text-[#ffcc00] text-[11px] font-bold uppercase tracking-[0.18em] mb-1">Required</p>
                                <p className="text-white/60 text-xs leading-relaxed">Add your workspace URL and project description, then save them before closing this popup.</p>
                            </div>
                        )}

                        {projectSubmission?.partnerComment && (
                            <div className="rounded-xl bg-white/4 border border-white/8 px-4 py-3">
                                <p className="text-white/60 text-[10px] uppercase tracking-wide font-semibold mb-1">Coordinator note</p>
                                <p className="text-white/60 text-xs leading-relaxed">{projectSubmission.partnerComment}</p>
                            </div>
                        )}

                        {(spaceDataPreview || isSpaceDataPending) && (
                            <div className="rounded-2xl border border-[#2CB1A1]/18 bg-[#2CB1A1]/[0.06] px-4 py-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#2CB1A1]">EU Space Data Preview</p>
                                        {isSpaceDataPending && !spaceDataPreview ? (
                                            <p className="mt-2 text-sm leading-relaxed text-white/60">
                                                Analysis is running for your latest project description. The full result will appear in your dashboard section when it is ready.
                                            </p>
                                        ) : (
                                            <>
                                                {spaceDataPreview?.summary && (
                                                    <p className="mt-2 text-sm leading-relaxed text-white/70">{spaceDataPreview.summary}</p>
                                                )}
                                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                                    {spaceDataPreview?.relevanceScore !== null && spaceDataPreview?.relevanceScore !== undefined && (
                                                        <span className="rounded-full border border-[#2CB1A1]/20 bg-[#2CB1A1]/10 px-2.5 py-1 text-[11px] font-semibold text-[#8CE3D8]">
                                                            {spaceDataPreview.relevanceScore}% relevance
                                                        </span>
                                                    )}
                                                    {(spaceDataPreview?.datasets || []).slice(0, 2).map((ds: any, i: number) => (
                                                        <span key={i} className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/60">
                                                            {ds.name || ds.title}
                                                        </span>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    {!isSpaceDataPending && spaceDataPreview && (
                                        <button
                                            type="button"
                                            onClick={onOpenSpaceDataSection}
                                            className="shrink-0 rounded-full border border-[#2CB1A1]/25 bg-[#2CB1A1]/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#8CE3D8] transition-colors hover:bg-[#2CB1A1]/14"
                                        >
                                            View on dashboard
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {canEditProject && (
                            <div className="flex items-center justify-between gap-3">
                                <div className="text-xs">
                                    {error && <span className="text-[#C96A4A]">{error}</span>}
                                    {saved && !dirty && <span className="text-[#2CB1A1]">Saved ✓</span>}
                                    {!saved && !error && (autoSave.isSaving || autoSave.lastSavedAt) && (
                                        <span className="text-white/70">
                                            {autoSave.isSaving
                                                ? autoSaveSavingLabel
                                                : `${autoSaveSavedLabel}${autoSave.lastSavedAt ? ` · ${autoSave.lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}`}
                                        </span>
                                    )}
                                </div>
                                <button
                                    onClick={handleSave}
                                    disabled={isPending || !canSubmit || !dirty}
                                    className="px-6 py-2.5 rounded-full text-sm font-bold text-[#1a2634] transition-all disabled:opacity-30 disabled:cursor-default cursor-pointer"
                                    style={{ background: 'linear-gradient(135deg, #2CB1A1 0%, #ffcc00 100%)' }}
                                >
                                    {isPending ? 'Saving…' : projectSubmission ? 'Save changes' : 'Submit project'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

function PartnerIdentity({
    label,
    logoUrl,
    tone = 'muted',
}: {
    label: string
    logoUrl?: string | null
    tone?: 'muted' | 'highlight'
}) {
    const highlight = tone === 'highlight'

    return (
        <div
            className="min-w-0 w-full rounded-[1.75rem] border p-4 sm:p-5"
            style={{
                background: highlight
                    ? 'linear-gradient(145deg, rgba(44,177,161,0.18), rgba(255,204,0,0.12))'
                    : 'linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
                borderColor: highlight ? 'rgba(44,177,161,0.28)' : 'rgba(255,255,255,0.08)',
                boxShadow: highlight ? '0 24px 80px -44px rgba(255,204,0,0.6)' : 'none',
            }}
        >
            <div className="flex flex-col items-center text-center">
                <div
                    className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[1.6rem] border bg-[#0d0d10] sm:h-28 sm:w-28"
                    style={{ borderColor: highlight ? 'rgba(44,177,161,0.25)' : 'rgba(255,255,255,0.08)' }}
                >
                    {logoUrl ? (
                        <img src={logoUrl} alt={label} className="h-full w-full object-contain p-3.5 sm:p-4" />
                    ) : (
                        <span className="px-3 text-center text-[12px] font-bold uppercase tracking-[0.24em] text-white/70">
                            {label.slice(0, 3)}
                        </span>
                    )}
                </div>
                <div className="mt-4 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/60">
                        {tone === 'highlight' ? 'New partner' : 'Previous partner'}
                    </p>
                    <p className={`mt-2 text-base leading-snug text-balance sm:text-lg ${highlight ? 'font-semibold text-white' : 'text-white/72'}`}>
                        {label}
                    </p>
                </div>
            </div>
        </div>
    )
}

function CalendarSwitchNoticeModal({
    open,
    onClose,
    notice,
    t,
}: {
    open: boolean
    onClose: () => void
    notice: NonNullable<DashboardClientProps['dashboardCalendarNotice']>
    t: (key: string, fallback?: string) => string
}) {
    if (!open) return null

    const reason = notice.reason ?? 'track'
    const previousCalendarLabel = notice.previousCalendarLabel?.trim() || t('dashboard.calendarSwitch.defaultCalendar', 'Default MESGA calendar')
    const nextCalendarLabel = notice.nextCalendarLabel?.trim() || t('dashboard.calendarSwitch.defaultCalendar', 'Default MESGA calendar')
    const previousPartnerName = notice.previousPartnerName?.trim() || t('dashboard.calendarSwitch.none', 'None')
    const nextPartnerName = notice.nextPartnerName?.trim() || t('dashboard.calendarSwitch.none', 'None')
    const previousTrackName = notice.previousTrackName?.trim() || t('dashboard.calendarSwitch.none', 'None')
    const nextTrackName = notice.nextTrackName?.trim() || t('dashboard.calendarSwitch.none', 'None')
    const partnerChanged = previousPartnerName !== nextPartnerName
    const trackChanged = previousTrackName !== nextTrackName

    const explanation = reason === 'partner_track'
        ? t('dashboard.calendarSwitch.combinedExplanation', 'Your partner assignment and specialised category were both updated, so the dashboard switched to a new calendar.')
        : reason === 'partner'
            ? t('dashboard.calendarSwitch.partnerExplanation', 'Your partner assignment changed, so the dashboard switched to the matching partner calendar.')
            : t('dashboard.calendarSwitch.trackExplanation', 'Your project was moved to a better specialised category, so the dashboard switched to the matching track calendar.')

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,204,0,0.16),transparent_34%),rgba(0,0,0,0.8)] backdrop-blur-md" onClick={onClose} />
            <div className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-[2rem] border border-white/10 bg-[#172433] shadow-[0_40px_140px_-48px_rgba(0,0,0,0.95)] animate-in fade-in zoom-in-95 duration-200">
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                    <div className="absolute -left-10 top-0 h-60 w-60 rounded-full bg-[#ffcc00]/10 blur-[90px]" />
                    <div className="absolute -right-12 bottom-0 h-72 w-72 rounded-full bg-[#ffcc00]/12 blur-[120px]" />
                    <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent" />
                </div>

                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 z-20 rounded-full border border-white/10 bg-white/6 p-2 text-white/80 transition-colors hover:bg-white/12 hover:text-white"
                >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                <div className="relative z-10 max-h-[90vh] overflow-y-auto p-6 sm:p-9">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="inline-flex items-center gap-2 rounded-full border border-[#ffcc00]/25 bg-[#ffcc00]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.28em] text-[#ffcc00]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#ffcc00]" />
                            {t('dashboard.calendarSwitch.badge', 'Calendar Update')}
                        </div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-white/70">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#2CB1A1]" />
                            {reason === 'partner_track'
                                ? t('dashboard.calendarSwitch.scopeBoth', 'Partner + category changed')
                                : partnerChanged
                                    ? t('dashboard.calendarSwitch.scopePartner', 'Partner changed')
                                    : t('dashboard.calendarSwitch.scopeTrack', 'Category changed')}
                        </div>
                    </div>

                    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] xl:gap-8">
                        <div className="min-w-0">
                            <h3 className="max-w-xl text-3xl font-black leading-tight tracking-[-0.03em] text-white sm:text-4xl">
                                {t('dashboard.calendarSwitch.title', 'Your dashboard calendar has changed')}
                            </h3>
                            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/62 sm:text-[15px]">
                                {explanation}
                            </p>

                            <div className="mt-6 grid gap-4 sm:grid-cols-2">
                                <div className="rounded-[1.6rem] border border-white/10 bg-white/4 p-5">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/60">
                                        {t('dashboard.calendarSwitch.previousCalendar', 'Previous Calendar')}
                                    </p>
                                    <p className="mt-2 text-sm leading-relaxed text-white/70">{previousCalendarLabel}</p>
                                </div>
                                <div className="rounded-[1.6rem] border border-[#2CB1A1]/25 bg-[linear-gradient(145deg,rgba(44,177,161,0.18),rgba(255,204,0,0.08))] p-5">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#8CE3D8]">
                                        {t('dashboard.calendarSwitch.currentCalendar', 'Current Calendar')}
                                    </p>
                                    <p className="mt-2 text-sm font-semibold leading-relaxed text-white">{nextCalendarLabel}</p>
                                </div>
                            </div>
                        </div>

                        <div className="min-w-0 rounded-[1.8rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-5 sm:p-6">
                            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/60">
                                {t('dashboard.calendarSwitch.whyLabel', 'Why this changed')}
                            </p>
                            <div className="mt-4 space-y-4">
                                {partnerChanged && (
                                    <div className="rounded-[1.6rem] border border-white/8 bg-[#0d0e10]/80 p-4">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/60">
                                            {t('dashboard.calendarSwitch.partnerLabel', 'Partner')}
                                        </p>
                                        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center">
                                            <PartnerIdentity label={previousPartnerName} logoUrl={notice.previousPartnerLogoUrl} />
                                            <div className="mx-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/6 text-white/55">
                                                <span className="text-lg">→</span>
                                            </div>
                                            <PartnerIdentity label={nextPartnerName} logoUrl={notice.nextPartnerLogoUrl} tone="highlight" />
                                        </div>
                                    </div>
                                )}

                                {trackChanged && (
                                    <div className="rounded-[1.6rem] border border-white/8 bg-[#0d0e10]/80 p-4">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/60">
                                            {t('dashboard.calendarSwitch.trackLabel', 'Specialised Category')}
                                        </p>
                                        <div className="mt-3 grid gap-3 rounded-[1.25rem] border border-white/8 bg-white/3 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center">
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/55">
                                                    {t('dashboard.calendarSwitch.beforeLabel', 'Before')}
                                                </p>
                                                <p className="mt-1 truncate text-sm text-white/65">{previousTrackName}</p>
                                            </div>
                                            <div className="mx-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#ffcc00]/20 bg-[#ffcc00]/10 text-[#ffcc00]">
                                                <span className="text-lg">→</span>
                                            </div>
                                            <div className="min-w-0 lg:text-right">
                                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8CE3D8]">
                                                    {t('dashboard.calendarSwitch.afterLabel', 'Now')}
                                                </p>
                                                <p className="mt-1 truncate text-sm font-semibold text-white">{nextTrackName}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="mt-7 flex justify-end">
                        <button
                            onClick={onClose}
                            className="rounded-full bg-linear-to-r from-[#ffcc00] via-[#2CB1A1] to-[#ffcc00] px-6 py-3 text-sm font-bold text-[#071216] shadow-[0_24px_60px_-28px_rgba(44,177,161,0.7)] transition-opacity hover:opacity-92"
                        >
                            {t('dashboard.calendarSwitch.confirm', 'Open updated calendar')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

function ProgramProgress({ progress, dashboard, branding }: {
    progress: ProgramProgress | null
    dashboard: any
    branding: BrandingColors
}) {
    if (!progress) return null

    const { phases, gates, totalDays, dayNumber, daysRemaining, weekNumber, activePhaseIndex } = progress
    const activePhase = phases[activePhaseIndex]
    const activePhaseKey = activePhase.key
    const activeColorCfg = getPhaseColorConfig(branding, activePhaseKey)
    const activePhaseColor = getPhaseTextColor(activeColorCfg, activePhaseKey)

    // Build progress bar gradient stops from actual phase ranges
    const barGradientStops = phases.map(ph => {
        const cfg = getPhaseColorConfig(branding, ph.key)
        const color = getPhaseBarColor(cfg, ph.key)
        const pct = Math.round((ph.startDay / totalDays) * 100)
        return `${color} ${pct}%`
    }).join(', ')

    // dayCounter color
    const dayCounterCfg = branding.dayCounter
    const dayCounterColor = dayCounterCfg ? getPhaseTextColor(dayCounterCfg, 'mix') : activePhaseColor
    const dayCounterBg = dayCounterCfg ? (dayCounterCfg.type === 'gradient' ? getPhaseBackground(dayCounterCfg, 'mix') : null) : null
    const dayCounterIsGrad = dayCounterCfg?.type === 'gradient'

    return (
        <section className="mb-10 rounded-3xl bg-[#203e5f]/50 backdrop-blur-sm p-8 relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700" style={{ border: `1px solid ${branding.cardBorderColor || 'rgba(255,255,255,0.1)'}` }}>
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none" style={{ backgroundColor: `${activePhaseColor}18` }} />
            <div className="absolute top-0 left-0 w-full h-0.5" style={{ background: `linear-gradient(90deg, transparent, ${activePhaseColor}50, transparent)` }} />

            <div className="relative z-10">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                    <div>
                        <h2 className="text-xl font-bold text-white">{dashboard?.programSectionTitle || progress.programName}</h2>
                        <p className="text-white/65 text-sm mt-1">Week {weekNumber + 1} · {daysRemaining} {dashboard?.daysRemainingLabel || 'days remaining'}</p>
                    </div>
                    <div className="flex items-baseline gap-1 whitespace-nowrap shrink-0">
                        {dayCounterIsGrad && dayCounterBg ? (
                            <span
                                className="text-4xl font-black leading-none"
                                style={{ background: dayCounterBg, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', display: 'inline-block' }}
                            >
                                {dayNumber}
                            </span>
                        ) : (
                            <span className="text-4xl font-black leading-none" style={{ color: dayCounterColor }}>
                                {dayNumber}
                            </span>
                        )}
                        <span className="text-white/55 text-lg font-light">/{totalDays}</span>
                    </div>
                </div>

                <div className="grid gap-1 mb-3" style={{ gridTemplateColumns: `repeat(${phases.length}, minmax(0, 1fr))` }}>
                    {phases.map((ph, i) => {
                        const isActive = i === activePhaseIndex
                        const isPast = i < activePhaseIndex
                        const cfg = getPhaseColorConfig(branding, ph.key)
                        const solidColor = getPhaseTextColor(cfg, ph.key)
                        const bg = getPhaseBackground(cfg, ph.key)
                        const isGradient = cfg?.type === 'gradient'
                        return (
                            <div key={ph.key} className="text-center">
                                {isActive && isGradient ? (
                                    <span
                                        className="text-xs font-bold tracking-widest uppercase mb-0.5 transition-all"
                                        style={{ background: bg, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', display: 'inline-block' }}
                                    >
                                        {ph.label}
                                    </span>
                                ) : (
                                    <div
                                        className="text-xs font-bold tracking-widest uppercase mb-0.5 transition-all"
                                        style={{ color: isActive ? solidColor : isPast ? `${solidColor}70` : 'rgba(255,255,255,0.2)' }}
                                    >
                                        {ph.label}
                                    </div>
                                )}
                                <div className="text-[10px] text-white/50 hidden sm:block">{ph.subtitle}</div>
                            </div>
                        )
                    })}
                </div>

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

                <div className="flex flex-wrap justify-between gap-x-3 gap-y-2 text-[10px] text-white/50 mb-8">
                    <span>Day 1</span>
                    {gates.map(gate => (
                        <span key={gate.day}>Day {gate.day}</span>
                    ))}
                </div>

                <div className="border-t border-white/5 pt-6">
                    <p className="text-xs font-bold uppercase tracking-wider text-white/55 mb-4">{dashboard?.decisionGatesTitle || 'Decision Gates'}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
                        {gates.map(gate => {
                            const passed = dayNumber >= gate.day
                            const current = !passed && dayNumber > gate.day - 10
                            return (
                                <div
                                    key={gate.day}
                                    className="flex items-center gap-3 rounded-xl border px-4 py-3 transition-all"
                                    style={{
                                        borderColor: passed ? `${activePhaseColor}50` : current ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)',
                                        backgroundColor: passed ? `${activePhaseColor}08` : 'transparent',
                                    }}
                                >
                                    <div
                                        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                                        style={{
                                            backgroundColor: passed ? `${activePhaseColor}20` : 'rgba(255,255,255,0.05)',
                                            color: passed ? activePhaseColor : 'rgba(255,255,255,0.3)',
                                        }}
                                    >
                                        {passed ? '✓' : '○'}
                                    </div>
                                    <span className="text-xs" style={{ color: passed ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)' }}>
                                        {gate.label}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        </section>
    )
}

function TodaysMission({
    dailyFormSlug, dailyFormTitle, hasSubmitted, dashboard,
    isLocked, lockReason, nextUnlockTime, dayNumber, branding, dayDefinition,
    nextMissionDayNumber, nextMissionSlug, nextMissionTitle, showMesgaTool, workspaceUrl,
    currentDayMentorReview,
}: {
    dailyFormSlug: string | null
    dailyFormTitle: string | null
    hasSubmitted: boolean
    dashboard: any
    isLocked?: boolean
    lockReason?: string | null
    nextUnlockTime?: string | null
    dayNumber?: number
    branding: BrandingColors
    dayDefinition?: DashboardClientProps['dayDefinition']
    nextMissionDayNumber?: number | null
    nextMissionSlug?: string | null
    nextMissionTitle?: string | null
    showMesgaTool?: boolean
    workspaceUrl?: string | null
    currentDayMentorReview?: FounderVisibleMentorReview | null
}) {
    if (isLocked) {
        return (
            <section className="mb-10 rounded-3xl border border-white/10 bg-[#203e5f]/60 backdrop-blur-sm p-8 relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-linear-to-r from-transparent via-white/15 to-transparent" />
                <div className="absolute top-[-40%] right-[-5%] w-72 h-72 bg-white/3 rounded-full blur-[80px] pointer-events-none" />

                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                            <svg className="w-6 h-6 text-white/55" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                            </svg>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-white/65">
                                Day {dayNumber} · Locked
                            </span>
                            <h3 className="text-xl font-bold text-white/60">
                                {lockReason === 'previous_incomplete'
                                    ? `Complete Day ${(dayNumber || 1) - 1} First`
                                    : 'Next Task Incoming'
                                }
                            </h3>
                        </div>
                    </div>

                    {lockReason === 'previous_incomplete' ? (
                        <p className="text-white/65 text-sm leading-relaxed">
                            You need to complete the previous day&apos;s mission before Day {dayNumber} becomes available.
                        </p>
                    ) : lockReason === 'before_release_time' && nextUnlockTime ? (
                        <div className="flex flex-col items-center gap-5 py-4">
                            <p className="text-white/50 text-sm">Your next task unlocks in:</p>
                            <CountdownTimer targetTime={nextUnlockTime} />
                            <p className="text-white/50 text-xs">Tasks are released daily at the scheduled time</p>
                        </div>
                    ) : (
                        <p className="text-white/65 text-sm">This day&apos;s task is not yet available.</p>
                    )}
                </div>
            </section>
        )
    }

    if (!dailyFormSlug) {
        return (
            <section className="mb-10 rounded-3xl border border-white/8 bg-[#203e5f]/40 backdrop-blur-sm px-8 py-6 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                </div>
                <p className="text-white/50 text-sm">{dashboard?.noMissionText || 'No mission assigned for today. Check back tomorrow.'}</p>
            </section>
        )
    }

    const missionTitle = dashboard?.todaysMissionTitle || "Today's Mission"
    const dd = dayDefinition
    const estimatedTimeHrs = normalizeEstimatedTimeHrs(dd?.estimatedTimeHrs)
    const showNextMission = hasSubmitted && !!nextMissionSlug && nextMissionDayNumber != null && nextMissionDayNumber !== dayNumber
    const missionHref = showNextMission ? `/day/${nextMissionSlug}` : `/day/${dailyFormSlug}`
    const missionButtonText = showNextMission
        ? `Start Day ${nextMissionDayNumber} →`
        : dashboard?.todaysMissionButtonText || 'Start Mission →'
    const workspaceHint = dashboard?.todaysMissionWorkspaceHint || 'Complete today’s output in your workspace, then log a short summary here.'
    const hasWorkspace = hasWorkspaceUrl(workspaceUrl)

    return (
        <section className="mb-10 rounded-3xl border border-[#ffcc00]/25 bg-[#203e5f]/60 backdrop-blur-sm p-8 relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-linear-to-r from-transparent via-[#ffcc00]/50 to-transparent" />
            <div className="absolute top-[-40%] right-[-5%] w-72 h-72 bg-[#ffcc00]/8 rounded-full blur-[80px] pointer-events-none" />

            <div className="relative z-10">
                {/* Header row */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                    <div className="w-14 h-14 rounded-2xl bg-[#ffcc00]/10 border border-[#ffcc00]/20 flex items-center justify-center shrink-0">
                        {hasSubmitted ? (
                            <svg className="w-7 h-7 text-[#ffcc00]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                            </svg>
                        ) : (
                            <svg className="w-7 h-7 text-[#ffcc00]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
                            </svg>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-[#ffcc00]">{missionTitle}</span>
                            {dd?.weekNumber != null && (
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/65">Week {dd.weekNumber}</span>
                            )}
                            {estimatedTimeHrs && (
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/65">{estimatedTimeHrs}h est.</span>
                            )}
                            {hasSubmitted && (() => {
                                const c = getPhaseTextColor(getPhaseColorConfig(branding, 'mix'), 'mix')
                                return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border" style={{ backgroundColor: `${c}18`, color: c, borderColor: `${c}30` }}>DONE</span>
                            })()}
                        </div>
                        <h3 className="text-xl font-bold text-white mb-1">{dd?.activity || dailyFormTitle || missionTitle}</h3>
                        {dd?.theme && (
                            <p className="text-[#ffcc00]/70 text-xs font-semibold uppercase tracking-wider mb-1">{dd.theme}</p>
                        )}
                        <p className="text-white/50 text-sm">
                            {hasSubmitted
                                ? dashboard?.todaysMissionCompletedText || 'Mission completed today ✓'
                                : dashboard?.todaysMissionSubtitle || 'Your daily task to advance the program. Complete it to log progress in your execution trail.'}
                        </p>
                        {!hasSubmitted && (
                            <p className={`mt-2 text-xs leading-relaxed ${hasWorkspace ? 'text-[#ffcc00]/80' : 'text-[#F59E0B]/85'}`}>
                                {workspaceHint}
                            </p>
                        )}
                        {showNextMission && (
                            <p className="mt-2 text-white/60 text-xs">
                                Next up: Day {nextMissionDayNumber}{nextMissionTitle ? ` · ${nextMissionTitle}` : ''}
                            </p>
                        )}
                    </div>
                    {(!hasSubmitted || showNextMission) && (
                        <Link
                            href={missionHref}
                            className="shrink-0 px-7 py-3 rounded-full font-bold text-sm text-[#1a2634] hover:opacity-90 transition-all whitespace-nowrap shadow-lg"
                            style={{ backgroundColor: '#ffcc00', boxShadow: '0 0 30px -8px #ffcc0080' }}
                        >
                            {missionButtonText}
                        </Link>
                    )}
                </div>

                {/* Mentor feedback — shown after the day has been reviewed */}
                {hasSubmitted && currentDayMentorReview && (
                    <div className="mt-6 rounded-2xl border border-[#2CB1A1]/20 bg-[#2CB1A1]/[0.06] p-5">
                        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#2CB1A1]/75">Mentor feedback</p>
                                <p className="mt-1 text-sm text-white/45">
                                    {currentDayMentorReview.mentorName || 'Mentor'} · {new Date(currentDayMentorReview.createdAt).toLocaleDateString('en-GB')}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70">
                                    {currentDayMentorReview.score}/5
                                </span>
                                {currentDayMentorReview.gateDecision && (
                                    <span className="rounded-full border border-[#ffcc00]/20 bg-[#ffcc00]/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#ffcc00]">
                                        {currentDayMentorReview.gateDecision}
                                    </span>
                                )}
                            </div>
                        </div>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/75">{currentDayMentorReview.comment}</p>
                    </div>
                )}

                {/* Day definition metadata — shown when not submitted */}
                {dd && !hasSubmitted && (
                    <div className="mt-6 pt-6 border-t border-white/10 space-y-1">
                        {/* YOUR TASK — main concrete action for this day */}
                        {dd.mainSoetMission && (
                            <div className="rounded-xl border-2 border-[#2CB1A1]/50 bg-[#2CB1A1]/10 px-4 py-3.5">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#2CB1A1] px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-[#1a2634]">
                                        YOUR TASK
                                    </span>
                                </div>
                                <p className="text-white font-semibold text-[15px] md:text-base leading-relaxed">{dd.mainSoetMission}</p>
                            </div>
                        )}
                        {/* Founder commandment / guiding principle */}
                        {dd.founderCommandment && (
                            <div className="rounded-xl bg-[#ffcc00]/6 border border-[#ffcc00]/15 px-4 py-3">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#ffcc00]/70 mb-1.5 flex items-center gap-2">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                                    </svg>
                                    Commandment
                                </p>
                                <p className="text-white/90 text-[15px] md:text-base italic leading-relaxed">&ldquo;{dd.founderCommandment}&rdquo;</p>
                            </div>
                        )}

                        {/* Deliverable */}
                        {dd.deliverable && (
                            <div className="rounded-xl bg-[#ffcc00]/6 border border-[#ffcc00]/15 px-4 py-3">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#ffcc00]/70 mb-1.5 flex items-center gap-2">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
                                    </svg>
                                    Deliverable
                                </p>
                                <p className="text-white/90 text-[15px] md:text-base leading-relaxed">{dd.deliverable}</p>
                            </div>
                        )}

                        {dd.exampleProject && (
                            <div className="rounded-xl bg-violet-500/6 border border-violet-500/15 px-4 py-3 select-none">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-300/70 mb-1.5">
                                    Example Project
                                </p>
                                <p className="text-white/90 text-[15px] md:text-base leading-relaxed">{dd.exampleProject}</p>
                            </div>
                        )}

                        {/* Where/How Tips */}
                        {dd.whereHowTips && (
                            <div className="rounded-xl bg-emerald-500/6 border border-emerald-500/15 px-4 py-3">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400/70 mb-1.5 flex items-center gap-2">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
                                    </svg>
                                    Tips
                                </p>
                                <p className="text-white/90 text-[15px] md:text-base leading-relaxed">{dd.whereHowTips}</p>
                            </div>
                        )}

                        {dd.coachingNote && (
                            <div className="rounded-xl bg-fuchsia-500/6 border border-fuchsia-500/15 px-4 py-3">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-fuchsia-300/70 mb-1.5">
                                    Coaching Lens
                                </p>
                                <p className="text-white/90 text-[15px] md:text-base leading-relaxed">{dd.coachingNote}</p>
                            </div>
                        )}

                        {/* Auto-check criteria */}
                        {dd.autoCheckCriteria && (
                            <div className="rounded-xl bg-purple-500/6 border border-purple-500/15 px-4 py-3">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-purple-400/70 mb-1.5 flex items-center gap-2">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                    </svg>
                                    Criteria
                                </p>
                                <p className="text-white/90 text-[15px] md:text-base leading-relaxed">{dd.autoCheckCriteria}</p>
                            </div>
                        )}

                        {/* MESGA Integration */}
                        {showMesgaTool && dd.mesgaIntegration && (
                            <div className="rounded-xl bg-white/3 border border-white/10 px-4 py-3">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50 mb-1.5 flex items-center gap-2">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
                                    </svg>
                                    MESGA Tool
                                </p>
                                <p className="text-white/90 text-[15px] md:text-base leading-relaxed">{dd.mesgaIntegration}</p>
                            </div>
                        )}

                        {/* Educational content */}
                        {(Boolean(dd.eduType) || (dd.eduLinks?.length ?? 0) > 0) && (
                            <div className="rounded-xl bg-amber-500/6 border border-amber-500/15 px-4 py-3">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-400/70 mb-1.5 flex items-center gap-2">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" />
                                    </svg>
                                    Learn
                                </p>
                                {dd.eduType && <p className="text-white/60 text-xs mb-1">{dd.eduType}{dd.contentType ? ` · ${dd.contentType}` : ''}</p>}
                                {dd.eduLinks && dd.eduLinks.length > 0 && (
                                    <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-1">
                                        {dd.eduLinks.map((link, i) => (
                                            <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" className="text-[#ffcc00] text-[13px] hover:underline hover:text-[#ffcc00]/80 transition-colors">{link.label}</a>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Countdown when submitted */}
                {hasSubmitted && nextUnlockTime && (
                    <div className="mt-6 pt-4 border-t border-white/5">
                        <p className="text-white/65 text-xs mb-3">Next task unlocks in:</p>
                        <CountdownTimer targetTime={nextUnlockTime} />
                    </div>
                )}
            </div>
        </section>
    )
}

function ProjectReviewCard({ status, comment, dashboard }: { status: string; comment?: string | null; dashboard: any }) {
    const isPending = status === 'pending'
    const color = isPending ? '#E0C188' : '#C96A4A'
    const bg = isPending ? '#E0C18812' : '#C96A4A12'
    const border = isPending ? '#E0C18830' : '#C96A4A30'

    return (
        <section className="mb-10 rounded-3xl border backdrop-blur-sm p-8 relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700" style={{ backgroundColor: bg, borderColor: border }}>
            <div className="absolute top-0 left-0 w-full h-0.5" style={{ background: `linear-gradient(90deg, transparent, ${color}60, transparent)` }} />

            <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-6">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border" style={{ backgroundColor: `${color}12`, borderColor: `${color}25` }}>
                    {isPending ? (
                        <svg className="w-7 h-7" style={{ color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                        </svg>
                    ) : (
                        <svg className="w-7 h-7" style={{ color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                        </svg>
                    )}
                </div>
                <div className="flex-1">
                    {dashboard?.nextStepEyebrow && (
                        <p className="text-[10px] font-bold uppercase tracking-[0.24em] mb-2" style={{ color: `${color}CC` }}>
                            {dashboard.nextStepEyebrow}
                        </p>
                    )}
                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color }}>
                        {isPending ? (dashboard?.projectReviewPendingBadge || 'Project Under Review') : (dashboard?.projectReviewDeniedBadge || 'Project Not Accepted')}
                    </span>
                    <h3 className="text-xl font-bold text-white mb-1 mt-0.5">
                        {isPending ? (dashboard?.projectReviewPendingTitle || 'Awaiting Coordinator Review') : (dashboard?.projectReviewDeniedTitle || 'Application Not Accepted')}
                    </h3>
                    <p className="text-white/50 text-sm leading-relaxed">
                        {isPending
                            ? (dashboard?.projectReviewPendingDescription || "Your project description has been submitted. A program coordinator will review it shortly — you'll be able to proceed once it's approved.")
                            : (dashboard?.projectReviewDeniedDescription || 'Your project description was not accepted. Please contact your program coordinator for details.')}
                    </p>
                    {comment && (
                        <div className="mt-4 rounded-xl border border-white/8 bg-white/4 px-4 py-3">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-white/55 mb-1">{dashboard?.coordinatorCommentLabel || 'Coordinator comment'}</p>
                            <p className="text-white/60 text-sm leading-relaxed">{comment}</p>
                        </div>
                    )}
                </div>
            </div>
        </section>
    )
}

function PreworkCard({ preworkProgress, dashboard, branding }: { preworkProgress: { completed: number; total: number; nextFormSlug: string | null; nextFormTitle: string | null }; dashboard: any; branding: BrandingColors }) {
    const router = useRouter()
    const [isStarting, startStartingTransition] = useTransition()
    const [startError, setStartError] = useState<string | null>(null)
    const mixCfg = getPhaseColorConfig(branding, 'mix')
    const c = getPhaseTextColor(mixCfg, 'mix')
    const bg = getPhaseBackground(mixCfg, 'mix')
    const isGrad = mixCfg?.type === 'gradient'
    const pct = preworkProgress.total > 0 ? Math.round((preworkProgress.completed / preworkProgress.total) * 100) : 0
    const allDone = preworkProgress.completed >= preworkProgress.total && preworkProgress.total > 0

    const handleStartNow = () => {
        setStartError(null)
        startStartingTransition(() => {
            void (async () => {
                const result = await startProgramAfterPrework()
                if ('error' in result) {
                    setStartError(result.error)
                    return
                }
                router.refresh()
            })()
        })
    }

    return (
        <section className="mb-10 rounded-3xl border bg-[#203e5f]/60 backdrop-blur-sm p-8 relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700" style={{ borderColor: `${c}30` }}>
            <div className="absolute top-0 left-0 w-full h-0.5" style={{ background: `linear-gradient(90deg, transparent, ${c}60, transparent)` }} />
            <div className="absolute top-[-40%] right-[-5%] w-72 h-72 rounded-full blur-[80px] pointer-events-none" style={{ backgroundColor: `${c}08` }} />

            <div className="relative z-10">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border" style={{ background: isGrad ? bg : `${c}10`, borderColor: `${c}20` }}>
                        <svg className="w-7 h-7" style={{ color: isGrad ? 'white' : c }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                        </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                        {dashboard?.nextStepEyebrow && (
                            <p className="text-[10px] font-bold uppercase tracking-[0.24em] mb-2" style={{ color: `${c}CC` }}>
                                {dashboard.nextStepEyebrow}
                            </p>
                        )}
                        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: c }}>
                            {dashboard?.preworkBadge || 'Prework Phase'}
                        </span>
                        <h3 className="text-xl font-bold text-white mb-2 mt-0.5">
                            {allDone
                                ? (dashboard?.preworkCompleteTitle || 'Prework Complete!')
                                : (dashboard?.preworkTitle || 'Complete Your Prework')
                            }
                        </h3>
                        <p className="text-white/50 text-sm leading-relaxed mb-4">
                            {allDone
                                ? (dashboard?.preworkCompleteDescription || 'All prework modules are done. Your 100-day program starts tomorrow!')
                                : (dashboard?.preworkDescription || 'Complete the prework modules below before your 100-day journey begins. No deadlines — work at your own pace.')
                            }
                        </p>

                        {/* Progress bar */}
                        <div className="flex items-center gap-3 mb-1">
                            <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{ width: `${pct}%`, background: bg }}
                                />
                            </div>
                            <span className="text-xs font-semibold whitespace-nowrap" style={{ color: c }}>
                                {preworkProgress.completed}/{preworkProgress.total}
                            </span>
                        </div>
                    </div>
                    {allDone ? (
                        <div className="shrink-0 flex flex-col items-start sm:items-end gap-2">
                            <button
                                type="button"
                                onClick={handleStartNow}
                                disabled={isStarting}
                                className="px-7 py-3 rounded-full font-bold text-sm text-[#1a2634] hover:opacity-90 transition-all whitespace-nowrap shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
                                style={{ background: bg, boxShadow: `0 0 30px -8px ${c}80` }}
                            >
                                {isStarting
                                    ? (dashboard?.preworkStartNowLoadingText || 'Starting...')
                                    : (dashboard?.preworkStartNowButtonText || 'Start 100 Days →')}
                            </button>
                            {startError && (
                                <p className="max-w-64 text-right text-xs text-red-300">{startError}</p>
                            )}
                        </div>
                    ) : preworkProgress.nextFormSlug && (
                        <Link
                            href={`/day/${preworkProgress.nextFormSlug}`}
                            className="shrink-0 px-7 py-3 rounded-full font-bold text-sm text-[#1a2634] hover:opacity-90 transition-all whitespace-nowrap shadow-lg"
                            style={{ background: bg, boxShadow: `0 0 30px -8px ${c}80` }}
                        >
                            {dashboard?.preworkButtonText || `Continue Prework →`}
                        </Link>
                    )}
                </div>
            </div>
        </section>
    )
}

function ReadyToStartCard({ dashboard, paymentEnabled = true, coordinatorComment, branding }: { dashboard: any; paymentEnabled?: boolean; coordinatorComment?: string | null; branding: BrandingColors }) {
    const mixCfg = getPhaseColorConfig(branding, 'mix')
    const c = getPhaseTextColor(mixCfg, 'mix')
    const bg = getPhaseBackground(mixCfg, 'mix')
    const isGrad = mixCfg?.type === 'gradient'
    return (
        <section className="mb-10 rounded-3xl border bg-[#203e5f]/60 backdrop-blur-sm p-8 relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700" style={{ borderColor: `${c}30` }}>
            <div className="absolute top-0 left-0 w-full h-0.5" style={{ background: `linear-gradient(90deg, transparent, ${c}60, transparent)` }} />
            <div className="absolute top-[-40%] right-[-5%] w-72 h-72 rounded-full blur-[80px] pointer-events-none" style={{ backgroundColor: `${c}08` }} />

            <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-6">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border" style={{ background: isGrad ? bg : `${c}10`, borderColor: `${c}20` }}>
                    <svg className="w-7 h-7" style={{ color: isGrad ? 'white' : c }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                </div>
                <div className="flex-1">
                    {dashboard?.nextStepEyebrow && (
                        <p className="text-[10px] font-bold uppercase tracking-[0.24em] mb-2" style={{ color: `${c}CC` }}>
                            {dashboard.nextStepEyebrow}
                        </p>
                    )}
                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: c }}>
                        {dashboard?.readyToStartBadge || (paymentEnabled ? 'Payment Confirmed' : 'Ready to Start')}
                    </span>
                    <h3 className="text-xl font-bold text-white mb-2 mt-0.5">
                        {dashboard?.readyToStartTitle || 'Start Your 100 Days When You\'re Ready'}
                    </h3>
                    <p className="text-white/50 text-sm leading-relaxed mb-3">
                        {dashboard?.readyToStartDescription || (paymentEnabled ? 'Your payment is confirmed. You can begin the program whenever you choose — but once you start, the clock is running.' : 'You can begin the program whenever you choose — but once you start, the clock is running.')}
                    </p>
                    <div className="flex items-start gap-2 rounded-xl border border-[#C96A4A]/20 bg-[#C96A4A]/5 px-4 py-3">
                        <svg className="w-4 h-4 text-[#C96A4A] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                        </svg>
                        <p className="text-[#C96A4A] text-xs leading-relaxed">
                            <strong>Remember:</strong> Each attempt ends on the 3rd missed daily mission. Misses are counted across the attempt, even when they are not consecutive.
                        </p>
                    </div>
                </div>
                <Link
                    href="/start-program"
                    className="shrink-0 px-7 py-3 rounded-full font-bold text-sm text-[#1a2634] hover:opacity-90 transition-all whitespace-nowrap shadow-lg"
                    style={{ background: bg, boxShadow: `0 0 30px -8px ${c}80` }}
                >
                    {dashboard?.readyToStartButtonText || 'Start 100 Days →'}
                </Link>
            </div>
            {coordinatorComment && (
                <div className="relative z-10 mt-5 rounded-xl border px-4 py-3" style={{ borderColor: `${c}20`, backgroundColor: `${c}08` }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: `${c}99` }}>{dashboard?.coordinatorCommentLabel || 'Coordinator comment'}</p>
                    <p className="text-white/60 text-sm leading-relaxed">{coordinatorComment}</p>
                </div>
            )}
        </section>
    )
}

function StartProgramCard({ dashboard, coordinatorComment, t }: { dashboard: any; coordinatorComment?: string | null; t: (key: string, fallback?: string) => string }) {
    return (
        <section className="mb-10 rounded-3xl border border-[#ffcc00]/30 bg-[#203e5f]/60 backdrop-blur-sm p-8 relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-linear-to-r from-transparent via-[#ffcc00]/60 to-transparent" />
            <div className="absolute top-[-40%] right-[-5%] w-72 h-72 bg-[#ffcc00]/8 rounded-full blur-[80px] pointer-events-none" />

            <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-6">
                <div className="w-14 h-14 rounded-2xl bg-[#ffcc00]/10 border border-[#ffcc00]/20 flex items-center justify-center shrink-0">
                    <svg className="w-7 h-7 text-[#ffcc00]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8.689c0-.864.933-1.406 1.683-.977l7.108 4.061a1.125 1.125 0 0 1 0 1.954l-7.108 4.061A1.125 1.125 0 0 1 3 16.811V8.69ZM12.75 8.689c0-.864.933-1.406 1.683-.977l7.108 4.061a1.125 1.125 0 0 1 0 1.954l-7.108 4.061a1.125 1.125 0 0 1-1.683-.977V8.69Z" />
                    </svg>
                </div>
                <div className="flex-1">
                    {dashboard?.nextStepEyebrow && (
                        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#ffcc00]/85 mb-2">
                            {dashboard.nextStepEyebrow}
                        </p>
                    )}
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#ffcc00]">
                        {t('dashboard.startProgramBadge', dashboard?.startProgramBadge || 'Ready to Launch')}
                    </span>
                    <h3 className="text-xl font-bold text-white mb-1 mt-0.5">
                        {t('dashboard.startProgramTitle', dashboard?.startProgramTitle || 'Start Mesga 100 Days')}
                    </h3>
                    <p className="text-white/50 text-sm leading-relaxed">
                        {t('dashboard.startProgramDescription', dashboard?.startProgramDescription || 'You\'ve completed your intake and personality assessment. You\'re ready to begin the 100-day founder program. Activate your journey and start building.')}
                    </p>
                </div>
                <Link
                    href="/start-program"
                    className="shrink-0 px-7 py-3 rounded-full font-bold text-sm text-[#1a2634] hover:opacity-90 transition-all whitespace-nowrap shadow-lg"
                    style={{ backgroundColor: '#ffcc00', boxShadow: '0 0 30px -8px #ffcc0080' }}
                >
                    {t('dashboard.startProgramButtonText', dashboard?.startProgramButtonText || 'Start 100 Days →')}
                </Link>
            </div>
            {coordinatorComment && (
                <div className="relative z-10 mt-5 rounded-xl border border-[#ffcc00]/20 bg-[#ffcc00]/5 px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#ffcc00]/60 mb-1">{dashboard?.coordinatorCommentLabel || 'Coordinator comment'}</p>
                    <p className="text-white/60 text-sm leading-relaxed">{coordinatorComment}</p>
                </div>
            )}
        </section>
    )
}

function FailedProgramCard({ programAttempts, maxAttempts, dashboard }: { programAttempts: number; maxAttempts: number; dashboard: any }) {
    const attemptsLeft = maxAttempts - programAttempts
    return (
        <section className="mb-10 rounded-3xl border border-[#C96A4A]/30 bg-[#203e5f]/60 backdrop-blur-sm p-8 relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-linear-to-r from-transparent via-[#C96A4A]/60 to-transparent" />
            <div className="absolute top-[-40%] right-[-5%] w-72 h-72 bg-[#C96A4A]/5 rounded-full blur-[80px] pointer-events-none" />

            <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-6">
                <div className="w-14 h-14 rounded-2xl bg-[#C96A4A]/10 border border-[#C96A4A]/20 flex items-center justify-center shrink-0">
                    <svg className="w-7 h-7 text-[#C96A4A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.990" />
                    </svg>
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#C96A4A]">
                            {dashboard?.failedProgramBadge || 'Attempt Failed'}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/65 font-bold">
                            {attemptsLeft} {attemptsLeft === 1 ? 'try' : 'tries'} left
                        </span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-1">
                        {dashboard?.failedProgramTitle || 'Your Attempt Has Ended'}
                    </h3>
                    <p className="text-white/50 text-sm leading-relaxed">
                        {dashboard?.failedProgramDescription || 'You reached the 3-miss limit for this attempt, so it was automatically ended. You can start a new attempt.'}
                    </p>
                </div>
                <Link
                    href="/start-program"
                    className="shrink-0 px-7 py-3 rounded-full font-bold text-sm text-white hover:opacity-90 transition-all whitespace-nowrap border border-[#C96A4A]/40 bg-[#C96A4A]/10"
                >
                    {dashboard?.failedProgramButtonText || 'Try Again →'}
                </Link>
            </div>
        </section>
    )
}

function NoAttemptsCard({ maxAttempts, dashboard }: { maxAttempts: number; dashboard: any }) {
    return (
        <section className="mb-10 rounded-3xl border border-white/10 bg-[#203e5f]/50 backdrop-blur-sm p-8 relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="relative z-10 flex items-start gap-6">
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                    <svg className="w-7 h-7 text-white/55" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                </div>
                <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/55">
                        {dashboard?.noAttemptsBadge || 'No Attempts Remaining'}
                    </span>
                    <h3 className="text-xl font-bold text-white/60 mb-1 mt-0.5">
                        {dashboard?.noAttemptsTitle || `All ${maxAttempts} Attempts Used`}
                    </h3>
                    <p className="text-white/55 text-sm leading-relaxed">
                        {dashboard?.noAttemptsDescription || `You have used all ${maxAttempts} of your program attempts without completing the 100 days. Please contact support if you believe this is an error.`}
                    </p>
                </div>
            </div>
        </section>
    )
}

function CompletedProgramCard({ dashboard, branding }: { dashboard: any; branding: BrandingColors }) {
    const glazeCfg = getPhaseColorConfig(branding, 'glaze')
    const c = getPhaseTextColor(glazeCfg, 'glaze')
    const bg = getPhaseBackground(glazeCfg, 'glaze')
    const isGrad = glazeCfg?.type === 'gradient'
    return (
        <section className="mb-10 rounded-3xl border bg-[#203e5f]/60 backdrop-blur-sm p-8 relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700" style={{ borderColor: `${c}30` }}>
            <div className="absolute top-0 left-0 w-full h-0.5" style={{ background: `linear-gradient(90deg, transparent, ${c}60, transparent)` }} />
            <div className="absolute top-[-40%] right-[-5%] w-72 h-72 rounded-full blur-[80px] pointer-events-none" style={{ backgroundColor: `${c}0D` }} />
            <div className="relative z-10 flex items-start gap-6">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border" style={{ background: isGrad ? bg : `${c}10`, borderColor: `${c}20` }}>
                    <svg className="w-7 h-7" style={{ color: isGrad ? 'white' : c }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                </div>
                <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: c }}>
                        {dashboard?.completedBadge || 'Program Complete'}
                    </span>
                    <h3 className="text-xl font-bold text-white mb-1 mt-0.5">
                        {dashboard?.completedTitle || 'Congratulations — 100 Days Done!'}
                    </h3>
                    <p className="text-white/50 text-sm leading-relaxed">
                        {dashboard?.completedDescription || 'You have successfully completed the entire 100-day founder program. Your consistency and commitment have paid off.'}
                    </p>
                </div>
            </div>
        </section>
    )
}

function CertificateProfileCard({
    dashboard,
    attemptData,
}: {
    dashboard: any
    attemptData: NonNullable<DashboardClientProps['attemptData']>
}) {
    const certificate = attemptData.certificate ?? null
    const resolution = attemptData.certificateResolution
    const policy = attemptData.certificatePolicy
    const hasAssignedCertificate = Boolean(certificate?.kind || certificate?.profileConfirmedAt)

    if (!policy?.enabled || !policy.showOnDashboard || !resolution || (!['completed', 'failed'].includes(attemptData.status) && !hasAssignedCertificate)) {
        return null
    }

    const statusText =
        resolution.kind === 'completion'
            ? dashboard?.certificateCompletionText || 'Completion'
            : resolution.kind === 'participation'
                ? dashboard?.certificateParticipationText || 'Participation'
                : dashboard?.certificateNoCertificateText || 'No certificate'
    const statusColor =
        resolution.kind === 'completion'
            ? '#2CB1A1'
            : resolution.kind === 'participation'
                ? '#ffcc00'
                : '#C96A4A'
    const missedSessions = certificate?.missedSessions ?? 0
    const hadWeekOff = certificate?.hadWeekOff === true

    return (
        <section className="mb-10 rounded-3xl border border-[#ffcc00]/20 bg-[#203e5f]/55 p-8 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#ffcc00]">
                        {dashboard?.certificateCardBadge || 'Certificate Details'}
                    </p>
                    <h3 className="mt-2 text-xl font-bold text-white">
                        {dashboard?.certificateCardTitle || 'Certificate details'}
                    </h3>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/60">
                        {dashboard?.certificateCardDescription || 'Your certificate details are prepared automatically after program completion.'}
                    </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/55">
                        {dashboard?.certificateEligibilityLabel || 'Current certificate status'}
                    </p>
                    <div className="mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: statusColor, borderColor: `${statusColor}44`, background: `${statusColor}12` }}>
                        {statusText}
                    </div>
                    <div className="mt-3 space-y-1 text-xs text-white/62">
                        <p>{dashboard?.certificateMissedSessionsLabel || 'Missed sessions'}: <span className="font-semibold text-white/84">{missedSessions}</span> / {policy.missedSessionsThreshold}</p>
                        <p>{dashboard?.certificateWeekOffLabel || 'Week off recorded'}: <span className="font-semibold text-white/84">{hadWeekOff ? 'Yes' : 'No'}</span></p>
                    </div>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-white/62">
                        {dashboard?.certificateFullNameLabel || 'Full name'}
                    </p>
                    <p className="text-sm font-semibold text-white">{certificate?.fullName || '-'}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-white/62">
                        {dashboard?.certificateCompanyNameLabel || 'Company name'}
                    </p>
                    <p className="text-sm font-semibold text-white">{certificate?.companyName || '-'}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-white/62">
                        {dashboard?.certificateRoleTitleLabel || 'Role / title'}
                    </p>
                    <p className="text-sm font-semibold text-white">{certificate?.roleTitle || '-'}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-white/62">
                        {dashboard?.certificateCountryLabel || 'Country'}
                    </p>
                    <p className="text-sm font-semibold text-white">{certificate?.country || '-'}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 md:col-span-2">
                    <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-white/62">
                        {dashboard?.certificateCityLabel || 'City'}
                    </p>
                    <p className="text-sm font-semibold text-white">{certificate?.city || '-'}</p>
                </div>
            </div>
        </section>
    )
}

function DatasetCard({ ds }: { ds: any }) {
    const [expanded, setExpanded] = useState(false)
    const Wrapper: any = ds.dataUrl ? 'a' : 'div'
    const wrapperProps = ds.dataUrl ? { href: ds.dataUrl, target: '_blank', rel: 'noopener noreferrer' } : {}

    // Use description as the primary text; fall back to useCase.
    // Avoid showing both since they're often duplicates.
    const bodyText = ds.description || ds.useCase || ''
    const isLong = bodyText.length > 160

    return (
        <Wrapper
            {...wrapperProps}
            className={`block rounded-2xl bg-white/3 border border-white/5 px-4 py-3 transition-colors ${ds.dataUrl ? 'hover:bg-white/5 hover:border-[#2CB1A1]/20 cursor-pointer' : ''}`}
        >
            {/* Row 1: name + badge */}
            <div className="flex items-start justify-between gap-3">
                <span className="text-sm font-semibold text-white leading-snug">{ds.name || ds.title}</span>
                {ds.euSpaceAsset && (
                    <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-[#2CB1A1]/70 bg-[#2CB1A1]/8 border border-[#2CB1A1]/15 px-2 py-0.5 rounded-full whitespace-nowrap">
                        {ds.euSpaceAsset}
                    </span>
                )}
            </div>

            {/* Row 2: matched keywords */}
            {ds.matchedKeywords && ds.matchedKeywords.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                    <span className="text-[10px] text-white/40 mr-0.5">matched on:</span>
                    {(ds.matchedKeywords as string[]).slice(0, 5).map((kw: string, ki: number) => (
                        <span key={ki} className="text-[10px] text-[#2CB1A1]/65 bg-[#2CB1A1]/6 border border-[#2CB1A1]/12 px-1.5 py-0.5 rounded">
                            {kw}
                        </span>
                    ))}
                </div>
            )}

            {/* Row 3: description (truncated) */}
            {bodyText && (
                <div className="mt-2">
                    <p className={`text-white/50 text-xs leading-relaxed ${!expanded && isLong ? 'line-clamp-2' : ''}`}>
                        {bodyText}
                    </p>
                    {isLong && !ds.dataUrl && (
                        <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); setExpanded(v => !v) }}
                            className="mt-0.5 text-[10px] text-[#2CB1A1]/60 hover:text-[#2CB1A1] transition-colors"
                        >
                            {expanded ? 'Show less ↑' : 'Show more ↓'}
                        </button>
                    )}
                </div>
            )}

            {/* Row 4: live data badge */}
            {(ds.sampleItemCount ?? 0) > 0 && (
                <div className="mt-2 flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                    <span className="text-[10px] text-green-500/70">
                        Live data — {(ds.sampleItemCount as number).toLocaleString()} items (last 90d)
                    </span>
                </div>
            )}
        </Wrapper>
    )
}

function SpaceDataCard({

    data,
    t,
    isPending = false,
}: {
    data?: any
    t: (key: string, fallback?: string) => string
    isPending?: boolean
}) {
    if (!data && !isPending) return null

    const datasets = data?.datasets || []
    const relevanceScore = data?.relevanceScore ?? null
    const summary = data?.summary || null
    const keywords = data?.keywords || []
    const euSpaceAssets = data?.euSpaceAssets || []
    const galileoRelevance = data?.galileoRelevance || null
    const hasResults = datasets.length > 0 || !!summary
    const isLowSignal = !isPending && relevanceScore !== null && relevanceScore <= 9 && datasets.length === 0
    const showGalileoDetails = !!galileoRelevance && !isLowSignal

    return (
        <section id="space-data-preview" className="mb-10 rounded-3xl border border-[#2CB1A1]/20 bg-[#203e5f]/50 backdrop-blur-sm p-8 relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700 scroll-mt-28">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-linear-to-r from-transparent via-[#2CB1A1]/50 to-transparent" />
            <div className="absolute top-[-30%] right-[-10%] w-[40%] h-[60%] bg-[#2CB1A1]/6 blur-[80px] rounded-full pointer-events-none" />

            <div className="relative z-10">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-[#2CB1A1]/10 border border-[#2CB1A1]/20 flex items-center justify-center shrink-0">
                        <svg className="w-7 h-7 text-[#2CB1A1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-xl font-bold text-white">{t('dashboard.spaceDataTitle', 'EU Space Data Integration')}</h3>
                            {isPending && relevanceScore === null && (
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#2CB1A1]/12 border border-[#2CB1A1]/20 text-[#2CB1A1]">
                                    Analyzing now
                                </span>
                            )}
                            {relevanceScore !== null && (
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#2CB1A1]/15 border border-[#2CB1A1]/25 text-[#2CB1A1]">
                                    {isLowSignal ? 'Low signal' : `${relevanceScore}${t('dashboard.spaceDataRelevanceLabel', '% relevance')}`}
                                </span>
                            )}
                        </div>
                        <p className="text-white/65 text-sm mt-0.5">{t('dashboard.spaceDataPoweredBy', 'Powered by Copernicus Data Space Ecosystem & Galileo GNSS')}</p>
                    </div>
                </div>

                {/* EU Space Assets badges */}
                {euSpaceAssets.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-5">
                        {euSpaceAssets.map((asset: string, i: number) => (
                            <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ffcc00]/8 border border-[#ffcc00]/15 text-xs font-medium text-[#ffcc00]/80">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3" /></svg>
                                {asset}
                            </span>
                        ))}
                    </div>
                )}

                {summary && !isLowSignal && (
                    <p className="text-white/60 text-sm leading-relaxed mb-5">{summary}</p>
                )}

                {isLowSignal && (
                    <div className="mb-5 rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                        <p className="text-white/70 text-sm leading-relaxed">
                            The current description does not create a strong Copernicus or Galileo match yet.
                        </p>
                        <p className="mt-2 text-white/70 text-xs leading-relaxed">
                            Stronger matches usually mention a monitored area, location-aware workflows, Earth observation inputs, or what is being measured over time. If your project does not use EU space data, this section stays hidden until there is a clearer fit.
                        </p>
                    </div>
                )}

                {keywords.length > 0 && !isLowSignal && (
                    <div className="flex flex-wrap gap-2 mb-5">
                        {keywords.map((kw: string, i: number) => (
                            <span key={i} className="px-2.5 py-1 rounded-full bg-[#2CB1A1]/8 border border-[#2CB1A1]/15 text-xs text-[#2CB1A1]/80">
                                {kw}
                            </span>
                        ))}
                    </div>
                )}

                {datasets.length > 0 && (
                    <div className="space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-white/55">{t('dashboard.spaceDataDatasetsLabel', 'Copernicus Datasets — Verified via STAC API')}</h4>
                        {datasets.slice(0, 5).map((ds: any, i: number) => (
                            <DatasetCard key={i} ds={ds} />
                        ))}
                    </div>
                )}


                {/* Galileo/EGNOS relevance */}
                {showGalileoDetails && (
                    <div className="mt-5 rounded-2xl bg-[#ffcc00]/5 border border-[#ffcc00]/15 p-4">
                        <div className="flex items-center gap-2 mb-1.5">
                            <svg className="w-4 h-4 text-[#ffcc00]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                            </svg>
                            <span className="text-xs font-bold uppercase tracking-widest text-[#ffcc00]">{t('dashboard.spaceDataGalileoLabel', 'Galileo / EGNOS Integration')}</span>
                        </div>
                        <p className="text-white/50 text-xs leading-relaxed">{galileoRelevance}</p>
                    </div>
                )}

                {isPending && !hasResults && (
                    <div className="flex items-center gap-3 py-2">
                        <div className="w-2 h-2 rounded-full bg-[#2CB1A1] animate-pulse" />
                        <p className="text-white/65 text-sm">Space data analysis is running for your latest project description. This preview updates automatically when the result is ready.</p>
                    </div>
                )}

                {hasResults && !isPending && (
                    <p className="text-[10px] text-white/70 mt-5 text-center">
                        Contains modified Copernicus Sentinel data {new Date().getFullYear()} — provided under EU open data policy
                    </p>
                )}
            </div>
        </section>
    )
}

export default function DashboardClient({
    user,
    settings,
    needsPersonalityTest,
    personalityTestSlug,
    founderArchetype,
    founderTrack,
    dailyFormSlug,
    dailyFormTitle,
    hasSubmittedDailyForm,
    dayNumber,
    isDayLocked,
    dayLockReason,
    nextUnlockTime,
    completedDays,
    personalityScores,
    nextMissionDayNumber,
    nextMissionSlug,
    nextMissionTitle,
    programStatus = 'not_started',
    programAttempts = 0,
    hasPaid100Days = false,
    paymentEnabled = true,
    projectSubmission = null,
    availableTracks = [],
    preferredTrackSlug = null,
    partnerLogoUrl = null,
    partnerName = null,
    partnerBrandingColors = null,
    assignedMentor = null,
    dashboardCalendarNotice = null,
    currentDayMentorReview = null,
    dayDefinition = null,
    preworkProgress = null,
    attemptData = null,
    openProjectModalDefault = false,
}: DashboardClientProps) {
    const router = useRouter()
    const branding: BrandingColors = partnerBrandingColors || {}
    const [showPersonalityResults, setShowPersonalityResults] = useState(false)
    const [showProjectModal, setShowProjectModal] = useState(false)
    const [showCalendarSwitchNotice, setShowCalendarSwitchNotice] = useState(false)
    const [projectDescriptionOverride, setProjectDescriptionOverride] = useState<string | null>(null)
    const [projectWorkspaceUrlOverride, setProjectWorkspaceUrlOverride] = useState<string | null>(null)
    const [savedTrackOverride, setSavedTrackOverride] = useState<{
        sourceTrackId: number | null
        trackId: number | null
    } | null>(null)
    const [spaceDataPreview, setSpaceDataPreview] = useState<any>(projectSubmission?.spaceDataRelevance ?? null)
    const [isSpaceDataPending, setIsSpaceDataPending] = useState(false)
    const [shouldScrollToSpaceData, setShouldScrollToSpaceData] = useState(false)
    const { lang } = useLanguage()
    const t = createT(settings, lang)
    const companyName = settings?.companyName || 'MESGA'
    const dashboard = settings?.dashboard || {}
    const showMesgaTool = settings?.founderForm?.showMesgaTool === true
    const isFounder = user?.role === 'founder'
    const isInvestor = user?.role === 'investor'
    const isPartner = user?.role === 'partner'
    const isAdmin = user?.role === 'admin'

    const projectSubmissionTrackId = projectSubmission?.trackId ?? null
    const persistedTrackId = savedTrackOverride?.sourceTrackId === projectSubmissionTrackId
        && savedTrackOverride.trackId !== projectSubmissionTrackId
        ? savedTrackOverride.trackId
        : projectSubmissionTrackId
    const resolvedProjectTrackSlug = persistedTrackId != null
        ? availableTracks.find((track) => track.id === persistedTrackId)?.slug ?? null
        : projectSubmission == null
            ? preferredTrackSlug
            : null
    const isSpaceTrack = isSpaceTrackSlug(resolvedProjectTrackSlug)

    const logoutButtonText = t('dashboard.logoutButtonText', dashboard?.logoutButtonText || 'Log out')
    const nextStepEyebrow = t('dashboard.nextStepEyebrow', dashboard?.nextStepEyebrow || 'Your next step →')
    const personalityTestPromptTitle = t('dashboard.personalityTestPromptTitle', dashboard?.personalityTestPromptTitle || 'Complete Your Personality Assessment')
    const personalityTestPromptDescription = t('dashboard.personalityTestPromptDescription', dashboard?.personalityTestPromptDescription || 'To proceed with our platform, please fill out the personality test. This helps us match you with the right investors, mentors, and track.')
    const personalityTestButtonText = t('dashboard.personalityTestButtonText', dashboard?.personalityTestButtonText || 'Start Personality Test →')
    const wipBadgeText = t('dashboard.wipBadgeText', dashboard?.wipBadgeText || 'Coming Soon')

    const welcomeTitle = isFounder
        ? t('dashboard.founderWelcomeTitle', dashboard?.founderWelcomeTitle || dashboard?.welcomeTitle || 'Welcome back,')
        : t('dashboard.investorWelcomeTitle', dashboard?.investorWelcomeTitle || dashboard?.welcomeTitle || 'Welcome back,')

    const welcomeSubtitle = isFounder
        ? t('dashboard.founderWelcomeSubtitle', dashboard?.founderWelcomeSubtitle || dashboard?.welcomeSubtitle || '')
        : t('dashboard.investorWelcomeSubtitle', dashboard?.investorWelcomeSubtitle || dashboard?.welcomeSubtitle || '')

    const normalizedFounderArchetype = founderArchetype ? normalizeArchetypeKey(founderArchetype) : null
    const archetypeData = normalizedFounderArchetype
        ? buildNormalizedArchetypeMap(settings?.personality?.archetypes)[normalizedFounderArchetype] ?? null
        : null

    const isTestProgram = isTestProgramStatus(programStatus)
    const isLiveProgram = programStatus === 'active' || isTestProgram
    const progress = isFounder && isLiveProgram ? computeProgramProgress(dayNumber ?? 0, branding) : null

    const partnerRoleLabel = settings?.auth?.partnerRoleLabel || 'Partner'
    const adminRoleLabel = settings?.auth?.adminRoleLabel || 'Admin'

    const roleLabel = isInvestor
        ? (settings?.auth?.investorRoleLabel || 'Investor')
        : isFounder
            ? (settings?.auth?.founderRoleLabel || 'Founder')
            : isPartner
                ? partnerRoleLabel
                : isAdmin
                    ? adminRoleLabel
                    : (user?.role || 'User')

    const roleColor = isInvestor ? '#ffcc00' : isPartner ? '#ffcc00' : isAdmin ? '#a855f7' : '#ffcc00'
    const effectiveProjectDescription = projectDescriptionOverride ?? projectSubmission?.projectDescription ?? ''
    const effectiveWorkspaceUrl = projectWorkspaceUrlOverride ?? projectSubmission?.workspaceUrl ?? ''
    const hasRequiredProjectDescription = hasProjectDescription(effectiveProjectDescription)
    const hasRequiredWorkspaceUrl = hasWorkspaceUrl(effectiveWorkspaceUrl)
    const projectEditRules = canFounderEditProjectSubmission(projectSubmission)
    const hasRequiredProjectTrack = persistedTrackId != null
        && availableTracks.some((track) => track.id === persistedTrackId)
    const requiresProjectDetails = isFounder
        && !needsPersonalityTest
        && (
            !projectSubmission
            || projectSubmission.status === 'pending'
            || projectEditRules.canEditWorkspaceUrl
        )
        && (
            !hasRequiredProjectDescription
            || !hasRequiredWorkspaceUrl
            || (projectEditRules.canEditDescription && !hasRequiredProjectTrack)
        )
    const calendarNoticeVersion = Number(dashboardCalendarNotice?.version ?? 0)
    const calendarNoticeSeenVersion = Number(dashboardCalendarNotice?.seenVersion ?? 0)
    const hasPendingCalendarNotice = isFounder
        && calendarNoticeVersion > 0
        && calendarNoticeVersion > calendarNoticeSeenVersion

    useEffect(() => {
        setProjectDescriptionOverride(projectSubmission?.projectDescription ?? null)
    }, [projectSubmission?.id, projectSubmission?.projectDescription])

    useEffect(() => {
        setProjectWorkspaceUrlOverride(projectSubmission?.workspaceUrl ?? null)
    }, [projectSubmission?.id, projectSubmission?.workspaceUrl])

    useEffect(() => {
        const nextPreview = isSpaceTrack ? projectSubmission?.spaceDataRelevance ?? null : null
        setSpaceDataPreview(nextPreview)
        if (!isSpaceTrack || nextPreview) setIsSpaceDataPending(false)
    }, [isSpaceTrack, projectSubmission?.id, projectSubmission?.spaceDataRelevance])

    useEffect(() => {
        if (!isFounder || needsPersonalityTest) return
        if (!requiresProjectDetails && !openProjectModalDefault) return
        if (projectSubmission && projectSubmission.status !== 'pending' && !requiresProjectDetails) return

        setShowProjectModal(true)

        if (typeof window !== 'undefined') {
            const url = new URL(window.location.href)
            if (url.searchParams.has('project')) {
                url.searchParams.delete('project')
                const next = `${url.pathname}${url.search}${url.hash}`
                window.history.replaceState({}, '', next)
            }
        }
    }, [openProjectModalDefault, isFounder, needsPersonalityTest, projectSubmission, requiresProjectDetails])

    useEffect(() => {
        if (!hasPendingCalendarNotice || !dashboardCalendarNotice) return

        setShowCalendarSwitchNotice(true)
        void acknowledgeDashboardCalendarNotice(calendarNoticeVersion)
    }, [calendarNoticeVersion, dashboardCalendarNotice, hasPendingCalendarNotice])

    useEffect(() => {
        if (!shouldScrollToSpaceData || showProjectModal) return

        const el = document.getElementById('space-data-preview')
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
        setShouldScrollToSpaceData(false)
    }, [shouldScrollToSpaceData, showProjectModal])

    useEffect(() => {
        if (!isFounder || !isSpaceTrack || !isSpaceDataPending || spaceDataPreview) return

        let cancelled = false

        const pollForPreview = async () => {
            for (let attempt = 0; attempt < 12; attempt += 1) {
                const result = await getMyProjectSubmissionPreview()
                if (cancelled) return

                if (!('error' in result) && result.projectSubmission?.spaceDataRelevance) {
                    setSpaceDataPreview(result.projectSubmission.spaceDataRelevance)
                    setIsSpaceDataPending(false)
                    router.refresh()
                    return
                }

                await new Promise(resolve => setTimeout(resolve, 2500))
                if (cancelled) return
            }

            if (!cancelled) {
                setIsSpaceDataPending(false)
                router.refresh()
            }
        }

        void pollForPreview()

        return () => {
            cancelled = true
        }
    }, [isFounder, isSpaceDataPending, isSpaceTrack, router, spaceDataPreview])

    return (
        <div className="dashboard-readable relative min-h-screen bg-[#1a2634] text-white font-sans flex flex-col">
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#ffcc00]/8 blur-[130px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#ffcc00]/8 blur-[130px] rounded-full" />
            </div>

            <header className="sticky top-0 z-50 flex items-center justify-center px-4 sm:px-6 py-4 backdrop-blur-md border-b border-white/5 bg-[#1a2634]/80">
                <div className="flex w-full max-w-7xl items-center justify-between">
                    <Link href="/" className="group flex items-center">
                        <MesgaHorizontalLogo
                            companyName={companyName}
                            logoUrl={settings?.logo?.url}
                            size="header"
                            className="transition-opacity group-hover:opacity-85"
                        />
                    </Link>

                    <div className="flex items-center gap-4 sm:gap-6">
                        <div className="hidden sm:flex flex-col items-end mr-2">
                            <span className="text-sm font-medium text-white/80">{user?.email}</span>
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: roleColor }} />
                                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: roleColor }}>
                                    {roleLabel}
                                </span>
                            </div>
                        </div>
                        <LanguageSwitcher />
                        <form action="/logout" method="POST">
                            <button
                                type="submit"
                                className="rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm font-medium text-white hover:bg-white/10 hover:border-white/20 transition-all active:scale-95"
                            >
                                {logoutButtonText}
                            </button>
                        </form>
                    </div>
                </div>
            </header>

            {/* Attempt status bar — visible on all founder pages when program is active */}
            {isFounder && attemptData && ['active', 'warned_1', 'warned_2', 'prework'].includes(programStatus) && (
                <AttemptStatusBar
                    attemptNumber={attemptData.attemptNumber}
                    maxAttempts={attemptData.maxAttempts}
                    missCount={attemptData.missCount}
                    currentDay={dayNumber || 0}
                    status={attemptData.status as any}
                    programStatus={programStatus}
                />
            )}

            <main className="relative z-10 max-w-7xl mx-auto w-full px-6 pt-16 pb-20 flex-1">

                <div className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    {(partnerLogoUrl || partnerName) && (
                        <div className="mb-5 flex flex-col items-start gap-2">
                            {partnerName && (
                                <p className="text-[10px] font-bold uppercase tracking-widest text-white/55">
                                    Partner — {partnerName}
                                </p>
                            )}
                            {partnerLogoUrl && (
                                <img src={partnerLogoUrl} alt={partnerName ?? 'Partner'} className="h-12 w-auto object-contain" />
                            )}
                        </div>
                    )}
                    {assignedMentor && (
                        <div className="mb-5 max-w-2xl rounded-2xl border border-[#E0C188]/20 bg-[#E0C188]/[0.05] px-5 py-4">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[#E0C188]/70">Assigned mentor</p>
                            <h2 className="mt-1 text-lg font-bold text-white">{assignedMentor.title || 'Mentor'}</h2>
                            {assignedMentor.description && (
                                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-white/60">
                                    {assignedMentor.description}
                                </p>
                            )}
                        </div>
                    )}
                    <div className="flex flex-wrap items-center gap-3 mb-3">
                        {normalizedFounderArchetype && archetypeData && (
                            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#ffcc00]/10 border border-[#ffcc00]/20 text-sm font-medium text-[#ffcc00]">
                                <span>{archetypeData.emoji}</span>
                                <span>{normalizedFounderArchetype}</span>
                            </span>
                        )}
                        {founderTrack && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-bold uppercase tracking-wider text-white/50">
                                {founderTrack}
                            </span>
                        )}
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-black mb-3 tracking-tight leading-[1.1]">
                        {welcomeTitle}{' '}
                        <span className="bg-clip-text text-transparent bg-linear-to-r from-[#ffcc00] to-[#203e5f]">
                            {user?.email?.split('@')[0]}
                        </span>
                    </h1>
                    {welcomeSubtitle && (
                        <p className="text-white/50 text-base sm:text-lg max-w-2xl leading-relaxed">{welcomeSubtitle}</p>
                    )}
                </div>

                {needsPersonalityTest && personalityTestSlug && (
                    <div className="mb-10 rounded-3xl border border-[#ffcc00]/25 bg-[#203e5f]/50 backdrop-blur-sm p-8 relative overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-700">
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-linear-to-r from-transparent via-[#ffcc00]/60 to-transparent" />
                        <div className="absolute top-[-30%] right-[-10%] w-[40%] h-[60%] bg-[#ffcc00]/8 blur-[80px] rounded-full pointer-events-none" />
                        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-6">
                            <div className="w-14 h-14 rounded-2xl bg-[#ffcc00]/10 border border-[#ffcc00]/20 flex items-center justify-center shrink-0">
                                <svg className="w-9 h-9 text-[#ffcc00]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path transform="translate(3, 0)" strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#ffcc00]/85 mb-2">{nextStepEyebrow}</p>
                                <h3 className="text-xl font-bold text-white mb-1">{personalityTestPromptTitle}</h3>
                                <p className="text-white/50 text-sm leading-relaxed">{personalityTestPromptDescription}</p>
                            </div>
                            <Link
                                href={`/intake?form=${personalityTestSlug}`}
                                className="shrink-0 px-7 py-3 rounded-full bg-linear-to-r from-[#ffcc00] to-[#203e5f] font-bold text-sm text-white hover:opacity-90 shadow-[0_0_30px_-5px_#ffcc00] transition-all whitespace-nowrap"
                            >
                                {personalityTestButtonText}
                            </Link>
                        </div>
                    </div>
                )}

                {/* Project review status: pending or denied blocks program access */}
                {isFounder && !needsPersonalityTest && projectSubmission && projectSubmission.status !== 'approved' && (
                    <ProjectReviewCard status={projectSubmission.status} comment={projectSubmission.partnerComment} dashboard={dashboard} />
                )}

                {/* 100-Days: Prework phase */}
                {isFounder && !needsPersonalityTest && (!projectSubmission || projectSubmission.status === 'approved') && programStatus === 'prework' && preworkProgress && (
                    <PreworkCard preworkProgress={preworkProgress} dashboard={dashboard} branding={branding} />
                )}

                {/* 100-Days: Paid, not started — user chooses when to begin */}
                {isFounder && !needsPersonalityTest && (!projectSubmission || projectSubmission.status === 'approved') && programStatus === 'not_started' && hasPaid100Days && (
                    <ReadyToStartCard dashboard={dashboard} paymentEnabled={paymentEnabled} coordinatorComment={projectSubmission?.partnerComment} branding={branding} />
                )}

                {/* 100-Days: Not paid yet — show purchase CTA */}
                {isFounder && !needsPersonalityTest && (!projectSubmission || projectSubmission.status === 'approved') && programStatus === 'not_started' && !hasPaid100Days && (
                    <StartProgramCard dashboard={dashboard} coordinatorComment={projectSubmission?.partnerComment} t={t} />
                )}

                {/* 100-Days: Failed attempt — show restart option */}
                {isFounder && (!projectSubmission || projectSubmission.status === 'approved') && programStatus === 'failed' && programAttempts < (attemptData?.maxAttempts ?? 3) && (
                    <FailedProgramCard programAttempts={programAttempts} maxAttempts={attemptData?.maxAttempts ?? 3} dashboard={dashboard} />
                )}

                {/* 100-Days: Out of attempts */}
                {isFounder && (!projectSubmission || projectSubmission.status === 'approved') && programAttempts >= (attemptData?.maxAttempts ?? 3) && programStatus !== 'completed' && !isLiveProgram && (
                    <NoAttemptsCard maxAttempts={attemptData?.maxAttempts ?? 3} dashboard={dashboard} />
                )}

                {/* 100-Days: Completed! */}
                {isFounder && (!projectSubmission || projectSubmission.status === 'approved') && programStatus === 'completed' && (
                    <CompletedProgramCard dashboard={dashboard} branding={branding} />
                )}

                {isFounder && (!projectSubmission || projectSubmission.status === 'approved') && attemptData && (
                    <CertificateProfileCard dashboard={dashboard} attemptData={attemptData} />
                )}

                {/* Active program: progress + today's mission */}
                {isFounder && (!projectSubmission || projectSubmission.status === 'approved') && progress && isLiveProgram && (
                    <ProgramProgress progress={progress} dashboard={dashboard} branding={branding} />
                )}

                {isFounder && (!projectSubmission || projectSubmission.status === 'approved') && isLiveProgram && (
                    <ProjectWorkspaceCard
                        workspaceUrl={effectiveWorkspaceUrl}
                        dashboard={dashboard}
                        onOpenProjectModal={() => setShowProjectModal(true)}
                    />
                )}

                {isFounder && (!projectSubmission || projectSubmission.status === 'approved') && isLiveProgram && (
                    <TodaysMission
                        dailyFormSlug={dailyFormSlug}
                        dailyFormTitle={dailyFormTitle}
                        hasSubmitted={hasSubmittedDailyForm}
                        dashboard={dashboard}
                        isLocked={isDayLocked}
                        lockReason={dayLockReason}
                        nextUnlockTime={nextUnlockTime}
                        dayNumber={dayNumber}
                        branding={branding}
                        dayDefinition={dayDefinition}
                        nextMissionDayNumber={nextMissionDayNumber}
                        nextMissionSlug={nextMissionSlug}
                        nextMissionTitle={nextMissionTitle}
                        showMesgaTool={showMesgaTool}
                        workspaceUrl={effectiveWorkspaceUrl}
                        currentDayMentorReview={currentDayMentorReview}
                    />
                )}

                {/* Timeline / Day selector — shown when program is active */}
                {isFounder && isLiveProgram && (dayNumber ?? 0) > 0 && (
                    <TimelineView
                        currentDay={dayNumber!}
                        completedDays={completedDays ?? []}
                        missedDays={attemptData?.missedDays || []}
                        unlockAllDays={isTestProgram}
                    />
                )}

                {isFounder && isSpaceTrack && (projectSubmission?.spaceDataRelevance || spaceDataPreview || isSpaceDataPending) && (
                    <SpaceDataCard
                        data={spaceDataPreview || projectSubmission?.spaceDataRelevance}
                        t={t}
                        isPending={isSpaceDataPending && !(spaceDataPreview || projectSubmission?.spaceDataRelevance)}
                    />
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
                    {!isInvestor && <ProfileCard user={user} />}

                    {(isPartner || isAdmin) && (
                        <Link
                            href="/partner"
                            className="group relative rounded-3xl border border-[#ffcc00]/20 bg-[#203e5f]/60 backdrop-blur-md p-8 hover:bg-[#203e5f]/80 hover:border-[#ffcc00]/50 transition-all duration-300 hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-8 delay-100"
                        >
                            <div className="absolute inset-0 rounded-3xl bg-linear-to-br from-[#ffcc00]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            <div className="relative z-10">
                                <div className="w-14 h-14 rounded-2xl bg-[#ffcc00]/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 border border-[#ffcc00]/20">
                                    <svg className="w-7 h-7 text-[#ffcc00]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-bold text-white mb-3 group-hover:text-[#ffcc00] transition-colors">
                                    {isAdmin ? t('dashboard.projectApplicationsCardTitle', dashboard?.projectApplicationsCardTitle || 'Project Applications') : t('dashboard.partnerPanelCardTitle', dashboard?.partnerPanelCardTitle || 'Partner Panel')}
                                </h3>
                                <p className="text-white/50 text-sm leading-relaxed mb-6">
                                    {isAdmin
                                        ? t('dashboard.projectApplicationsCardDescription', dashboard?.projectApplicationsCardDescription || 'Review all project submissions from founders. Approve or deny applications and add coordinator comments.')
                                        : t('dashboard.partnerPanelCardDescription', dashboard?.partnerPanelCardDescription || 'Review project applications from your founders. Approve or deny submissions and manage your banned words list.')}
                                </p>
                                <div className="flex items-center text-sm font-bold text-[#ffcc00] opacity-0 group-hover:opacity-100 transform -translate-x-2.5 group-hover:translate-x-0 transition-all duration-300">
                                    {t('dashboard.openPanelText', dashboard?.openPanelText || 'Open Panel')} <span className="ml-2">→</span>
                                </div>
                            </div>
                        </Link>
                    )}

                    {/* Mentor Dashboard link — for mentor role users */}
                    {((user?.role as string) === 'mentor' || isAdmin) && (
                        <Link
                            href="/mentor"
                            className="group relative rounded-3xl border border-[#E0C188]/20 bg-[#203e5f]/60 backdrop-blur-md p-8 hover:bg-[#203e5f]/80 hover:border-[#E0C188]/50 transition-all duration-300 hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-8 delay-100"
                        >
                            <div className="absolute inset-0 rounded-3xl bg-linear-to-br from-[#E0C188]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            <div className="relative z-10">
                                <div className="w-14 h-14 rounded-2xl bg-[#E0C188]/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 border border-[#E0C188]/20">
                                    <svg className="w-7 h-7 text-[#E0C188]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-bold text-white mb-3 group-hover:text-[#E0C188] transition-colors">
                                    {t('dashboard.mentorDashboardCardTitle', dashboard?.mentorDashboardCardTitle || 'Mentor Dashboard')}
                                </h3>
                                <p className="text-white/50 text-sm leading-relaxed mb-6">
                                    {t('dashboard.mentorDashboardCardDescription', dashboard?.mentorDashboardCardDescription || 'Review founder submissions, provide feedback and scores, and make gate pass/fail/revise decisions.')}
                                </p>
                                <div className="flex items-center text-sm font-bold text-[#E0C188] opacity-0 group-hover:opacity-100 transform -translate-x-2.5 group-hover:translate-x-0 transition-all duration-300">
                                    {t('openInbox', 'Open Inbox')} <span className="ml-2">→</span>
                                </div>
                            </div>
                        </Link>
                    )}

                    {/* Admin Queue link — for admin only */}
                    {isAdmin && (
                        <Link
                            href="/admin-queue"
                            className="group relative rounded-3xl border border-[#C96A4A]/20 bg-[#203e5f]/60 backdrop-blur-md p-8 hover:bg-[#203e5f]/80 hover:border-[#C96A4A]/50 transition-all duration-300 hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-8 delay-100"
                        >
                            <div className="absolute inset-0 rounded-3xl bg-linear-to-br from-[#C96A4A]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            <div className="relative z-10">
                                <div className="w-14 h-14 rounded-2xl bg-[#C96A4A]/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 border border-[#C96A4A]/20">
                                    <svg className="w-7 h-7 text-[#C96A4A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-bold text-white mb-3 group-hover:text-[#C96A4A] transition-colors">
                                    {t('dashboard.attemptQueueCardTitle', dashboard?.attemptQueueCardTitle || 'Attempt Queue')}
                                </h3>
                                <p className="text-white/50 text-sm leading-relaxed mb-6">
                                    {t('dashboard.attemptQueueCardDescription', dashboard?.attemptQueueCardDescription || 'Review failed attempts, monitor partner override decisions, and manage founders needing attention.')}
                                </p>
                                <div className="flex items-center text-sm font-bold text-[#C96A4A] opacity-0 group-hover:opacity-100 transform -translate-x-2.5 group-hover:translate-x-0 transition-all duration-300">
                                    {t('viewQueue', 'View Queue')} <span className="ml-2">→</span>
                                </div>
                            </div>
                        </Link>
                    )}

                    {isAdmin && (
                        <a
                            href="/admin"
                            className="group relative rounded-3xl border border-[#a855f7]/20 bg-[#203e5f]/60 backdrop-blur-md p-8 hover:bg-[#203e5f]/80 hover:border-[#a855f7]/50 transition-all duration-300 hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-8 delay-150"
                        >
                            <div className="absolute inset-0 rounded-3xl bg-linear-to-br from-[#a855f7]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            <div className="relative z-10">
                                <div className="w-14 h-14 rounded-2xl bg-[#a855f7]/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 border border-[#a855f7]/20">
                                    <svg className="w-7 h-7 text-[#a855f7]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-bold text-white mb-3 group-hover:text-[#a855f7] transition-colors">{t('dashboard.payloadAdminCardTitle', dashboard?.payloadAdminCardTitle || 'Payload Admin')}</h3>
                                <p className="text-white/50 text-sm leading-relaxed mb-6">
                                    {t('dashboard.payloadAdminCardDescription', dashboard?.payloadAdminCardDescription || 'Manage users, forms, content, and platform settings from the full Payload CMS admin panel.')}
                                </p>
                                <div className="flex items-center text-sm font-bold text-[#a855f7] opacity-0 group-hover:opacity-100 transform -translate-x-2.5 group-hover:translate-x-0 transition-all duration-300">
                                    {t('dashboard.openAdminText', dashboard?.openAdminText || 'Open Admin')} <span className="ml-2">→</span>
                                </div>
                            </div>
                        </a>
                    )}


                    {personalityScores && (
                        <div className="group relative rounded-3xl border border-white/10 bg-[#203e5f]/60 backdrop-blur-md p-8 hover:bg-[#203e5f]/80 hover:border-[#a855f7]/50 transition-all duration-300 hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-8 delay-100 cursor-pointer" onClick={() => setShowPersonalityResults(true)}>
                            <div className="absolute inset-0 rounded-3xl bg-linear-to-br from-[#a855f7]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            <div className="relative z-10">
                                <div className="w-14 h-14 rounded-2xl bg-[#a855f7]/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 border border-[#a855f7]/20">
                                    <svg className="w-7 h-7 text-[#a855f7]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Zm3.75 11.625a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-bold text-white mb-3 group-hover:text-[#a855f7] transition-colors">{t('dashboard.personalityProfileCard.title', dashboard?.personalityProfileCard?.title || 'Personality Profile')}</h3>
                                <p className="text-white/50 text-sm leading-relaxed mb-6">
                                    {t('dashboard.personalityProfileCard.description', dashboard?.personalityProfileCard?.description || 'Review your archetype details, core strengths, blind spots, and best team roles.')}
                                </p>
                                <div className="flex items-center text-sm font-bold text-[#a855f7] opacity-0 group-hover:opacity-100 transform -translate-x-2.5 group-hover:translate-x-0 transition-all duration-300">
                                    {t('dashboard.personalityProfileCard.buttonText', dashboard?.personalityProfileCard?.buttonText || 'View Results')} <span className="ml-2">→</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {isFounder && (
                        <>
                            <Link
                                href="/ecosystem"
                                className="group relative rounded-3xl border border-[#2CB1A1]/20 bg-[#203e5f]/60 backdrop-blur-md p-8 hover:bg-[#203e5f]/80 hover:border-[#2CB1A1]/50 transition-all duration-300 hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-8 delay-100"
                            >
                                <div className="absolute inset-0 rounded-3xl bg-linear-to-br from-[#2CB1A1]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                <div className="relative z-10">
                                    <div className="w-14 h-14 rounded-2xl bg-[#2CB1A1]/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 border border-[#2CB1A1]/20">
                                        <svg className="w-7 h-7 text-[#2CB1A1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m0 0-3-3m3 3 3-3m-8.25 6a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-3 group-hover:text-[#2CB1A1] transition-colors">
                                        {t('dashboard.ecosystemCard.title', dashboard?.ecosystemCard?.title || 'Ecosystem Map')}
                                    </h3>
                                    <p className="text-white/50 text-sm leading-relaxed mb-6">
                                        {t('dashboard.ecosystemCard.description', dashboard?.ecosystemCard?.description || 'Map your local ecosystem: online groups, physical spaces, events, angel investors, VCs, and operators. Request intros.')}
                                    </p>
                                    <div className="flex items-center text-sm font-bold text-[#2CB1A1] opacity-0 group-hover:opacity-100 transform -translate-x-2.5 group-hover:translate-x-0 transition-all duration-300">
                                        {t('openMap', 'Open Map')} <span className="ml-2">→</span>
                                    </div>
                                </div>
                            </Link>
                            <Link
                                href="/feedback"
                                className="group relative rounded-3xl border border-[#E0C188]/20 bg-[#203e5f]/60 backdrop-blur-md p-8 hover:bg-[#203e5f]/80 hover:border-[#E0C188]/50 transition-all duration-300 hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-8 delay-150"
                            >
                                <div className="absolute inset-0 rounded-3xl bg-linear-to-br from-[#E0C188]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                <div className="relative z-10">
                                    <div className="w-14 h-14 rounded-2xl bg-[#E0C188]/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 border border-[#E0C188]/20">
                                        <svg className="w-7 h-7 text-[#E0C188]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-3 group-hover:text-[#E0C188] transition-colors">
                                        {t('dashboard.mentorsCard.title', dashboard?.mentorsCard?.title || 'Mentors & Feedback')}
                                    </h3>
                                    <p className="text-white/50 text-sm leading-relaxed mb-6">
                                        {t('dashboard.mentorsCard.description', dashboard?.mentorsCard?.description || 'Connect with assigned mentors, receive structured feedback on your submissions, and log your coaching sessions.')}
                                    </p>
                                    <div className="flex items-center text-sm font-bold text-[#E0C188] opacity-0 group-hover:opacity-100 transform -translate-x-2.5 group-hover:translate-x-0 transition-all duration-300">
                                        {t('viewFeedback', 'View Feedback')} <span className="ml-2">→</span>
                                    </div>
                                </div>
                            </Link>
                            <div
                                className="group relative rounded-3xl border border-white/10 bg-[#203e5f]/60 backdrop-blur-md p-8 hover:bg-[#203e5f]/80 hover:border-[#2CB1A1]/50 transition-all duration-300 hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-8 delay-200 cursor-pointer"
                                onClick={() => setShowProjectModal(true)}
                            >
                                <div className="absolute inset-0 rounded-3xl bg-linear-to-br from-[#2CB1A1]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                <div className="relative z-10">
                                    <div className="flex items-start justify-between mb-6">
                                        <div className="w-14 h-14 rounded-2xl bg-[#2CB1A1]/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 border border-[#2CB1A1]/20">
                                            <svg className="w-7 h-7 text-[#2CB1A1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
                                            </svg>
                                        </div>
                                        {projectSubmission && (() => {
                                            const sc = PROJECT_STATUS_CFG[projectSubmission.status as keyof typeof PROJECT_STATUS_CFG] ?? PROJECT_STATUS_CFG.pending
                                            return (
                                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: `${sc.color}15`, border: `1px solid ${sc.color}30` }}>
                                                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sc.color }} />
                                                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: sc.color }}>{sc.label}</span>
                                                </div>
                                            )
                                        })()}
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-3 group-hover:text-[#2CB1A1] transition-colors">
                                        {t('dashboard.projectCard.title', dashboard?.projectCard?.title || 'Your Project')}
                                    </h3>
                                    <p className="text-white/50 text-sm leading-relaxed mb-6">
                                        {t('dashboard.projectCard.description', dashboard?.projectCard?.description || (projectSubmission ? 'View or edit your project description and track selection.' : 'Describe your project and select a specialised track to get started.'))}
                                    </p>
                                    <div className="flex items-center text-sm font-bold text-[#2CB1A1] opacity-0 group-hover:opacity-100 transform -translate-x-2.5 group-hover:translate-x-0 transition-all duration-300">
                                        {projectSubmission ? t('viewProject', 'View Project') : t('setUpProject', 'Set Up Project')} <span className="ml-2">→</span>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {isInvestor && (
                        <>
                            <Link
                                href="/investor-profile"
                                className="group relative rounded-3xl border border-white/10 bg-[#203e5f]/60 backdrop-blur-md p-8 hover:bg-[#203e5f]/80 hover:border-[#ffcc00]/50 transition-all duration-300 hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-8 delay-100 cursor-pointer block"
                            >
                                <div className="absolute inset-0 rounded-3xl bg-linear-to-br from-[#ffcc00]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                <div className="relative z-10">
                                    <div className="w-14 h-14 rounded-2xl bg-[#ffcc00]/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 border border-[#ffcc00]/20">
                                        <svg className="w-7 h-7 text-[#ffcc00]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-3 group-hover:text-[#ffcc00] transition-colors">
                                        {t('dashboard.investorProfileCard.title', dashboard?.investorProfileCard?.title || 'Your Investor Profile')}
                                    </h3>
                                    <p className="text-white/50 text-sm leading-relaxed mb-6">
                                        {t('dashboard.investorProfileCard.description', dashboard?.investorProfileCard?.description || 'View and edit your submitted intake data, investment preferences, and contact information.')}
                                    </p>
                                    <div className="flex items-center text-sm font-bold text-[#ffcc00] opacity-0 group-hover:opacity-100 transform -translate-x-2.5 group-hover:translate-x-0 transition-all duration-300">
                                        {t('dashboard.investorProfileCard.buttonText', dashboard?.investorProfileCard?.buttonText || 'View Profile')} <span className="ml-2">&rarr;</span>
                                    </div>
                                </div>
                            </Link>
                            <WipCard
                                icon={<svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" /></svg>}
                                title={t('dashboard.dealflowCard.title', dashboard?.dealflowCard?.title || 'Dealflow')}
                                description={t('dashboard.dealflowCard.description', dashboard?.dealflowCard?.description || 'Browse curated startup profiles, access high-level summaries, and track your introductions from the MESGA team.')}
                                accentColor="#ffcc00"
                                wipText={wipBadgeText}
                            />
                            <WipCard
                                icon={<svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>}
                                title={t('dashboard.applicationsCard.title', dashboard?.applicationsCard?.title || 'Matchmaking')}
                                description={t('dashboard.applicationsCard.description', dashboard?.applicationsCard?.description || 'Founder-investor matching powered by multi-dimensional scoring: stage, sector, geography, value-add, and archetype fit.')}
                                accentColor="#ffcc00"
                                wipText={wipBadgeText}
                            />
                        </>
                    )}

                    <WipCard
                        icon={<svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" /></svg>}
                        title={t('dashboard.resourcesCard.title', dashboard?.resourcesCard?.title || 'Resources & Guides')}
                        description={t('dashboard.resourcesCard.description', dashboard?.resourcesCard?.description || 'Access exclusive documentation, founder playbooks, investor memos, and templates curated by the MESGA team.')}
                        accentColor="#F59E0B"
                        wipText={wipBadgeText}
                    />
                </div>

                {isInvestor && (
                    <div className="rounded-3xl border border-white/8 bg-[#203e5f]/40 backdrop-blur-sm p-8 relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="absolute top-0 right-0 w-72 h-72 bg-[#ffcc00]/8 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                        <div className="relative z-10 flex items-start gap-5">
                            <div className="w-9 h-9 rounded-full bg-[#ffcc00]/15 border border-[#ffcc00]/25 flex items-center justify-center shrink-0 mt-0.5">
                                <div className="w-2 h-2 rounded-full bg-[#ffcc00] animate-pulse" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-white mb-1">{t('dashboard.statusCard.title', dashboard?.statusCard?.title || 'Platform Status Update')}</h3>
                                <p className="text-white/50 text-sm leading-relaxed max-w-2xl">
                                    {(dashboard?.statusCard?.description
                                        ? dashboard.statusCard.description.replace('{companyName}', companyName)
                                        : `The ${companyName} ecosystem is actively expanding. Matchmaking features for Founders and Investors will be deployed in the upcoming cycle. Your intake profile is queued for curator review.`)}
                                </p>
                                <div className="mt-4 flex items-center gap-2 text-xs text-[#ffcc00] font-medium">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#ffcc00]" />
                                    <span>{t('dashboard.statusCard.statusText', dashboard?.statusCard?.statusText || 'Systems Operational')}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            <SiteFooter settings={settings} companyName={companyName} variant="compact" />

            {showPersonalityResults && personalityScores && (
                <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                        onClick={() => setShowPersonalityResults(false)}
                    />
                    <div className="relative w-full max-w-175 max-h-[90vh] overflow-hidden rounded-3xl border border-white/10 bg-[#203e5f] shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col">
                        <button
                            onClick={() => setShowPersonalityResults(false)}
                            className="absolute top-4 right-4 z-50 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                        <div className="overflow-y-auto no-scrollbar rounded-3xl backdrop-blur-xl">
                            <PersonalityResults
                                scores={personalityScores}
                                onContinue={() => setShowPersonalityResults(false)}
                                platformSettings={settings}
                            />
                        </div>
                    </div>
                </div>
            )}

            {dashboardCalendarNotice && (
                <CalendarSwitchNoticeModal
                    open={showCalendarSwitchNotice}
                    onClose={() => setShowCalendarSwitchNotice(false)}
                    notice={dashboardCalendarNotice}
                    t={t}
                />
            )}

            <ProjectSubmissionModal
                open={showProjectModal}
                onClose={() => setShowProjectModal(false)}
                settings={settings}
                dismissLocked={requiresProjectDetails}
                onSaved={(nextDescription, nextWorkspaceUrl, nextTrackId, shouldRefreshSpaceData) => {
                    setProjectDescriptionOverride(nextDescription)
                    setProjectWorkspaceUrlOverride(nextWorkspaceUrl)
                    const savedTrackSlug = nextTrackId != null
                        ? availableTracks.find((track) => track.id === nextTrackId)?.slug ?? null
                        : resolvedProjectTrackSlug
                    const savedIsSpaceTrack = isSpaceTrackSlug(savedTrackSlug)
                    setSavedTrackOverride({
                        sourceTrackId: projectSubmissionTrackId,
                        trackId: nextTrackId,
                    })
                    if (!savedIsSpaceTrack) {
                        setSpaceDataPreview(null)
                        setIsSpaceDataPending(false)
                        setShouldScrollToSpaceData(false)
                    } else if (shouldRefreshSpaceData) {
                        setSpaceDataPreview(null)
                        setIsSpaceDataPending(true)
                    }
                    router.refresh()
                }}
                spaceDataPreview={isSpaceTrack ? (spaceDataPreview || projectSubmission?.spaceDataRelevance) : undefined}
                isSpaceDataPending={isSpaceTrack && isSpaceDataPending && !(spaceDataPreview || projectSubmission?.spaceDataRelevance)}
                onOpenSpaceDataSection={() => {
                    setShowProjectModal(false)
                    setShouldScrollToSpaceData(true)
                }}
                projectSubmission={projectSubmission ? {
                    ...projectSubmission,
                    projectDescription: effectiveProjectDescription,
                    workspaceUrl: effectiveWorkspaceUrl,
                    trackId: persistedTrackId,
                } : null}
                availableTracks={availableTracks}
                preferredTrackSlug={preferredTrackSlug}
            />
        </div>
    )
}
