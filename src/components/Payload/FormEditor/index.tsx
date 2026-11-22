
'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import * as XLSX from 'xlsx'

type Choice = { label: string; value: string }

type Question = {
    question_id: string
    question_text: string
    question_type: string
    required: boolean
    choices: Choice[]
    placeholder: string
    helperText: string
    exampleHintTitle: string
    exampleHintBody: string
    numberMinType: 'none' | 'custom'
    numberMinValue: string
    numberMaxType: 'none' | 'custom'
    numberMaxValue: string
}

type Section = {
    sectionId: string
    title: string
    description: string
    questions: Question[]
}

type ValidationError = {
    label: string
    message: string
    path: string
}

type CollectionType = 'investor-forms' | 'founder-forms'

type SearchFieldKey =
    | 'title'
    | 'description'
    | 'sectionId'
    | 'question_id'
    | 'question_text'
    | 'placeholder'
    | 'helperText'
    | 'exampleHintTitle'
    | 'exampleHintBody'
    | 'choice_label'
    | 'choice_value'

type SearchHit = {
    sectionIdx: number
    questionIdx: number | null
    field: string
    value: string
    fieldKey: SearchFieldKey
    choiceIdx?: number
}

type RevealTarget = SearchHit & { key: number; match?: string }

type ImportError = {
    row: number
    column?: string
    message: string
    severity: 'error' | 'warning'
}

type ImportResult = {
    sections: Section[]
    errors: ImportError[]
    warnings: ImportError[]
    totalRows: number
    skippedRows: number
}

const VALID_QUESTION_TYPES = new Set([
    'short_text', 'long_text', 'email', 'url', 'number',
    'dropdown', 'multiple_choice_single', 'multiple_choice_multiple',
    'yes_no', 'opinion_scale_1_5', 'range', 'statement', 'file_upload',
])

const OPINION_SCALE_CHOICES: Choice[] = [
    { label: 'Strongly disagree', value: 'strongly_disagree' },
    { label: 'Disagree', value: 'disagree' },
    { label: 'Neither agree nor disagree', value: 'neither' },
    { label: 'Agree', value: 'agree' },
    { label: 'Strongly agree', value: 'strongly_agree' },
]

function normalizeBool(val: string): boolean {
    const v = (val || '').toString().trim().toLowerCase()
    return v === 'y' || v === 'yes' || v === 'true' || v === '1'
}

function cleanSectionTitle(raw: string): string {
    return raw.replace(/^\d+[_\s]+/, '').replace(/_/g, ' ').trim()
}

function parseExcelToSections(data: any[][], hasId: boolean): ImportResult {
    const errors: ImportError[] = []
    const warnings: ImportError[] = []
    let skippedRows = 0

    if (data.length === 0) {
        errors.push({ row: 0, message: 'File is empty', severity: 'error' })
        return { sections: [], errors, warnings, totalRows: 0, skippedRows: 0 }
    }

    const header = data[0].map((h: any) => (h || '').toString().trim().toLowerCase())

    const colMap: Record<string, number> = {}
    const requiredCols = ['section', 'question_id', 'question_type', 'question_text']
    const allKnownCols = ['section', 'question_id', 'question_type', 'required', 'question_text', 'notes',
        ...Array.from({ length: 12 }, (_, i) => `choice_${i + 1}`)]

    for (const col of allKnownCols) {
        const idx = header.indexOf(col)
        if (idx !== -1) colMap[col] = idx
    }

    const missingCols = requiredCols.filter(c => !(c in colMap))
    if (missingCols.length > 0) {
        errors.push({
            row: 1,
            message: `Missing required column(s): ${missingCols.join(', ')}. Found columns: ${header.filter((h: string) => h).join(', ')}`,
            severity: 'error',
        })
        return { sections: [], errors, warnings, totalRows: data.length - 1, skippedRows: 0 }
    }

    const col = (row: any[], name: string): string => {
        const idx = colMap[name]
        if (idx === undefined) return ''
        return (row[idx] || '').toString().trim()
    }

    const sectionMap = new Map<string, { section: Section; rows: number[] }>()
    const sectionOrder: string[] = []
    const seenQuestionIds = new Set<string>()

    for (let i = 1; i < data.length; i++) {
        const row = data[i]
        if (!row || row.every((cell: any) => !cell || cell.toString().trim() === '')) {
            skippedRows++
            continue
        }

        const rowNum = i + 1
        const sectionKey = col(row, 'section')
        const qId = col(row, 'question_id')
        const qType = col(row, 'question_type')
        const qText = col(row, 'question_text')
        const required = normalizeBool(col(row, 'required'))

        if (!sectionKey) {
            errors.push({ row: rowNum, column: 'section', message: 'Missing section value', severity: 'error' })
            continue
        }
        if (!qId) {
            errors.push({ row: rowNum, column: 'question_id', message: 'Missing question_id', severity: 'error' })
            continue
        }
        if (!qText) {
            errors.push({ row: rowNum, column: 'question_text', message: 'Missing question_text', severity: 'error' })
            continue
        }
        if (!qType) {
            errors.push({ row: rowNum, column: 'question_type', message: 'Missing question_type', severity: 'error' })
            continue
        }

        if (!VALID_QUESTION_TYPES.has(qType)) {
            errors.push({
                row: rowNum,
                column: 'question_type',
                message: `Unknown question_type "${qType}". Valid: ${[...VALID_QUESTION_TYPES].join(', ')}`,
                severity: 'error',
            })
            continue
        }

        if (qType === 'statement') {
            warnings.push({
                row: rowNum,
                column: 'question_type',
                message: `Statement row skipped (display-only, no question created)`,
                severity: 'warning',
            })
            skippedRows++
            continue
        }

        if (seenQuestionIds.has(qId)) {
            warnings.push({ row: rowNum, column: 'question_id', message: `Duplicate question_id "${qId}"`, severity: 'warning' })
        }
        seenQuestionIds.add(qId)

        let finalType = qType
        let choices: Choice[] = []

        if (qType === 'opinion_scale_1_5') {
            finalType = 'range'
            const customChoices: Choice[] = []
            for (let ci = 1; ci <= 12; ci++) {
                const cv = col(row, `choice_${ci}`)
                if (!cv) break
                customChoices.push({ label: cv, value: toSlug(cv) || `option_${ci}` })
            }
            choices = customChoices.length === 5 ? customChoices : OPINION_SCALE_CHOICES
        } else if (TYPES_WITH_CHOICES.has(finalType)) {
            for (let ci = 1; ci <= 12; ci++) {
                const cv = col(row, `choice_${ci}`)
                if (!cv) break
                choices.push({ label: cv, value: toSlug(cv) || `option_${ci}` })
            }
            if (choices.length === 0) {
                warnings.push({
                    row: rowNum,
                    column: 'choice_1',
                    message: `Question type "${qType}" expects choices but none found`,
                    severity: 'warning',
                })
            }
        }

        const question: Question = {
            question_id: qId,
            question_text: qText,
            question_type: finalType,
            required,
            choices,
            placeholder: '',
            helperText: '',
            exampleHintTitle: '',
            exampleHintBody: '',
            numberMinType: 'none',
            numberMinValue: '',
            numberMaxType: 'none',
            numberMaxValue: '',
        }

        if (!sectionMap.has(sectionKey)) {
            sectionOrder.push(sectionKey)
            sectionMap.set(sectionKey, {
                section: {
                    sectionId: hasId ? toSlug(sectionKey) : crypto.randomUUID(),
                    title: cleanSectionTitle(sectionKey),
                    description: '',
                    questions: [],
                },
                rows: [],
            })
        }

        const entry = sectionMap.get(sectionKey)!
        entry.section.questions.push(question)
        entry.rows.push(rowNum)
    }

    const sections = sectionOrder.map(k => sectionMap.get(k)!.section)

    if (sections.length === 0 && errors.length === 0) {
        errors.push({ row: 0, message: 'No valid data rows found in the file', severity: 'error' })
    }

    return { sections, errors, warnings, totalRows: data.length - 1, skippedRows }
}

