'use client'

import { useState, useMemo, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createMentorReview } from '@/app/actions'
import FounderProgressPanel, { type FounderProgressTimeline } from '@/components/FounderProgressPanel'
import MesgaHorizontalLogo from '@/components/MesgaHorizontalLogo'

/* ─── Types ─────────────────────────────────────────────────────────── */

interface SubmissionItem {
  id: number
  founderEmail: string
  founderId: number | null
  dayNumber: number
  dayType: string
  programDay: number
  submittedAt: string
  isBackfill: boolean
  submissionData: Record<string, any>
  formTitle: string | null
  formSections: any[] | null
  aiSummary?: {
    summary_3s?: string
    key_output?: string
    decision?: string
    learnings?: string
    mentor_ask?: string
    checks_passed?: boolean
    link_reachable?: boolean
  } | null
  checksPassed?: boolean | null
  linkUrl?: string | null
  linkReachable?: boolean | null
  attemptNumber?: number
  theme?: string | null
  deliverable?: string | null
  autoCheckCriteria?: string | null
  blockFocus?: string | null
  review?: {
    id: number
    score: number
    comment: string
    internalNote: string
    isGateReview: boolean
    gateDecision: string | null
    reviewerEmail: string | null
    createdAt: string
  } | null
}

interface MentorDashboardProps {
  user: any
  mentorType: 'partner' | 'admin'
  partnerName?: string | null
  pendingSubmissions: SubmissionItem[]
  reviewedSubmissions: SubmissionItem[]
  recentReviews: Array<{
    id: number
    submissionId: number | null
    founderEmail: string
    dayNumber: number
    score: number
    comment: string
    isGateReview: boolean
    gateDecision?: string | null
    createdAt: string
  }>
  founders: Array<{
    id: number
    email: string
    programStatus: string
    currentDay: number
    completedDays: number[]
    missedDays: number[]
    submissions: FounderProgressTimeline['submissions']
    reviews: FounderProgressTimeline['reviews']
  }>
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

const DAY_TYPE_COLORS: Record<string, string> = {
  standard: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  retro: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  gate: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  prework: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
}

function DayTypeBadge({ type }: { type: string }) {
  const colors = DAY_TYPE_COLORS[type] ?? DAY_TYPE_COLORS.standard
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border ${colors}`}>
      {type.toUpperCase()}
    </span>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function StarRating({ value, onChange, readonly }: { value: number; onChange?: (v: number) => void; readonly?: boolean }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          className={`text-lg transition-colors ${
            star <= value ? 'text-yellow-400' : 'text-white/15'
          } ${readonly ? 'cursor-default' : 'cursor-pointer hover:text-yellow-300'}`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

/* ─── Submission Data Viewer ─────────────────────────────────────────── */

function SubmissionDataView({ data, sections }: { data: Record<string, any>; sections?: any[] | null }) {
  if (!data || Object.keys(data).length === 0) {
    return <p className="text-xs text-white/30 italic">No submission data</p>
  }

  // If we have form sections, render in order with question labels
  if (sections && sections.length > 0) {
    return (
      <div className="space-y-3">
        {sections.map((section: any, si: number) => (
          <div key={si}>
            {section.questions?.map((q: any) => {
              const answer = data[q.question_id]
              if (answer === undefined || answer === null || answer === '') return null
              if (q.question_type === 'statement') return null
              const isFileOrUrl = q.question_type === 'file_upload' || q.question_type === 'url' || q.question_type === 'website_url'
              const isLink = isFileOrUrl && typeof answer === 'string' && (answer.startsWith('http://') || answer.startsWith('https://'))
              return (
                <div key={q.question_id} className="mb-2">
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">
                    {q.question_text}
                  </p>
                  {isLink ? (
                    <a href={answer} target="_blank" rel="noopener noreferrer" className="text-sm text-[#ffcc00] underline break-all">
                      {q.question_type === 'file_upload' ? (answer.split('/').pop() || 'View file') : answer}
                    </a>
                  ) : (
                    <p className="text-sm text-white/80 whitespace-pre-wrap break-words">
                      {typeof answer === 'object' ? JSON.stringify(answer) : String(answer)}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    )
  }

  // Fallback: render raw key-value pairs
  return (
    <div className="space-y-2">
      {Object.entries(data).map(([key, value]) => {
        if (value === undefined || value === null || value === '') return null
        return (
          <div key={key}>
            <p className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">{key}</p>
            <p className="text-sm text-white/80 whitespace-pre-wrap break-words">
              {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
            </p>
          </div>
        )
      })}
    </div>
  )
}

/* ─── Review Form ────────────────────────────────────────────────────── */

function ReviewForm({
  submission,
  onComplete,
}: {
  submission: SubmissionItem
  onComplete: () => void
}) {
  const [score, setScore] = useState(0)
  const [comment, setComment] = useState('')
  const [internalNote, setInternalNote] = useState('')
  const [gateDecision, setGateDecision] = useState<'pass' | 'fail' | 'revise' | ''>('')
  const [evidencePackUrl, setEvidencePackUrl] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const isGate = submission.dayType === 'gate'

  const handleSubmit = () => {
    if (score === 0) { setError('Please set a score (1-5)'); return }
    if (!comment.trim()) { setError('Please add a comment'); return }
    if (isGate && !gateDecision) { setError('Gate reviews require a pass/fail/revise decision'); return }

    setError('')
    startTransition(async () => {
      const result = await createMentorReview({
        submissionId: submission.id,
        dayNumber: submission.dayNumber,
        score,
        comment,
        internalNote: internalNote || undefined,
        isGateReview: isGate,
        gateDecision: isGate && gateDecision ? gateDecision as 'pass' | 'fail' | 'revise' : undefined,
        evidencePackUrl: evidencePackUrl || undefined,
      })

      if ('error' in result) {
        setError(result.error)
      } else {
        onComplete()
        router.refresh()
      }
    })
  }

  return (
    <div className="mt-4 p-4 bg-[#203e5f] border border-white/10 rounded-lg space-y-4">
      <p className="text-sm font-medium text-white/70">Write Review</p>

      {/* Score */}
      <div>
        <label className="text-xs text-white/40 block mb-1">Score</label>
        <StarRating value={score} onChange={setScore} />
      </div>

      {/* Comment (visible to founder) */}
      <div>
        <label className="text-xs text-white/40 block mb-1">Comment (visible to founder)</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder="Feedback for the founder..."
          className="w-full bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 resize-none"
        />
      </div>

      {/* Internal note (admin/mentor only) */}
      <div>
        <label className="text-xs text-white/40 block mb-1">Internal note (not visible to founder)</label>
        <textarea
          value={internalNote}
          onChange={(e) => setInternalNote(e.target.value)}
          rows={2}
          placeholder="Internal notes..."
          className="w-full bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 resize-none"
        />
      </div>

      {/* Gate decision */}
      {isGate && (
        <div className="p-3 border border-amber-500/20 rounded-lg bg-amber-500/5">
          <label className="text-xs text-amber-300/60 block mb-2 uppercase tracking-wider">Gate Decision (required)</label>
          <div className="flex gap-2">
            {(['pass', 'fail', 'revise'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setGateDecision(d)}
                className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  gateDecision === d
                    ? d === 'pass'
                      ? 'bg-green-500/20 border-green-500/50 text-green-300'
                      : d === 'fail'
                        ? 'bg-red-500/20 border-red-500/50 text-red-300'
                        : 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300'
                    : 'bg-white/5 border-white/10 text-white/40 hover:border-white/20'
                }`}
              >
                {d.toUpperCase()}
              </button>
            ))}
          </div>
          {gateDecision === 'fail' && (
            <p className="text-xs text-red-400/70 mt-2">
              This will end the founder&apos;s current attempt immediately.
            </p>
          )}
          {gateDecision === 'revise' && (
            <p className="text-xs text-yellow-400/70 mt-2">
              The founder will have 48 hours to resubmit.
            </p>
          )}
          <div className="mt-3">
            <label className="text-xs text-white/40 block mb-1">Evidence pack URL (optional)</label>
            <input
              type="url"
              value={evidencePackUrl}
              onChange={(e) => setEvidencePackUrl(e.target.value)}
              placeholder="https://..."
              className="w-full bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30"
            />
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="px-5 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-white/90 transition-colors disabled:opacity-50"
        >
          {isPending ? 'Submitting...' : 'Submit Review'}
        </button>
        <button
          type="button"
          onClick={onComplete}
          className="px-4 py-2 text-sm text-white/40 hover:text-white/60 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

