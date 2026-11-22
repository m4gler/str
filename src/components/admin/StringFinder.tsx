'use client'

import React, { useCallback, useMemo, useState } from 'react'
import {
    countTextMatches,
    findFirstTextMatch,
    findMatchesInForm,
    replaceSelectedFormMatches,
    replaceTextMatches,
    type FindOptions,
    type FormCollectionSlug,
    type FormDoc,
    type FormMatch,
    type FormTextField,
} from '@/lib/formBulkReplace'

interface SearchResult {
    label: string
    fieldLabel: string
    value: string
    href: string
}

type Mode = 'search' | 'replace'
type CollectionFilter = 'all' | FormCollectionSlug

const COLLECTIONS: Array<{ slug: FormCollectionSlug; label: string; shortLabel: string }> = [
    { slug: 'founder-forms', label: '📝 Founder Forms', shortLabel: 'Founder' },
    { slug: 'investor-forms', label: '📊 Investor Forms', shortLabel: 'Investor' },
]

const FIELD_OPTIONS: Array<{ value: FormTextField | 'all'; label: string }> = [
    { value: 'all', label: 'All text fields' },
    { value: 'question_text', label: 'Question text' },
    { value: 'helperText', label: 'Helper text' },
    { value: 'placeholder', label: 'Placeholder' },
    { value: 'question_id', label: 'Question ID' },
    { value: 'title', label: 'Section title' },
    { value: 'description', label: 'Section description' },
    { value: 'exampleHintTitle', label: 'Example hint title' },
    { value: 'exampleHintBody', label: 'Example hint body' },
    { value: 'choice_label', label: 'Choice label' },
    { value: 'choice_value', label: 'Choice stored value' },
]

const QUESTION_TYPES = [
    'short_text', 'long_text', 'email', 'url', 'number', 'dropdown',
    'multiple_choice_single', 'multiple_choice_multiple', 'yes_no', 'range',
    'statement', 'file_upload',
]

const inputStyle: React.CSSProperties = {
    width: '100%', minHeight: 42, padding: '9px 12px',
    border: '1px solid var(--theme-elevation-150)', borderRadius: 6,
    background: 'var(--theme-input-bg)', color: 'var(--theme-text)', fontSize: 14, outline: 'none',
}

const buttonStyle = (primary = false): React.CSSProperties => ({
    minHeight: 42, padding: '9px 16px',
    border: primary ? '1px solid #087fc5' : '1px solid var(--theme-elevation-200)', borderRadius: 6,
    background: primary ? '#ffcc00' : 'var(--theme-elevation-50)', color: primary ? '#fff' : 'var(--theme-text)',
    fontSize: 13, fontWeight: 700, cursor: 'pointer',
})

const fetchAllForms = async (collection: FormCollectionSlug): Promise<FormDoc[]> => {
    const docs: FormDoc[] = []
    let page = 1
    let hasNextPage = true
    while (hasNextPage) {
        const response = await fetch(`/api/${collection}?limit=100&page=${page}&depth=0&sort=title`)
        if (!response.ok) throw new Error(`Could not load ${collection} (${response.status})`)
        const data = await response.json()
        docs.push(...(data.docs || []))
        hasNextPage = Boolean(data.hasNextPage)
        page = Number(data.nextPage) || page + 1
    }
    return docs
}

const formEditorHref = (match: FormMatch) => {
    const params = new URLSearchParams({ sectionIdx: String(match.sectionIdx), fieldKey: match.field })
    if (match.questionIdx != null) params.set('questionIdx', String(match.questionIdx))
    if (match.choiceIdx != null) params.set('choiceIdx', String(match.choiceIdx))
    return `/admin/collections/${match.collectionSlug}/${match.docId}?${params.toString()}`
}

const Highlight: React.FC<{ text: string; query: string; caseSensitive?: boolean; wholeWord?: boolean }> = ({ text, query, caseSensitive, wholeWord }) => {
    const match = findFirstTextMatch(text, query, { caseSensitive, wholeWord })
    if (!match) return <>{text}</>
    const { index } = match
    const start = Math.max(0, index - 45)
    const end = Math.min(text.length, index + query.length + 90)
    return <>{start > 0 && '…'}{text.slice(start, index)}<mark style={{ background: '#ffcc00', color: '#fff', padding: '1px 3px', borderRadius: 3 }}>{text.slice(index, index + query.length)}</mark>{text.slice(index + query.length, end)}{end < text.length && '…'}</>
}

