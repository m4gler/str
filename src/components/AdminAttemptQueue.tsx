'use client'

import { useState } from 'react'
import Link from 'next/link'

interface AdminAttemptQueueProps {
    failedAttempts: Array<{
        id: number
        founderEmail: string
        founderId: number
        attemptNumber: number
        missCount: number
        missedDays: number[]
        currentDay: number
        paymentType: string
        status: string
        startedAt: string
        endedAt?: string | null
        gateFailedAt?: string | null
        partnerName?: string | null
        partnerId?: number | null
        partnerDecision?: string | null
        partnerOverrideRequestedAt?: string | null
    }>
    pendingPartnerDecisions: Array<{
        id: number
        founderEmail: string
        founderId: number
        attemptNumber: number
        missCount: number
        currentDay: number
        partnerName: string
        partnerId: number
        partnerOverrideRequestedAt: string
    }>
}

const PAYMENT_BADGE_COLORS: Record<string, string> = {
    self_paid: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    paid: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    free: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
    test: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    sponsored: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    partnership: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
}

function formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

function hoursAgo(dateStr: string): number {
    return (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60)
}

function getUrgencyClass(endedAt: string | null | undefined): string {
    if (!endedAt) return ''
    const hours = hoursAgo(endedAt)
    if (hours < 24) return 'border-l-4 border-l-red-500 bg-red-500/5'
    if (hours < 72) return 'border-l-4 border-l-orange-500 bg-orange-500/5'
    return ''
}

function getWaitingClass(requestedAt: string): string {
    const hours = hoursAgo(requestedAt)
    if (hours >= 96) return 'border-l-4 border-l-red-500 bg-red-500/5'
    if (hours >= 48) return 'border-l-4 border-l-orange-500 bg-orange-500/5'
    return ''
}

function getWaitingBadge(requestedAt: string): { text: string; className: string } | null {
    const hours = hoursAgo(requestedAt)
    if (hours >= 96) return { text: `${Math.floor(hours)}h - OVERDUE`, className: 'bg-red-500/20 text-red-300 border-red-500/30' }
    if (hours >= 48) return { text: `${Math.floor(hours)}h - Reminder needed`, className: 'bg-orange-500/20 text-orange-300 border-orange-500/30' }
    return { text: `${Math.floor(hours)}h`, className: 'bg-gray-500/20 text-gray-300 border-gray-500/30' }
}

function getMaxAttempts(paymentType: string): number | string {
    if (paymentType === 'paid' || paymentType === 'self_paid') return 3
    if (paymentType === 'free' || paymentType === 'test') return 1
    return 'CUSTOM'
}