/* ─── Submission Card ────────────────────────────────────────────────── */

function SubmissionCard({
  submission,
  showReviewButton,
  existingReview,
}: {
  submission: SubmissionItem
  showReviewButton: boolean
  existingReview?: SubmissionItem['review']
}) {
  const [expanded, setExpanded] = useState(false)
  const [showReviewForm, setShowReviewForm] = useState(false)

  const isGate = submission.dayType === 'gate'

  return (
    <div className={`bg-[#203e5f] border rounded-lg overflow-hidden transition-colors ${
      isGate ? 'border-amber-500/20 hover:border-amber-500/30' : 'border-white/10 hover:border-white/20'
    }`}>
      {/* Header row */}
      <div
        className="p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-sm font-medium text-white truncate">
                {submission.founderEmail}
              </span>
              <DayTypeBadge type={submission.dayType} />
              {submission.isBackfill && (
                <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border bg-orange-500/20 text-orange-300 border-orange-500/30">
                  BACKFILL
                </span>
              )}
              {submission.checksPassed === false && (
                <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border bg-red-500/20 text-red-300 border-red-500/30">
                  CHECKS FAILED
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-xs text-white/40">
              <span>Day {submission.dayNumber}</span>
              <span>{formatDate(submission.submittedAt)}</span>
              {submission.attemptNumber != null && (
                <span>Attempt #{submission.attemptNumber}</span>
              )}
              {submission.theme && (
                <span className="text-white/25 truncate max-w-[200px]">{submission.theme}</span>
              )}
            </div>

            {/* AI summary preview (collapsed) */}
            {!expanded && submission.aiSummary?.summary_3s && (
              <p className="mt-2 text-xs text-indigo-300/50 line-clamp-1">
                AI: {submission.aiSummary.summary_3s}
              </p>
            )}

            {/* Existing review badge */}
            {existingReview && (
              <div className="flex items-center gap-2 mt-2">
                <StarRating value={existingReview.score} readonly />
                <span className="text-xs text-white/40">
                  by {existingReview.reviewerEmail ?? 'Mentor'}
                </span>
                {existingReview.gateDecision && (
                  <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border ${
                    existingReview.gateDecision === 'pass'
                      ? 'bg-green-500/20 text-green-300 border-green-500/30'
                      : existingReview.gateDecision === 'fail'
                        ? 'bg-red-500/20 text-red-300 border-red-500/30'
                        : 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
                  }`}>
                    {existingReview.gateDecision.toUpperCase()}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-white/20">
              {expanded ? '▲' : '▼'}
            </span>
            {showReviewButton && !showReviewForm && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setExpanded(true)
                  setShowReviewForm(true)
                }}
                className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  isGate
                    ? 'bg-amber-500 text-black hover:bg-amber-400'
                    : 'bg-white text-black hover:bg-white/90'
                }`}
              >
                {isGate ? 'Gate Review' : 'Review'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-white/5 pt-4">
          {/* Context cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            {/* Day definition context */}
            {(submission.deliverable || submission.autoCheckCriteria) && (
              <div className="p-3 bg-[#203e5f] border border-indigo-500/10 rounded-lg">
                <p className="text-[10px] text-indigo-300/50 uppercase tracking-wider mb-2">Day Requirements</p>
                {submission.deliverable && (
                  <div className="mb-2">
                    <p className="text-[10px] text-white/30">Deliverable</p>
                    <p className="text-xs text-white/70">{submission.deliverable}</p>
                  </div>
                )}
                {submission.autoCheckCriteria && (
                  <div>
                    <p className="text-[10px] text-white/30">Auto-check Criteria</p>
                    <p className="text-xs text-white/70">{submission.autoCheckCriteria}</p>
                  </div>
                )}
              </div>
            )}

            {/* AI summary */}
            {submission.aiSummary && (
              <div className="p-3 bg-[#203e5f] border border-indigo-500/10 rounded-lg">
                <p className="text-[10px] text-indigo-300/50 uppercase tracking-wider mb-2">AI Preview (not a grade)</p>
                {submission.aiSummary.summary_3s && (
                  <p className="text-xs text-white/70 mb-2">{submission.aiSummary.summary_3s}</p>
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px]">
                  {submission.aiSummary.key_output && (
                    <span className="text-white/40">Key: {submission.aiSummary.key_output}</span>
                  )}
                  {submission.aiSummary.decision && (
                    <span className="text-white/40">Decision: {submission.aiSummary.decision}</span>
                  )}
                  {submission.aiSummary.checks_passed != null && (
                    <span className={submission.aiSummary.checks_passed ? 'text-green-400/60' : 'text-red-400/60'}>
                      {submission.aiSummary.checks_passed ? 'Checks passed' : 'Checks failed'}
                    </span>
                  )}
                </div>
                {submission.aiSummary.mentor_ask && (
                  <div className="mt-2 p-2 bg-amber-500/5 border border-amber-500/10 rounded">
                    <p className="text-[10px] text-amber-300/50 uppercase mb-0.5">Mentor Ask</p>
                    <p className="text-xs text-white/60">{submission.aiSummary.mentor_ask}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Link */}
          {submission.linkUrl && (
            <div className="mb-3 flex items-center gap-2">
              <a
                href={submission.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-400 hover:text-blue-300 underline truncate"
              >
                {submission.linkUrl}
              </a>
              {submission.linkReachable != null && (
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  submission.linkReachable ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
                }`}>
                  {submission.linkReachable ? 'Reachable' : 'Unreachable'}
                </span>
              )}
            </div>
          )}

          {/* Submission answers */}
          <div className="p-3 bg-[#111] border border-white/5 rounded-lg mb-4">
            <p className="text-[10px] text-white/30 uppercase tracking-wider mb-3">Submission Answers</p>
            <SubmissionDataView data={submission.submissionData} sections={submission.formSections} />
          </div>

          {/* Existing review display */}
          {existingReview && (
            <div className="p-3 bg-green-500/5 border border-green-500/10 rounded-lg mb-4">
              <p className="text-[10px] text-green-300/50 uppercase tracking-wider mb-2">Review</p>
              <div className="flex items-center gap-3 mb-2">
                <StarRating value={existingReview.score} readonly />
                <span className="text-xs text-white/40">{existingReview.score}/5</span>
              </div>
              {existingReview.comment && (
                <p className="text-sm text-white/70 whitespace-pre-wrap">{existingReview.comment}</p>
              )}
              {existingReview.internalNote && (
                <div className="mt-2 p-2 bg-white/5 rounded">
                  <p className="text-[10px] text-white/30 mb-0.5">Internal Note</p>
                  <p className="text-xs text-white/50 whitespace-pre-wrap">{existingReview.internalNote}</p>
                </div>
              )}
            </div>
          )}

          {/* Review form */}
          {showReviewForm && !existingReview && (
            <ReviewForm
              submission={submission}
              onComplete={() => setShowReviewForm(false)}
            />
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Main Dashboard ──────────────────────────────────────────────────── */

export default function MentorDashboard({
  user,
  mentorType,
  partnerName,
  pendingSubmissions,
  reviewedSubmissions,
  recentReviews,
  founders,
}: MentorDashboardProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFounderId, setSelectedFounderId] = useState<number | null>(null)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [optimisticReviewedSubmissionIds, setOptimisticReviewedSubmissionIds] = useState<Set<number>>(new Set())

  const visiblePendingSubmissions = useMemo(
    () => pendingSubmissions.filter((submission) => !optimisticReviewedSubmissionIds.has(submission.id)),
    [optimisticReviewedSubmissionIds, pendingSubmissions],
  )

  const pendingGateCount = useMemo(
    () => visiblePendingSubmissions.filter((s) => s.dayType === 'gate').length,
    [visiblePendingSubmissions],
  )

  const pendingByFounderId = useMemo(() => {
    const map = new Map<number, SubmissionItem[]>()
    for (const submission of visiblePendingSubmissions) {
      if (submission.founderId == null) continue
      const list = map.get(submission.founderId) ?? []
      list.push(submission)
      map.set(submission.founderId, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime())
    }
    return map
  }, [visiblePendingSubmissions])

  function handleReviewCreated(submissionId: number) {
    setOptimisticReviewedSubmissionIds((current) => new Set(current).add(submissionId))
  }

  const filteredFounders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return founders
      .filter((founder) => !query || founder.email.toLowerCase().includes(query))
      .sort((a, b) => {
        const aPending = pendingByFounderId.get(a.id)?.length ?? 0
        const bPending = pendingByFounderId.get(b.id)?.length ?? 0
        if (aPending !== bPending) return bPending - aPending
        return a.email.localeCompare(b.email)
      })
  }, [founders, pendingByFounderId, searchQuery])

  const selectedFounder = useMemo(() => {
    if (selectedFounderId == null) return filteredFounders[0] ?? null
    return filteredFounders.find((founder) => founder.id === selectedFounderId) ?? filteredFounders[0] ?? null
  }, [filteredFounders, selectedFounderId])

  const selectedFounderPendingSubmissions = selectedFounder
    ? pendingByFounderId.get(selectedFounder.id) ?? []
    : []

  const selectedFounderRecentReviews = selectedFounder
    ? recentReviews.filter((review) => review.founderEmail === selectedFounder.email).slice(0, 3)
    : []

  const selectedFounderAverageScore = selectedFounder && selectedFounder.reviews.length > 0
    ? (selectedFounder.reviews.reduce((sum, review) => sum + review.score, 0) / selectedFounder.reviews.length).toFixed(1)
    : '—'

  return (
    <div className="relative min-h-screen bg-[#1a2634] text-white font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-center px-4 sm:px-6 py-4 backdrop-blur-md border-b border-white/5 bg-[#1a2634]/80">
        <div className="flex w-full max-w-7xl items-center justify-between">
          <Link href="/" className="group flex min-w-0 items-center">
            <MesgaHorizontalLogo
              size="header"
              className="transition-opacity group-hover:opacity-85"
            />
          </Link>
          <div className="flex items-center gap-3 sm:gap-6">
            <div className="hidden sm:flex flex-col items-end">
              <span className="max-w-[240px] truncate text-sm font-medium text-white/80">{user.email}</span>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-[#ffcc00]" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#ffcc00]">
                  {mentorType === 'partner' ? 'Partner Mentor' : 'Admin Mentor'}
                </span>
              </div>
            </div>
            <Link
              href="/"
              className="hidden md:inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-white/80 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white active:scale-95"
            >
              Dashboard
            </Link>
            <form action="/logout" method="POST">
              <button
                type="submit"
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-white transition-all hover:border-white/20 hover:bg-white/10 active:scale-95 sm:px-5 sm:text-sm"
              >
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page header */}
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#ffcc00]">
              {mentorType === 'partner' ? 'Partner Mentor' : 'Admin Mentor'}
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Mentor Dashboard</h1>
            <p className="mt-1 text-sm text-white/50">
              {mentorType === 'partner' && partnerName ? partnerName : 'All Partners'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-8">
          <div className="rounded-2xl border border-white/10 bg-[#203e5f] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">Pending</p>
            <p className="mt-2 text-3xl font-bold text-white">{visiblePendingSubmissions.length}</p>
          </div>
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.05] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300/60">Gate Reviews</p>
            <p className="mt-2 text-3xl font-bold text-amber-300">{pendingGateCount}</p>
          </div>
          <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300/55">Reviewed</p>
            <p className="mt-2 text-3xl font-bold text-emerald-300">
              {reviewedSubmissions.length + optimisticReviewedSubmissionIds.size}
            </p>
          </div>
          <div className="rounded-2xl border border-[#ffcc00]/15 bg-[#ffcc00]/[0.04] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#ffcc00]/60">My Reviews</p>
            <p className="mt-2 text-3xl font-bold text-[#ffcc00]">{recentReviews.length}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-[#203e5f] p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">Founder Workbench</p>
                  <p className="mt-1 text-sm text-white/55">{filteredFounders.length} founders in scope</p>
                </div>
              </div>
              <input
                type="text"
                placeholder="Search founders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#172433] px-4 py-2.5 text-sm text-white placeholder-white/25 outline-none transition-colors focus:border-[#ffcc00]/50"
              />
            </div>

            <div className="max-h-[680px] space-y-3 overflow-y-auto pr-1">
              {filteredFounders.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-[#203e5f] p-6 text-sm text-white/30">
                  No founders match this search.
                </div>
              ) : (
                filteredFounders.map((founder) => {
                  const founderPending = pendingByFounderId.get(founder.id) ?? []
                  const isSelected = selectedFounder?.id === founder.id
                  const averageScore = founder.reviews.length > 0
                    ? (founder.reviews.reduce((sum, review) => sum + review.score, 0) / founder.reviews.length).toFixed(1)
                    : '—'

                  return (
                    <button
                      key={founder.id}
                      type="button"
                      onClick={() => {
                        setSelectedFounderId(founder.id)
                        setSelectedDay(founderPending[0]?.programDay ?? founder.currentDay ?? null)
                      }}
                      className={`w-full rounded-2xl border p-4 text-left transition-all ${
                        isSelected
                          ? 'border-[#ffcc00]/45 bg-[#ffcc00]/[0.08] shadow-[0_0_30px_-22px_#ffcc00]'
                          : 'border-white/10 bg-[#203e5f] hover:border-white/20 hover:bg-[#274a70]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">{founder.email}</p>
                          <p className="mt-1 text-xs text-white/35">
                            Day {founder.currentDay || '—'} · {founder.completedDays.length} completed
                          </p>
                        </div>
                        {founderPending.length > 0 && (
                          <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-300">
                            {founderPending.length}
                          </span>
                        )}
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-lg bg-white/[0.03] px-2 py-1.5">
                          <p className="text-[9px] uppercase tracking-wider text-white/25">Reviews</p>
                          <p className="text-xs font-semibold text-white/70">{founder.reviews.length}</p>
                        </div>
                        <div className="rounded-lg bg-white/[0.03] px-2 py-1.5">
                          <p className="text-[9px] uppercase tracking-wider text-white/25">Missed</p>
                          <p className="text-xs font-semibold text-white/70">{founder.missedDays.length}</p>
                        </div>
                        <div className="rounded-lg bg-white/[0.03] px-2 py-1.5">
                          <p className="text-[9px] uppercase tracking-wider text-white/25">Avg</p>
                          <p className="text-xs font-semibold text-white/70">{averageScore}</p>
                        </div>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </aside>

          <main className="min-w-0 space-y-4">
            {selectedFounder ? (
              <>
                <div className="rounded-2xl border border-white/10 bg-[#203e5f] p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#ffcc00]/70">
                        Selected founder
                      </p>
                      <h2 className="mt-1 truncate text-xl font-bold text-white">{selectedFounder.email}</h2>
                      <p className="mt-1 text-sm text-white/40">
                        Day {selectedFounder.currentDay || '—'} · {selectedFounder.completedDays.length} completed · Avg score {selectedFounderAverageScore}
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[300px]">
                      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wider text-white/30">Needs review</p>
                        <p className="text-lg font-bold text-white">{selectedFounderPendingSubmissions.length}</p>
                      </div>
                      <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.05] px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wider text-amber-300/55">Gates</p>
                        <p className="text-lg font-bold text-amber-300">
                          {selectedFounderPendingSubmissions.filter((sub) => sub.dayType === 'gate').length}
                        </p>
                      </div>
                      <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wider text-emerald-300/55">Reviews</p>
                        <p className="text-lg font-bold text-emerald-300">{selectedFounder.reviews.length}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {selectedFounderPendingSubmissions.length > 0 && (
                  <div className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.04] p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300/65">Needs review</p>
                      <p className="text-xs text-white/35">Oldest submissions first</p>
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      {selectedFounderPendingSubmissions.slice(0, 6).map((sub) => (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => setSelectedDay(sub.programDay)}
                          className="rounded-xl border border-white/10 bg-[#172433] p-3 text-left transition-colors hover:border-amber-500/30 hover:bg-amber-500/[0.06]"
                        >
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-white">Day {sub.programDay}</span>
                              <DayTypeBadge type={sub.dayType} />
                            </div>
                            <span className="text-[10px] text-white/30">{formatDate(sub.submittedAt)}</span>
                          </div>
                          <p className="line-clamp-1 text-xs text-white/45">{sub.formTitle || sub.theme || 'Submitted mission'}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {selectedFounderRecentReviews.length > 0 && (
                  <div className="rounded-2xl border border-white/10 bg-[#203e5f] p-4">
                    <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">Recent mentor activity</p>
                    <div className="grid gap-2 md:grid-cols-3">
                      {selectedFounderRecentReviews.map((review) => (
                        <div key={review.id} className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-white/70">Day {review.dayNumber}</span>
                            <span className="text-xs text-white/45">{review.score}/5</span>
                          </div>
                          <p className="line-clamp-2 text-xs text-white/45">{review.comment || 'Review submitted'}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <FounderProgressPanel
                  founderEmail={selectedFounder.email}
                  allowReview={true}
                  selectedDay={selectedDay}
                  onSelectedDayChange={setSelectedDay}
                  onReviewCreated={(submissionId) => handleReviewCreated(submissionId)}
                  timeline={{
                    currentDay: selectedFounder.currentDay,
                    completedDays: selectedFounder.completedDays,
                    missedDays: selectedFounder.missedDays,
                    submissions: selectedFounder.submissions,
                    reviews: selectedFounder.reviews,
                  }}
                />
              </>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-[#203e5f] p-12 text-center text-white/30">
                Select a founder to inspect their progress.
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
