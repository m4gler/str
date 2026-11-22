'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { saveDraft, loadDraft, deleteDraft } from '@/app/actions'

export type FormAutoSaveType =
  | 'founder_intake'
  | 'personality'
  | 'daily'
  | 'weekly'
  | 'gate'
  | 'prework'
  | 'investor'
  | 'project_submission'

interface UseFormAutoSaveOptions<T extends Record<string, unknown>> {
  formSlug: string
  formType: FormAutoSaveType
  answers: T
  enabled?: boolean
  intervalMs?: number
  onHydrate?: (draft: T) => void
}

interface UseFormAutoSaveResult {
  hydrated: boolean
  isSaving: boolean
  lastSavedAt: Date | null
  flush: () => Promise<void>
  clear: () => Promise<void>
}

function shallowEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  if (a === b) return true
  const ak = Object.keys(a)
  const bk = Object.keys(b)
  if (ak.length !== bk.length) return false
  for (const k of ak) if (a[k] !== b[k]) return false
  return true
}

function hasContent(answers: Record<string, unknown>): boolean {
  return Object.values(answers).some((v) => {
    if (v == null) return false
    if (typeof v === 'string') return v.trim().length > 0
    if (Array.isArray(v)) return v.length > 0
    if (typeof v === 'object') return Object.keys(v as object).length > 0
    return true
  })
}

export function useFormAutoSave<T extends Record<string, unknown>>({
  formSlug,
  formType,
  answers,
  enabled = true,
  intervalMs = 10_000,
  onHydrate,
}: UseFormAutoSaveOptions<T>): UseFormAutoSaveResult {
  const [hydrated, setHydrated] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)

  const answersRef = useRef(answers)
  const lastSavedSnapshotRef = useRef<Record<string, unknown> | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savingRef = useRef(false)
  const onHydrateRef = useRef(onHydrate)

  useEffect(() => {
    answersRef.current = answers
  }, [answers])

  useEffect(() => {
    onHydrateRef.current = onHydrate
  }, [onHydrate])

  useEffect(() => {
    if (!enabled || !formSlug) {
      setHydrated(true)
      return
    }
    let cancelled = false
    loadDraft(formSlug)
      .then((result) => {
        if (cancelled) return
        if (result && typeof result === 'object' && 'answers' in result) {
          const loaded = (result.answers as T) || ({} as T)
          lastSavedSnapshotRef.current = loaded
          if (result.lastSavedAt) setLastSavedAt(new Date(result.lastSavedAt))
          onHydrateRef.current?.(loaded)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setHydrated(true)
      })
    return () => {
      cancelled = true
    }
  }, [enabled, formSlug])

  const performSave = useCallback(async (): Promise<void> => {
    if (!enabled || !formSlug || savingRef.current) return
    const snapshot = answersRef.current as Record<string, unknown>
    if (!hasContent(snapshot)) return
    if (lastSavedSnapshotRef.current && shallowEqual(snapshot, lastSavedSnapshotRef.current)) return

    savingRef.current = true
    setIsSaving(true)
    try {
      const result = await saveDraft(formSlug, formType, snapshot)
      if (result && typeof result === 'object' && 'savedAt' in result) {
        lastSavedSnapshotRef.current = { ...snapshot }
        setLastSavedAt(new Date(result.savedAt))
      }
    } catch {} finally {
      savingRef.current = false
      setIsSaving(false)
    }
  }, [enabled, formSlug, formType])

  useEffect(() => {
    if (!enabled || !hydrated || !formSlug) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      void performSave()
    }, intervalMs)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [answers, enabled, hydrated, formSlug, intervalMs, performSave])

  useEffect(() => {
    if (!enabled || !hydrated) return
    const onPageHide = () => {
      void performSave()
    }
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('beforeunload', onPageHide)
    return () => {
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('beforeunload', onPageHide)
    }
  }, [enabled, hydrated, performSave])

  const flush = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    await performSave()
  }, [performSave])

  const clear = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!formSlug) return
    try {
      await deleteDraft(formSlug)
      lastSavedSnapshotRef.current = null
      setLastSavedAt(null)
    } catch {}
  }, [formSlug])

  return { hydrated, isSaving, lastSavedAt, flush, clear }
}