export const StringFinder: React.FC = () => {
    const [mode, setMode] = useState<Mode>('search')
    const [searchQuery, setSearchQuery] = useState('')
    const [replacement, setReplacement] = useState('')
    const [collectionFilter, setCollectionFilter] = useState<CollectionFilter>('all')
    const [fieldFilter, setFieldFilter] = useState<FormTextField | 'all'>('all')
    const [questionTypeFilter, setQuestionTypeFilter] = useState('all')
    const [formFilter, setFormFilter] = useState('')
    const [caseSensitive, setCaseSensitive] = useState(false)
    const [wholeWord, setWholeWord] = useState(false)
    const [results, setResults] = useState<SearchResult[]>([])
    const [formMatches, setFormMatches] = useState<FormMatch[]>([])
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [isSearching, setIsSearching] = useState(false)
    const [isReplacing, setIsReplacing] = useState(false)
    const [hasSearched, setHasSearched] = useState(false)
    const [searchedSignature, setSearchedSignature] = useState('')
    const [confirmOpen, setConfirmOpen] = useState(false)
    const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

    const options: FindOptions = useMemo(() => ({
        query: searchQuery, field: fieldFilter, questionType: questionTypeFilter, caseSensitive, wholeWord,
    }), [caseSensitive, fieldFilter, questionTypeFilter, searchQuery, wholeWord])
    const searchSignature = JSON.stringify({ mode, searchQuery, collectionFilter, fieldFilter, questionTypeFilter, formFilter, caseSensitive, wholeWord })
    const isSearchCurrent = searchedSignature === searchSignature

    const selectedMatches = useMemo(() => formMatches.filter(match => selected.has(match.key)), [formMatches, selected])
    const selectedOccurrences = selectedMatches.reduce((sum, match) => sum + match.occurrences, 0)
    const selectedDocuments = new Set(selectedMatches.map(match => `${match.collectionSlug}:${match.docId}`)).size

    const changeMode = (next: Mode) => {
        setMode(next); setResults([]); setFormMatches([]); setSelected(new Set()); setHasSearched(false); setSearchedSignature(''); setNotice(null)
    }

    const search = useCallback(async () => {
        if (!searchQuery) return
        setIsSearching(true); setHasSearched(true); setNotice(null)
        const foundForms: FormMatch[] = []
        const foundOther: SearchResult[] = []

        try {
            const collections = collectionFilter === 'all' ? COLLECTIONS : COLLECTIONS.filter(item => item.slug === collectionFilter)
            const loaded = await Promise.all(collections.map(async collection => ({ ...collection, docs: await fetchAllForms(collection.slug) })))
            loaded.forEach(collection => collection.docs.forEach(doc => {
                const formNeedle = formFilter.trim().toLocaleLowerCase()
                if (formNeedle && !`${doc.title || ''} ${doc.id || ''}`.toLocaleLowerCase().includes(formNeedle)) return
                foundForms.push(...findMatchesInForm(doc, collection.slug, options))
            }))

            if (mode === 'search' && collectionFilter === 'all' && fieldFilter === 'all' && questionTypeFilter === 'all' && !formFilter) {
                const searchInObject = (obj: unknown, label: string, resourceLabel: string, href: string) => {
                    if (!obj || typeof obj !== 'object') return
                    Object.entries(obj).forEach(([key, value]) => {
                        if (['id', 'createdAt', 'updatedAt', '_id', 'globalType'].includes(key)) return
                        const currentLabel = label ? `${label} → ${key}` : key
                        if (typeof value === 'string' && countTextMatches(value, searchQuery, { caseSensitive, wholeWord })) {
                            foundOther.push({ label: resourceLabel, href, fieldLabel: currentLabel, value })
                        } else if (Array.isArray(value)) {
                            value.forEach((item, index) => {
                                const itemLabel = `${currentLabel}[${index + 1}]`
                                if (typeof item === 'string' && countTextMatches(item, searchQuery, { caseSensitive, wholeWord })) {
                                    foundOther.push({ label: resourceLabel, href, fieldLabel: itemLabel, value: item })
                                } else searchInObject(item, itemLabel, resourceLabel, href)
                            })
                        } else if (typeof value === 'object') searchInObject(value, currentLabel, resourceLabel, href)
                    })
                }
                const globalResponse = await fetch('/api/globals/platform-settings')
                if (globalResponse.ok) searchInObject(await globalResponse.json(), '', '⚙️ Platform Settings', '/admin/globals/platform-settings')

                const params = new URLSearchParams({ limit: '50', depth: '0' })
                params.set('where[or][0][email][like]', searchQuery)
                params.set('where[or][1][companyName][like]', searchQuery)
                params.set('where[or][2][businessIdea][like]', searchQuery)
                const normalizedRole = searchQuery.trim().toLocaleLowerCase()
                if (['founder', 'investor', 'partner', 'mentor', 'admin'].includes(normalizedRole)) params.set('where[or][3][role][equals]', normalizedRole)
                const usersResponse = await fetch(`/api/users?${params.toString()}`)
                if (usersResponse.ok) {
                    const users = await usersResponse.json()
                    ;(users.docs || []).forEach((doc: Record<string, unknown>) => searchInObject(doc, '', `👥 Users: ${doc.email || doc.companyName || doc.id}`, `/admin/collections/users/${doc.id}`))
                }
            }

            setFormMatches(foundForms); setResults(foundOther)
            setSelected(mode === 'replace' ? new Set(foundForms.map(match => match.key)) : new Set())
            setSearchedSignature(JSON.stringify({ mode, searchQuery, collectionFilter, fieldFilter, questionTypeFilter, formFilter, caseSensitive, wholeWord }))
        } catch (error) {
            setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Search failed.' })
        } finally { setIsSearching(false) }
    }, [caseSensitive, collectionFilter, fieldFilter, formFilter, mode, options, questionTypeFilter, searchQuery, wholeWord])

    const replaceSelected = async () => {
        setConfirmOpen(false); setIsReplacing(true); setNotice(null)
        let replacedFields = 0; let replacedOccurrences = 0; let staleFields = 0
        const errors: string[] = []
        const groups = new Map<string, FormMatch[]>()
        selectedMatches.forEach(match => {
            const key = `${match.collectionSlug}:${match.docId}`
            groups.set(key, [...(groups.get(key) || []), match])
        })

        for (const matches of groups.values()) {
            const first = matches[0]
            try {
                const currentResponse = await fetch(`/api/${first.collectionSlug}/${first.docId}?depth=0`)
                if (!currentResponse.ok) throw new Error(`reload failed (${currentResponse.status})`)
                const current = await currentResponse.json() as FormDoc
                const changed = replaceSelectedFormMatches(current, matches, searchQuery, replacement, { caseSensitive, wholeWord })
                staleFields += changed.staleFields
                if (!changed.replacedFields) continue
                const saveResponse = await fetch(`/api/${first.collectionSlug}/${first.docId}`, {
                    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sections: changed.doc.sections }),
                })
                if (!saveResponse.ok) {
                    const body = await saveResponse.json().catch(() => null)
                    throw new Error(body?.errors?.[0]?.message || `save failed (${saveResponse.status})`)
                }
                replacedFields += changed.replacedFields; replacedOccurrences += changed.replacedOccurrences
            } catch (error) {
                errors.push(`${first.docTitle}: ${error instanceof Error ? error.message : 'unknown error'}`)
            }
        }
        const details = [
            `${replacedOccurrences} occurrence${replacedOccurrences === 1 ? '' : 's'} in ${replacedFields} field${replacedFields === 1 ? '' : 's'} replaced.`,
            staleFields ? `${staleFields} changed field${staleFields === 1 ? '' : 's'} skipped.` : '',
            errors.length ? `${errors.length} form${errors.length === 1 ? '' : 's'} failed: ${errors.join('; ')}` : '',
        ].filter(Boolean).join(' ')
        setIsReplacing(false)
        await search()
        setNotice({ kind: errors.length ? 'error' : 'success', text: details })
    }

    const totalCount = formMatches.length + results.length
    const toggleAll = () => setSelected(selected.size === formMatches.length ? new Set() : new Set(formMatches.map(match => match.key)))

    return (
        <div style={{ padding: '24px 20px 60px', maxWidth: 1240, margin: '0 auto' }}>
            <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#ffcc00', marginBottom: 7 }}>Content operations</div>
                <h1 style={{ fontSize: 30, lineHeight: 1.1, fontWeight: 750, margin: 0, color: 'var(--theme-text)' }}>Search &amp; Replace</h1>
                <p style={{ color: 'var(--theme-elevation-650)', fontSize: 14, margin: '9px 0 0', maxWidth: 720, lineHeight: 1.55 }}>Find content across the admin panel or safely replace selected text fields in Founder and Investor forms.</p>
            </div>

            <div style={{ display: 'inline-flex', padding: 4, borderRadius: 8, background: 'var(--theme-elevation-100)', marginBottom: 18 }}>
                {([['search', '🔍 Search everywhere'], ['replace', '⇄ Bulk replace']] as Array<[Mode, string]>).map(([value, label]) => (
                    <button key={value} type="button" onClick={() => changeMode(value)} style={{ ...buttonStyle(), minHeight: 34, padding: '6px 14px', border: 'none', background: mode === value ? 'var(--theme-elevation-0)' : 'transparent', boxShadow: mode === value ? '0 1px 4px rgba(0,0,0,.12)' : 'none' }}>{label}</button>
                ))}
            </div>

            <section style={{ border: '1px solid var(--theme-elevation-150)', borderRadius: 10, background: 'var(--theme-elevation-50)', overflow: 'hidden', marginBottom: 22 }}>
                <div className="string-finder-query" style={{ padding: 18, display: 'grid', gridTemplateColumns: mode === 'replace' ? '1fr 1fr auto' : '1fr auto', gap: 10, alignItems: 'end' }}>
                    <label><span style={{ display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 6, color: 'var(--theme-elevation-650)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Find</span><input value={searchQuery} onChange={event => setSearchQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') search() }} placeholder="Text to find…" style={{ ...inputStyle, fontSize: 16 }} /></label>
                    {mode === 'replace' && <label><span style={{ display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 6, color: 'var(--theme-elevation-650)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Replace with</span><input value={replacement} onChange={event => setReplacement(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') search() }} placeholder="Leave empty to remove text" style={{ ...inputStyle, fontSize: 16 }} /></label>}
                    <button type="button" onClick={search} disabled={isSearching || !searchQuery} style={{ ...buttonStyle(true), opacity: isSearching || !searchQuery ? .55 : 1 }}>{isSearching ? 'Searching…' : 'Find matches'}</button>
                </div>

                <div className="string-finder-filters" style={{ padding: '14px 18px 18px', borderTop: '1px solid var(--theme-elevation-100)', display: 'grid', gridTemplateColumns: 'repeat(4, minmax(150px, 1fr))', gap: 12 }}>
                    <label><span style={{ display: 'block', fontSize: 11, marginBottom: 5, color: 'var(--theme-elevation-600)' }}>Collection</span><select value={collectionFilter} onChange={event => setCollectionFilter(event.target.value as CollectionFilter)} style={inputStyle}><option value="all">Founder + Investor forms</option><option value="founder-forms">Founder Forms</option><option value="investor-forms">Investor Forms</option></select></label>
                    <label><span style={{ display: 'block', fontSize: 11, marginBottom: 5, color: 'var(--theme-elevation-600)' }}>Field</span><select value={fieldFilter} onChange={event => setFieldFilter(event.target.value as FormTextField | 'all')} style={inputStyle}>{FIELD_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                    <label><span style={{ display: 'block', fontSize: 11, marginBottom: 5, color: 'var(--theme-elevation-600)' }}>Question type</span><select value={questionTypeFilter} onChange={event => setQuestionTypeFilter(event.target.value)} style={inputStyle}><option value="all">All question types</option>{QUESTION_TYPES.map(type => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}</select></label>
                    <label><span style={{ display: 'block', fontSize: 11, marginBottom: 5, color: 'var(--theme-elevation-600)' }}>Specific form</span><input value={formFilter} onChange={event => setFormFilter(event.target.value)} placeholder="Title or ID" style={inputStyle} /></label>
                </div>
                <div style={{ padding: '0 18px 16px', display: 'flex', gap: 18, color: 'var(--theme-elevation-650)', fontSize: 12, flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}><input type="checkbox" checked={caseSensitive} onChange={event => setCaseSensitive(event.target.checked)} /> Match case</label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}><input type="checkbox" checked={wholeWord} onChange={event => setWholeWord(event.target.checked)} /> Whole words only</label>
                    {mode === 'search' && <span style={{ marginLeft: 'auto' }}>Platform Settings and Users are included only when no form filters are active.</span>}
                </div>
            </section>

            {notice && <div style={{ padding: '12px 15px', marginBottom: 18, borderRadius: 7, border: `1px solid var(--theme-${notice.kind === 'success' ? 'success' : 'error'}-300)`, background: `var(--theme-${notice.kind === 'success' ? 'success' : 'error'}-100)`, color: `var(--theme-${notice.kind === 'success' ? 'success' : 'error'}-600)`, fontSize: 13, lineHeight: 1.5 }}>{notice.kind === 'success' ? '✓ ' : '⚠ '}{notice.text}</div>}
            {hasSearched && !isSearchCurrent && <div style={{ padding: '10px 14px', marginBottom: 14, borderRadius: 7, background: 'var(--theme-warning-100)', color: 'var(--theme-warning-600)', fontSize: 12 }}>⚠ Search criteria changed. Run Find matches again before replacing.</div>}

            {hasSearched && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 12 }}>
                <div style={{ color: 'var(--theme-elevation-650)', fontSize: 13 }}><strong style={{ color: 'var(--theme-text)' }}>{totalCount}</strong> matching field{totalCount === 1 ? '' : 's'}{mode === 'replace' && <> · <strong style={{ color: 'var(--theme-text)' }}>{selected.size}</strong> selected</>}</div>
                {mode === 'replace' && formMatches.length > 0 && <div style={{ display: 'flex', gap: 8 }}><button type="button" onClick={toggleAll} style={{ ...buttonStyle(), minHeight: 34, padding: '5px 11px' }}>{selected.size === formMatches.length ? 'Clear selection' : 'Select all'}</button><button type="button" onClick={() => setConfirmOpen(true)} disabled={!selected.size || isReplacing || searchQuery === replacement || !isSearchCurrent} style={{ ...buttonStyle(true), minHeight: 34, padding: '5px 13px', opacity: !selected.size || isReplacing || searchQuery === replacement || !isSearchCurrent ? .5 : 1 }}>{isReplacing ? 'Replacing…' : `Review & replace (${selectedOccurrences})`}</button></div>}
            </div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {formMatches.map(match => {
                    const checked = selected.has(match.key)
                    const collection = COLLECTIONS.find(item => item.slug === match.collectionSlug)!
                    return <div key={match.key} style={{ display: 'grid', gridTemplateColumns: mode === 'replace' ? '34px 1fr' : '1fr', border: `1px solid ${checked ? '#ffcc00' : 'var(--theme-elevation-125)'}`, borderRadius: 8, background: 'var(--theme-elevation-0)', overflow: 'hidden' }}>
                        {mode === 'replace' && <label style={{ display: 'flex', justifyContent: 'center', paddingTop: 17, background: checked ? 'rgba(255,204,0,.09)' : 'var(--theme-elevation-50)', cursor: 'pointer' }}><input type="checkbox" checked={checked} onChange={() => setSelected(current => { const next = new Set(current); if (next.has(match.key)) next.delete(match.key); else next.add(match.key); return next })} /></label>}
                        <div style={{ padding: '13px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 7, marginBottom: 7 }}><span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', padding: '3px 7px', background: match.collectionSlug === 'founder-forms' ? '#ffcc00' : '#7656d6', color: '#fff', borderRadius: 3 }}>{collection.shortLabel}</span><strong style={{ fontSize: 13 }}>{match.docTitle}</strong><span style={{ fontSize: 11, color: 'var(--theme-elevation-550)' }}>{match.fieldLabel}</span>{match.questionType && <code style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--theme-elevation-550)' }}>{match.questionType}</code>}</div>
                            <div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--theme-text)' }}><Highlight text={match.value} query={searchQuery} caseSensitive={caseSensitive} wholeWord={wholeWord} /></div>
                            {mode === 'replace' && <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--theme-elevation-150)', display: 'grid', gridTemplateColumns: '38px 1fr auto', gap: 8, fontSize: 12, lineHeight: 1.5, color: 'var(--theme-elevation-650)' }}><span style={{ fontWeight: 800, color: 'var(--theme-success-500)' }}>NEW</span><span>{replaceTextMatches(match.value, searchQuery, replacement, { caseSensitive, wholeWord }) || <em>empty</em>}</span><span>{match.occurrences} occurrence{match.occurrences === 1 ? '' : 's'}</span></div>}
                            <a href={formEditorHref(match)} style={{ display: 'inline-block', marginTop: 8, color: '#ffcc00', fontSize: 11, textDecoration: 'none' }}>Open field ↗</a>
                        </div>
                    </div>
                })}

                {results.map((result, index) => <a key={`${result.href}:${result.fieldLabel}:${index}`} href={result.href} style={{ display: 'block', padding: '14px 16px', background: 'var(--theme-elevation-0)', border: '1px solid var(--theme-elevation-125)', borderRadius: 8, color: 'var(--theme-text)', textDecoration: 'none' }}><div style={{ display: 'flex', gap: 8, marginBottom: 7, alignItems: 'center' }}><span style={{ fontSize: 10, padding: '3px 7px', background: 'var(--theme-elevation-200)', borderRadius: 3, fontWeight: 700 }}>{result.label}</span><span style={{ fontSize: 11, color: 'var(--theme-elevation-600)' }}>{result.fieldLabel}</span></div><div style={{ fontSize: 13, lineHeight: 1.5 }}><Highlight text={result.value} query={searchQuery} caseSensitive={caseSensitive} wholeWord={wholeWord} /></div></a>)}

                {hasSearched && totalCount === 0 && !isSearching && <div style={{ padding: '46px 20px', textAlign: 'center', color: 'var(--theme-elevation-550)', border: '1px dashed var(--theme-elevation-200)', borderRadius: 9 }}><div style={{ fontSize: 25, marginBottom: 8 }}>∅</div><div style={{ fontSize: 14, fontWeight: 700, color: 'var(--theme-text)' }}>No matching fields</div><div style={{ fontSize: 12, marginTop: 5 }}>Change the phrase or widen the filters.</div></div>}
            </div>

            {confirmOpen && <div role="dialog" aria-modal="true" aria-labelledby="replace-confirm-title" style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'grid', placeItems: 'center', padding: 20, background: 'rgba(0,0,0,.62)', backdropFilter: 'blur(3px)' }}><div style={{ width: 'min(560px, 100%)', borderRadius: 10, border: '1px solid var(--theme-elevation-200)', background: 'var(--theme-elevation-0)', boxShadow: '0 24px 80px rgba(0,0,0,.4)', overflow: 'hidden' }}><div style={{ height: 5, background: '#ffcc00' }} /><div style={{ padding: 24 }}><div style={{ fontSize: 11, fontWeight: 800, color: '#ffcc00', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 8 }}>Final check</div><h2 id="replace-confirm-title" style={{ margin: 0, fontSize: 22 }}>Replace {selectedOccurrences} occurrence{selectedOccurrences === 1 ? '' : 's'}?</h2><p style={{ color: 'var(--theme-elevation-650)', fontSize: 13, lineHeight: 1.55, margin: '10px 0 18px' }}>This will update {selectedMatches.length} field{selectedMatches.length === 1 ? '' : 's'} in {selectedDocuments} form{selectedDocuments === 1 ? '' : 's'}. Fields changed by another editor since this search will be skipped.</p><div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 10, alignItems: 'center', padding: 14, borderRadius: 7, background: 'var(--theme-elevation-50)', fontSize: 13 }}><code style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{searchQuery}</code><span style={{ color: '#ffcc00', fontWeight: 800 }}>→</span><code style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{replacement || <em>empty</em>}</code></div><div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9, marginTop: 22 }}><button type="button" onClick={() => setConfirmOpen(false)} style={buttonStyle()}>Cancel</button><button type="button" onClick={replaceSelected} style={buttonStyle(true)}>Confirm replacement</button></div></div></div></div>}

            <style>{`@media (max-width: 850px) { .string-finder-query { grid-template-columns: 1fr !important; } .string-finder-filters { grid-template-columns: 1fr 1fr !important; } } @media (max-width: 560px) { .string-finder-filters { grid-template-columns: 1fr !important; } }`}</style>
        </div>
    )
}

export default StringFinder
