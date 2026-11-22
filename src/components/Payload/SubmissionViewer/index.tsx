'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { resolveArchetypeDisplay } from '@/lib/personalityTest'

type Question = {
    question_id: string
    question_text: string
    question_type: string
    required?: boolean
    choices?: { label: string; value: string }[]
    helperText?: string
}

type Section = {
    title: string
    description?: string
    questions?: Question[]
}

type FormData = {
    id: number
    title: string
    sections?: Section[]
}

type Partner = {
    id: number
    name: string
}

type SubmissionData = {
    id: number
    form: number | FormData
    email?: string
    submissionData: Record<string, unknown>
    status?: string
    adminNote?: string | null
    partner?: number | Partner | null
    createdAt: string
    updatedAt: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    new: { label: 'New', color: 'var(--theme-success-500)', bg: 'var(--theme-success-100)' },
    reviewed: { label: 'Reviewed', color: 'var(--theme-warning-500)', bg: 'var(--theme-warning-100)' },
    contacted: { label: 'Contacted', color: 'var(--theme-success-700)', bg: 'var(--theme-success-200)' },
    archived: { label: 'Archived', color: 'var(--theme-elevation-650)', bg: 'var(--theme-elevation-200)' },
}

const TYPE_ICONS: Record<string, string> = {
    short_text: '✏️',
    long_text: '📝',
    email: '📧',
    url: '🔗',
    number: '🔢',
    dropdown: '📋',
    multiple_choice_single: '⭕',
    multiple_choice_multiple: '☑️',
    yes_no: '👍',
}

