'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CURRICULUM_DEFAULT_RELEASE_KEY,
  GENERAL_DIMENSION_VALUE,
  normalizeArchetypeKey,
  normalizeVariantTrackLabel,
  normalizeVerticalLabel,
} from '@/lib/curriculum/constants'
import {
  buildFounderFormLookup,
  buildWorkbookStats,
  filterToActiveRelease,
  getDerivedProgramKind,
  getDerivedProgramLabel,
  mapFounderFormSummary,
  normalizeDayProgramConfig,
  resolveDefinitionQuestions,
  type AdminDayProgramConfig,
  type AdminFounderForm,
  type ResolvedQuestionSource,
} from '@/lib/dayDefinitionAdmin'

type QuestionItem = {
  questionId: string
  questionTitle: string
  questionType: string
  required: boolean
  description: string
  choices: string
  logic: string
}

type EduLink = {
  label: string
  url: string
  type: string
}

type DayDef = {
  id: number | string
  definitionKey: string
  definitionKind: 'base' | 'override'
  releaseKey: string
  title: string
  blockType: string
  blockKey: string
  dayNumber: number | null
  order: number | null
  vertical: string
  track: string
  personality: string
  hasVerticalVariants: boolean
  hasPersonalityVariants: boolean
  hasTrackVariants: boolean
  sourceSheet: string
  sourceRowNumber: number | null
  qaSourceSheet: string
  qaSourceRowNumber: number | null
  overrideFields: Record<string, unknown> | null
  section: string
  weekNumber: number | null
  theme: string
  founderCommandment: string
  blockFocus: string
  mainSoetMission: string
  activity: string
  deliverable: string
  whereHowTips: string
  autoCheckCriteria: string
  mesgaIntegration: string
  estimatedTimeHrs: number | null
  qaTimeBreakdown: string
  coachingNote: string
  eduType: string
  eduDescription: string
  contentType: string
  contentOwner: string
  eduLinks: EduLink[]
  questions: QuestionItem[]
  isGateDay: boolean
  gateDayNumber: number | null
  gateRequiredArtifacts: string
  gateRubric: string
  gateThreshold: string
  linkedForm: number | null
}

type FormOption = AdminFounderForm
type ViewInfo = { mode: 'list' | 'edit' | 'create'; id: string | null }
type PaginatedApiResponse<T> = {
  docs?: T[]
  hasNextPage?: boolean
  nextPage?: number | null
  totalPages?: number
}

const RESOLVED_EDITABLE_FIELDS: Array<keyof DayDef> = [
  'title',
  'theme',
  'founderCommandment',
  'blockFocus',
  'mainSoetMission',
  'activity',
  'deliverable',
  'whereHowTips',
  'autoCheckCriteria',
  'mesgaIntegration',
  'estimatedTimeHrs',
  'eduType',
  'eduDescription',
  'contentType',
  'contentOwner',
  'eduLinks',
  'weekNumber',
  'dayNumber',
  'questions',
  'coachingNote',
  'qaTimeBreakdown',
  'linkedForm',
  'order',
  'section',
  'isGateDay',
  'gateDayNumber',
  'gateRequiredArtifacts',
  'gateRubric',
  'gateThreshold',
]

const BLOCK_TYPES = [
  { label: 'Day Block', value: 'day', color: '#3b82f6' },
  { label: 'Prework', value: 'prework', color: '#8b5cf6' },
  { label: 'Gate', value: 'gate', color: '#ef4444' },
  { label: 'Weekly Retro', value: 'weekly', color: '#f59e0b' },
  { label: 'Welcome', value: 'welcome', color: '#6b7280' },
  { label: 'Team Identity', value: 'team', color: '#6b7280' },
  { label: 'Daily Log', value: 'daily_log', color: '#6b7280' },
  { label: 'End', value: 'end', color: '#6b7280' },
]

const QUESTION_TYPES = [
  { label: 'Statement', value: 'statement' },
  { label: 'Short Text', value: 'short_text' },
  { label: 'Long Text', value: 'long_text' },
  { label: 'Email', value: 'email' },
  { label: 'Website URL', value: 'website_url' },
  { label: 'Number', value: 'number' },
  { label: 'Yes / No', value: 'yes_no' },
  { label: 'Multiple Choice', value: 'multiple_choice' },
  { label: 'Dropdown', value: 'dropdown' },
  { label: 'Opinion Scale', value: 'opinion_scale' },
  { label: 'File Upload', value: 'file_upload' },
]

const QUESTION_TYPES_WITH_CHOICES = new Set(['multiple_choice', 'dropdown'])

const PHASES = [
  { name: 'MIX', startDay: 1, endDay: 21, color: '#3b82f6' },
  { name: 'PROOF', startDay: 22, endDay: 49, color: '#8b5cf6' },
  { name: 'BAKE', startDay: 50, endDay: 77, color: '#f59e0b' },
  { name: 'GLAZE', startDay: 78, endDay: 100, color: '#10b981' },
]

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  background: 'var(--theme-input-bg)',
  border: '1px solid var(--theme-border-color)',
  borderRadius: 4,
  fontSize: 13,
  color: 'var(--theme-text)',
  outline: 'none',
  boxSizing: 'border-box',
}

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: 84,
  resize: 'vertical',
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--theme-elevation-550)',
  display: 'block',
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
}

const panelStyle: React.CSSProperties = {
  border: '1px solid var(--theme-border-color)',
  borderRadius: 8,
  background: 'var(--theme-elevation-0)',
  padding: 16,
}

const btn = (variant: 'default' | 'primary' | 'success' | 'danger' = 'default'): React.CSSProperties => {
  const variants: Record<string, React.CSSProperties> = {
    default: {
      background: 'var(--theme-elevation-100)',
      color: 'var(--theme-text)',
      border: '1px solid var(--theme-border-color)',
    },
    primary: {
      background: '#2563eb',
      color: '#fff',
      border: '1px solid #2563eb',
    },
    success: {
      background: 'var(--theme-success-500)',
      color: '#fff',
      border: '1px solid var(--theme-success-500)',
    },
    danger: {
      background: 'var(--theme-error-100)',
      color: 'var(--theme-error-500)',
      border: '1px solid var(--theme-error-300)',
    },
  }

  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '7px 14px',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
    textDecoration: 'none',
    ...variants[variant],
  }
}

function getViewInfo(): ViewInfo {
  if (typeof window === 'undefined') return { mode: 'list', id: null }

  const parts = window.location.pathname.split('/').filter(Boolean)
  const idx = parts.lastIndexOf('day-definitions')
  const next = idx === -1 ? null : parts[idx + 1] ?? null

  if (!next) return { mode: 'list', id: null }
  if (next === 'create') return { mode: 'create', id: null }
  return { mode: 'edit', id: next }
}

async function fetchAllCollectionDocs<T>(
  path: string,
  params: Record<string, string>,
): Promise<T[]> {
  const docs: T[] = []
  let page = 1

  while (true) {
    const searchParams = new URLSearchParams({
      ...params,
      page: String(page),
    })

    const res = await fetch(`${path}?${searchParams.toString()}`)
    if (!res.ok) {
      throw new Error(`Failed to load ${path} (${res.status})`)
    }

    const data = await res.json() as PaginatedApiResponse<T>
    docs.push(...(Array.isArray(data.docs) ? data.docs : []))

    if (!data.hasNextPage) break
    page = typeof data.nextPage === 'number' ? data.nextPage : page + 1
  }

  return docs
}

function getBlockColor(blockType: string): string {
  return BLOCK_TYPES.find((b) => b.value === blockType)?.color || '#6b7280'
}

function getBlockLabel(blockType: string): string {
  return BLOCK_TYPES.find((b) => b.value === blockType)?.label || blockType
}

function getQuestionTypeLabel(questionType: string): string {
  return QUESTION_TYPES.find((t) => t.value === questionType)?.label || questionType
}

function getQuestionSourceLabel(source: ResolvedQuestionSource): string {
  if (source === 'linked_form') return 'Linked Form'
  if (source === 'linked_form_missing') return 'Linked Form Missing'
  if (source === 'legacy') return 'Legacy Questions'
  return 'No Submission Questions'
}

