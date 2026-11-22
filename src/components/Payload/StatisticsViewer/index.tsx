
'use client'

import React, { useEffect, useState, useCallback } from 'react'

type Question = {
    question_id: string
    question_text: string
    question_type: string
    choices?: { label: string; value: string }[]
}

type Section = {
    title: string
    questions?: Question[]
}

type FormData = {
    id: number
    title: string
    sections?: Section[]
}

type SubmissionData = {
    submissionData: Record<string, unknown>
}

type StatData = {
    questionId: string
    questionText: string
    sectionName?: string
    totalResponses: number
    choiceCounts: Record<string, number>
    percentages: Record<string, number>
    type: string
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
    range: '🎚️',
}

function StatisticsViewer() {
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [stats, setStats] = useState<StatData[]>([])
    const [form, setForm] = useState<FormData | null>(null)
    const [sortMode, setSortMode] = useState<'count' | 'alpha'>('count')

    const groupedStats = React.useMemo(() => {
        const groups: Record<string, StatData[]> = {}
        stats.forEach(stat => {
            const section = stat.sectionName || 'Other'
            if (!groups[section]) groups[section] = []
            groups[section].push(stat)
        })
        return groups
    }, [stats])

    const [collectionSlug, setCollectionSlug] = useState<string>('')
    const [formSlug, setFormSlug] = useState<string>('')

    useEffect(() => {
        const path = window.location.pathname
        if (path.includes('investor-forms')) {
            setCollectionSlug('investor-form-submissions')
            setFormSlug('investor-forms')
        } else if (path.includes('founder-forms')) {
            setCollectionSlug('founder-form-submissions')
            setFormSlug('founder-forms')
        }
    }, [])

    const getFormId = useCallback(() => {
        const pathParts = window.location.pathname.split('/')
        let index = pathParts.indexOf('investor-forms')
        if (index === -1) index = pathParts.indexOf('founder-forms')

        if (index !== -1 && pathParts[index + 1]) {
            return pathParts[index + 1]
        }
        return null
    }, [])

    useEffect(() => {
        const fetchData = async () => {
            if (!collectionSlug || !formSlug) return

            const formId = getFormId()
            if (!formId) {
                setLoading(false)
                return
            }

            try {
                const formRes = await fetch(`/api/${formSlug}/${formId}?depth=0`)
                if (!formRes.ok) throw new Error('Failed to fetch form definition')
                const formData: FormData = await formRes.json()
                setForm(formData)

                const subRes = await fetch(`/api/${collectionSlug}?where[form][equals]=${formId}&limit=10000&depth=0`)
                if (!subRes.ok) throw new Error('Failed to fetch submissions')
                const subData = await subRes.json()
                const submissions: SubmissionData[] = subData.docs

                const newStats: StatData[] = []

                if (formData.sections) {
                    for (const section of formData.sections) {
                        if (section.questions) {
                            for (const q of section.questions) {
                                if (['dropdown', 'multiple_choice_single', 'multiple_choice_multiple', 'yes_no', 'range'].includes(q.question_type)) {

                                    const counts: Record<string, number> = {}

                                    if (q.choices) {
                                        q.choices.forEach(c => counts[c.label] = 0)
                                    }
                                    if (q.question_type === 'yes_no') {
                                        counts['Yes'] = 0
                                        counts['No'] = 0
                                    }

                                    submissions.forEach(sub => {
                                        const val = sub.submissionData?.[q.question_id]

                                        if (val !== undefined && val !== null && val !== '') {
                                            if (Array.isArray(val)) {
                                                val.forEach(v => {
                                                    const choiceLabel = q.choices?.find(c => c.value === v)?.label || String(v)
                                                    counts[choiceLabel] = (counts[choiceLabel] || 0) + 1
                                                })
                                            } else {
                                                let label = String(val)
                                                if (q.choices) {
                                                    const choice = q.choices.find(c => c.value === val)
                                                    if (choice) label = choice.label
                                                }
                                                if (q.question_type === 'yes_no') {
                                                    if (val === true || val === 'true' || val === 'yes') label = 'Yes'
                                                    if (val === false || val === 'false' || val === 'no') label = 'No'
                                                }
                                                counts[label] = (counts[label] || 0) + 1
                                            }
                                        }
                                    })

                                    const totalRespondents = submissions.filter(s => {
                                        const v = s.submissionData?.[q.question_id]
                                        return v !== undefined && v !== null && v !== ''
                                    }).length

                                    const percentages: Record<string, number> = {}
                                    Object.keys(counts).forEach(key => {
                                        percentages[key] = totalRespondents > 0
                                            ? Math.round((counts[key] / totalRespondents) * 100)
                                            : 0
                                    })

                                    newStats.push({
                                        questionId: q.question_id,
                                        questionText: q.question_text,
                                        sectionName: section.title,
                                        totalResponses: totalRespondents,
                                        choiceCounts: counts,
                                        percentages,
                                        type: q.question_type
                                    })
                                }
                            }
                        }
                    }
                }
                setStats(newStats)

            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unknown error')
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [collectionSlug, formSlug, getFormId])

    if (!formSlug) return null

    if (loading) {
        return (
            <div style={{ padding: 'var(--base)', color: 'var(--theme-elevation-500)' }}>
                Loading statistics...
            </div>
        )
    }

    if (error) {
        return (
            <div style={{ padding: 'var(--base)', color: 'var(--theme-error-500)' }}>
                Error: {error}
            </div>
        )
    }

    if (stats.length === 0) {
        return (
            <div style={{ padding: 'var(--base)', color: 'var(--theme-elevation-500)' }}>
                No statistics available.
            </div>
        )
    }

    return (
        <div style={{ maxWidth: 1200, margin: '40px auto', padding: '0 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--theme-text)', margin: 0 }}>
                    📊 Response Statistics
                </h2>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, color: 'var(--theme-elevation-500)' }}>Sort choices by:</span>
                    <button
                        onClick={() => setSortMode(sortMode === 'count' ? 'alpha' : 'count')}
                        style={{
                            background: 'var(--theme-elevation-150)',
                            border: '1px solid var(--theme-border-color)',
                            padding: '4px 10px',
                            borderRadius: 4,
                            color: 'var(--theme-text)',
                            fontSize: 13,
                            cursor: 'pointer',
                            fontWeight: 500
                        }}
                    >
                        {sortMode === 'count' ? 'Count (High → Low)' : 'Label (A → Z)'}
                    </button>
                </div>
            </div>

            {Object.entries(groupedStats).map(([sectionName, sectionStats]) => (
                <div key={sectionName} style={{ marginBottom: 40 }}>
                    <h3 style={{
                        fontSize: 18,
                        fontWeight: 600,
                        color: 'var(--theme-text)',
                        marginBottom: 16,
                        paddingBottom: 8,
                        borderBottom: '1px solid var(--theme-border-color)'
                    }}>
                        {sectionName}
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
                        {sectionStats.map((stat) => (
                            <div
                                key={stat.questionId}
                                style={{
                                    background: 'var(--theme-elevation-50)',
                                    border: '1px solid var(--theme-border-color)',
                                    borderRadius: 8,
                                    padding: 20,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 12,
                                    height: 340,
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexShrink: 0 }}>
                                    <span style={{ fontSize: 16 }}>{TYPE_ICONS[stat.type]}</span>
                                    <div>
                                        <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 4px', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                            {stat.questionText}
                                        </h3>
                                        <p style={{ fontSize: 12, color: 'var(--theme-elevation-450)', margin: 0 }}>
                                            {stat.totalResponses} responses
                                        </p>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', flex: 1, paddingRight: 4 }}>
                                    {Object.entries(stat.choiceCounts)
                                        .sort((a, b) => {
                                            if (sortMode === 'count') return b[1] - a[1]
                                            return a[0].localeCompare(b[0])
                                        })
                                        .map(([label, count]) => {
                                            const percent = stat.percentages[label]
                                            return (
                                                <div key={label} style={{ flexShrink: 0 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                                                        <span style={{ wordBreak: 'break-word', marginRight: 8 }}>{label}</span>
                                                        <span style={{ color: 'var(--theme-elevation-500)', whiteSpace: 'nowrap' }}>
                                                            {count} <span style={{ fontSize: 11 }}>({percent}%)</span>
                                                        </span>
                                                    </div>
                                                    <div style={{ height: 6, width: '100%', background: 'var(--theme-elevation-150)', borderRadius: 3, overflow: 'hidden' }}>
                                                        <div
                                                            style={{
                                                                height: '100%',
                                                                width: `${percent}%`,
                                                                background: percent > 0 ? 'var(--theme-success-500)' : 'transparent',
                                                                borderRadius: 3
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            )
                                        })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}

export default StatisticsViewer
