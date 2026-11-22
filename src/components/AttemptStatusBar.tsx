'use client'

import { useMemo } from 'react'

interface AttemptStatusBarProps {
  attemptNumber: number
  maxAttempts: number
  missCount: number
  maxMisses?: number
  currentDay: number
  totalDays?: number
  status: 'active' | 'warned_1' | 'warned_2' | 'completed' | 'failed'
  programStatus?: string
}

const STATUS_CONFIG = {
  active: { label: 'ACTIVE', bg: 'bg-[#2CB1A1]/20', text: 'text-[#2CB1A1]', dot: 'bg-[#2CB1A1]' },
  warned_1: { label: 'WARNED', bg: 'bg-[#ffcc00]/20', text: 'text-[#ffcc00]', dot: 'bg-[#ffcc00]' },
  warned_2: { label: 'WARNED', bg: 'bg-[#C96A4A]/20', text: 'text-[#C96A4A]', dot: 'bg-[#C96A4A]' },
  completed: { label: 'COMPLETED', bg: 'bg-[#2CB1A1]/20', text: 'text-[#2CB1A1]', dot: 'bg-[#2CB1A1]' },
  failed: { label: 'FAILED', bg: 'bg-red-500/20', text: 'text-red-400', dot: 'bg-red-500' },
} as const

function getMissColor(missCount: number, maxMisses: number): { text: string; dot: string } {
  if (missCount >= maxMisses) return { text: 'text-red-400', dot: 'bg-red-500' }
  if (missCount === 2) return { text: 'text-[#C96A4A]', dot: 'bg-[#C96A4A]' }
  if (missCount === 1) return { text: 'text-[#ffcc00]', dot: 'bg-[#ffcc00]' }
  return { text: 'text-[#2CB1A1]', dot: 'bg-[#2CB1A1]' }
}

export default function AttemptStatusBar({
  attemptNumber,
  maxAttempts,
  missCount,
  maxMisses = 3,
  currentDay,
  totalDays = 100,
  status,
}: AttemptStatusBarProps) {
  const statusConfig = STATUS_CONFIG[status]
  const missColor = useMemo(() => getMissColor(missCount, maxMisses), [missCount, maxMisses])

  const missIndicators = useMemo(() => {
    return Array.from({ length: maxMisses }, (_, i) => {
      const filled = i < missCount
      if (filled) {
        const color =
          missCount >= maxMisses
            ? 'bg-red-500'
            : missCount === 2
              ? 'bg-[#C96A4A]'
              : 'bg-[#ffcc00]'
        return (
          <span
            key={i}
            className={`inline-block h-1.5 w-1.5 rounded-full ${color}`}
          />
        )
      }
      return (
        <span
          key={i}
          className="inline-block h-1.5 w-1.5 rounded-full bg-white/20"
        />
      )
    })
  }, [missCount, maxMisses])

  const progressPercent = Math.min((currentDay / totalDays) * 100, 100)

  return (
    <div className="sticky top-0 z-40 w-full border-b border-white/5 bg-[#172433]/90 backdrop-blur-md">
      <div className="mx-auto flex h-8 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Left: status badge */}
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 ${statusConfig.bg}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${statusConfig.dot} ${status === 'active' ? 'animate-pulse' : ''}`} />
            <span className={`text-[10px] font-bold uppercase tracking-wider ${statusConfig.text}`}>
              {statusConfig.label}
            </span>
          </span>
        </div>

        {/* Center: metrics */}
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-white/50 sm:gap-4">
          {/* Attempt */}
          <span className="hidden xs:inline sm:inline">
            <span className="text-white/70">Attempt</span>{' '}
            <span className="text-white/90">{attemptNumber}</span>
            <span className="text-white/30">/{maxAttempts}</span>
          </span>

          <span className="hidden text-white/15 sm:inline">&middot;</span>

          {/* Misses */}
          <span className="flex items-center gap-1.5">
            <span className="text-white/70">Misses</span>
            <span className={missColor.text}>{missCount}</span>
            <span className="text-white/30">/{maxMisses}</span>
            <span className="ml-0.5 flex items-center gap-0.5">
              {missIndicators}
            </span>
          </span>

          <span className="text-white/15">&middot;</span>

          {/* Day */}
          <span>
            <span className="text-white/70">Day</span>{' '}
            <span className="text-white/90">{currentDay}</span>
            <span className="text-white/30">/{totalDays}</span>
          </span>
        </div>

        {/* Right: progress bar */}
        <div className="hidden w-24 items-center gap-2 sm:flex">
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-[#2CB1A1] transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-[10px] font-medium tabular-nums text-white/40">
            {Math.round(progressPercent)}%
          </span>
        </div>
      </div>
    </div>
  )
}