function getQuestionSourceChip(source: ResolvedQuestionSource): { bg: string; text: string } {
  if (source === 'linked_form') return { bg: '#10b98115', text: '#10b981' }
  if (source === 'linked_form_missing') return { bg: '#ef444415', text: '#ef4444' }
  if (source === 'legacy') return { bg: '#f59e0b15', text: '#f59e0b' }
  return { bg: 'var(--theme-elevation-100)', text: 'var(--theme-elevation-600)' }
}

function getPhaseForDay(day: number | null) {
  if (!day) return null
  return PHASES.find((phase) => day >= phase.startDay && day <= phase.endDay) || null
}

function mapApiDayDef(d: any): DayDef {
  return {
    id: d.id,
    definitionKey: d.definitionKey || '',
    definitionKind: d.definitionKind || 'base',
    releaseKey: d.releaseKey || CURRICULUM_DEFAULT_RELEASE_KEY,
    title: d.title || '',
    blockType: d.blockType || 'day',
    blockKey: d.blockKey || '',
    dayNumber: d.dayNumber ?? null,
    order: d.order ?? null,
    vertical: d.vertical || 'General',
    track: d.track || 'General',
    personality: d.personality || 'General',
    hasVerticalVariants: Boolean(d.hasVerticalVariants),
    hasPersonalityVariants: Boolean(d.hasPersonalityVariants),
    hasTrackVariants: Boolean(d.hasTrackVariants),
    sourceSheet: d.sourceSheet || '',
    sourceRowNumber: d.sourceRowNumber ?? null,
    qaSourceSheet: d.qaSourceSheet || '',
    qaSourceRowNumber: d.qaSourceRowNumber ?? null,
    overrideFields: d.overrideFields || null,
    section: d.section || '',
    weekNumber: d.weekNumber ?? null,
    theme: d.theme || '',
    founderCommandment: d.founderCommandment || '',
    blockFocus: d.blockFocus || '',
    mainSoetMission: d.mainSoetMission || '',
    activity: d.activity || '',
    deliverable: d.deliverable || '',
    whereHowTips: d.whereHowTips || '',
    autoCheckCriteria: d.autoCheckCriteria || '',
    mesgaIntegration: d.mesgaIntegration || '',
    estimatedTimeHrs: d.estimatedTimeHrs ?? null,
    qaTimeBreakdown: d.qaTimeBreakdown || '',
    coachingNote: d.coachingNote || '',
    eduType: d.eduType || '',
    eduDescription: d.eduDescription || '',
    contentType: d.contentType || '',
    contentOwner: d.contentOwner || '',
    eduLinks: Array.isArray(d.eduLinks)
      ? d.eduLinks.map((link: any) => ({
          label: link?.label || '',
          url: link?.url || '',
          type: link?.type || '',
        }))
      : [],
    questions: Array.isArray(d.questions)
      ? d.questions.map((q: any) => ({
          questionId: q.questionId || '',
          questionTitle: q.questionTitle || '',
          questionType: q.questionType || 'short_text',
          required: Boolean(q.required),
          description: q.description || '',
          choices: q.choices || '',
          logic: q.logic || '',
        }))
      : [],
    isGateDay: Boolean(d.isGateDay),
    gateDayNumber: d.gateDayNumber ?? null,
    gateRequiredArtifacts: d.gateRequiredArtifacts || '',
    gateRubric: d.gateRubric || '',
    gateThreshold: d.gateThreshold || '',
    linkedForm: typeof d.linkedForm === 'object' ? d.linkedForm?.id ?? null : d.linkedForm ?? null,
  }
}

function sanitizeLinks(links: EduLink[]): EduLink[] {
  return links
    .map((link) => ({
      label: link.label.trim(),
      url: link.url.trim(),
      type: link.type.trim(),
    }))
    .filter((link) => link.label || link.url || link.type)
}

function sanitizeQuestions(questions: QuestionItem[]): QuestionItem[] {
  return questions.map((question) => ({
    questionId: question.questionId.trim(),
    questionTitle: question.questionTitle.trim(),
    questionType: question.questionType,
    required: Boolean(question.required),
    description: question.description.trim(),
    choices: question.choices.trim(),
    logic: question.logic.trim(),
  }))
}

function editableSnapshot(def: DayDef): string {
  return JSON.stringify({
    activity: def.activity,
    theme: def.theme,
    weekNumber: def.weekNumber,
    founderCommandment: def.founderCommandment,
    blockFocus: def.blockFocus,
    deliverable: def.deliverable,
    whereHowTips: def.whereHowTips,
    coachingNote: def.coachingNote,
    autoCheckCriteria: def.autoCheckCriteria,
    mesgaIntegration: def.mesgaIntegration,
    estimatedTimeHrs: def.estimatedTimeHrs,
    eduType: def.eduType,
    contentType: def.contentType,
    eduLinks: sanitizeLinks(def.eduLinks),
    questions: sanitizeQuestions(def.questions),
    linkedForm: def.linkedForm,
    gateDayNumber: def.gateDayNumber,
    gateRequiredArtifacts: def.gateRequiredArtifacts,
    gateRubric: def.gateRubric,
    gateThreshold: def.gateThreshold,
  })
}

function buildPatchPayload(def: DayDef) {
  const isGateLike = Boolean(def.isGateDay || def.blockType === 'gate')

  return {
    title: def.activity.trim() || def.title.trim() || def.blockKey || `Day ${def.dayNumber ?? ''}`.trim(),
    activity: def.activity.trim(),
    theme: def.theme.trim(),
    weekNumber: def.weekNumber,
    founderCommandment: def.founderCommandment.trim(),
    blockFocus: def.blockFocus.trim(),
    deliverable: def.deliverable.trim(),
    whereHowTips: def.whereHowTips.trim(),
    coachingNote: def.coachingNote.trim(),
    autoCheckCriteria: def.autoCheckCriteria.trim(),
    mesgaIntegration: def.mesgaIntegration.trim(),
    estimatedTimeHrs: def.estimatedTimeHrs,
    eduType: def.eduType.trim(),
    contentType: def.contentType.trim(),
    eduLinks: sanitizeLinks(def.eduLinks),
    questions: sanitizeQuestions(def.questions),
    linkedForm: def.linkedForm || null,
    isGateDay: isGateLike,
    gateDayNumber: isGateLike ? def.gateDayNumber ?? def.dayNumber ?? null : null,
    gateRequiredArtifacts: isGateLike ? def.gateRequiredArtifacts.trim() : '',
    gateRubric: isGateLike ? def.gateRubric.trim() : '',
    gateThreshold: isGateLike ? def.gateThreshold.trim() : '',
  }
}

function getQuestionPrefix(def: DayDef): string {
  if (def.blockType === 'prework') return `PW${String(def.dayNumber || '').padStart(2, '0')}`
  if (def.blockType === 'gate') return `G${def.dayNumber || def.gateDayNumber || ''}`
  if (def.blockType === 'weekly') return `W${def.weekNumber || def.dayNumber || ''}`
  return `DP${def.dayNumber || ''}`
}

function getDisplayTitle(def: DayDef): string {
  return def.activity || def.title || def.blockKey || `Definition ${def.id}`
}

function isGeneralValue(value: string | null | undefined): boolean {
  return !value || value.trim() === '' || value.trim().toLowerCase() === 'general'
}

function normalizeDimension(field: 'vertical' | 'personality' | 'track', value: string | null | undefined): string {
  if (field === 'vertical') return normalizeVerticalLabel(value)
  if (field === 'personality') return normalizeArchetypeKey(value)
  return normalizeVariantTrackLabel(value)
}

function matchesDimension(field: 'vertical' | 'personality' | 'track', docValue: string | null | undefined, targetValue: string): boolean {
  const normalizedDocValue = normalizeDimension(field, docValue)
  return normalizedDocValue === GENERAL_DIMENSION_VALUE || normalizedDocValue === targetValue
}