function ImportPanel({
    onImport,
    onClose,
    collectionType,
    hasId,
}: {
    onImport: (sections: Section[], title?: string) => void
    onClose: () => void
    collectionType: CollectionType
    hasId: boolean
}) {
    const [dragOver, setDragOver] = useState(false)
    const [result, setResult] = useState<ImportResult | null>(null)
    const [fileName, setFileName] = useState('')
    const [processing, setProcessing] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const processFile = useCallback(async (file: File) => {
        setProcessing(true)
        setResult(null)
        setFileName(file.name)

        try {
            const buf = await file.arrayBuffer()
            const wb = XLSX.read(buf, { type: 'array' })

            let sheetName = wb.SheetNames[0]
            const formSheetIdx = wb.SheetNames.findIndex(
                n => n.toLowerCase().includes('form') && !n.toLowerCase().includes('instruction') && !n.toLowerCase().includes('description'),
            )
            if (formSheetIdx !== -1) sheetName = wb.SheetNames[formSheetIdx]

            const cleanIdx = wb.SheetNames.findIndex(n => n.toLowerCase().includes('clean'))
            if (cleanIdx !== -1) sheetName = wb.SheetNames[cleanIdx]

            const ws = wb.Sheets[sheetName]
            const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

            const parsed = parseExcelToSections(data, hasId)
            setResult(parsed)
        } catch (e: any) {
            setResult({
                sections: [],
                errors: [{ row: 0, message: `Failed to read file: ${e.message}`, severity: 'error' }],
                warnings: [],
                totalRows: 0,
                skippedRows: 0,
            })
        } finally {
            setProcessing(false)
        }
    }, [hasId])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files[0]
        if (file) processFile(file)
    }, [processFile])

    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) processFile(file)
    }, [processFile])

    const canImport = result && result.sections.length > 0 && result.errors.length === 0
    const hasWarningsOnly = result && result.sections.length > 0 && result.errors.length === 0 && result.warnings.length > 0
    const templateType = collectionType === 'founder-forms' ? 'founder' : 'investor'

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={onClose}>
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    width: 640, maxHeight: '85vh', display: 'flex', flexDirection: 'column',
                    background: 'var(--theme-elevation-0)', borderRadius: 12,
                    border: '1px solid var(--theme-border-color)',
                    boxShadow: '0 8px 40px rgba(0,0,0,0.3)',
                    overflow: 'hidden',
                }}
            >
                <div style={{
                    padding: '16px 20px', borderBottom: '1px solid var(--theme-border-color)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--theme-text)' }}>
                            📥 Import Form from Excel / CSV
                        </h3>
                        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--theme-elevation-500)' }}>
                            Upload a spreadsheet to auto-populate sections and questions
                        </p>
                    </div>
                    <button
                        type="button" onClick={onClose}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-elevation-550)', fontSize: 20, padding: '4px 8px', lineHeight: 1 }}
                    >✕</button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
                    <div
                        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                            border: `2px dashed ${dragOver ? 'var(--theme-success-500)' : 'var(--theme-border-color)'}`,
                            borderRadius: 8, padding: '32px 20px', textAlign: 'center',
                            cursor: 'pointer', transition: 'all 0.2s',
                            background: dragOver ? 'var(--theme-success-100)' : 'var(--theme-elevation-50)',
                        }}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            onChange={handleFileChange}
                            style={{ display: 'none' }}
                        />
                        <div style={{ fontSize: 36, marginBottom: 8 }}>{dragOver ? '📂' : '📎'}</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--theme-text)', marginBottom: 4 }}>
                            {processing ? 'Processing…' : 'Drop Excel / CSV file here'}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--theme-elevation-500)' }}>
                            or click to browse · Supports .xlsx, .xls, .csv
                        </div>
                    </div>

                    <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'center' }}>
                        <a
                            href={`/api/form-template?type=${templateType}`}
                            download
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                padding: '6px 14px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                                border: '1px solid var(--theme-border-color)',
                                background: 'var(--theme-elevation-100)', color: 'var(--theme-text)',
                                textDecoration: 'none', cursor: 'pointer',
                            }}
                        >
                            📄 Download {templateType === 'founder' ? 'Founder' : 'Investor'} Template
                        </a>
                    </div>

                    {result && (
                        <div style={{ marginTop: 16 }}>
                            <div style={{
                                padding: '10px 14px', borderRadius: 6, fontSize: 13, marginBottom: 12,
                                background: result.errors.length > 0
                                    ? 'var(--theme-error-100)'
                                    : hasWarningsOnly
                                        ? 'rgba(255,193,7,0.12)'
                                        : 'var(--theme-success-100)',
                                border: `1px solid ${result.errors.length > 0 ? 'var(--theme-error-300)' : hasWarningsOnly ? 'rgba(255,193,7,0.3)' : 'rgba(34,197,94,0.3)'}`,
                                color: result.errors.length > 0 ? 'var(--theme-error-500)' : 'var(--theme-text)',
                            }}>
                                <div style={{ fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    {result.errors.length > 0 ? '❌' : hasWarningsOnly ? '⚠️' : '✅'}
                                    {result.errors.length > 0
                                        ? `${result.errors.length} error${result.errors.length !== 1 ? 's' : ''} found in "${fileName}"`
                                        : `Ready to import from "${fileName}"`}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--theme-elevation-600)' }}>
                                    {result.totalRows} rows · {result.sections.length} sections · {result.sections.reduce((n, s) => n + s.questions.length, 0)} questions
                                    {result.skippedRows > 0 && ` · ${result.skippedRows} empty rows skipped`}
                                    {result.warnings.length > 0 && ` · ${result.warnings.length} warning${result.warnings.length !== 1 ? 's' : ''}`}
                                </div>
                            </div>

                            {result.errors.length > 0 && (
                                <div style={{
                                    maxHeight: 200, overflowY: 'auto', borderRadius: 6,
                                    border: '1px solid var(--theme-error-300)', marginBottom: 12,
                                }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                        <thead>
                                            <tr style={{ background: 'var(--theme-error-100)', position: 'sticky', top: 0 }}>
                                                <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700, color: 'var(--theme-error-500)', width: 60 }}>Row</th>
                                                <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700, color: 'var(--theme-error-500)', width: 100 }}>Column</th>
                                                <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700, color: 'var(--theme-error-500)' }}>Error</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {result.errors.map((err, i) => (
                                                <tr key={i} style={{ borderTop: '1px solid var(--theme-error-200)' }}>
                                                    <td style={{ padding: '5px 10px', fontFamily: 'monospace', color: 'var(--theme-error-500)', fontWeight: 600 }}>{err.row || '—'}</td>
                                                    <td style={{ padding: '5px 10px', fontFamily: 'monospace', color: 'var(--theme-error-400)' }}>{err.column || '—'}</td>
                                                    <td style={{ padding: '5px 10px', color: 'var(--theme-text)' }}>{err.message}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {result.warnings.length > 0 && (
                                <div style={{
                                    maxHeight: 160, overflowY: 'auto', borderRadius: 6,
                                    border: '1px solid rgba(255,193,7,0.3)', marginBottom: 12,
                                }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                        <thead>
                                            <tr style={{ background: 'rgba(255,193,7,0.08)', position: 'sticky', top: 0 }}>
                                                <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700, color: 'rgb(180,130,0)', width: 60 }}>Row</th>
                                                <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700, color: 'rgb(180,130,0)', width: 100 }}>Column</th>
                                                <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700, color: 'rgb(180,130,0)' }}>Warning</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {result.warnings.map((w, i) => (
                                                <tr key={i} style={{ borderTop: '1px solid rgba(255,193,7,0.15)' }}>
                                                    <td style={{ padding: '5px 10px', fontFamily: 'monospace', color: 'rgb(180,130,0)', fontWeight: 600 }}>{w.row || '—'}</td>
                                                    <td style={{ padding: '5px 10px', fontFamily: 'monospace', color: 'rgb(160,120,0)' }}>{w.column || '—'}</td>
                                                    <td style={{ padding: '5px 10px', color: 'var(--theme-text)' }}>{w.message}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {canImport && (
                                <div style={{
                                    padding: 12, borderRadius: 6, background: 'var(--theme-elevation-50)',
                                    border: '1px solid var(--theme-border-color)', fontSize: 12,
                                }}>
                                    <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--theme-text)' }}>Preview:</div>
                                    {result.sections.map((s, si) => (
                                        <div key={si} style={{ marginBottom: 4 }}>
                                            <span style={{ fontWeight: 600, color: 'var(--theme-text)' }}>§{si + 1} {s.title}</span>
                                            <span style={{ color: 'var(--theme-elevation-500)', marginLeft: 6 }}>
                                                ({s.questions.length} question{s.questions.length !== 1 ? 's' : ''})
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div style={{
                    padding: '12px 20px', borderTop: '1px solid var(--theme-border-color)',
                    display: 'flex', justifyContent: 'flex-end', gap: 8,
                }}>
                    <button type="button" onClick={onClose} style={{ ...btn(), padding: '8px 16px' }}>Cancel</button>
                    <button
                        type="button"
                        disabled={!canImport}
                        onClick={() => {
                            if (result && canImport) {
                                onImport(result.sections, fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '))
                                onClose()
                            }
                        }}
                        style={{
                            padding: '8px 20px', borderRadius: 4, fontSize: 13, fontWeight: 700,
                            border: 'none', cursor: canImport ? 'pointer' : 'default',
                            background: canImport ? 'var(--theme-success-500)' : 'var(--theme-elevation-200)',
                            color: canImport ? '#fff' : 'var(--theme-elevation-500)',
                            transition: 'all 0.15s',
                        }}
                    >
                        📥 Import {result ? `(${result.sections.reduce((n, s) => n + s.questions.length, 0)} questions)` : ''}
                    </button>
                </div>
            </div>
        </div>
    )
}

function highlightSnippet(text: string, query: string) {
    const idx = text.toLowerCase().indexOf(query.toLowerCase())
    if (idx === -1) return <span>{text.slice(0, 80)}{text.length > 80 ? '…' : ''}</span>
    const before = text.slice(Math.max(0, idx - 20), idx)
    const match = text.slice(idx, idx + query.length)
    const after = text.slice(idx + query.length, idx + query.length + 40)
    return (
        <span>
            {idx > 20 && '…'}{before}
            <mark style={{ background: '#ffcc00', color: 'white', padding: '0 2px', borderRadius: 2 }}>{match}</mark>
            {after}{after.length >= 40 && '…'}
        </span>
    )
}

function focusAndRevealElement(
    container: HTMLElement | null,
    selector: string,
    match?: string,
    block: ScrollLogicalPosition = 'center',
) {
    if (!container) return false
    const target = container.querySelector<HTMLElement>(selector)
    if (!target) return false

    target.scrollIntoView({ behavior: 'smooth', block })

    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
        target.focus({ preventScroll: true })
        if (
            match &&
            (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) &&
            typeof target.value === 'string'
        ) {
            const lowerValue = target.value.toLowerCase()
            const lowerMatch = match.toLowerCase()
            const matchIndex = lowerValue.indexOf(lowerMatch)
            if (matchIndex >= 0) {
                target.setSelectionRange(matchIndex, matchIndex + match.length)
            } else {
                target.select()
            }
        }
    }

    return true
}

const QUESTION_TYPES = [
    { value: 'short_text', label: 'Short Text', icon: '✏️' },
    { value: 'long_text', label: 'Long Text', icon: '📝' },
    { value: 'email', label: 'Email', icon: '📧' },
    { value: 'url', label: 'URL', icon: '🔗' },
    { value: 'number', label: 'Number', icon: '🔢' },
    { value: 'dropdown', label: 'Dropdown', icon: '📋' },
    { value: 'multiple_choice_single', label: 'Single Choice', icon: '⭕' },
    { value: 'multiple_choice_multiple', label: 'Multi Choice', icon: '☑️' },
    { value: 'yes_no', label: 'Yes / No', icon: '👍' },
    { value: 'range', label: 'Range / Slider', icon: '🎚️' },
    { value: 'file_upload', label: 'File Upload', icon: '📎' },
] as const

const TYPES_WITH_CHOICES = new Set(['dropdown', 'multiple_choice_single', 'multiple_choice_multiple', 'range'])

function toSlug(s: string) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

function newQuestion(): Question {
    return {
        question_id: '',
        question_text: '',
        question_type: 'short_text',
        required: false,
        choices: [],
        placeholder: '',
        helperText: '',
        exampleHintTitle: '',
        exampleHintBody: '',
        numberMinType: 'none',
        numberMinValue: '',
        numberMaxType: 'none',
        numberMaxValue: '',
    }
}

function newSection(hasId: boolean): Section {
    return { sectionId: hasId ? '' : crypto.randomUUID(), title: '', description: '', questions: [] }
}

function apiToSections(raw: any[], collectionType: CollectionType): Section[] {
    return (raw || []).map((s: any) => ({
        sectionId: collectionType === 'founder-forms' ? (s.id || '') : (s._uid || crypto.randomUUID()),
        title: s.title || '',
        description: s.description || '',
        questions: (s.questions || []).map((q: any) => ({
            question_id: q.question_id || '',
            question_text: q.question_text || '',
            question_type: q.question_type || 'short_text',
            required: Boolean(q.required),
            choices: (q.choices || []).map((c: any) => ({ label: c.label || '', value: c.value || '' })),
            placeholder: q.placeholder || '',
            helperText: q.helperText || '',
            exampleHintTitle: q.exampleHintTitle || '',
            exampleHintBody: q.exampleHintBody || '',
            numberMinType: q.numberMinType === 'custom' ? 'custom' : 'none',
            numberMinValue: q.numberMinValue != null ? String(q.numberMinValue) : '',
            numberMaxType: q.numberMaxType === 'custom' ? 'custom' : 'none',
            numberMaxValue: q.numberMaxValue != null ? String(q.numberMaxValue) : '',
        })),
    }))
}

function sectionsToApi(sections: Section[], collectionType: CollectionType): any[] {
    return sections.map((s) => {
        const base: any = {
            title: s.title,
            description: s.description || undefined,
            questions: s.questions.map((q) => ({
                question_id: q.question_id,
                question_text: q.question_text,
                question_type: q.question_type,
                required: q.required,
                choices: TYPES_WITH_CHOICES.has(q.question_type as any) ? q.choices : [],
                placeholder: q.placeholder || undefined,
                helperText: q.helperText || undefined,
                exampleHintTitle: q.exampleHintTitle || undefined,
                exampleHintBody: q.exampleHintBody || undefined,
                numberMinType: q.numberMinType,
                numberMinValue: q.question_type === 'number' && q.numberMinType === 'custom' && q.numberMinValue !== '' ? parseFloat(q.numberMinValue) : undefined,
                numberMaxType: q.numberMaxType,
                numberMaxValue: q.question_type === 'number' && q.numberMaxType === 'custom' && q.numberMaxValue !== '' ? parseFloat(q.numberMaxValue) : undefined,
            })),
        }
        if (collectionType === 'founder-forms') base.id = s.sectionId
        return base
    })
}

function moveItem<T>(arr: T[], from: number, to: number): T[] {
    const next = [...arr]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    return next
}

const btn = (extra = ''): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    gap: 4, padding: '5px 12px', borderRadius: 4, fontSize: 12, fontWeight: 600,
    cursor: 'pointer', border: '1px solid var(--theme-border-color)',
    background: 'var(--theme-elevation-100)', color: 'var(--theme-text)',
    transition: 'all 0.15s',
})

const inputStyle: React.CSSProperties = {
    width: '100%', padding: '7px 10px',
    background: 'var(--theme-input-bg)', border: '1px solid var(--theme-border-color)',
    borderRadius: 4, fontSize: 13, color: 'var(--theme-text)', outline: 'none',
}

function SmallBtn({ onClick, title, children, variant = 'default', disabled }: { onClick: () => void; title?: string; children: React.ReactNode; variant?: 'default' | 'danger' | 'success'; disabled?: boolean }) {
    const colors: Record<string, React.CSSProperties> = {
        default: { background: 'var(--theme-elevation-100)', color: 'var(--theme-text)', border: '1px solid var(--theme-border-color)' },
        danger: { background: 'var(--theme-error-100)', color: 'var(--theme-error-500)', border: '1px solid var(--theme-error-300)' },
        success: { background: 'var(--theme-success-100)', color: 'var(--theme-success-600)', border: '1px solid var(--theme-success-300)' },
    }
    return (
        <button
            type="button"
            title={title}
            onClick={onClick}
            disabled={disabled}
            style={{
                ...btn(),
                ...colors[variant],
                opacity: disabled ? 0.45 : 1,
                cursor: disabled ? 'default' : 'pointer',
            }}
        >
            {children}
        </button>
    )
}

function ChoiceRow({ choice, index, total, onChange, onDelete, onMove, validationErrors = [], pathPrefix = '' }: {
    choice: Choice; index: number; total: number
    onChange: (c: Choice) => void; onDelete: () => void; onMove: (dir: -1 | 1) => void
    validationErrors?: ValidationError[]; pathPrefix?: string
}) {
    const hasError = (field: string) => validationErrors.some(e => e.path === `${pathPrefix}.${field}`)
    const getError = (field: string) => validationErrors.find(e => e.path === `${pathPrefix}.${field}`)?.message

    return (
        <div data-choice-idx={index} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                    <button type="button" title="Move up" onClick={() => onMove(-1)} disabled={index === 0}
                        style={{ ...btn(), padding: '2px 6px', fontSize: 10, opacity: index === 0 ? 0.3 : 1 }}>▲</button>
                    <button type="button" title="Move down" onClick={() => onMove(1)} disabled={index === total - 1}
                        style={{ ...btn(), padding: '2px 6px', fontSize: 10, opacity: index === total - 1 ? 0.3 : 1 }}>▼</button>
                </div>
                <input
                    data-search-field="choice_label"
                    style={{ ...inputStyle, flex: 2, border: hasError('label') ? '1px solid var(--theme-error-500)' : inputStyle.border }}
                    placeholder="Label (displayed)"
                    value={choice.label}
                    onChange={(e) => {
                        const label = e.target.value
                        const autoValue = choice.value === '' || choice.value === toSlug(choice.label)
                        onChange({ label, value: autoValue ? toSlug(label) : choice.value })
                    }}
                />
                <input
                    data-search-field="choice_value"
                    style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', fontSize: 11, border: hasError('value') ? '1px solid var(--theme-error-500)' : inputStyle.border }}
                    placeholder="value (stored)"
                    value={choice.value}
                    onChange={(e) => onChange({ ...choice, value: e.target.value })}
                />
                <SmallBtn onClick={onDelete} variant="danger" title="Remove choice">✕</SmallBtn>
            </div>
            {(hasError('label') || hasError('value')) && (
                <div style={{ paddingLeft: 34, fontSize: 11, color: 'var(--theme-error-500)' }}>
                    {getError('label') || getError('value')}
                </div>
            )}
        </div>
    )
}

function QuestionCard({ question, index, total, onChange, onDelete, onMove, validationErrors = [], pathPrefix = '', sectionIdx, revealTarget }: {
    question: Question; index: number; total: number
    onChange: (q: Question) => void; onDelete: () => void; onMove: (dir: -1 | 1) => void
    validationErrors?: ValidationError[]; pathPrefix?: string
    sectionIdx?: number; revealTarget?: RevealTarget | null
}) {
    const [expanded, setExpanded] = useState(false)
    const cardRef = useRef<HTMLDivElement>(null)
    const typeInfo = QUESTION_TYPES.find(t => t.value === question.question_type)
    const showChoices = TYPES_WITH_CHOICES.has(question.question_type as any)

    // Auto-expand if there are validation errors
    useEffect(() => {
        if (validationErrors.length > 0) {
            setExpanded(true)
        }
    }, [validationErrors])

    // Auto-expand and scroll when revealed via search
    useEffect(() => {
        if (
            revealTarget &&
            revealTarget.sectionIdx === sectionIdx &&
            revealTarget.questionIdx === index
        ) {
            setExpanded(true)
            window.setTimeout(() => {
                if (revealTarget.fieldKey === 'choice_label' || revealTarget.fieldKey === 'choice_value') {
                    const selector = `[data-choice-idx="${revealTarget.choiceIdx ?? -1}"] [data-search-field="${revealTarget.fieldKey}"]`
                    if (focusAndRevealElement(cardRef.current, selector, revealTarget.match)) return
                }

                const selector = `[data-search-field="${revealTarget.fieldKey}"]`
                if (focusAndRevealElement(cardRef.current, selector, revealTarget.match)) return

                cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }, 80)
        }
    }, [index, revealTarget, sectionIdx])

    const hasError = (field: string) => validationErrors.some(e => e.path === `${pathPrefix}.${field}`)
    const getError = (field: string) => validationErrors.find(e => e.path === `${pathPrefix}.${field}`)?.message

    const setField = <K extends keyof Question>(k: K, v: Question[K]) => onChange({ ...question, [k]: v })

    const addChoice = () => setField('choices', [...question.choices, { label: '', value: '' }])
    const updateChoice = (i: number, c: Choice) => {
        const next = [...question.choices]; next[i] = c; setField('choices', next)
    }
    const deleteChoice = (i: number) => setField('choices', question.choices.filter((_, idx) => idx !== i))
    const moveChoice = (i: number, dir: -1 | 1) => setField('choices', moveItem(question.choices, i, i + dir))

    return (
        <div
            ref={cardRef}
            data-section-idx={sectionIdx}
            data-question-idx={index}
            style={{
                border: '1px solid var(--theme-border-color)', borderRadius: 6,
                background: 'var(--theme-elevation-50)', overflow: 'hidden',
            }}
        >
            <div
                style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
                    cursor: 'pointer', userSelect: 'none',
                    background: expanded ? 'var(--theme-elevation-100)' : undefined,
                    borderBottom: expanded ? '1px solid var(--theme-border-color)' : 'none',
                }}
                onClick={() => setExpanded(v => !v)}
            >
                <div style={{ display: 'flex', gap: 2, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    <button type="button" onClick={() => onMove(-1)} disabled={index === 0}
                        style={{ ...btn(), padding: '2px 6px', fontSize: 10, opacity: index === 0 ? 0.3 : 1 }}>▲</button>
                    <button type="button" onClick={() => onMove(1)} disabled={index === total - 1}
                        style={{ ...btn(), padding: '2px 6px', fontSize: 10, opacity: index === total - 1 ? 0.3 : 1 }}>▼</button>
                </div>

                <span style={{
                    flexShrink: 0, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                    padding: '2px 8px', borderRadius: 3, background: 'var(--theme-elevation-200)',
                    color: 'var(--theme-elevation-650)', whiteSpace: 'nowrap',
                }}>
                    {typeInfo?.icon} {typeInfo?.label ?? question.question_type}
                </span>

                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                    <input
                        data-search-field="question_text"
                        style={{ ...inputStyle, fontWeight: 500, border: hasError('question_text') ? '1px solid var(--theme-error-500)' : 'transparent', background: expanded ? undefined : 'transparent', padding: expanded ? '7px 10px' : '4px 10px' }}
                        placeholder="Question text…"
                        value={question.question_text}
                        onChange={e => setField('question_text', e.target.value)}
                    />
                    {!expanded && hasError('question_text') && (
                        <span style={{ fontSize: 11, color: 'var(--theme-error-500)', paddingLeft: 10 }}>{getError('question_text')}</span>
                    )}
                </div>

                {question.required && (
                    <span style={{ flexShrink: 0, fontSize: 10, padding: '2px 7px', borderRadius: 3, background: 'var(--theme-error-100)', color: 'var(--theme-error-500)', fontWeight: 700 }}>
                        Required
                    </span>
                )}

                {showChoices && question.choices.length > 0 && (
                    <span style={{ flexShrink: 0, fontSize: 11, color: 'var(--theme-elevation-500)' }}>
                        {question.choices.length} choices
                    </span>
                )}

                <span style={{ flexShrink: 0, fontSize: 12, color: 'var(--theme-elevation-450)' }}>{expanded ? '▲' : '▼'}</span>

                <div onClick={e => e.stopPropagation()}>
                    <SmallBtn onClick={onDelete} variant="danger" title="Delete question">✕</SmallBtn>
                </div>
            </div>

            {expanded && (
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'end' }}>
                        <div>
                            <label style={{ fontSize: 11, fontWeight: 600, color: hasError('question_id') ? 'var(--theme-error-500)' : 'var(--theme-elevation-550)', display: 'block', marginBottom: 4 }}>
                                Question ID <span style={{ color: 'var(--theme-error-500)' }}>*</span>
                            </label>
                            <input
                                data-search-field="question_id"
                                style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12, border: hasError('question_id') ? '1px solid var(--theme-error-500)' : inputStyle.border }}
                                placeholder="e.g. F1_NAME"
                                value={question.question_id}
                                onChange={e => setField('question_id', e.target.value)}
                            />
                            {hasError('question_id') && <div style={{ fontSize: 11, color: 'var(--theme-error-500)', marginTop: 4 }}>{getError('question_id')}</div>}
                        </div>
                        <div>
                            <label style={{ fontSize: 11, fontWeight: 600, color: hasError('question_type') ? 'var(--theme-error-500)' : 'var(--theme-elevation-550)', display: 'block', marginBottom: 4 }}>
                                Type <span style={{ color: 'var(--theme-error-500)' }}>*</span>
                            </label>
                            <select
                                style={{ ...inputStyle, border: hasError('question_type') ? '1px solid var(--theme-error-500)' : inputStyle.border }}
                                value={question.question_type}
                                onChange={e => setField('question_type', e.target.value)}
                            >
                                {QUESTION_TYPES.map(t => (
                                    <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                                ))}
                            </select>
                        </div>
                        <div style={{ paddingBottom: 2 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: 'var(--theme-text)', userSelect: 'none' }}>
                                <input type="checkbox" checked={question.required} onChange={e => setField('required', e.target.checked)} />
                                Required
                            </label>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <label style={{ fontSize: 11, fontWeight: 600, color: hasError('placeholder') ? 'var(--theme-error-500)' : 'var(--theme-elevation-550)', display: 'block', marginBottom: 4 }}>Placeholder</label>
                            <input
                                data-search-field="placeholder"
                                style={{ ...inputStyle, border: hasError('placeholder') ? '1px solid var(--theme-error-500)' : inputStyle.border }}
                                placeholder="Placeholder text…"
                                value={question.placeholder}
                                onChange={e => setField('placeholder', e.target.value)}
                            />
                            {hasError('placeholder') && <div style={{ fontSize: 11, color: 'var(--theme-error-500)', marginTop: 4 }}>{getError('placeholder')}</div>}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <label style={{ fontSize: 11, fontWeight: 600, color: hasError('helperText') ? 'var(--theme-error-500)' : 'var(--theme-elevation-550)', display: 'block', marginBottom: 4 }}>Helper text</label>
                            <input
                                data-search-field="helperText"
                                style={{ ...inputStyle, border: hasError('helperText') ? '1px solid var(--theme-error-500)' : inputStyle.border }}
                                placeholder="Helper / hint text…"
                                value={question.helperText}
                                onChange={e => setField('helperText', e.target.value)}
                            />
                            {hasError('helperText') && <div style={{ fontSize: 11, color: 'var(--theme-error-500)', marginTop: 4 }}>{getError('helperText')}</div>}
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--theme-elevation-550)', display: 'block', marginBottom: 4 }}>Example hint title</label>
                            <input
                                data-search-field="exampleHintTitle"
                                style={{ ...inputStyle }}
                                placeholder="Example answer title…"
                                value={question.exampleHintTitle}
                                onChange={e => setField('exampleHintTitle', e.target.value)}
                            />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--theme-elevation-550)', display: 'block', marginBottom: 4 }}>Example hint body</label>
                            <textarea
                                data-search-field="exampleHintBody"
                                style={{ ...inputStyle, minHeight: 96, resize: 'vertical' }}
                                placeholder="Fictional sample answer shown in the example bubble…"
                                value={question.exampleHintBody}
                                onChange={e => setField('exampleHintBody', e.target.value)}
                            />
                        </div>
                    </div>

                    {question.question_type === 'number' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--theme-elevation-550)', display: 'block' }}>Minimum value</label>
                                <select
                                    style={{ ...inputStyle }}
                                    value={question.numberMinType}
                                    onChange={e => setField('numberMinType', e.target.value as 'none' | 'custom')}
                                >
                                    <option value="none">−∞ (No minimum)</option>
                                    <option value="custom">Custom value</option>
                                </select>
                                {question.numberMinType === 'custom' && (
                                    <input
                                        type="number"
                                        style={{ ...inputStyle }}
                                        placeholder="Min value…"
                                        value={question.numberMinValue}
                                        onChange={e => setField('numberMinValue', e.target.value)}
                                    />
                                )}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--theme-elevation-550)', display: 'block' }}>Maximum value</label>
                                <select
                                    style={{ ...inputStyle }}
                                    value={question.numberMaxType}
                                    onChange={e => setField('numberMaxType', e.target.value as 'none' | 'custom')}
                                >
                                    <option value="none">+∞ (No maximum)</option>
                                    <option value="custom">Custom value</option>
                                </select>
                                {question.numberMaxType === 'custom' && (
                                    <input
                                        type="number"
                                        style={{ ...inputStyle }}
                                        placeholder="Max value…"
                                        value={question.numberMaxValue}
                                        onChange={e => setField('numberMaxValue', e.target.value)}
                                    />
                                )}
                            </div>
                        </div>
                    )}

                    {showChoices && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--theme-elevation-550)' }}>
                                    Choices ({question.choices.length})
                                </label>
                                <SmallBtn onClick={addChoice} variant="success">+ Add choice</SmallBtn>
                            </div>

                            {question.choices.length === 0 ? (
                                <p style={{ fontSize: 12, color: 'var(--theme-elevation-450)', margin: 0, fontStyle: 'italic' }}>
                                    No choices yet — click "Add choice" to add options.
                                </p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <div style={{ display: 'flex', gap: 6, paddingLeft: 36 }}>
                                        <span style={{ flex: 2, fontSize: 10, fontWeight: 600, color: 'var(--theme-elevation-450)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Label</span>
                                        <span style={{ flex: 1, fontSize: 10, fontWeight: 600, color: 'var(--theme-elevation-450)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Stored value</span>
                                        <span style={{ width: 52 }} />
                                    </div>
                                    {question.choices.map((c, i) => (
                                        <ChoiceRow
                                            key={i}
                                            choice={c}
                                            index={i}
                                            total={question.choices.length}
                                            onChange={nc => updateChoice(i, nc)}
                                            onDelete={() => deleteChoice(i)}
                                            onMove={dir => moveChoice(i, dir)}
                                            validationErrors={validationErrors.filter(e => e.path.startsWith(`${pathPrefix}.choices.${i}`))}
                                            pathPrefix={`${pathPrefix}.choices.${i}`}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

function SectionCard({ section, index, total, hasId, onChange, onDelete, onMove, validationErrors = [], pathPrefix = '', revealTarget }: {
    section: Section; index: number; total: number; hasId: boolean
    onChange: (s: Section) => void; onDelete: () => void; onMove: (dir: -1 | 1) => void
    validationErrors?: ValidationError[]; pathPrefix?: string
    revealTarget?: RevealTarget | null
}) {
    const [collapsed, setCollapsed] = useState(false)
    const cardRef = useRef<HTMLDivElement>(null)

    // Auto-expand if there are validation errors anywhere in this section
    useEffect(() => {
        if (validationErrors.length > 0) {
            setCollapsed(false)
        }
    }, [validationErrors])

    // Auto-expand and scroll when revealed via search
    useEffect(() => {
        if (revealTarget && revealTarget.sectionIdx === index) {
            setCollapsed(false)
            window.setTimeout(() => {
                if (revealTarget.questionIdx === null) {
                    const selector = `[data-search-field="${revealTarget.fieldKey}"]`
                    if (focusAndRevealElement(cardRef.current, selector, revealTarget.match, 'start')) return
                }
                cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }, 80)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [revealTarget?.key])

    const hasError = (field: string) => validationErrors.some(e => e.path === `${pathPrefix}.${field}`)
    const getError = (field: string) => validationErrors.find(e => e.path === `${pathPrefix}.${field}`)?.message

    const setField = <K extends keyof Section>(k: K, v: Section[K]) => onChange({ ...section, [k]: v })

    const addQuestion = () => setField('questions', [...section.questions, newQuestion()])
    const updateQuestion = (i: number, q: Question) => {
        const next = [...section.questions]; next[i] = q; setField('questions', next)
    }
    const deleteQuestion = (i: number) => setField('questions', section.questions.filter((_, idx) => idx !== i))
    const moveQuestion = (i: number, dir: -1 | 1) => setField('questions', moveItem(section.questions, i, i + dir))

    return (
        <div
            ref={cardRef}
            data-section-idx={index}
            style={{
                border: '2px solid var(--theme-border-color)', borderRadius: 8,
                background: 'var(--theme-elevation-0)', overflow: 'hidden',
            }}
        >
            <div style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px',
                background: 'var(--theme-elevation-100)',
                borderBottom: collapsed ? 'none' : '1px solid var(--theme-border-color)',
            }}>
                <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                    <button type="button" onClick={() => onMove(-1)} disabled={index === 0}
                        style={{ ...btn(), padding: '3px 8px', opacity: index === 0 ? 0.3 : 1 }}>▲</button>
                    <button type="button" onClick={() => onMove(1)} disabled={index === total - 1}
                        style={{ ...btn(), padding: '3px 8px', opacity: index === total - 1 ? 0.3 : 1 }}>▼</button>
                </div>

                <span style={{
                    flexShrink: 0, fontSize: 11, fontWeight: 700, background: 'var(--theme-elevation-200)',
                    color: 'var(--theme-elevation-600)', padding: '2px 8px', borderRadius: 3,
                }}>
                    Section {index + 1}
                </span>

                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    <input
                        style={{ ...inputStyle, fontWeight: 600, fontSize: 14, border: hasError('title') ? '1px solid var(--theme-error-500)' : 'transparent', background: collapsed ? undefined : 'transparent', padding: collapsed ? '7px 10px' : '4px 10px' }}
                        placeholder="Section title…"
                        value={section.title}
                        onChange={e => setField('title', e.target.value)}
                    />
                    {collapsed && hasError('title') && (
                        <span style={{ fontSize: 11, color: 'var(--theme-error-500)', paddingLeft: 10 }}>{getError('title')}</span>
                    )}
                </div>

                <span style={{ flexShrink: 0, fontSize: 11, color: 'var(--theme-elevation-450)' }}>
                    {section.questions.length} question{section.questions.length !== 1 ? 's' : ''}
                </span>

                {section.questions.length > 0 && (() => {
                    const allReq = section.questions.every(q => q.required)
                    return (
                        <SmallBtn
                            onClick={() => {
                                const next = !allReq
                                onChange({ ...section, questions: section.questions.map(q => ({ ...q, required: next })) })
                            }}
                            variant={allReq ? 'danger' : 'success'}
                            title={allReq ? 'Unmark all questions as required' : 'Mark all questions as required'}
                        >
                            {allReq ? '☆ Unrequire All' : '★ Require All'}
                        </SmallBtn>
                    )
                })()}

                <SmallBtn onClick={() => setCollapsed(v => !v)} title={collapsed ? 'Expand' : 'Collapse'}>
                    {collapsed ? '▼ Show' : '▲ Hide'}
                </SmallBtn>

                <SmallBtn onClick={onDelete} variant="danger" title="Delete section">✕ Section</SmallBtn>
            </div>

            {!collapsed && (
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: hasId ? '1fr 1fr 2fr' : '1fr 2fr', gap: 10 }}>
                        {hasId && (
                            <div>
                                <label style={{ fontSize: 11, fontWeight: 600, color: hasError('id') ? 'var(--theme-error-500)' : 'var(--theme-elevation-550)', display: 'block', marginBottom: 4 }}>Section ID</label>
                                <input
                                    data-search-field="sectionId"
                                    style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12, border: hasError('id') ? '1px solid var(--theme-error-500)' : inputStyle.border }}
                                    placeholder="e.g. demographics"
                                    value={section.sectionId}
                                    onChange={e => setField('sectionId', e.target.value)}
                                />
                                {hasError('id') && <div style={{ fontSize: 11, color: 'var(--theme-error-500)', marginTop: 4 }}>{getError('id')}</div>}
                            </div>
                        )}
                        <div>
                            <label style={{ fontSize: 11, fontWeight: 600, color: hasError('title') ? 'var(--theme-error-500)' : 'var(--theme-elevation-550)', display: 'block', marginBottom: 4 }}>Title <span style={{ color: 'var(--theme-error-500)' }}>*</span></label>
                            <input
                                data-search-field="title"
                                style={{ ...inputStyle, border: hasError('title') ? '1px solid var(--theme-error-500)' : inputStyle.border }}
                                placeholder="Section title…"
                                value={section.title}
                                onChange={e => setField('title', e.target.value)}
                            />
                            {hasError('title') && <div style={{ fontSize: 11, color: 'var(--theme-error-500)', marginTop: 4 }}>{getError('title')}</div>}
                        </div>
                        <div>
                            <label style={{ fontSize: 11, fontWeight: 600, color: hasError('description') ? 'var(--theme-error-500)' : 'var(--theme-elevation-550)', display: 'block', marginBottom: 4 }}>Description (optional)</label>
                            <input
                                data-search-field="description"
                                style={{ ...inputStyle, border: hasError('description') ? '1px solid var(--theme-error-500)' : inputStyle.border }}
                                placeholder="Shown below section heading to users…"
                                value={section.description}
                                onChange={e => setField('description', e.target.value)}
                            />
                            {hasError('description') && <div style={{ fontSize: 11, color: 'var(--theme-error-500)', marginTop: 4 }}>{getError('description')}</div>}
                        </div>
                    </div>

                    <div style={{ borderBottom: '1px solid var(--theme-border-color)', margin: '4px 0' }} />

                    {section.questions.length === 0 ? (
                        <p style={{ fontSize: 13, color: 'var(--theme-elevation-450)', margin: 0, fontStyle: 'italic', textAlign: 'center', padding: '12px 0' }}>
                            No questions yet — click "Add Question" below.
                        </p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {section.questions.map((q, qi) => (
                                <QuestionCard
                                    key={qi}
                                    question={q}
                                    index={qi}
                                    total={section.questions.length}
                                    onChange={nq => updateQuestion(qi, nq)}
                                    onDelete={() => deleteQuestion(qi)}
                                    onMove={dir => moveQuestion(qi, dir)}
                                    validationErrors={validationErrors.filter(e => e.path.startsWith(`${pathPrefix}.questions.${qi}`))}
                                    pathPrefix={`${pathPrefix}.questions.${qi}`}
                                    sectionIdx={index}
                                    revealTarget={revealTarget?.sectionIdx === index && revealTarget?.questionIdx === qi ? revealTarget : null}
                                />
                            ))}
                        </div>
                    )}

                    <div>
                        <SmallBtn onClick={addQuestion} variant="success">+ Add Question</SmallBtn>
                    </div>
                </div>
            )}
        </div>
    )
}

function FormEditor() {
    const [formTitle, setFormTitle] = useState('')
    const [formSlug, setFormSlug] = useState('')
    const [autoSlug, setAutoSlug] = useState(true)
    const [sections, setSections] = useState<Section[]>([])
    const [collectionType, setCollectionType] = useState<CollectionType>('investor-forms')
    const [formId, setFormId] = useState<string | null>(null)
    const [isCreateMode, setIsCreateMode] = useState(false)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
    const [savedAt, setSavedAt] = useState<string | null>(null)
    const [dirty, setDirty] = useState(false)
    const initialRef = useRef<string>('')
    const [importOpen, setImportOpen] = useState(false)
    const [showReferredBy, setShowReferredBy] = useState(false)
    const [allowMultipleSubmissions, setAllowMultipleSubmissions] = useState(false)

    // Search state
    const [searchOpen, setSearchOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [searchHits, setSearchHits] = useState<SearchHit[]>([])
    const [hitIdx, setHitIdx] = useState(0)
    const [revealTarget, setRevealTarget] = useState<RevealTarget | null>(null)
    const searchInputRef = useRef<HTMLInputElement>(null)
    const externalRevealAppliedRef = useRef(false)

    const hasId = collectionType === 'founder-forms'

    const getInfo = useCallback((): { collection: CollectionType; id: string | null; create: boolean } | null => {
        const parts = window.location.pathname.split('/')
        for (const col of ['investor-forms', 'founder-forms'] as CollectionType[]) {
            const idx = parts.indexOf(col)
            if (idx !== -1) {
                const next = parts[idx + 1]
                if (next === 'create') {
                    return { collection: col, id: null, create: true }
                }
                if (next && next !== 'create') {
                    return { collection: col, id: next, create: false }
                }
            }
        }
        return null
    }, [])

    useEffect(() => {
        const info = getInfo()
        if (!info) { setLoading(false); return }
        setCollectionType(info.collection)

        if (info.create) {
            setIsCreateMode(true)
            setLoading(false)
            setDirty(true)
            return
        }

        setFormId(info.id)

        fetch(`/api/${info.collection}/${info.id}?depth=0`)
            .then(r => { if (!r.ok) throw new Error('Failed to load form'); return r.json() })
            .then(data => {
                setFormTitle(data.title || '')
                setFormSlug(data.slug || '')
                setAutoSlug(false)
                setShowReferredBy(data.showReferredBy ?? false)
                setAllowMultipleSubmissions(data.allowMultipleSubmissions ?? false)
                const secs = apiToSections(data.sections || [], info.collection)
                setSections(secs)
                initialRef.current = JSON.stringify({ title: data.title, slug: data.slug, showReferredBy: data.showReferredBy ?? false, allowMultipleSubmissions: data.allowMultipleSubmissions ?? false, sections: secs })
            })
            .catch(e => setError(e.message))
            .finally(() => setLoading(false))
    }, [getInfo])

    useEffect(() => {
        if (loading || externalRevealAppliedRef.current) return
        const params = new URLSearchParams(window.location.search)
        const sectionIdxRaw = params.get('sectionIdx')
        const fieldKeyRaw = params.get('fieldKey') as SearchFieldKey | null

        if (sectionIdxRaw == null || !fieldKeyRaw) return

        const sectionIdx = Number(sectionIdxRaw)
        const questionIdxParam = params.get('questionIdx')
        const choiceIdxParam = params.get('choiceIdx')
        const match = params.get('match') || ''

        if (!Number.isInteger(sectionIdx) || sectionIdx < 0 || sectionIdx >= sections.length) return

        const questionIdx = questionIdxParam == null ? null : Number(questionIdxParam)
        if (questionIdx !== null) {
            if (!Number.isInteger(questionIdx) || questionIdx < 0 || questionIdx >= (sections[sectionIdx]?.questions.length || 0)) {
                return
            }
        }

        const choiceIdx = choiceIdxParam == null ? undefined : Number(choiceIdxParam)
        if (choiceIdx !== undefined && !Number.isInteger(choiceIdx)) return

        externalRevealAppliedRef.current = true
        setSearchOpen(true)
        setSearchTerm(match)
        setRevealTarget({
            sectionIdx,
            questionIdx,
            field: params.get('fieldLabel') || fieldKeyRaw,
            value: '',
            fieldKey: fieldKeyRaw,
            choiceIdx,
            match,
            key: Date.now(),
        })
    }, [loading, sections])

    useEffect(() => {
        if (isCreateMode) return
        const current = JSON.stringify({ title: formTitle, slug: formSlug, showReferredBy, allowMultipleSubmissions, sections })
        setDirty(current !== initialRef.current)
    }, [sections, formTitle, formSlug, showReferredBy, allowMultipleSubmissions, isCreateMode])

    const updateSection = (i: number, s: Section) => {
        setSections(prev => { const next = [...prev]; next[i] = s; return next })
    }
    const deleteSection = (i: number) => setSections(prev => prev.filter((_, idx) => idx !== i))
    const moveSection = (i: number, dir: -1 | 1) => setSections(prev => moveItem(prev, i, i + dir))
    const addSection = () => setSections(prev => [...prev, newSection(hasId)])

    const handleImport = useCallback((importedSections: Section[], suggestedTitle?: string) => {
        setSections(importedSections)
        if (suggestedTitle && !formTitle) {
            setFormTitle(suggestedTitle)
            setFormSlug(toSlug(suggestedTitle))
        }
        setDirty(true)
    }, [formTitle])

    // Ctrl+F intercept
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault()
                setSearchOpen(true)
                setTimeout(() => searchInputRef.current?.focus(), 50)
            }
            if (e.key === 'Escape') {
                setSearchOpen(false)
            }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    const runSearch = useCallback((term: string) => {
        const q = term.toLowerCase().trim()
        if (!q) { setSearchHits([]); setRevealTarget(null); return }
        const hits: SearchHit[] = []
        sections.forEach((section, si) => {
            const checkSection = (field: string, fieldKey: SearchFieldKey, value: string) => {
                if (value && value.toLowerCase().includes(q)) {
                    hits.push({ sectionIdx: si, questionIdx: null, field, fieldKey, value })
                }
            }
            checkSection('title', 'title', section.title)
            if (section.description) checkSection('description', 'description', section.description)

            section.questions.forEach((question, qi) => {
                const checkQ = (field: string, fieldKey: SearchFieldKey, value: string) => {
                    if (value && value.toLowerCase().includes(q)) {
                        hits.push({ sectionIdx: si, questionIdx: qi, field, fieldKey, value })
                    }
                }
                checkQ('question text', 'question_text', question.question_text)
                checkQ('question id', 'question_id', question.question_id)
                if (question.placeholder) checkQ('placeholder', 'placeholder', question.placeholder)
                if (question.helperText) checkQ('helper text', 'helperText', question.helperText)
                if (question.exampleHintTitle) checkQ('example hint title', 'exampleHintTitle', question.exampleHintTitle)
                if (question.exampleHintBody) checkQ('example hint body', 'exampleHintBody', question.exampleHintBody)
                question.choices.forEach((c, ci) => {
                    if (c.label && c.label.toLowerCase().includes(q)) {
                        hits.push({ sectionIdx: si, questionIdx: qi, field: `choice ${ci + 1} label`, fieldKey: 'choice_label', choiceIdx: ci, value: c.label })
                    }
                    if (c.value && c.value.toLowerCase().includes(q)) {
                        hits.push({ sectionIdx: si, questionIdx: qi, field: `choice ${ci + 1} value`, fieldKey: 'choice_value', choiceIdx: ci, value: c.value })
                    }
                })
            })
        })
        setSearchHits(hits)
        setHitIdx(0)
        if (hits.length > 0) {
            setRevealTarget({ ...hits[0], key: 0 })
        } else {
            setRevealTarget(null)
        }
    }, [sections])

    const goToHit = useCallback((i: number) => {
        const total = searchHits.length
        if (total === 0) return
        const next = ((i % total) + total) % total
        setHitIdx(next)
        setRevealTarget({ ...searchHits[next], match: searchTerm, key: next })
    }, [searchHits, searchTerm])

    const handleTitleChange = (val: string) => {
        setFormTitle(val)
        if (autoSlug || formSlug === '' || formSlug === toSlug(formTitle)) {
            setFormSlug(toSlug(val))
            setAutoSlug(true)
        }
        if (isCreateMode) setDirty(true)
    }

    const handleSlugChange = (val: string) => {
        setFormSlug(val)
        setAutoSlug(false)
        if (isCreateMode) setDirty(true)
    }

    const parseApiErrors = (body: any): { message: string; fieldErrors: ValidationError[] } => {
        const fieldErrors: ValidationError[] = []
        let message = ''

        if (body?.errors && Array.isArray(body.errors)) {
            for (const err of body.errors) {
                if (err.data?.errors && Array.isArray(err.data.errors)) {
                    for (const fe of err.data.errors) {
                        fieldErrors.push({
                            label: fe.label || fe.path || 'Unknown field',
                            message: fe.message || 'Validation error',
                            path: fe.path || '',
                        })
                    }
                }
                if (!message && err.message) {
                    message = err.message
                }
            }
        }

        if (!message && fieldErrors.length > 0) {
            message = `${fieldErrors.length} validation error${fieldErrors.length !== 1 ? 's' : ''} found`
        }

        return { message: message || 'An unknown error occurred', fieldErrors }
    }

    const handleSave = async () => {
        if (!formTitle.trim()) {
            setError('Form title is required')
            setValidationErrors([])
            return
        }
        if (!formSlug.trim()) {
            setError('Form slug is required')
            setValidationErrors([])
            return
        }

        setSaving(true)
        setError(null)
        setValidationErrors([])

        try {
            const payload: any = {
                title: formTitle,
                slug: formSlug,
                sections: sectionsToApi(sections, collectionType),
            }

            if (hasId) {
                payload.showReferredBy = showReferredBy;
            }
            payload.allowMultipleSubmissions = allowMultipleSubmissions;

            if (isCreateMode) {
                const res = await fetch(`/api/${collectionType}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                })
                if (!res.ok) {
                    const body = await res.json().catch(() => ({}))
                    const { message, fieldErrors } = parseApiErrors(body)
                    setValidationErrors(fieldErrors)
                    throw new Error(message || `Create failed (${res.status})`)
                }
                const created = await res.json()
                const newId = created.doc?.id || created.id
                if (newId) {
                    window.location.href = `/admin/collections/${collectionType}/${newId}`
                }
                return
            }

            const res = await fetch(`/api/${collectionType}/${formId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            if (!res.ok) {
                const body = await res.json().catch(() => ({}))
                const { message, fieldErrors } = parseApiErrors(body)
                setValidationErrors(fieldErrors)
                throw new Error(message || `Save failed (${res.status})`)
            }
            initialRef.current = JSON.stringify({ title: formTitle, slug: formSlug, showReferredBy, sections })
            setDirty(false)
            setSavedAt(new Date().toLocaleTimeString())
        } catch (e: any) {
            setError(e.message)
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12, color: 'var(--theme-elevation-500)' }}>
                <div style={{ width: 28, height: 28, border: '3px solid var(--theme-elevation-250)', borderTopColor: 'var(--theme-success-500)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                Loading form…
            </div>
        )
    }

    const collectionLabel = collectionType === 'founder-forms' ? 'Founder Forms' : 'Investor Forms'

    return (
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 var(--base) calc(var(--base) * 2)' }}>
            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                .fe-btn:hover:not(:disabled) { filter: brightness(0.92); }
            `}</style>

            <div style={{
                position: 'sticky', top: 0, zIndex: 20,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 0', marginBottom: 8,
                background: 'var(--theme-bg)', borderBottom: '1px solid var(--theme-border-color)',
                gap: 12, flexWrap: 'wrap',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <a
                        href={`/admin/collections/${collectionType}`}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            color: 'var(--theme-elevation-650)', textDecoration: 'none', fontSize: 13,
                        }}
                    >
                        ← {collectionLabel}
                    </a>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--theme-text)' }}>
                        {isCreateMode ? '✨ New Form' : '📝 Form Editor'}
                    </h2>
                    {dirty && !isCreateMode && (
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 3, background: 'var(--theme-warning-100)', color: 'var(--theme-warning-600)', fontWeight: 600 }}>
                            Unsaved changes
                        </span>
                    )}
                    {savedAt && !dirty && (
                        <span style={{ fontSize: 11, color: 'var(--theme-success-600)', fontWeight: 500 }}>
                            ✓ Saved at {savedAt}
                        </span>
                    )}
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: 'var(--theme-elevation-450)' }}>
                        {sections.length} section{sections.length !== 1 ? 's' : ''} · {sections.reduce((n, s) => n + s.questions.length, 0)} questions
                    </span>
                    {sections.some(s => s.questions.length > 0) && (() => {
                        const allQuestions = sections.flatMap(s => s.questions)
                        const allReq = allQuestions.length > 0 && allQuestions.every(q => q.required)
                        return (
                            <button
                                type="button"
                                onClick={() => {
                                    const next = !allReq
                                    setSections(prev => prev.map(s => ({
                                        ...s,
                                        questions: s.questions.map(q => ({ ...q, required: next })),
                                    })))
                                    setDirty(true)
                                }}
                                title={allReq ? 'Unmark all questions in entire form as required' : 'Mark all questions in entire form as required'}
                                style={{ ...btn(), padding: '6px 12px', color: allReq ? 'var(--theme-error-500)' : 'var(--theme-success-500)' }}
                            >
                                {allReq ? '☆ Unrequire All' : '★ Require All'}
                            </button>
                        )
                    })()}
                    <button
                        type="button"
                        onClick={() => setImportOpen(true)}
                        title="Import from Excel / CSV"
                        style={{ ...btn(), padding: '6px 12px' }}
                    >
                        📥 Import
                    </button>
                    <a
                        href={`/api/form-template?type=${collectionType === 'founder-forms' ? 'founder' : 'investor'}`}
                        download
                        title="Download Excel template"
                        style={{ ...btn(), padding: '6px 12px', textDecoration: 'none' }}
                    >
                        📄 Template
                    </a>
                    <button
                        type="button"
                        onClick={() => { setSearchOpen(v => !v); setTimeout(() => searchInputRef.current?.focus(), 50) }}
                        title="Search form content (Ctrl+F)"
                        style={{
                            ...btn(), padding: '6px 12px',
                            background: searchOpen ? 'var(--theme-elevation-200)' : undefined,
                        }}
                    >
                        🔍
                    </button>
                    <button
                        type="button"
                        className="fe-btn"
                        onClick={handleSave}
                        disabled={saving || (!dirty && !isCreateMode)}
                        style={{
                            padding: '8px 20px', borderRadius: 4, fontSize: 13, fontWeight: 700,
                            border: 'none', cursor: saving || (!dirty && !isCreateMode) ? 'default' : 'pointer',
                            background: saving || (!dirty && !isCreateMode) ? 'var(--theme-elevation-200)' : 'var(--theme-success-500)',
                            color: saving || (!dirty && !isCreateMode) ? 'var(--theme-elevation-500)' : '#fff',
                            transition: 'all 0.15s',
                        }}
                    >
                        {saving ? 'Saving…' : isCreateMode ? '✨ Create Form' : dirty ? '💾 Save Changes' : 'Saved'}
                    </button>
                </div>
            </div>

            {(error || validationErrors.length > 0) && (
                <div style={{
                    marginBottom: 16, padding: '14px 18px',
                    background: 'var(--theme-error-100)', border: '1px solid var(--theme-error-300)',
                    borderRadius: 6, color: 'var(--theme-error-500)',
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: validationErrors.length > 0 ? 10 : 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                                ⚠️ {error || 'Validation errors'}
                            </div>
                            {validationErrors.length > 0 && (
                                <ul style={{ margin: 0, padding: '0 0 0 18px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {validationErrors.map((ve, i) => (
                                        <li key={i} style={{ fontSize: 12, lineHeight: 1.5 }}>
                                            <span style={{ fontWeight: 600 }}>{ve.label}</span>
                                            <span style={{ color: 'var(--theme-error-400)', margin: '0 4px' }}>—</span>
                                            <span>{ve.message}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => { setError(null); setValidationErrors([]) }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-error-500)', fontSize: 16, lineHeight: 1, flexShrink: 0, padding: '2px' }}
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}

            <div style={{ marginBottom: 24, display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: validationErrors.some(e => e.path === 'title') ? 'var(--theme-error-500)' : 'var(--theme-elevation-550)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Form title <span style={{ color: 'var(--theme-error-500)' }}>*</span>
                    </label>
                    <input
                        style={{ ...inputStyle, fontSize: 16, fontWeight: 600, padding: '10px 14px', border: validationErrors.some(e => e.path === 'title') ? '1px solid var(--theme-error-500)' : inputStyle.border }}
                        placeholder="Form title…"
                        value={formTitle}
                        onChange={e => handleTitleChange(e.target.value)}
                    />
                    {validationErrors.some(e => e.path === 'title') && <div style={{ fontSize: 11, color: 'var(--theme-error-500)', marginTop: 4 }}>{validationErrors.find(e => e.path === 'title')?.message}</div>}
                </div>
                <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: validationErrors.some(e => e.path === 'slug') ? 'var(--theme-error-500)' : 'var(--theme-elevation-550)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Slug <span style={{ color: 'var(--theme-error-500)' }}>*</span>
                    </label>
                    <input
                        style={{ ...inputStyle, fontSize: 14, fontFamily: 'monospace', padding: '10px 14px', border: validationErrors.some(e => e.path === 'slug') ? '1px solid var(--theme-error-500)' : inputStyle.border }}
                        placeholder="form-slug"
                        value={formSlug}
                        onChange={e => handleSlugChange(e.target.value)}
                    />
                    {validationErrors.some(e => e.path === 'slug') && <div style={{ fontSize: 11, color: 'var(--theme-error-500)', marginTop: 4 }}>{validationErrors.find(e => e.path === 'slug')?.message}</div>}
                </div>
            </div>

            {hasId && (
                <div style={{ marginBottom: 24, padding: '16px', background: 'var(--theme-elevation-50)', border: '1px solid var(--theme-border-color)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <input
                        type="checkbox"
                        id="showReferredBy"
                        checked={showReferredBy}
                        onChange={e => {
                            setShowReferredBy(e.target.checked)
                            if (isCreateMode) setDirty(true)
                        }}
                        style={{ cursor: 'pointer', width: 16, height: 16 }}
                    />
                    <label htmlFor="showReferredBy" style={{ fontSize: 13, fontWeight: 600, color: 'var(--theme-elevation-800)', cursor: 'pointer', userSelect: 'none', margin: 0 }}>
                        Enable "Referred by partner" dropdown
                    </label>
                    <span style={{ fontSize: 12, color: 'var(--theme-elevation-400)', marginLeft: 8 }}>
                        (Allows users to select which partner referred them)
                    </span>
                </div>
            )}

            <div style={{ marginBottom: 24, padding: '16px', background: 'var(--theme-elevation-50)', border: '1px solid var(--theme-border-color)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                <input
                    type="checkbox"
                    id="allowMultipleSubmissions"
                    checked={allowMultipleSubmissions}
                    onChange={e => {
                        setAllowMultipleSubmissions(e.target.checked)
                        if (isCreateMode) setDirty(true)
                    }}
                    style={{ cursor: 'pointer', width: 16, height: 16 }}
                />
                <label htmlFor="allowMultipleSubmissions" style={{ fontSize: 13, fontWeight: 600, color: 'var(--theme-elevation-800)', cursor: 'pointer', userSelect: 'none', margin: 0 }}>
                    Allow multiple submissions
                </label>
                <span style={{ fontSize: 12, color: 'var(--theme-elevation-400)', marginLeft: 8 }}>
                    (If enabled, the same user can submit this form more than once)
                </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {sections.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--theme-elevation-450)', border: '2px dashed var(--theme-border-color)', borderRadius: 8 }}>
                        <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
                        <p style={{ margin: 0, fontSize: 14 }}>No sections yet. Add one below.</p>
                    </div>
                ) : (
                    sections.map((section, si) => (
                        <SectionCard
                            key={si}
                            section={section}
                            index={si}
                            total={sections.length}
                            hasId={hasId}
                            onChange={ns => updateSection(si, ns)}
                            onDelete={() => deleteSection(si)}
                            onMove={dir => moveSection(si, dir)}
                            validationErrors={validationErrors.filter(e => e.path.startsWith(`sections.${si}`))}
                            pathPrefix={`sections.${si}`}
                            revealTarget={revealTarget}
                        />
                    ))
                )}
            </div>

            <div style={{ marginTop: 20 }}>
                <button
                    type="button"
                    onClick={addSection}
                    style={{
                        width: '100%', padding: '12px 0', borderRadius: 6,
                        border: '2px dashed var(--theme-border-color)',
                        background: 'transparent', color: 'var(--theme-elevation-550)',
                        fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        transition: 'all 0.15s',
                    }}
                >
                    + Add Section
                </button>
            </div>

            {searchOpen && (
                <div style={{
                    position: 'fixed', top: 0, right: 0, bottom: 0, width: 340, zIndex: 100,
                    background: 'var(--theme-elevation-50)',
                    borderLeft: '2px solid var(--theme-border-color)',
                    display: 'flex', flexDirection: 'column',
                    boxShadow: '-4px 0 24px rgba(0,0,0,0.25)',
                }}>
                    <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--theme-border-color)', display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 16 }}>🔍</span>
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={searchTerm}
                            onChange={e => { setSearchTerm(e.target.value); runSearch(e.target.value) }}
                            onKeyDown={e => {
                                if (e.key === 'Enter') goToHit(hitIdx + 1)
                                if (e.key === 'Escape') setSearchOpen(false)
                                if (e.key === 'ArrowDown') { e.preventDefault(); goToHit(hitIdx + 1) }
                                if (e.key === 'ArrowUp') { e.preventDefault(); goToHit(hitIdx - 1) }
                            }}
                            placeholder="Search sections, questions, choices…"
                            style={{ ...inputStyle, flex: 1 }}
                        />
                        <button
                            type="button"
                            onClick={() => setSearchOpen(false)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-elevation-550)', fontSize: 18, padding: '2px 6px', lineHeight: 1 }}
                        >✕</button>
                    </div>

                    {searchTerm && (
                        <div style={{ padding: '8px 16px', fontSize: 12, color: 'var(--theme-elevation-500)', borderBottom: '1px solid var(--theme-border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>
                                {searchHits.length === 0
                                    ? 'No results'
                                    : `${hitIdx + 1} / ${searchHits.length}`}
                            </span>
                            {searchHits.length > 1 && (
                                <span style={{ display: 'flex', gap: 4 }}>
                                    <button type="button" onClick={() => goToHit(hitIdx - 1)} style={{ ...btn(), padding: '2px 8px' }}>▲</button>
                                    <button type="button" onClick={() => goToHit(hitIdx + 1)} style={{ ...btn(), padding: '2px 8px' }}>▼</button>
                                </span>
                            )}
                        </div>
                    )}

                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {searchHits.map((hit, i) => (
                            <button
                                key={i}
                                type="button"
                                onClick={() => goToHit(i)}
                                style={{
                                    display: 'block', width: '100%', textAlign: 'left',
                                    padding: '12px 16px',
                                    background: i === hitIdx ? 'var(--theme-elevation-150)' : 'transparent',
                                    border: 'none',
                                    borderBottom: '1px solid var(--theme-border-color)',
                                    cursor: 'pointer',
                                    color: 'var(--theme-text)',
                                }}
                            >
                                <div style={{ fontSize: 11, color: 'var(--theme-elevation-500)', marginBottom: 4 }}>
                                    Section {hit.sectionIdx + 1}
                                    {hit.questionIdx !== null && ` › Q${hit.questionIdx + 1}`}
                                    {' · '}<span style={{ fontStyle: 'italic' }}>{hit.field}</span>
                                </div>
                                <div style={{ fontSize: 13, lineHeight: 1.4 }}>
                                    {highlightSnippet(hit.value, searchTerm)}
                                </div>
                            </button>
                        ))}
                        {searchTerm && searchHits.length === 0 && (
                            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--theme-elevation-450)', fontSize: 13 }}>
                                No matches found
                            </div>
                        )}
                        {!searchTerm && (
                            <div style={{ padding: '24px 16px', color: 'var(--theme-elevation-450)', fontSize: 13 }}>
                                <div style={{ marginBottom: 8, fontWeight: 600 }}>Searches across:</div>
                                <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 2 }}>
                                    <li>Section titles &amp; descriptions</li>
                                    <li>Question text &amp; IDs</li>
                                    <li>Placeholders &amp; helper text</li>
                                    <li>All choice labels &amp; values</li>
                                </ul>
                                <div style={{ marginTop: 12, fontSize: 11, color: 'var(--theme-elevation-400)' }}>
                                    ↵ Enter or ▲▼ to navigate · Esc to close
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {importOpen && (
                <ImportPanel
                    onImport={handleImport}
                    onClose={() => setImportOpen(false)}
                    collectionType={collectionType}
                    hasId={hasId}
                />
            )}

            {(dirty || isCreateMode) && (
                <div style={{
                    position: 'fixed', bottom: 24, right: 32, zIndex: 50,
                    display: 'flex', gap: 10, alignItems: 'center',
                    padding: '12px 20px', borderRadius: 8,
                    background: 'var(--theme-elevation-900, #203e5f)',
                    boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
                    border: '1px solid var(--theme-elevation-650)',
                    color: '#fff',
                }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>
                        {isCreateMode ? 'Ready to create form' : 'You have unsaved changes'}
                    </span>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        style={{
                            padding: '7px 18px', borderRadius: 4, fontSize: 13, fontWeight: 700,
                            border: 'none', cursor: saving ? 'default' : 'pointer',
                            background: saving ? '#555' : 'var(--theme-success-500)',
                            color: '#fff',
                        }}
                    >
                        {saving ? 'Saving…' : isCreateMode ? '✨ Create' : '💾 Save'}
                    </button>
                </div>
            )}
        </div>
    )
}

export default FormEditor
