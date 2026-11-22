'use client'

import React, { useState, useTransition } from 'react'
import Link from 'next/link'
import { updateInvestorProfile } from '@/app/actions'
import type { User as PayloadUser, InvestorForm } from '@/payload-types'
import SiteFooter from '@/components/SiteFooter'
import MesgaHorizontalLogo from '@/components/MesgaHorizontalLogo'
import { normalizeInvestorStoredAnswer } from '@/lib/investorForm'

interface InvestorProfileClientProps {
    user: PayloadUser
    submission: {
        id: number
        submissionData: Record<string, any>
        createdAt: string
        status?: string
    }
    formConfig: InvestorForm | null
    settings: any
}

interface QuestionMeta {
    question_id: string
    question_text: string
    question_type: string
    required?: boolean
    choices?: Array<{ label: string; value: string }> | null
    placeholder?: string | null
    helperText?: string | null
    sectionTitle: string
}

function buildQuestionMap(formConfig: InvestorForm | null): QuestionMeta[] {
    if (!formConfig?.sections) return []
    const questions: QuestionMeta[] = []
    for (const section of formConfig.sections) {
        const sectionTitle = section.title || 'Untitled Section'
        for (const q of section.questions || []) {
            questions.push({
                question_id: q.question_id,
                question_text: q.question_text,
                question_type: q.question_type,
                required: q.required ?? false,
                choices: q.choices ?? null,
                placeholder: q.placeholder ?? null,
                helperText: q.helperText ?? null,
                sectionTitle,
            })
        }
    }
    return questions
}

function groupBySection(questions: QuestionMeta[]): Record<string, QuestionMeta[]> {
    const groups: Record<string, QuestionMeta[]> = {}
    for (const q of questions) {
        if (!groups[q.sectionTitle]) {
            groups[q.sectionTitle] = []
        }
        groups[q.sectionTitle].push(q)
    }
    return groups
}

function resolveChoiceLabel(
    value: string,
    choices?: Array<{ label: string; value: string }> | null,
): string {
    if (!choices?.length) return value

    const directMatch = choices.find((choice) => choice.value === value)
    if (directMatch) return directMatch.label

    const normalizedValue = String(value || '').trim().toLowerCase()
    const looseMatch = choices.find((choice) => choice.value.trim().toLowerCase() === normalizedValue)
    return looseMatch?.label || value
}

function formatAnswer(
    questionId: string,
    value: any,
    questionType: string,
    choices?: Array<{ label: string; value: string }> | null,
): string {
    const normalizedValue = normalizeInvestorStoredAnswer(questionId, value)

    if (normalizedValue === undefined || normalizedValue === null || normalizedValue === '') return '(not answered)'

    if (questionType === 'yes_no') {
        return normalizedValue === true || normalizedValue === 'yes' || normalizedValue === 'Yes' ? 'Yes' : 'No'
    }

    if ((questionType === 'dropdown' || questionType === 'multiple_choice_single') && choices) {
        return resolveChoiceLabel(String(normalizedValue), choices)
    }

    if (questionType === 'multiple_choice_multiple' && Array.isArray(normalizedValue)) {
        if (choices) {
            return normalizedValue
                .map((item) => resolveChoiceLabel(String(item), choices))
                .join(', ')
        }
        return normalizedValue.join(', ')
    }

    return String(normalizedValue)
}

// Editable question types
const EDITABLE_TYPES = new Set([
    'short_text',
    'long_text',
    'email',
    'url',
    'number',
    'dropdown',
    'multiple_choice_single',
    'multiple_choice_multiple',
    'yes_no',
])

const LOCKED_PROFILE_FIELDS = new Set([
    'I0_CONSENT',
])