function scoreSpecificity(definition: DayDef): number {
  let score = 0
  if (normalizeVerticalLabel(definition.vertical) !== GENERAL_DIMENSION_VALUE) score += 100
  if (normalizeArchetypeKey(definition.personality) !== GENERAL_DIMENSION_VALUE) score += 10
  if (normalizeVariantTrackLabel(definition.track) !== GENERAL_DIMENSION_VALUE) score += 1
  return score
}

function mergeDefinitionForDisplay(current: DayDef, pool: DayDef[]): DayDef {
  if (current.definitionKind !== 'override') return current

  const targetVertical = normalizeVerticalLabel(current.vertical)
  const targetPersonality = normalizeArchetypeKey(current.personality)
  const targetTrack = normalizeVariantTrackLabel(current.track)

  const matching = pool.filter((definition) => (
    definition.releaseKey === current.releaseKey &&
    definition.blockKey === current.blockKey &&
    matchesDimension('vertical', definition.vertical, targetVertical) &&
    matchesDimension('personality', definition.personality, targetPersonality) &&
    matchesDimension('track', definition.track, targetTrack)
  ))

  const base = matching.find((definition) => definition.definitionKind !== 'override')
  if (!base) return current

  const resolved: DayDef = {
    ...base,
    id: current.id,
    definitionKey: current.definitionKey,
    definitionKind: current.definitionKind,
    vertical: current.vertical,
    personality: current.personality,
    track: current.track,
    sourceSheet: current.sourceSheet,
    sourceRowNumber: current.sourceRowNumber,
    qaSourceSheet: current.qaSourceSheet,
    qaSourceRowNumber: current.qaSourceRowNumber,
    overrideFields: current.overrideFields,
  }

  const applicableOverrides = matching
    .filter((definition) => definition.definitionKind === 'override')
    .sort((left, right) => scoreSpecificity(left) - scoreSpecificity(right))

  for (const override of applicableOverrides) {
    for (const field of RESOLVED_EDITABLE_FIELDS) {
      const value = override[field]
      if (value === undefined || value === null) continue
      if (typeof value === 'string' && value === '') continue
      resolved[field] = value as never
    }
  }

  return resolved
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b))
}

function StatusBanner({
  type,
  children,
}: {
  type: 'success' | 'error' | 'info'
  children: React.ReactNode
}) {
  const colors: Record<string, { bg: string; border: string; text: string }> = {
    success: { bg: '#10b98115', border: '#10b98140', text: '#10b981' },
    error: { bg: '#ef444415', border: '#ef444440', text: '#ef4444' },
    info: { bg: 'var(--theme-elevation-50)', border: 'var(--theme-border-color)', text: 'var(--theme-text)' },
  }

  return (
    <div
      style={{
        padding: '10px 14px',
        borderRadius: 8,
        marginBottom: 16,
        background: colors[type].bg,
        border: `1px solid ${colors[type].border}`,
        color: colors[type].text,
        fontSize: 13,
      }}
    >
      {children}
    </div>
  )
}

function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: React.ReactNode
  hint?: string
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
      {hint && (
        <div style={{ marginTop: 4, fontSize: 11, color: 'var(--theme-elevation-450)' }}>
          {hint}
        </div>
      )}
    </div>
  )
}

function ReadOnlyChip({ children, color = 'var(--theme-elevation-100)', textColor = 'var(--theme-text)' }: { children: React.ReactNode; color?: string; textColor?: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 8px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        background: color,
        color: textColor,
      }}
    >
      {children}
    </span>
  )
}

function SmallButton({
  children,
  onClick,
  disabled = false,
  variant = 'default',
  title,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  variant?: 'default' | 'danger' | 'success'
  title?: string
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...btn(variant === 'success' ? 'success' : 'default'),
        ...(variant === 'danger'
          ? { background: 'var(--theme-error-100)', color: 'var(--theme-error-500)', border: '1px solid var(--theme-error-300)' }
          : {}),
        padding: '5px 10px',
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {children}
    </button>
  )
}

function QuestionEditor({
  question,
  index,
  total,
  onChange,
  onRemove,
  onMove,
}: {
  question: QuestionItem
  index: number
  total: number
  onChange: (next: QuestionItem) => void
  onRemove: () => void
  onMove: (dir: -1 | 1) => void
}) {
  const setField = (key: keyof QuestionItem, value: string | boolean) => {
    onChange({ ...question, [key]: value })
  }

  const showChoices = QUESTION_TYPES_WITH_CHOICES.has(question.questionType)

  return (
    <div style={{ ...panelStyle, padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 13, color: 'var(--theme-text)' }}>
          {question.questionTitle || `Question ${index + 1}`}
        </strong>
        <ReadOnlyChip color={`${getBlockColor('day')}15`} textColor={getBlockColor('day')}>
          {getQuestionTypeLabel(question.questionType)}
        </ReadOnlyChip>
        {question.required && (
          <ReadOnlyChip color="var(--theme-error-100)" textColor="var(--theme-error-500)">
            Required
          </ReadOnlyChip>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <SmallButton onClick={() => onMove(-1)} disabled={index === 0} title="Move up">▲</SmallButton>
          <SmallButton onClick={() => onMove(1)} disabled={index === total - 1} title="Move down">▼</SmallButton>
          <SmallButton onClick={onRemove} variant="danger" title="Delete question">✕</SmallButton>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 220px) 1fr', gap: 12, marginBottom: 12 }}>
        <Field label="Question ID">
          <input
            style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12 }}
            value={question.questionId}
            onChange={(e) => setField('questionId', e.target.value)}
          />
        </Field>
        <Field label="Question Title">
          <input
            style={inputStyle}
            value={question.questionTitle}
            onChange={(e) => setField('questionTitle', e.target.value)}
          />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: showChoices ? '1fr minmax(180px, 220px) 100px' : '1fr 100px', gap: 12, marginBottom: 12 }}>
        <Field label="Input Type">
          <select
            style={inputStyle}
            value={question.questionType}
            onChange={(e) => setField('questionType', e.target.value)}
          >
            {QUESTION_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </Field>
        {showChoices && (
          <Field label="Choices" hint="Pipe-separated values, e.g. Go|Flip|Kill">
            <input
              style={inputStyle}
              value={question.choices}
              onChange={(e) => setField('choices', e.target.value)}
            />
          </Field>
        )}
        <Field label="Required">
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 34 }}>
            <input
              type="checkbox"
              checked={question.required}
              onChange={(e) => setField('required', e.target.checked)}
            />
            <span style={{ fontSize: 12, color: 'var(--theme-text)' }}>Yes</span>
          </label>
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Helper Text">
          <textarea
            style={{ ...textareaStyle, minHeight: 72 }}
            value={question.description}
            onChange={(e) => setField('description', e.target.value)}
          />
        </Field>
        <Field label="Visibility Rule" hint="Keep blank unless the question should be conditionally shown.">
          <input
            style={inputStyle}
            value={question.logic}
            onChange={(e) => setField('logic', e.target.value)}
          />
        </Field>
      </div>
    </div>
  )
}

function EduLinkEditor({
  link,
  index,
  onChange,
  onRemove,
}: {
  link: EduLink
  index: number
  onChange: (next: EduLink) => void
  onRemove: () => void
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(160px, 220px) 1fr 140px auto',
        gap: 10,
        alignItems: 'end',
      }}
    >
      <Field label={index === 0 ? 'Label' : `Label ${index + 1}`}>
        <input
          style={inputStyle}
          value={link.label}
          onChange={(e) => onChange({ ...link, label: e.target.value })}
        />
      </Field>
      <Field label="URL">
        <input
          style={inputStyle}
          value={link.url}
          onChange={(e) => onChange({ ...link, url: e.target.value })}
        />
      </Field>
      <Field label="Type">
        <select
          style={inputStyle}
          value={link.type}
          onChange={(e) => onChange({ ...link, type: e.target.value })}
        >
          <option value="">Select</option>
          <option value="video">Video</option>
          <option value="article">Article</option>
          <option value="deck">Deck</option>
          <option value="audio">Audio</option>
          <option value="template">Template</option>
          <option value="tool">Tool</option>
          <option value="other">Other</option>
        </select>
      </Field>
      <button type="button" onClick={onRemove} style={{ ...btn('danger'), padding: '7px 10px', whiteSpace: 'nowrap' }}>
        Remove
      </button>
    </div>
  )
}