export default function AdminAttemptQueue({ failedAttempts, pendingPartnerDecisions }: AdminAttemptQueueProps) {
    const [activeTab, setActiveTab] = useState<'failed' | 'pending'>('failed')

    const gateFailCount = failedAttempts.filter(a => a.gateFailedAt).length
    const missLimitCount = failedAttempts.filter(a => !a.gateFailedAt).length

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Attempt Over Queue</h1>
                        <p className="text-gray-400 mt-1">Monitor failed attempts and pending partner decisions</p>
                    </div>
                    <Link
                        href="/admin"
                        className="text-sm text-gray-400 hover:text-white transition-colors px-4 py-2 rounded-lg border border-white/10 hover:border-white/20"
                    >
                        Back to Admin
                    </Link>
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <div className="text-2xl font-bold text-white">{failedAttempts.length}</div>
                    <div className="text-sm text-gray-400">Total Failed</div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <div className="text-2xl font-bold text-red-400">{missLimitCount}</div>
                    <div className="text-sm text-gray-400">Miss Limit (3/3)</div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <div className="text-2xl font-bold text-orange-400">{gateFailCount}</div>
                    <div className="text-sm text-gray-400">Gate Fail</div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <div className="text-2xl font-bold text-yellow-400">{pendingPartnerDecisions.length}</div>
                    <div className="text-sm text-gray-400">Awaiting Partner</div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-6 bg-white/5 rounded-lg p-1 w-fit">
                <button
                    onClick={() => setActiveTab('failed')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        activeTab === 'failed'
                            ? 'bg-white/10 text-white'
                            : 'text-gray-400 hover:text-white'
                    }`}
                >
                    Failed Attempts ({failedAttempts.length})
                </button>
                <button
                    onClick={() => setActiveTab('pending')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        activeTab === 'pending'
                            ? 'bg-white/10 text-white'
                            : 'text-gray-400 hover:text-white'
                    }`}
                >
                    Awaiting Partner Decision ({pendingPartnerDecisions.length})
                </button>
            </div>

            {/* Failed Attempts Tab */}
            {activeTab === 'failed' && (
                <div className="space-y-3">
                    {failedAttempts.length === 0 ? (
                        <div className="bg-white/5 border border-white/10 rounded-xl p-12 text-center">
                            <div className="text-gray-400">No failed attempts</div>
                        </div>
                    ) : (
                        failedAttempts.map((attempt) => (
                            <div
                                key={attempt.id}
                                className={`bg-white/5 border border-white/10 rounded-xl p-5 hover:bg-white/[0.07] transition-colors ${getUrgencyClass(attempt.endedAt)}`}
                            >
                                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                                    {/* Founder info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="text-white font-medium truncate">{attempt.founderEmail}</span>
                                            <span className="text-xs text-gray-500 shrink-0">ID: {attempt.founderId}</span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 text-sm">
                                            <span className="text-gray-300">
                                                Attempt {attempt.attemptNumber}/{getMaxAttempts(attempt.paymentType)}
                                            </span>
                                            <span className="text-gray-600">|</span>
                                            <span className="text-gray-300">
                                                Day {attempt.currentDay}/100
                                            </span>
                                            <span className="text-gray-600">|</span>
                                            <span className="text-gray-300">
                                                {attempt.missCount} miss{attempt.missCount !== 1 ? 'es' : ''}
                                            </span>
                                            {attempt.missedDays.length > 0 && (
                                                <>
                                                    <span className="text-gray-600">|</span>
                                                    <span className="text-gray-500 text-xs">
                                                        Days {attempt.missedDays.join(', ')}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Badges and meta */}
                                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                                        {/* End reason badge */}
                                        {attempt.gateFailedAt ? (
                                            <span className="px-2.5 py-1 rounded-full text-xs font-medium border bg-orange-500/20 text-orange-300 border-orange-500/30">
                                                Gate Fail
                                            </span>
                                        ) : (
                                            <span className="px-2.5 py-1 rounded-full text-xs font-medium border bg-red-500/20 text-red-300 border-red-500/30">
                                                Miss Limit
                                            </span>
                                        )}

                                        {/* Payment type badge */}
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${PAYMENT_BADGE_COLORS[attempt.paymentType] ?? PAYMENT_BADGE_COLORS.free}`}>
                                            {attempt.paymentType.replace('_', ' ')}
                                        </span>

                                        {/* Partner name */}
                                        {attempt.partnerName && (
                                            <span className="text-xs text-gray-400">
                                                via{' '}
                                                {attempt.partnerId ? (
                                                    <Link
                                                        href={`/admin/collections/partners/${attempt.partnerId}`}
                                                        className="text-blue-400 hover:text-blue-300 underline"
                                                    >
                                                        {attempt.partnerName}
                                                    </Link>
                                                ) : (
                                                    attempt.partnerName
                                                )}
                                            </span>
                                        )}

                                        {/* Date */}
                                        <span className="text-xs text-gray-500">
                                            {formatDate(attempt.endedAt)}
                                        </span>

                                        {/* View link */}
                                        <Link
                                            href={`/admin/collections/attempts/${attempt.id}`}
                                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 text-white hover:bg-white/15 transition-colors"
                                        >
                                            View
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Pending Partner Decision Tab */}
            {activeTab === 'pending' && (
                <div className="space-y-3">
                    {pendingPartnerDecisions.length === 0 ? (
                        <div className="bg-white/5 border border-white/10 rounded-xl p-12 text-center">
                            <div className="text-gray-400">No pending partner decisions</div>
                        </div>
                    ) : (
                        pendingPartnerDecisions.map((attempt) => {
                            const waitBadge = getWaitingBadge(attempt.partnerOverrideRequestedAt)
                            return (
                                <div
                                    key={attempt.id}
                                    className={`bg-white/5 border border-white/10 rounded-xl p-5 hover:bg-white/[0.07] transition-colors ${getWaitingClass(attempt.partnerOverrideRequestedAt)}`}
                                >
                                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                                        {/* Founder info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className="text-white font-medium truncate">{attempt.founderEmail}</span>
                                                <span className="text-xs text-gray-500 shrink-0">ID: {attempt.founderId}</span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2 text-sm">
                                                <span className="text-gray-300">
                                                    Attempt {attempt.attemptNumber}
                                                </span>
                                                <span className="text-gray-600">|</span>
                                                <span className="text-gray-300">
                                                    Day {attempt.currentDay}/100
                                                </span>
                                                <span className="text-gray-600">|</span>
                                                <span className="text-gray-300">
                                                    {attempt.missCount} miss{attempt.missCount !== 1 ? 'es' : ''}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Partner info and badges */}
                                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                                            {/* Waiting badge */}
                                            {waitBadge && (
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${waitBadge.className}`}>
                                                    {waitBadge.text}
                                                </span>
                                            )}

                                            {/* Partner link */}
                                            <Link
                                                href={`/admin/collections/partners/${attempt.partnerId}`}
                                                className="text-sm text-blue-400 hover:text-blue-300 underline"
                                            >
                                                {attempt.partnerName}
                                            </Link>

                                            {/* Requested date */}
                                            <span className="text-xs text-gray-500">
                                                Requested {formatDate(attempt.partnerOverrideRequestedAt)}
                                            </span>

                                            {/* View link */}
                                            <Link
                                                href={`/admin/collections/attempts/${attempt.id}`}
                                                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 text-white hover:bg-white/15 transition-colors"
                                            >
                                                View
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            )}
        </div>
    )
}