export default function InvestorProfileClient({
    user,
    submission,
    formConfig,
    settings,
}: InvestorProfileClientProps) {
    const companyName = settings?.companyName || 'MESGA'
    const accentColor = '#ffcc00'
    const questions = buildQuestionMap(formConfig)
    const sectionGroups = groupBySection(questions)

    const [editMode, setEditMode] = useState(false)
    const [editedValues, setEditedValues] = useState<Record<string, any>>({})
    const [isPending, startTransition] = useTransition()
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
    const [errorMessage, setErrorMessage] = useState('')

    const submissionData = submission.submissionData || {}
    const isLockedField = (questionId: string) => LOCKED_PROFILE_FIELDS.has(questionId)

    const getCurrentValue = (questionId: string) => {
        const currentValue = editMode && questionId in editedValues
            ? editedValues[questionId]
            : submissionData[questionId]

        return normalizeInvestorStoredAnswer(questionId, currentValue)
    }

    const handleValueChange = (questionId: string, value: any) => {
        setEditedValues((prev) => ({ ...prev, [questionId]: value }))
    }

    const handleSave = () => {
        startTransition(async () => {
            setSaveStatus('idle')
            setErrorMessage('')
            const result = await updateInvestorProfile(submission.id, editedValues)
            if (result.error) {
                setSaveStatus('error')
                setErrorMessage(result.error)
            } else {
                setSaveStatus('success')
                setEditMode(false)
                setEditedValues({})
                setTimeout(() => setSaveStatus('idle'), 3000)
            }
        })
    }

    const handleCancel = () => {
        setEditMode(false)
        setEditedValues({})
        setSaveStatus('idle')
    }

    const hasChanges = Object.keys(editedValues).length > 0

    // Fallback: if no form config, display raw key-value pairs
    const hasFormStructure = questions.length > 0

    return (
        <div className="relative min-h-screen bg-[#1a2634] text-white font-sans flex flex-col">
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

                    <div className="flex items-center gap-4">
                        <Link
                            href="/"
                            className="rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm font-medium text-white hover:bg-white/10 hover:border-white/20 transition-all active:scale-95"
                        >
                            Dashboard
                        </Link>
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

            <main className="relative z-10 max-w-4xl mx-auto w-full px-6 pt-12 pb-20 flex-1">
                {/* Page Header */}
                <div className="mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="flex flex-wrap items-center gap-3 mb-3">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accentColor }} />
                        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: accentColor }}>
                            Investor
                        </span>
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">
                        Your Investor Profile
                    </h1>
                    <p className="text-white/70 text-sm max-w-xl">
                        Review and edit the information you submitted during your intake. Changes are saved directly to your profile.
                    </p>
                    <div className="mt-2 flex items-center gap-4 text-xs text-white/55">
                        <span>
                            Submitted {new Date(submission.createdAt).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                            })}
                        </span>
                        {submission.status && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/65 text-[10px] font-bold uppercase tracking-wider">
                                {submission.status}
                            </span>
                        )}
                    </div>
                </div>

                {/* Action bar */}
                <div className="mb-8 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    {!editMode ? (
                        <button
                            onClick={() => setEditMode(true)}
                            className="rounded-full px-6 py-2.5 text-sm font-bold transition-all active:scale-95"
                            style={{ backgroundColor: accentColor, color: '#000' }}
                        >
                            Edit Profile
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={handleSave}
                                disabled={isPending || !hasChanges}
                                className="rounded-full px-6 py-2.5 text-sm font-bold transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                                style={{ backgroundColor: accentColor, color: '#000' }}
                            >
                                {isPending ? 'Saving...' : 'Save Changes'}
                            </button>
                            <button
                                onClick={handleCancel}
                                disabled={isPending}
                                className="rounded-full border border-white/10 bg-white/5 px-6 py-2.5 text-sm font-medium text-white hover:bg-white/10 transition-all active:scale-95 disabled:opacity-40"
                            >
                                Cancel
                            </button>
                        </>
                    )}
                </div>

                {/* Status messages */}
                {saveStatus === 'success' && (
                    <div className="mb-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-3 text-sm text-emerald-400 animate-in fade-in duration-300">
                        Profile updated successfully.
                    </div>
                )}
                {saveStatus === 'error' && (
                    <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-3 text-sm text-red-400 animate-in fade-in duration-300">
                        {errorMessage || 'Failed to save changes. Please try again.'}
                    </div>
                )}

                {/* Sections */}
                {hasFormStructure ? (
                    <div className="space-y-8">
                        {Object.entries(sectionGroups).map(([sectionTitle, sectionQuestions], sectionIdx) => (
                            <div
                                key={sectionTitle}
                                className="rounded-3xl border border-white/8 bg-[#203e5f]/40 backdrop-blur-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700"
                                style={{ animationDelay: `${sectionIdx * 100}ms` }}
                            >
                                <div className="px-7 py-5 border-b border-white/5">
                                    <h2 className="text-lg font-bold text-white">{sectionTitle}</h2>
                                </div>
                                <div className="divide-y divide-white/5">
                                    {sectionQuestions.map((q) => {
                                        const value = getCurrentValue(q.question_id)
                                        const isEditable = editMode
                                            && EDITABLE_TYPES.has(q.question_type)
                                            && !isLockedField(q.question_id)

                                        return (
                                            <div key={q.question_id} className="px-7 py-5">
                                                <div className="text-xs font-medium text-white/65 mb-1.5 uppercase tracking-wider">
                                                    {q.question_text}
                                                    {q.required && <span className="ml-1 text-red-400/60">*</span>}
                                                </div>
                                                {isEditable ? (
                                                    <EditableField
                                                        question={q}
                                                        value={value}
                                                        onChange={(v) => handleValueChange(q.question_id, v)}
                                                    />
                                                ) : (
                                                    <div className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
                                                        {formatAnswer(q.question_id, value, q.question_type, q.choices)}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    /* Fallback: raw data display */
                    <div className="rounded-3xl border border-white/8 bg-[#203e5f]/40 backdrop-blur-sm overflow-hidden">
                        <div className="px-7 py-5 border-b border-white/5">
                            <h2 className="text-lg font-bold text-white">Submitted Data</h2>
                        </div>
                        <div className="divide-y divide-white/5">
                            {Object.entries(submissionData).map(([key, value]) => (
                                <div key={key} className="px-7 py-5">
                                    <div className="text-xs font-medium text-white/65 mb-1.5 uppercase tracking-wider">
                                        {key.replace(/_/g, ' ')}
                                    </div>
                                    {editMode && !isLockedField(key) ? (
                                        <input
                                            type="text"
                                            value={typeof getCurrentValue(key) === 'object'
                                                ? JSON.stringify(getCurrentValue(key) ?? '')
                                                : String(getCurrentValue(key) ?? '')}
                                            onChange={(e) => handleValueChange(key, e.target.value)}
                                            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/55 focus:border-[#ffcc00]/50 focus:ring-1 focus:ring-[#ffcc00]/30 outline-none transition-colors"
                                        />
                                    ) : (
                                        <div className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
                                            {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value ?? '(not answered)')}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>

            <SiteFooter settings={settings} companyName={companyName} variant="compact" />
        </div>
    )
}

function EditableField({
    question,
    value,
    onChange,
}: {
    question: QuestionMeta
    value: any
    onChange: (v: any) => void
}) {
    const inputClasses =
        'w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/55 focus:border-[#ffcc00]/50 focus:ring-1 focus:ring-[#ffcc00]/30 outline-none transition-colors'

    switch (question.question_type) {
        case 'long_text':
            return (
                <textarea
                    value={value ?? ''}
                    onChange={(e) => onChange(e.target.value)}
                    rows={4}
                    placeholder={question.placeholder ?? undefined}
                    className={inputClasses + ' resize-y min-h-[80px]'}
                />
            )

        case 'email':
            return (
                <input
                    type="email"
                    value={value ?? ''}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={question.placeholder ?? 'email@example.com'}
                    className={inputClasses}
                />
            )

        case 'url':
            return (
                <input
                    type="url"
                    value={value ?? ''}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={question.placeholder ?? 'https://'}
                    className={inputClasses}
                />
            )

        case 'number':
            return (
                <input
                    type="number"
                    value={value ?? ''}
                    onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder={question.placeholder ?? undefined}
                    className={inputClasses}
                />
            )

        case 'dropdown':
        case 'multiple_choice_single':
            return (
                <select
                    value={value ?? ''}
                    onChange={(e) => onChange(e.target.value)}
                    className={inputClasses + ' appearance-none cursor-pointer'}
                >
                    <option value="" className="bg-[#203e5f]">-- Select --</option>
                    {(question.choices || []).map((c) => (
                        <option key={c.value} value={c.value} className="bg-[#203e5f]">
                            {c.label}
                        </option>
                    ))}
                </select>
            )

        case 'multiple_choice_multiple': {
            const selectedValues = Array.isArray(value) ? value : []

            return (
                <div className="grid gap-2 sm:grid-cols-2">
                    {(question.choices || []).map((choice) => {
                        const isSelected = selectedValues.includes(choice.value)

                        return (
                            <button
                                key={choice.value}
                                type="button"
                                onClick={() => {
                                    if (isSelected) {
                                        onChange(selectedValues.filter((item) => item !== choice.value))
                                    } else {
                                        onChange([...selectedValues, choice.value])
                                    }
                                }}
                                className={`rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                                    isSelected
                                        ? 'border-[#ffcc00]/50 bg-[#ffcc00]/15 text-white'
                                        : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                                }`}
                            >
                                {choice.label}
                            </button>
                        )
                    })}
                </div>
            )
        }

        case 'yes_no':
            return (
                <div className="flex gap-3">
                    {['yes', 'no'].map((opt) => {
                        const isSelected = (value === true && opt === 'yes') ||
                            (value === false && opt === 'no') ||
                            value === opt ||
                            value === opt.charAt(0).toUpperCase() + opt.slice(1)
                        return (
                            <button
                                key={opt}
                                type="button"
                                onClick={() => onChange(opt)}
                                className={`px-5 py-2 rounded-xl text-sm font-medium border transition-all ${
                                    isSelected
                                        ? 'border-[#ffcc00]/50 bg-[#ffcc00]/15 text-[#ffcc00]'
                                        : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
                                }`}
                            >
                                {opt.charAt(0).toUpperCase() + opt.slice(1)}
                            </button>
                        )
                    })}
                </div>
            )

        default:
            return (
                <input
                    type="text"
                    value={value ?? ''}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={question.placeholder ?? undefined}
                    className={inputClasses}
                />
            )
    }
}