function formatDate(dateStr: string): string {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

function formatAnswer(value: unknown, question: Question): string {
    if (value === null || value === undefined || value === '') return '—'

    if (question.question_type === 'yes_no') {
        if (value === true || value === 'true' || value === 'yes' || value === 'Yes') return 'Yes'
        if (value === false || value === 'false' || value === 'no' || value === 'No') return 'No'
    }

    if (question.question_type === 'multiple_choice_multiple' && Array.isArray(value)) {
        return value
            .map((v) => {
                const choice = question.choices?.find((c) => c.value === v)
                return choice ? choice.label : String(v)
            })
            .join(', ')
    }

    if (
        (question.question_type === 'multiple_choice_single' || question.question_type === 'dropdown') &&
        question.choices
    ) {
        const choice = question.choices.find((c) => c.value === value)
        if (choice) return choice.label
    }

    return String(value)
}

function SubmissionViewer() {
    const [submission, setSubmission] = useState<SubmissionData | null>(null)
    const [form, setForm] = useState<FormData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [isEditing, setIsEditing] = useState(false)
    const [editedData, setEditedData] = useState<Record<string, unknown>>({})
    const [saving, setSaving] = useState(false)
    const [currentStatus, setCurrentStatus] = useState<string>('new')
    const [statusSaving, setStatusSaving] = useState(false)
    const [collectionSlug, setCollectionSlug] = useState<string>('investor-form-submissions')

    // Admin note state
    const [adminNote, setAdminNote] = useState<string>('')
    const [isEditingNote, setIsEditingNote] = useState(false)
    const [editedNote, setEditedNote] = useState<string>('')
    const [noteSaving, setNoteSaving] = useState(false)

    const getSubmissionInfo = useCallback(() => {
        const pathParts = window.location.pathname.split('/')

        let index = pathParts.indexOf('investor-form-submissions')
        if (index !== -1) {
            return { slug: 'investor-form-submissions', id: pathParts[index + 1] }
        }

        index = pathParts.indexOf('founder-form-submissions')
        if (index !== -1) {
            return { slug: 'founder-form-submissions', id: pathParts[index + 1] }
        }

        return null
    }, [])

    useEffect(() => {
        const fetchData = async () => {
            const info = getSubmissionInfo()
            if (!info || !info.id || info.id === 'create') {
                setLoading(false)
                return
            }

            setCollectionSlug(info.slug)

            try {
                // depth=1 so partner relationship is expanded
                const subRes = await fetch(`/api/${info.slug}/${info.id}?depth=1`)
                if (!subRes.ok) throw new Error('Failed to fetch submission')
                const subData: SubmissionData = await subRes.json()
                setSubmission(subData)
                setEditedData(subData.submissionData || {})
                setCurrentStatus(subData.status || 'new')
                const note = subData.adminNote || ''
                setAdminNote(note)
                setEditedNote(note)

                const formId = typeof subData.form === 'number' ? subData.form : subData.form?.id
                if (formId) {
                    const formCollection = info.slug === 'founder-form-submissions'
                        ? 'founder-forms'
                        : 'investor-forms'

                    const formRes = await fetch(`/api/${formCollection}/${formId}?depth=0`)
                    if (!formRes.ok) throw new Error('Failed to fetch form')
                    const formData: FormData = await formRes.json()
                    setForm(formData)
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unknown error')
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [getSubmissionInfo])

    const handleStatusChange = async (newStatus: string) => {
        if (!submission) return
        setStatusSaving(true)
        try {
            const res = await fetch(`/api/${collectionSlug}/${submission.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            })
            if (res.ok) {
                setCurrentStatus(newStatus)
            }
        } catch {

        } finally {
            setStatusSaving(false)
        }
    }

    const handleSaveNote = async () => {
        if (!submission) return
        setNoteSaving(true)
        try {
            const res = await fetch(`/api/${collectionSlug}/${submission.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ adminNote: editedNote }),
            })
            if (res.ok) {
                setAdminNote(editedNote)
                setIsEditingNote(false)
            } else {
                alert('Failed to save note.')
            }
        } catch {
            alert('An error occurred while saving the note.')
        } finally {
            setNoteSaving(false)
        }
    }

    const handleDataChange = (questionId: string, value: unknown) => {
        setEditedData((prev) => ({
            ...prev,
            [questionId]: value,
        }))
    }

    const handleSave = async () => {
        if (!submission) return
        setSaving(true)
        try {
            const res = await fetch(`/api/${collectionSlug}/${submission.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ submissionData: editedData }),
            })
            if (res.ok) {
                setSubmission((prev) => prev ? ({ ...prev, submissionData: editedData }) : null)
                setIsEditing(false)
            } else {
                alert('Failed to save changes.')
            }
        } catch (e) {
            alert('An error occurred while saving.')
        } finally {
            setSaving(false)
        }
    }

    const renderInput = (question: Question, value: unknown) => {
        const val = value === undefined || value === null ? '' : value

        switch (question.question_type) {
            case 'long_text':
                return (
                    <textarea
                        style={{
                            width: '100%',
                            padding: '10px 14px',
                            background: 'var(--theme-input-bg)',
                            border: '1px solid var(--theme-border-color)',
                            borderRadius: 4,
                            fontSize: 14,
                            lineHeight: 1.6,
                            color: 'var(--theme-text)',
                            minHeight: 100,
                        }}
                        value={String(val)}
                        onChange={(e) => handleDataChange(question.question_id, e.target.value)}
                    />
                )
            case 'yes_no':
                return (
                    <select
                        style={{
                            width: '100%',
                            padding: '10px 14px',
                            background: 'var(--theme-input-bg)',
                            border: '1px solid var(--theme-border-color)',
                            borderRadius: 4,
                            fontSize: 14,
                            color: 'var(--theme-text)',
                        }}
                        value={String(val)}
                        onChange={(e) => {
                            const v = e.target.value
                            handleDataChange(question.question_id, v === 'Yes' ? 'Yes' : v === 'No' ? 'No' : v)
                        }}
                    >
                        <option value="">Select...</option>
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                    </select>
                )
            case 'dropdown':
            case 'multiple_choice_single':
                return (
                    <select
                        style={{
                            width: '100%',
                            padding: '10px 14px',
                            background: 'var(--theme-input-bg)',
                            border: '1px solid var(--theme-border-color)',
                            borderRadius: 4,
                            fontSize: 14,
                            color: 'var(--theme-text)',
                        }}
                        value={String(val)}
                        onChange={(e) => handleDataChange(question.question_id, e.target.value)}
                    >
                        <option value="">Select...</option>
                        {question.choices?.map((c) => (
                            <option key={c.value} value={c.value}>
                                {c.label}
                            </option>
                        ))}
                    </select>
                )
            case 'multiple_choice_multiple':
                const selected = Array.isArray(val) ? val : []
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {question.choices?.map((c) => (
                            <label key={c.value} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--theme-text)' }}>
                                <input
                                    type="checkbox"
                                    checked={selected.includes(c.value)}
                                    onChange={(e) => {
                                        let newSelected = [...selected]
                                        if (e.target.checked) {
                                            newSelected.push(c.value)
                                        } else {
                                            newSelected = newSelected.filter((v: unknown) => v !== c.value)
                                        }
                                        handleDataChange(question.question_id, newSelected)
                                    }}
                                />
                                {c.label}
                            </label>
                        ))}
                    </div>
                )
            case 'file_upload': {
                const fileUrl = typeof val === 'string' ? val : ''
                return fileUrl ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <a
                            href={fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                color: '#ffcc00',
                                fontSize: 14,
                                textDecoration: 'underline',
                                wordBreak: 'break-all',
                            }}
                        >
                            {fileUrl.split('/').pop() || 'View uploaded file'}
                        </a>
                    </div>
                ) : (
                    <span style={{ fontSize: 14, color: 'var(--theme-text)', opacity: 0.5 }}>No file uploaded</span>
                )
            }
            default:
                return (
                    <input
                        type={itemTypeToInputType(question.question_type)}
                        style={{
                            width: '100%',
                            padding: '10px 14px',
                            background: 'var(--theme-input-bg)',
                            border: '1px solid var(--theme-border-color)',
                            borderRadius: 4,
                            fontSize: 14,
                            color: 'var(--theme-text)',
                        }}
                        value={String(val)}
                        onChange={(e) => handleDataChange(question.question_id, e.target.value)}
                    />
                )
        }
    }

    const itemTypeToInputType = (type: string) => {
        if (type === 'number') return 'number'
        if (type === 'email') return 'email'
        if (type === 'url') return 'url'
        return 'text'
    }

    if (loading) {
        return (
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 400,
                    gap: 16,
                    color: 'var(--theme-elevation-650)',
                }}
            >
                <div
                    style={{
                        width: 36,
                        height: 36,
                        border: '3px solid var(--theme-elevation-250)',
                        borderTopColor: 'var(--theme-success-500)',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                    }}
                />
                <p style={{ fontSize: 14, margin: 0 }}>Loading submission...</p>
            </div>
        )
    }

    if (error) {
        return (
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 300,
                    gap: 8,
                    color: 'var(--theme-error-500)',
                    textAlign: 'center',
                }}
            >
                <div style={{ fontSize: 48 }}>⚠️</div>
                <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Error loading submission</h3>
                <p style={{ color: 'var(--theme-elevation-500)', margin: 0 }}>{error}</p>
            </div>
        )
    }

    if (!submission) return null

    const questionMap = new Map<string, Question>()
    const sectionForQuestion = new Map<string, string>()
    if (form?.sections) {
        for (const section of form.sections) {
            if (section.questions) {
                for (const q of section.questions) {
                    questionMap.set(q.question_id, q)
                    sectionForQuestion.set(q.question_id, section.title)
                }
            }
        }
    }

    const dataToRender = isEditing ? editedData : submission.submissionData

    const submissionEntries =
        dataToRender &&
            typeof dataToRender === 'object' &&
            !Array.isArray(dataToRender)
            ? Object.entries(dataToRender as Record<string, unknown>)
            : []

    const grouped = new Map<string, { question: Question; answer: unknown }[]>()
    const ungrouped: { questionId: string; answer: unknown }[] = []

    if (isEditing && form?.sections) {
        for (const section of form.sections) {
            if (section.questions) {
                if (!grouped.has(section.title)) grouped.set(section.title, [])
                for (const q of section.questions) {
                    const answer = dataToRender[q.question_id]
                    grouped.get(section.title)!.push({ question: q, answer })
                }
            }
        }
    } else {
        if (form?.sections) {
            for (const section of form.sections) {
                if (section.questions) {
                    if (!grouped.has(section.title)) grouped.set(section.title, [])
                    for (const q of section.questions) {
                        const answer = dataToRender?.[q.question_id]
                        grouped.get(section.title)!.push({ question: q, answer })
                    }
                }
            }
        }
    }

    if (dataToRender) {
        for (const [key, val] of Object.entries(dataToRender)) {
            if (!questionMap.has(key)) {
                ungrouped.push({ questionId: key, answer: val })
            }
        }
    }

    const statusConfig = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.new

    const partnerName = submission.partner && typeof submission.partner === 'object'
        ? (submission.partner as Partner).name
        : null

    return (
        <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 var(--base) var(--base)' }}>
            <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .sv-status-btn:hover:not(:disabled) { opacity: 0.85; }
        .sv-card:hover { background: var(--theme-elevation-100) !important; }
        .sv-link:hover { text-decoration: underline; }
        .sv-edit-btn { background: var(--theme-elevation-150); border: 1px solid var(--theme-border-color); color: var(--theme-text); padding: 6px 16px; border-radius: 4px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
        .sv-edit-btn:hover { background: var(--theme-elevation-250); }
        .sv-save-btn { background: var(--theme-success-500); border: 1px solid var(--theme-success-600); color: white; padding: 6px 16px; border-radius: 4px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
        .sv-save-btn:hover { background: var(--theme-success-600); }
        .sv-cancel-btn { background: var(--theme-error-500); border: 1px solid var(--theme-error-600); color: white; padding: 6px 16px; border-radius: 4px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
        .sv-cancel-btn:hover { background: var(--theme-error-600); }
        .sv-note-edit-btn { background: transparent; border: 1px solid var(--theme-border-color); color: var(--theme-elevation-650); padding: 3px 10px; border-radius: 4px; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.15s; }
        .sv-note-edit-btn:hover { background: var(--theme-elevation-100); }
      `}</style>

            {/* Admin Note */}
            <div
                style={{
                    marginBottom: 'var(--base)',
                    padding: '14px 18px',
                    background: adminNote || isEditingNote
                        ? 'color-mix(in srgb, var(--theme-warning-500) 8%, transparent)'
                        : 'var(--theme-elevation-50)',
                    border: `1px solid ${adminNote || isEditingNote ? 'var(--theme-warning-500)' : 'var(--theme-border-color)'}`,
                    borderRadius: 6,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isEditingNote ? 10 : adminNote ? 8 : 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--theme-warning-500)' }}>
                        🗒 Admin Note
                    </span>
                    {!isEditingNote && (
                        <button
                            className="sv-note-edit-btn"
                            onClick={() => { setEditedNote(adminNote); setIsEditingNote(true) }}
                        >
                            {adminNote ? 'Edit' : '+ Add note'}
                        </button>
                    )}
                </div>

                {isEditingNote ? (
                    <>
                        <textarea
                            style={{
                                width: '100%',
                                padding: '10px 14px',
                                background: 'var(--theme-input-bg)',
                                border: '1px solid var(--theme-border-color)',
                                borderRadius: 4,
                                fontSize: 14,
                                lineHeight: 1.6,
                                color: 'var(--theme-text)',
                                minHeight: 80,
                                resize: 'vertical',
                                boxSizing: 'border-box',
                            }}
                            placeholder="Add an internal note about this submission..."
                            value={editedNote}
                            onChange={(e) => setEditedNote(e.target.value)}
                            autoFocus
                        />
                        <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
                            <button
                                className="sv-cancel-btn"
                                onClick={() => { setIsEditingNote(false); setEditedNote(adminNote) }}
                                disabled={noteSaving}
                            >
                                Cancel
                            </button>
                            <button
                                className="sv-save-btn"
                                onClick={handleSaveNote}
                                disabled={noteSaving}
                            >
                                {noteSaving ? 'Saving...' : 'Save Note'}
                            </button>
                        </div>
                    </>
                ) : adminNote ? (
                    <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--theme-text)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {adminNote}
                    </p>
                ) : (
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--theme-elevation-450)', fontStyle: 'italic' }}>
                        No note added yet.
                    </p>
                )}
            </div>

            <div
                style={{
                    marginBottom: 'var(--base)',
                    paddingBottom: 'var(--base)',
                    borderBottom: '1px solid var(--theme-border-color)',
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <a
                        href={`/admin/collections/${collectionSlug}`}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            color: 'var(--theme-elevation-650)',
                            textDecoration: 'none',
                            fontSize: 13,
                        }}
                    >
                        ← Back to submissions
                    </a>

                    <div style={{ display: 'flex', gap: 8 }}>
                        {!isEditing ? (
                            <button className="sv-edit-btn" onClick={() => setIsEditing(true)}>
                                ✏️ Edit Responses
                            </button>
                        ) : (
                            <>
                                <button className="sv-cancel-btn" onClick={() => setIsEditing(false)} disabled={saving}>
                                    Cancel
                                </button>
                                <button className="sv-save-btn" onClick={handleSave} disabled={saving}>
                                    {saving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap', marginBottom: 20, marginTop: 20 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--theme-text)', margin: '0 0 4px', lineHeight: 1.3 }}>
                            {submission.email || `Submission #${submission.id}`}
                        </h1>
                        {form && (
                            <p style={{ fontSize: 13, color: 'var(--theme-elevation-550)', margin: '0 0 6px' }}>
                                {form.title}
                            </p>
                        )}
                        {partnerName && (
                            <span
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    padding: '2px 10px',
                                    borderRadius: 3,
                                    fontSize: 12,
                                    fontWeight: 600,
                                    background: 'var(--theme-elevation-150)',
                                    color: 'var(--theme-elevation-700)',
                                    border: '1px solid var(--theme-border-color)',
                                }}
                            >
                                🤝 {partnerName}
                            </span>
                        )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                        <span
                            style={{
                                display: 'inline-flex',
                                padding: '3px 12px',
                                borderRadius: 3,
                                fontSize: 12,
                                fontWeight: 600,
                                color: statusConfig.color,
                                background: statusConfig.bg,
                            }}
                        >
                            {statusConfig.label}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--theme-elevation-500)' }}>
                            {formatDate(submission.createdAt)}
                        </span>
                    </div>
                </div>

                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 14px',
                        background: 'var(--theme-elevation-50)',
                        border: '1px solid var(--theme-border-color)',
                        borderRadius: 4,
                        flexWrap: 'wrap',
                    }}
                >
                    <span style={{ fontSize: 12, color: 'var(--theme-elevation-550)', whiteSpace: 'nowrap' }}>
                        Update status:
                    </span>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {Object.entries(STATUS_CONFIG).map(([value, config]) => {
                            const isActive = value === currentStatus
                            return (
                                <button
                                    key={value}
                                    className="sv-status-btn"
                                    style={{
                                        padding: '5px 14px',
                                        borderRadius: 3,
                                        fontSize: 12,
                                        fontWeight: 500,
                                        border: `1px solid ${isActive ? config.color : 'var(--theme-border-color)'}`,
                                        background: isActive ? config.bg : 'var(--theme-elevation-100)',
                                        color: isActive ? config.color : 'var(--theme-elevation-650)',
                                        cursor: isActive || statusSaving ? 'default' : 'pointer',
                                        opacity: isActive ? 1 : undefined,
                                        transition: 'all 0.15s',
                                    }}
                                    onClick={() => handleStatusChange(value)}
                                    disabled={statusSaving || isActive}
                                >
                                    {config.label}
                                </button>
                            )
                        })}
                    </div>
                </div>
            </div>

            {collectionSlug === 'founder-form-submissions' && (submission as any).personalityScores?.raw && Object.values((submission as any).personalityScores.raw).some((v: any) => v > 0) && (() => {
                const ps = (submission as any).personalityScores
                const archetypeDisplay = resolveArchetypeDisplay(ps.archetype, {
                    emoji: ps.archetypeEmoji,
                    tagline: ps.archetypeTagline,
                })
                const traitLabels: Record<string, string> = { E: 'Extraversion', A: 'Agreeableness', C: 'Conscientiousness', N: 'Neuroticism', O: 'Openness', SE: 'Self-Efficacy', RT: 'Risk-Taking' }
                const compositeLabels: Record<string, string> = { ES: 'Emotional Stability', EXEC: 'Execution', ADAPT: 'Adaptability', RISK_CAL: 'Risk Calibration' }
                const traitColors: Record<string, string> = { E: '#E8A838', A: '#38C9E8', C: '#38E87A', N: '#E85B38', O: '#B038E8', SE: '#38E8C9', RT: '#E83870' }
                const compositeColors: Record<string, string> = { ES: '#38E87A', EXEC: '#3888E8', ADAPT: '#B038E8', RISK_CAL: '#E8A838' }

                const ScoreRow = ({ label, value, color }: { label: string; value: number; color: string }) => (
                    <div style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--theme-elevation-650)' }}>{label}</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color }}>{value?.toFixed(2)}</span>
                        </div>
                        <div style={{ height: 6, borderRadius: 3, background: 'var(--theme-elevation-100)' }}>
                            <div style={{ height: '100%', borderRadius: 3, background: color, width: `${Math.min(100, (value / 5) * 100)}%` }} />
                        </div>
                    </div>
                )

                return (
                    <div style={{
                        marginBottom: 'var(--base)',
                        padding: '18px 20px',
                        background: 'var(--theme-elevation-50)',
                        border: '1px solid var(--theme-border-color)',
                        borderRadius: 6,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--theme-success-500)' }}>
                                🧠 Personality Profile
                            </span>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                {archetypeDisplay.key && (
                                    <span style={{
                                        padding: '3px 12px', borderRadius: 3, fontSize: 13, fontWeight: 700,
                                        background: 'color-mix(in srgb, var(--theme-success-500) 12%, transparent)',
                                        color: 'var(--theme-success-500)', border: '1px solid var(--theme-success-500)',
                                    }}>
                                        {archetypeDisplay.emoji} {archetypeDisplay.key}
                                    </span>
                                )}
                                {ps.track && (
                                    <span style={{
                                        padding: '3px 12px', borderRadius: 3, fontSize: 12, fontWeight: 600,
                                        background: 'color-mix(in srgb, #3888E8 10%, transparent)',
                                        color: '#3888E8', border: '1px solid #3888E8',
                                    }}>
                                        {ps.track}
                                    </span>
                                )}
                            </div>
                        </div>

                        {archetypeDisplay.tagline && (
                            <p style={{ fontSize: 13, color: 'var(--theme-elevation-550)', fontStyle: 'italic', margin: '0 0 16px' }}>
                                "{archetypeDisplay.tagline}"
                            </p>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                            <div>
                                <h4 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--theme-elevation-450)', margin: '0 0 10px' }}>
                                    Raw Scores
                                </h4>
                                {ps.raw && Object.entries(ps.raw).map(([k, v]) => (
                                    <ScoreRow key={k} label={traitLabels[k] || k} value={v as number} color={traitColors[k] || '#888'} />
                                ))}
                            </div>
                            <div>
                                <h4 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--theme-elevation-450)', margin: '0 0 10px' }}>
                                    Composite Scores
                                </h4>
                                {ps.composite && Object.entries(ps.composite).map(([k, v]) => (
                                    <ScoreRow key={k} label={compositeLabels[k] || k} value={v as number} color={compositeColors[k] || '#888'} />
                                ))}
                            </div>
                        </div>

                        {ps.flags && (ps.flags.low_ES || ps.flags.low_exec || ps.flags.high_risk || ps.flags.low_risk || !ps.flags.attn_pass || !ps.flags.honesty_ok) && (
                            <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {!ps.flags.attn_pass && <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 3, background: 'color-mix(in srgb, var(--theme-error-500) 10%, transparent)', color: 'var(--theme-error-500)', border: '1px solid var(--theme-error-500)' }}>⚠ Attention Check Failed</span>}
                                {!ps.flags.honesty_ok && <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 3, background: 'color-mix(in srgb, var(--theme-warning-500) 10%, transparent)', color: 'var(--theme-warning-500)', border: '1px solid var(--theme-warning-500)' }}>⚠ Low Honesty</span>}
                                {ps.flags.low_ES && <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 3, background: 'color-mix(in srgb, var(--theme-error-500) 10%, transparent)', color: 'var(--theme-error-500)', border: '1px solid var(--theme-error-500)' }}>Low Emotional Stability</span>}
                                {ps.flags.low_exec && <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 3, background: 'color-mix(in srgb, var(--theme-warning-500) 10%, transparent)', color: 'var(--theme-warning-500)', border: '1px solid var(--theme-warning-500)' }}>Low Execution</span>}
                                {ps.flags.high_risk && <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 3, background: 'color-mix(in srgb, var(--theme-error-500) 10%, transparent)', color: 'var(--theme-error-500)', border: '1px solid var(--theme-error-500)' }}>High Risk Appetite</span>}
                                {ps.flags.low_risk && <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 3, background: 'color-mix(in srgb, var(--theme-warning-500) 10%, transparent)', color: 'var(--theme-warning-500)', border: '1px solid var(--theme-warning-500)' }}>Low Risk Appetite</span>}
                            </div>
                        )}
                    </div>
                )
            })()}

            <div>
                {Array.from(grouped.entries()).map(([sectionTitle, items]) => (
                    <div key={sectionTitle} style={{ marginBottom: 'calc(var(--base) * 1.5)' }}>
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                marginBottom: 16,
                                paddingBottom: 8,
                                borderBottom: '1px solid var(--theme-border-color)',
                            }}
                        >
                            <h2
                                style={{
                                    fontSize: 16,
                                    fontWeight: 700,
                                    color: 'var(--theme-text)',
                                    margin: 0,
                                    textTransform: 'none',
                                }}
                            >
                                {sectionTitle}
                            </h2>
                        </div>

                        {items.map(({ question, answer }) => {
                            const formattedAnswer = formatAnswer(answer, question)
                            const isEmpty = formattedAnswer === '—'

                            return (
                                <div
                                    key={question.question_id}
                                    className="sv-card"
                                    style={{
                                        padding: '16px 20px',
                                        marginBottom: 1,
                                        background: 'var(--theme-elevation-50)',
                                        borderBottom: '1px solid var(--theme-border-color)',
                                        transition: 'background 0.15s',
                                        cursor: 'default',
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                        <span style={{ fontSize: 14, lineHeight: 1 }}>
                                            {TYPE_ICONS[question.question_type] || '❓'}
                                        </span>
                                        <label
                                            style={{
                                                fontSize: 13,
                                                fontWeight: 600,
                                                color: 'var(--theme-elevation-650)',
                                                flex: 1,
                                            }}
                                        >
                                            {question.question_text}
                                            {question.required && (
                                                <span style={{ color: 'var(--theme-error-500)', marginLeft: 4 }}>*</span>
                                            )}
                                        </label>
                                        <span
                                            style={{
                                                fontSize: 10,
                                                fontWeight: 500,
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.05em',
                                                color: 'var(--theme-elevation-450)',
                                                flexShrink: 0,
                                            }}
                                        >
                                            {question.question_type.replace(/_/g, ' ')}
                                        </span>
                                    </div>

                                    <div
                                        style={{
                                            padding: isEditing && !['yes_no', 'multiple_choice_multiple'].includes(question.question_type) ? 0 : '10px 14px',
                                            background: isEditing ? 'transparent' : 'var(--theme-input-bg)',
                                            border: isEditing ? 'none' : '1px solid var(--theme-border-color)',
                                            borderRadius: 4,
                                            fontSize: 14,
                                            lineHeight: 1.6,
                                            color: isEmpty ? 'var(--theme-elevation-400)' : 'var(--theme-text)',
                                            fontStyle: isEmpty && !isEditing ? 'italic' : 'normal',
                                            minHeight: !isEditing && question.question_type === 'long_text' ? 60 : undefined,
                                            whiteSpace: !isEditing && question.question_type === 'long_text' ? 'pre-wrap' : undefined,
                                            wordBreak: 'break-word',
                                        }}
                                    >
                                        {isEditing ? (
                                            renderInput(question, answer)
                                        ) : (
                                            question.question_type === 'yes_no' && !isEmpty ? (
                                                <span
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: 6,
                                                        padding: '2px 12px',
                                                        borderRadius: 3,
                                                        fontSize: 13,
                                                        fontWeight: 600,
                                                        background:
                                                            formattedAnswer === 'Yes'
                                                                ? 'var(--theme-success-100)'
                                                                : 'var(--theme-error-100)',
                                                        color:
                                                            formattedAnswer === 'Yes'
                                                                ? 'var(--theme-success-500)'
                                                                : 'var(--theme-error-500)',
                                                    }}
                                                >
                                                    {formattedAnswer === 'Yes' ? '✓' : '✗'} {formattedAnswer}
                                                </span>
                                            ) : question.question_type === 'url' && !isEmpty ? (
                                                <a
                                                    href={formattedAnswer}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="sv-link"
                                                    style={{
                                                        color: 'var(--theme-success-500)',
                                                        textDecoration: 'none',
                                                        fontWeight: 500,
                                                    }}
                                                >
                                                    {formattedAnswer}
                                                </a>
                                            ) : (
                                                formattedAnswer
                                            )
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ))}

                {ungrouped.length > 0 && (
                    <div style={{ marginBottom: 'calc(var(--base) * 1.5)' }}>
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                marginBottom: 16,
                                paddingBottom: 8,
                                borderBottom: '1px solid var(--theme-border-color)',
                            }}
                        >
                            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--theme-text)', margin: 0 }}>
                                Other Responses
                            </h2>
                        </div>
                        {ungrouped.map(({ questionId, answer }) => (
                            <div
                                key={questionId}
                                className="sv-card"
                                style={{
                                    padding: '16px 20px',
                                    marginBottom: 1,
                                    background: 'var(--theme-elevation-5)',
                                    borderBottom: '1px solid var(--theme-border-color)',
                                    transition: 'background 0.15s',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                    <span style={{ fontSize: 14, lineHeight: 1 }}>❓</span>
                                    <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--theme-elevation-650)' }}>
                                        {questionId}
                                    </label>
                                </div>
                                <div
                                    style={{
                                        padding: '10px 14px',
                                        background: 'var(--theme-input-bg)',
                                        border: '1px solid var(--theme-border-color)',
                                        borderRadius: 4,
                                        fontSize: 14,
                                        color: 'var(--theme-text)',
                                        wordBreak: 'break-word',
                                    }}
                                >
                                    {String(answer)}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {submissionEntries.length === 0 && (
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: 200,
                            gap: 8,
                            textAlign: 'center',
                            color: 'var(--theme-elevation-500)',
                        }}
                    >
                        <div style={{ fontSize: 48, marginBottom: 8 }}>📭</div>
                        <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--theme-elevation-650)', margin: 0 }}>
                            No responses found
                        </h3>
                        <p style={{ margin: 0, fontSize: 14 }}>This submission doesn't contain any response data.</p>
                    </div>
                )}
            </div>
        </div>
    )
}

export default SubmissionViewer