function DayDefinitionRecordEditor({ id }: { id: string }) {
  const [definition, setDefinition] = useState<DayDef | null>(null)
  const [forms, setForms] = useState<FormOption[]>([])
  const [programConfig, setProgramConfig] = useState<AdminDayProgramConfig>(() => normalizeDayProgramConfig(null))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const initialRef = useRef<string>('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [definitionRes, formsRes, dayProgramRes] = await Promise.all([
        fetch(`/api/day-definitions/${id}?depth=0`),
        fetch('/api/founder-forms?limit=500&sort=title&depth=0'),
        fetch('/api/globals/day-program?depth=0'),
      ])

      if (!definitionRes.ok) {
        throw new Error(`Failed to load day definition (${definitionRes.status})`)
      }
      if (!formsRes.ok) {
        throw new Error(`Failed to load founder forms (${formsRes.status})`)
      }
      if (!dayProgramRes.ok) {
        throw new Error(`Failed to load day program (${dayProgramRes.status})`)
      }

      const definitionData = await definitionRes.json()
      const formsData = await formsRes.json()
      const dayProgramData = await dayProgramRes.json()
      const raw = mapApiDayDef(definitionData)
      let mapped = raw

      if (raw.blockKey) {
        const peersRes = await fetch(`/api/day-definitions?where[blockKey][equals]=${encodeURIComponent(raw.blockKey)}&limit=200&depth=0`)
        if (peersRes.ok) {
          const peersData = await peersRes.json()
          const peers = (peersData.docs || []).map(mapApiDayDef)
          mapped = mergeDefinitionForDisplay(raw, peers)
        }
      }

      setDefinition(mapped)
      setForms((formsData.docs || []).map(mapFounderFormSummary))
      setProgramConfig(normalizeDayProgramConfig(dayProgramData))
      initialRef.current = editableSnapshot(mapped)
      setDirty(false)
    } catch (err: any) {
      setError(err.message || 'Failed to load day definition')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!definition || !initialRef.current) return
    setDirty(editableSnapshot(definition) !== initialRef.current)
  }, [definition])

  const setField = <K extends keyof DayDef>(key: K, value: DayDef[K]) => {
    setDefinition((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  const handleQuestionChange = (index: number, next: QuestionItem) => {
    if (!definition) return
    const questions = [...definition.questions]
    questions[index] = next
    setField('questions', questions)
  }

  const handleQuestionMove = (index: number, dir: -1 | 1) => {
    if (!definition) return
    const target = index + dir
    if (target < 0 || target >= definition.questions.length) return
    const questions = [...definition.questions]
    ;[questions[index], questions[target]] = [questions[target], questions[index]]
    setField('questions', questions)
  }

  const addQuestion = () => {
    if (!definition) return
    const prefix = getQuestionPrefix(definition)
    const nextNumber = String(definition.questions.length + 1).padStart(3, '0')
    const nextQuestion: QuestionItem = {
      questionId: `${prefix}-${nextNumber}`,
      questionTitle: '',
      questionType: 'short_text',
      required: false,
      description: '',
      choices: '',
      logic: '',
    }
    setField('questions', [...definition.questions, nextQuestion])
  }

  const handleSave = async () => {
    if (!definition) return

    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/day-definitions/${definition.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPatchPayload(definition)),
      })

      if (!res.ok) {
        throw new Error(await res.text())
      }

      const updated = mapApiDayDef(await res.json())
      setDefinition(updated)
      initialRef.current = editableSnapshot(updated)
      setDirty(false)
      setSavedAt(new Date().toLocaleTimeString())
    } catch (err: any) {
      setError(err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleRebuildLinkedForm = async () => {
    if (!definition) return

    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/rebuild-linked-form-from-day-definition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dayDefinitionId: definition.id }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || 'Failed to generate form')
      }

      await load()
      setSavedAt(new Date().toLocaleTimeString())
    } catch (err: any) {
      setError(err.message || 'Failed to rebuild linked form')
    } finally {
      setSaving(false)
    }
  }

  const handleGenerateLegacyForm = async () => {
    if (!definition) return

    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/generate-form-from-day-definition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dayDefinitionId: definition.id }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || 'Failed to generate legacy form')
      }

      await load()
      setSavedAt(new Date().toLocaleTimeString())
    } catch (err: any) {
      setError(err.message || 'Failed to generate legacy form')
    } finally {
      setSaving(false)
    }
  }

  const formLookup = useMemo(() => buildFounderFormLookup(forms), [forms])
  const linkedForm = useMemo(
    () => forms.find((form) => String(form.id) === String(definition?.linkedForm ?? '')) || null,
    [forms, definition?.linkedForm],
  )
  const questionResolution = useMemo(
    () => (definition ? resolveDefinitionQuestions(definition, formLookup) : { source: 'none' as const, questions: [], linkedForm: null }),
    [definition, formLookup],
  )
  const derivedProgramKind = getDerivedProgramKind(definition?.dayNumber ?? null, programConfig)
  const derivedProgramLabel = getDerivedProgramLabel(derivedProgramKind)

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 320, color: 'var(--theme-elevation-500)' }}>
        Loading day definition…
      </div>
    )
  }

  if (!definition) {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 var(--base) calc(var(--base) * 2)' }}>
        <StatusBanner type="error">Day definition not found.</StatusBanner>
      </div>
    )
  }

  const blockColor = getBlockColor(definition.blockType)
  const phase = getPhaseForDay(definition.dayNumber)

  return (
    <div style={{ maxWidth: 920, margin: '0 auto', padding: '0 var(--base) calc(var(--base) * 2)' }}>
      <style>{`.dd-btn:hover:not(:disabled){filter:brightness(.95)}`}</style>

      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '12px 0',
          marginBottom: 12,
          background: 'var(--theme-bg)',
          borderBottom: '1px solid var(--theme-border-color)',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <a
            href="/admin/collections/day-definitions"
            style={{ color: 'var(--theme-elevation-650)', textDecoration: 'none', fontSize: 13 }}
          >
            ← Day Definitions
          </a>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--theme-text)' }}>
              Day Definition Editor
            </h2>
            <ReadOnlyChip color={`${blockColor}18`} textColor={blockColor}>
              {getBlockLabel(definition.blockType)}
            </ReadOnlyChip>
            {definition.dayNumber != null && (
              <ReadOnlyChip color="var(--theme-elevation-100)">
                Day {definition.dayNumber}
              </ReadOnlyChip>
            )}
            {definition.weekNumber != null && (
              <ReadOnlyChip color="var(--theme-elevation-100)">
                Week {definition.weekNumber}
              </ReadOnlyChip>
            )}
            {phase && (
              <ReadOnlyChip color={`${phase.color}18`} textColor={phase.color}>
                {phase.name}
              </ReadOnlyChip>
            )}
            {derivedProgramLabel && (
              <ReadOnlyChip
                color={derivedProgramKind === 'gate' ? '#ef444415' : '#f59e0b15'}
                textColor={derivedProgramKind === 'gate' ? '#ef4444' : '#f59e0b'}
              >
                {derivedProgramLabel}
              </ReadOnlyChip>
            )}
            <ReadOnlyChip
              color={getQuestionSourceChip(questionResolution.source).bg}
              textColor={getQuestionSourceChip(questionResolution.source).text}
            >
              {getQuestionSourceLabel(questionResolution.source)}
            </ReadOnlyChip>
            {dirty && (
              <ReadOnlyChip color="var(--theme-warning-100)" textColor="var(--theme-warning-600)">
                Unsaved changes
              </ReadOnlyChip>
            )}
            {savedAt && !dirty && (
              <span style={{ fontSize: 11, color: 'var(--theme-success-600)', fontWeight: 500 }}>
                Saved at {savedAt}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="dd-btn"
            onClick={handleSave}
            disabled={saving || !dirty}
            style={{
              ...btn('success'),
              opacity: saving || !dirty ? 0.6 : 1,
              cursor: saving || !dirty ? 'default' : 'pointer',
            }}
          >
            {saving ? 'Saving…' : dirty ? 'Save Changes' : 'Saved'}
          </button>
        </div>
      </div>

      {error && <StatusBanner type="error">{error}</StatusBanner>}

      <div style={{ ...panelStyle, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 420px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--theme-elevation-450)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
              Founder-Facing Header
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 2fr) repeat(3, minmax(120px, 1fr))', gap: 12 }}>
              <Field label="Mission Title" hint="Main heading founders see on the dashboard and generated forms.">
                <input
                  style={{ ...inputStyle, fontSize: 15, fontWeight: 600 }}
                  value={definition.activity}
                  onChange={(e) => setField('activity', e.target.value)}
                />
              </Field>
              <Field label="Week">
                <input
                  style={inputStyle}
                  type="number"
                  min="0"
                  value={definition.weekNumber ?? ''}
                  onChange={(e) => setField('weekNumber', e.target.value ? Number(e.target.value) : null)}
                />
              </Field>
              <Field label="Theme">
                <input
                  style={inputStyle}
                  value={definition.theme}
                  onChange={(e) => setField('theme', e.target.value)}
                />
              </Field>
              <Field label="Est. Hours">
                <input
                  style={inputStyle}
                  type="number"
                  min="0"
                  step="0.5"
                  value={definition.estimatedTimeHrs ?? ''}
                  onChange={(e) => setField('estimatedTimeHrs', e.target.value ? Number(e.target.value) : null)}
                />
              </Field>
            </div>
          </div>

          <div style={{ flex: '0 1 240px', minWidth: 220 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--theme-elevation-450)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
              Context
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--theme-elevation-500)' }}>
                <strong style={{ color: 'var(--theme-text)' }}>Block key:</strong> {definition.blockKey || '—'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--theme-elevation-500)' }}>
                <strong style={{ color: 'var(--theme-text)' }}>Release:</strong> {definition.releaseKey || '—'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--theme-elevation-500)' }}>
                <strong style={{ color: 'var(--theme-text)' }}>Source:</strong>{' '}
                {definition.sourceSheet ? `${definition.sourceSheet}${definition.sourceRowNumber ? ` · row ${definition.sourceRowNumber}` : ''}` : '—'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--theme-elevation-500)' }}>
                <strong style={{ color: 'var(--theme-text)' }}>Variant:</strong> {definition.definitionKind}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ ...panelStyle, marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--theme-elevation-450)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
          Content Blocks
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          <Field label="Commandment">
            <input
              style={inputStyle}
              value={definition.founderCommandment}
              onChange={(e) => setField('founderCommandment', e.target.value)}
            />
          </Field>
          {definition.blockType === 'prework' && (
            <Field label="Focus">
              <input
                style={inputStyle}
                value={definition.blockFocus}
                onChange={(e) => setField('blockFocus', e.target.value)}
              />
            </Field>
          )}
          <Field label="Deliverable">
            <textarea
              style={textareaStyle}
              value={definition.deliverable}
              onChange={(e) => setField('deliverable', e.target.value)}
            />
          </Field>
          <Field label="Tips">
            <textarea
              style={textareaStyle}
              value={definition.whereHowTips}
              onChange={(e) => setField('whereHowTips', e.target.value)}
            />
          </Field>
          <Field label="Coaching Lens">
            <textarea
              style={textareaStyle}
              value={definition.coachingNote}
              onChange={(e) => setField('coachingNote', e.target.value)}
            />
          </Field>
          <Field label="Criteria">
            <textarea
              style={textareaStyle}
              value={definition.autoCheckCriteria}
              onChange={(e) => setField('autoCheckCriteria', e.target.value)}
            />
          </Field>
          <Field label="MESGA Tool">
            <input
              style={inputStyle}
              value={definition.mesgaIntegration}
              onChange={(e) => setField('mesgaIntegration', e.target.value)}
            />
          </Field>
        </div>
      </div>

      <div style={{ ...panelStyle, marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--theme-elevation-450)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
          Learn Section
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <Field label="Content Type" hint="Shown in the founder UI next to learn resources.">
            <input
              style={inputStyle}
              value={definition.eduType}
              onChange={(e) => setField('eduType', e.target.value)}
            />
          </Field>
          <Field label="Ownership / Source">
            <input
              style={inputStyle}
              value={definition.contentType}
              onChange={(e) => setField('contentType', e.target.value)}
            />
          </Field>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {definition.eduLinks.length === 0 ? (
            <div
              style={{
                padding: '18px 16px',
                borderRadius: 8,
                border: '1px dashed var(--theme-border-color)',
                color: 'var(--theme-elevation-450)',
                fontSize: 13,
                textAlign: 'center',
              }}
            >
              No founder-facing resources yet.
            </div>
          ) : (
            definition.eduLinks.map((link, index) => (
              <EduLinkEditor
                key={`${index}-${link.label}-${link.url}`}
                link={link}
                index={index}
                onChange={(next) => {
                  const links = [...definition.eduLinks]
                  links[index] = next
                  setField('eduLinks', links)
                }}
                onRemove={() => setField('eduLinks', definition.eduLinks.filter((_, i) => i !== index))}
              />
            ))
          )}
          <div>
            <button
              type="button"
              onClick={() => setField('eduLinks', [...definition.eduLinks, { label: '', url: '', type: '' }])}
              style={btn('default')}
            >
              + Add Resource Link
            </button>
          </div>
        </div>
      </div>

      {definition.blockType === 'gate' && (
        <div style={{ ...panelStyle, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--theme-elevation-450)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
            Gate Settings
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <Field label="Gate Day Number">
              <input
                style={inputStyle}
                type="number"
                value={definition.gateDayNumber ?? ''}
                onChange={(e) => setField('gateDayNumber', e.target.value ? Number(e.target.value) : null)}
              />
            </Field>
            <Field label="Pass Threshold">
              <input
                style={inputStyle}
                value={definition.gateThreshold}
                onChange={(e) => setField('gateThreshold', e.target.value)}
              />
            </Field>
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            <Field label="Required Artifacts">
              <textarea
                style={{ ...textareaStyle, minHeight: 72 }}
                value={definition.gateRequiredArtifacts}
                onChange={(e) => setField('gateRequiredArtifacts', e.target.value)}
              />
            </Field>
            <Field label="Rubric">
              <textarea
                style={{ ...textareaStyle, minHeight: 72 }}
                value={definition.gateRubric}
                onChange={(e) => setField('gateRubric', e.target.value)}
              />
            </Field>
          </div>
        </div>
      )}

      <div style={{ ...panelStyle, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--theme-elevation-450)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
              Submission Setup
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <ReadOnlyChip
                color={getQuestionSourceChip(questionResolution.source).bg}
                textColor={getQuestionSourceChip(questionResolution.source).text}
              >
                {getQuestionSourceLabel(questionResolution.source)}
              </ReadOnlyChip>
              <ReadOnlyChip color="var(--theme-elevation-100)">
                {questionResolution.questions.length} question{questionResolution.questions.length !== 1 ? 's' : ''}
              </ReadOnlyChip>
            </div>
            <div style={{ fontSize: 12, color: 'var(--theme-elevation-500)', lineHeight: 1.5, maxWidth: 640 }}>
              {questionResolution.source === 'linked_form' && linkedForm
                ? `Imported curriculum resolves submission questions from the linked FounderForm "${linkedForm.title}". Search, counters, and founder submissions all use this form first.`
                : questionResolution.source === 'linked_form_missing'
                  ? 'This record points to a linked FounderForm that is no longer available in the current list response. Rebuild or relink it before relying on submission counts.'
                  : questionResolution.source === 'legacy'
                    ? 'No linked form is selected, so this record falls back to the embedded legacy questions below. This mode is kept only for manual/backward-compatible definitions.'
                    : 'No linked FounderForm and no embedded legacy questions are configured yet.'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleRebuildLinkedForm}
              disabled={saving || definition.definitionKind === 'override'}
              style={{
                ...btn('primary'),
                opacity: saving || definition.definitionKind === 'override' ? 0.6 : 1,
                cursor: saving || definition.definitionKind === 'override' ? 'default' : 'pointer',
              }}
            >
              Rebuild Linked Form from Curriculum
            </button>
            {linkedForm && (
              <a
                href={`/admin/collections/founder-forms/${linkedForm.id}`}
                style={{ ...btn('default'), whiteSpace: 'nowrap' }}
              >
                Open Linked Form
              </a>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: linkedForm ? '1fr auto' : '1fr', gap: 12, alignItems: 'end' }}>
          <Field
            label="Linked Founder Form"
            hint="Imported workbook records should point at a canonical FounderForm here. Remove the link only for legacy/manual fallback records."
          >
            <select
              style={inputStyle}
              value={definition.linkedForm ?? ''}
              onChange={(e) => setField('linkedForm', e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">No linked form (legacy fallback only)</option>
              {forms.map((form) => (
                <option key={form.id} value={form.id}>
                  {form.title} ({form.slug})
                </option>
              ))}
            </select>
          </Field>
          {linkedForm && (
            <div style={{ fontSize: 12, color: 'var(--theme-elevation-500)' }}>
              <strong style={{ color: 'var(--theme-text)' }}>Slug:</strong> {linkedForm.slug}
            </div>
          )}
        </div>
        {definition.definitionKind === 'override' && (
          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--theme-elevation-500)' }}>
            Override records inherit the submission setup from their base workbook block. Rebuild is disabled here to avoid writing canonical forms from a merged override view.
          </div>
        )}
      </div>

      <div style={{ ...panelStyle, marginBottom: 16 }}>
        <details open={questionResolution.source === 'legacy' || (!definition.linkedForm && definition.questions.length > 0)}>
          <summary style={{ cursor: 'pointer', listStyle: 'none' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--theme-elevation-450)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Legacy Question Fallback
              </div>
              <div style={{ marginTop: 4, fontSize: 12, color: 'var(--theme-elevation-500)' }}>
                Use this only for hand-authored or backward-compatible records. Imported curriculum should rebuild and link a FounderForm instead.
              </div>
            </div>
          </summary>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={addQuestion} style={btn('default')}>
                + Add Legacy Question
              </button>
              <button
                type="button"
                onClick={handleGenerateLegacyForm}
                disabled={saving || definition.questions.length === 0 || definition.definitionKind === 'override'}
                style={{
                  ...btn('default'),
                  opacity: saving || definition.questions.length === 0 || definition.definitionKind === 'override' ? 0.6 : 1,
                  cursor: saving || definition.questions.length === 0 || definition.definitionKind === 'override' ? 'default' : 'pointer',
                }}
              >
                Generate Form from Legacy Questions
              </button>
            </div>
            {definition.questions.length === 0 ? (
              <div
                style={{
                  padding: '22px 16px',
                  borderRadius: 8,
                  border: '1px dashed var(--theme-border-color)',
                  color: 'var(--theme-elevation-450)',
                  fontSize: 13,
                  textAlign: 'center',
                }}
              >
                No embedded legacy questions yet. Leave this empty for linked-form-driven workbook records.
              </div>
            ) : (
              definition.questions.map((question, index) => (
                <QuestionEditor
                  key={`${question.questionId}-${index}`}
                  question={question}
                  index={index}
                  total={definition.questions.length}
                  onChange={(next) => handleQuestionChange(index, next)}
                  onRemove={() => setField('questions', definition.questions.filter((_, i) => i !== index))}
                  onMove={(dir) => handleQuestionMove(index, dir)}
                />
              ))
            )}
          </div>
        </details>
      </div>

      <div style={{ ...panelStyle }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--theme-elevation-450)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
          System Info
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--theme-elevation-500)' }}>
            <strong style={{ color: 'var(--theme-text)' }}>Definition key:</strong> {definition.definitionKey || '—'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--theme-elevation-500)' }}>
            <strong style={{ color: 'var(--theme-text)' }}>Section:</strong> {definition.section || '—'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--theme-elevation-500)' }}>
            <strong style={{ color: 'var(--theme-text)' }}>Vertical:</strong> {definition.vertical || '—'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--theme-elevation-500)' }}>
            <strong style={{ color: 'var(--theme-text)' }}>Personality:</strong> {definition.personality || '—'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--theme-elevation-500)' }}>
            <strong style={{ color: 'var(--theme-text)' }}>Track:</strong> {definition.track || '—'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--theme-elevation-500)' }}>
            <strong style={{ color: 'var(--theme-text)' }}>Override fields:</strong>{' '}
            {definition.overrideFields && Object.keys(definition.overrideFields).length > 0 ? 'Present' : 'None'}
          </div>
        </div>
      </div>
    </div>
  )
}

function DayDefinitionListView() {
  const [definitions, setDefinitions] = useState<DayDef[]>([])
  const [forms, setForms] = useState<FormOption[]>([])
  const [programConfig, setProgramConfig] = useState<AdminDayProgramConfig>(() => normalizeDayProgramConfig(null))
  const [loading, setLoading] = useState(true)
  const [programFilter, setProgramFilter] = useState<'all' | 'standard' | 'gate' | 'weekly'>('all')
  const [kindFilter, setKindFilter] = useState<'all' | 'base' | 'override'>('all')
  const [verticalFilter, setVerticalFilter] = useState<string>('all')
  const [personalityFilter, setPersonalityFilter] = useState<string>('all')
  const [trackFilter, setTrackFilter] = useState<string>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [activeReleaseKey, setActiveReleaseKey] = useState(CURRICULUM_DEFAULT_RELEASE_KEY)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [importStatus, setImportStatus] = useState<string | null>(null)
  const uploadRef = useRef<HTMLInputElement>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [dayProgramRes, forms] = await Promise.all([
        fetch('/api/globals/day-program?depth=0'),
        fetchAllCollectionDocs<any>('/api/founder-forms', {
          limit: '200',
          sort: 'title',
          depth: '0',
        }),
      ])

      if (!dayProgramRes.ok) throw new Error(`Failed to load day program (${dayProgramRes.status})`)

      const dayProgramData = await dayProgramRes.json()
      const nextProgramConfig = normalizeDayProgramConfig(dayProgramData)
      const definitionsQuery: Record<string, string> = {
        limit: '200',
        sort: 'order',
        depth: '0',
      }

      if (nextProgramConfig.activeCurriculumReleaseKey) {
        definitionsQuery['where[releaseKey][equals]'] = nextProgramConfig.activeCurriculumReleaseKey
      }

      const definitionDocs = await fetchAllCollectionDocs<any>('/api/day-definitions', definitionsQuery)

      const allDefinitions: DayDef[] = definitionDocs.map(mapApiDayDef)
      const releaseScopedDefinitions = filterToActiveRelease<DayDef>(allDefinitions, nextProgramConfig.activeCurriculumReleaseKey)

      setActiveReleaseKey(nextProgramConfig.activeCurriculumReleaseKey || CURRICULUM_DEFAULT_RELEASE_KEY)
      setProgramConfig(nextProgramConfig)
      setForms(forms.map(mapFounderFormSummary))
      setDefinitions(releaseScopedDefinitions)
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to load day definitions', type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const formLookup = useMemo(() => buildFounderFormLookup(forms), [forms])
  const visibleDefinitions = useMemo(
    () => definitions.map((definition) => mergeDefinitionForDisplay(definition, definitions)),
    [definitions],
  )

  const handleCurriculumSync = async (scope: 'snapshots' | 'general' | 'all') => {
    const label = scope === 'snapshots'
      ? 'Refreshing workbook snapshots…'
      : scope === 'general'
        ? 'Syncing GENERAL + GENERAL TEST…'
        : 'Syncing workbook + overrides…'

    setImportStatus(label)
    try {
      const res = await fetch('/api/curriculum-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, refreshSnapshot: scope === 'snapshots', writeMarkdown: true, activateRelease: true }),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || 'Curriculum sync failed')
      }

      setImportStatus(data.message || 'Sync complete')
      setMessage({ text: data.message || 'Curriculum sync complete', type: 'success' })
      fetchData()
    } catch (err: any) {
      setImportStatus(`Error: ${err.message}`)
      setMessage({ text: err.message || 'Curriculum sync failed', type: 'error' })
    }
  }

  const handleGenerateAll = async () => {
    setImportStatus('Generating all forms and assigning to schedule…')
    try {
      const res = await fetch('/api/generate-all-day-forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignToSchedule: true }),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || 'Failed to generate all forms')
      }

      setImportStatus(data.message || 'Generated all forms')
      setMessage({ text: data.message || 'Generated all forms', type: 'success' })
      fetchData()
    } catch (err: any) {
      setImportStatus(`Error: ${err.message}`)
      setMessage({ text: err.message || 'Failed to generate all forms', type: 'error' })
    }
  }

  const handleUploadExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImportStatus('Uploading and syncing curriculum…')

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/curriculum-sync', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || 'Upload failed')
      }

      setImportStatus(data.message || 'Upload complete')
      setMessage({ text: data.message || 'Curriculum updated', type: 'success' })
      fetchData()
    } catch (err: any) {
      setImportStatus(`Error: ${err.message}`)
      setMessage({ text: err.message || 'Upload failed', type: 'error' })
    }

    e.target.value = ''
  }

  const stats = useMemo(() => {
    return buildWorkbookStats(definitions, programConfig)
  }, [definitions, programConfig])

  const filterOptions = useMemo(() => {
    return {
      verticals: uniqueSorted(visibleDefinitions.map((definition) => definition.vertical)),
      personalities: uniqueSorted(visibleDefinitions.map((definition) => definition.personality)),
      tracks: uniqueSorted(visibleDefinitions.map((definition) => definition.track)),
      sources: uniqueSorted(visibleDefinitions.map((definition) => definition.sourceSheet)),
    }
  }, [visibleDefinitions])

  const hasActiveAdvancedFilters =
    programFilter !== 'all' ||
    kindFilter !== 'all' ||
    verticalFilter !== 'all' ||
    personalityFilter !== 'all' ||
    trackFilter !== 'all' ||
    sourceFilter !== 'all'

  const filtered = useMemo(() => {
    return visibleDefinitions.filter((definition) => {
      const derivedProgramKind = getDerivedProgramKind(definition.dayNumber, programConfig)

      if (programFilter !== 'all' && derivedProgramKind !== programFilter) return false
      if (kindFilter !== 'all' && definition.definitionKind !== kindFilter) return false
      if (verticalFilter !== 'all' && definition.vertical !== verticalFilter) return false
      if (personalityFilter !== 'all' && definition.personality !== personalityFilter) return false
      if (trackFilter !== 'all' && definition.track !== trackFilter) return false
      if (sourceFilter !== 'all' && definition.sourceSheet !== sourceFilter) return false
      if (!search.trim()) return true

      const query = search.trim().toLowerCase()
      const questionResolution = resolveDefinitionQuestions(definition, formLookup)
      return (
        getDisplayTitle(definition).toLowerCase().includes(query) ||
        definition.theme.toLowerCase().includes(query) ||
        definition.blockKey.toLowerCase().includes(query) ||
        definition.definitionKind.toLowerCase().includes(query) ||
        getBlockLabel(definition.blockType).toLowerCase().includes(query) ||
        (getDerivedProgramLabel(derivedProgramKind) || '').toLowerCase().includes(query) ||
        definition.vertical.toLowerCase().includes(query) ||
        definition.personality.toLowerCase().includes(query) ||
        definition.track.toLowerCase().includes(query) ||
        definition.sourceSheet.toLowerCase().includes(query) ||
        definition.deliverable.toLowerCase().includes(query) ||
        questionResolution.questions.some((question) =>
          question.questionTitle.toLowerCase().includes(query) ||
          question.questionId.toLowerCase().includes(query) ||
          question.description.toLowerCase().includes(query),
        ) ||
        (questionResolution.linkedForm?.title || '').toLowerCase().includes(query) ||
        (questionResolution.linkedForm?.slug || '').toLowerCase().includes(query) ||
        (definition.dayNumber != null && String(definition.dayNumber) === query)
      )
    })
  }, [visibleDefinitions, programConfig, programFilter, kindFilter, verticalFilter, personalityFilter, trackFilter, sourceFilter, search, formLookup])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 320, color: 'var(--theme-elevation-500)' }}>
        Loading day definitions…
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 var(--base) calc(var(--base) * 2)' }}>
      <input
        ref={uploadRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleUploadExcel}
        style={{ display: 'none' }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--theme-text)' }}>
            Day Definitions
          </h2>
          <div style={{ marginTop: 4, fontSize: 13, color: 'var(--theme-elevation-500)', maxWidth: 720, lineHeight: 1.5 }}>
            Workbook-centric view of the active curriculum release. Imported day blocks stay as `blockType="day"`; gate and weekly semantics are derived from Day Program config and shown as labels, not separate imported records.
          </div>
          <div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <ReadOnlyChip color="var(--theme-elevation-100)">
              Active release: {activeReleaseKey}
            </ReadOnlyChip>
            <ReadOnlyChip color="#10b98115" textColor="#10b981">
              {stats.baseDays} imported days
            </ReadOnlyChip>
            <ReadOnlyChip color="#f59e0b15" textColor="#f59e0b">
              {stats.overrides} overrides
            </ReadOnlyChip>
            <ReadOnlyChip color="#10b98115" textColor="#10b981">
              {stats.baseDaysWithLinkedForms} linked forms
            </ReadOnlyChip>
            <ReadOnlyChip color="#ef444415" textColor="#ef4444">
              {stats.gateDays} gate-labelled days
            </ReadOnlyChip>
            <ReadOnlyChip color="#f59e0b15" textColor="#f59e0b">
              {stats.weeklyRetroDays} weekly retro days
            </ReadOnlyChip>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => uploadRef.current?.click()} style={btn('default')}>
            Upload Excel
          </button>
          <button type="button" onClick={() => handleCurriculumSync('snapshots')} style={btn('default')}>
            Refresh Snapshots
          </button>
          <button type="button" onClick={() => handleCurriculumSync('general')} style={btn('default')}>
            Sync GENERAL
          </button>
          <button type="button" onClick={() => handleCurriculumSync('all')} style={btn('default')}>
            Sync All Variants
          </button>
          <button type="button" onClick={handleGenerateAll} style={btn('success')}>
            Generate All Forms + Schedule
          </button>
        </div>
      </div>

      {message && <StatusBanner type={message.type}>{message.text}</StatusBanner>}
      {importStatus && <StatusBanner type="info">{importStatus}</StatusBanner>}

      <div style={{ ...panelStyle, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
          {[
            { label: 'Imported Days', count: stats.baseDays, value: 'all', color: 'var(--theme-text)' },
            { label: 'Standard Days', count: stats.standardDays, value: 'standard', color: '#3b82f6' },
            { label: 'Gate Days', count: stats.gateDays, value: 'gate', color: '#ef4444' },
            { label: 'Weekly Retro', count: stats.weeklyRetroDays, value: 'weekly', color: '#f59e0b' },
          ].map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setProgramFilter(item.value as 'all' | 'standard' | 'gate' | 'weekly')}
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                border: programFilter === item.value ? `1px solid ${item.color}` : '1px solid var(--theme-border-color)',
                background: programFilter === item.value ? `${item.color}15` : 'var(--theme-elevation-0)',
                color: programFilter === item.value ? item.color : 'var(--theme-text)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{item.label}</div>
              <div style={{ marginTop: 4, fontSize: 18, fontWeight: 700 }}>{item.count}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ ...panelStyle, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            style={{ ...inputStyle, width: 320, maxWidth: '100%' }}
            placeholder="Search title, theme, day, source, linked-form question…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span style={{ fontSize: 12, color: 'var(--theme-elevation-500)' }}>
            Showing {filtered.length} of {visibleDefinitions.length}
          </span>
        </div>
      </div>

      <div style={{ ...panelStyle, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--theme-elevation-450)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Variant Filters
          </div>
          <button
            type="button"
            onClick={() => {
              setProgramFilter('all')
              setKindFilter('all')
              setVerticalFilter('all')
              setPersonalityFilter('all')
              setTrackFilter('all')
              setSourceFilter('all')
            }}
            disabled={!hasActiveAdvancedFilters}
            style={{ ...btn('default'), opacity: hasActiveAdvancedFilters ? 1 : 0.5, cursor: hasActiveAdvancedFilters ? 'pointer' : 'default' }}
          >
            Clear Advanced Filters
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <Field label="Program Label">
            <select style={inputStyle} value={programFilter} onChange={(e) => setProgramFilter(e.target.value as 'all' | 'standard' | 'gate' | 'weekly')}>
              <option value="all">All imported days</option>
              <option value="standard">Standard days</option>
              <option value="gate">Gate-labelled days</option>
              <option value="weekly">Weekly retro days</option>
            </select>
          </Field>
          <Field label="Kind">
            <select style={inputStyle} value={kindFilter} onChange={(e) => setKindFilter(e.target.value as 'all' | 'base' | 'override')}>
              <option value="base">Base only</option>
              <option value="all">All kinds</option>
              <option value="override">Overrides only</option>
            </select>
          </Field>
          <Field label="Vertical">
            <select style={inputStyle} value={verticalFilter} onChange={(e) => setVerticalFilter(e.target.value)}>
              <option value="all">All verticals</option>
              {filterOptions.verticals.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Personality">
            <select style={inputStyle} value={personalityFilter} onChange={(e) => setPersonalityFilter(e.target.value)}>
              <option value="all">All personalities</option>
              {filterOptions.personalities.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Track">
            <select style={inputStyle} value={trackFilter} onChange={(e) => setTrackFilter(e.target.value)}>
              <option value="all">All tracks</option>
              {filterOptions.tracks.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Source Sheet">
            <select style={inputStyle} value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
              <option value="all">All sources</option>
              {filterOptions.sources.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.length === 0 ? (
          <div style={{ ...panelStyle, textAlign: 'center', color: 'var(--theme-elevation-450)' }}>
            No day definitions match the current filter.
          </div>
        ) : (
          filtered.map((definition) => {
            const blockColor = getBlockColor(definition.blockType)
            const phase = getPhaseForDay(definition.dayNumber)
            const derivedProgramKind = getDerivedProgramKind(definition.dayNumber, programConfig)
            const derivedProgramLabel = getDerivedProgramLabel(derivedProgramKind)
            const questionResolution = resolveDefinitionQuestions(definition, formLookup)
            const questionSourceChip = getQuestionSourceChip(questionResolution.source)
            const accentColor = derivedProgramKind === 'gate'
              ? '#ef4444'
              : derivedProgramKind === 'weekly'
                ? '#f59e0b'
                : blockColor

            return (
              <a
                key={definition.id}
                href={`/admin/collections/day-definitions/${definition.id}`}
                style={{
                  ...panelStyle,
                  display: 'block',
                  color: 'inherit',
                  textDecoration: 'none',
                  borderLeft: `4px solid ${accentColor}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 520px' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                      <ReadOnlyChip color={`${blockColor}15`} textColor={blockColor}>
                        {getBlockLabel(definition.blockType)}
                      </ReadOnlyChip>
                      <ReadOnlyChip
                        color={definition.definitionKind === 'override' ? '#f59e0b15' : '#10b98115'}
                        textColor={definition.definitionKind === 'override' ? '#f59e0b' : '#10b981'}
                      >
                        {definition.definitionKind === 'override' ? 'Override' : 'Base'}
                      </ReadOnlyChip>
                      {definition.dayNumber != null && (
                        <ReadOnlyChip color="var(--theme-elevation-100)">
                          Day {definition.dayNumber}
                        </ReadOnlyChip>
                      )}
                      {definition.weekNumber != null && (
                        <ReadOnlyChip color="var(--theme-elevation-100)">
                          Week {definition.weekNumber}
                        </ReadOnlyChip>
                      )}
                      {phase && (
                        <ReadOnlyChip color={`${phase.color}15`} textColor={phase.color}>
                          {phase.name}
                        </ReadOnlyChip>
                      )}
                      {derivedProgramLabel && (
                        <ReadOnlyChip
                          color={derivedProgramKind === 'gate' ? '#ef444415' : '#f59e0b15'}
                          textColor={derivedProgramKind === 'gate' ? '#ef4444' : '#f59e0b'}
                        >
                          {derivedProgramLabel}
                        </ReadOnlyChip>
                      )}
                      {!isGeneralValue(definition.vertical) && (
                        <ReadOnlyChip color="#0ea5e915" textColor="#0ea5e9">
                          Vertical: {definition.vertical}
                        </ReadOnlyChip>
                      )}
                      {!isGeneralValue(definition.personality) && (
                        <ReadOnlyChip color="#a855f715" textColor="#a855f7">
                          Personality: {definition.personality}
                        </ReadOnlyChip>
                      )}
                      {!isGeneralValue(definition.track) && (
                        <ReadOnlyChip color="#14b8a615" textColor="#14b8a6">
                          Track: {definition.track}
                        </ReadOnlyChip>
                      )}
                      <ReadOnlyChip color={questionSourceChip.bg} textColor={questionSourceChip.text}>
                        {getQuestionSourceLabel(questionResolution.source)}
                      </ReadOnlyChip>
                    </div>

                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--theme-text)' }}>
                      {getDisplayTitle(definition)}
                    </h3>

                    <div style={{ marginTop: 8, display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'var(--theme-elevation-500)' }}>
                      <span>{definition.theme || 'No theme yet'}</span>
                      <span>{questionResolution.questions.length} question{questionResolution.questions.length !== 1 ? 's' : ''}</span>
                      {questionResolution.linkedForm && (
                        <span>{questionResolution.linkedForm.slug}</span>
                      )}
                      {definition.estimatedTimeHrs != null && <span>{definition.estimatedTimeHrs}h est.</span>}
                      {isGeneralValue(definition.vertical) && isGeneralValue(definition.personality) && isGeneralValue(definition.track) && (
                        <span>General scope</span>
                      )}
                    </div>

                    {definition.deliverable && (
                      <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--theme-elevation-650)', lineHeight: 1.5 }}>
                        {definition.deliverable}
                      </p>
                    )}
                  </div>

                  <div style={{ minWidth: 220, display: 'grid', gap: 8, alignContent: 'start' }}>
                    <div style={{ fontSize: 12, color: 'var(--theme-elevation-500)' }}>
                      <strong style={{ color: 'var(--theme-text)' }}>Block key:</strong> {definition.blockKey}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--theme-elevation-500)' }}>
                      <strong style={{ color: 'var(--theme-text)' }}>Learn links:</strong> {definition.eduLinks.length}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--theme-elevation-500)' }}>
                      <strong style={{ color: 'var(--theme-text)' }}>Submission:</strong> {getQuestionSourceLabel(questionResolution.source)}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--theme-elevation-500)' }}>
                      <strong style={{ color: 'var(--theme-text)' }}>Source:</strong>{' '}
                      {definition.sourceSheet ? `${definition.sourceSheet}${definition.sourceRowNumber ? ` · row ${definition.sourceRowNumber}` : ''}` : '—'}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 12, fontWeight: 600, color: '#2563eb' }}>
                      Edit founder-facing content →
                    </div>
                  </div>
                </div>
              </a>
            )
          })
        )}
      </div>
    </div>
  )
}

function CreatePlaceholderView() {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 var(--base) calc(var(--base) * 2)' }}>
      <div style={{ ...panelStyle }}>
        <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 20, color: 'var(--theme-text)' }}>
          New Day Definition
        </h2>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--theme-elevation-600)' }}>
          This custom editor is now optimized for editing existing founder-facing curriculum content only.
          Create new definitions through the curriculum sync/import flow, then open the record here for clean editing.
        </p>
        <div style={{ marginTop: 16 }}>
          <a href="/admin/collections/day-definitions" style={btn('default')}>
            Back to Day Definitions
          </a>
        </div>
      </div>
    </div>
  )
}

export default function DayDefinitionEditor() {
  const [view, setView] = useState<ViewInfo>({ mode: 'list', id: null })

  useEffect(() => {
    setView(getViewInfo())
  }, [])

  if (view.mode === 'edit' && view.id) {
    return <DayDefinitionRecordEditor id={view.id} />
  }

  if (view.mode === 'create') {
    return <CreatePlaceholderView />
  }

  return <DayDefinitionListView />
}
