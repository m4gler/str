'use client'

import React, { useState, useCallback } from 'react'
import { CURRICULUM_SOURCE_DEFAULT_PATH } from '@/lib/curriculum/constants'

export default function DayDefinitionImporter() {
    const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
    const [result, setResult] = useState<any>(null)
    const [dragOver, setDragOver] = useState(false)

    const handleUpload = useCallback(async (file: File) => {
        setStatus('uploading')
        setResult(null)

        const formData = new FormData()
        formData.append('file', file)

        try {
            const res = await fetch('/api/curriculum-sync', {
                method: 'POST',
                body: formData,
            })
            const data = await res.json()
            if (data.success) {
                setStatus('success')
                setResult(data)
            } else {
                setStatus('error')
                setResult(data)
            }
        } catch (err: any) {
            setStatus('error')
            setResult({ error: err.message || 'Upload failed' })
        }
    }, [])

    const handleSeedFromServer = useCallback(async () => {
        setStatus('uploading')
        setResult(null)

        try {
            const res = await fetch('/api/curriculum-sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scope: 'all', refreshSnapshot: true, writeMarkdown: true, activateRelease: true }),
            })
            const data = await res.json()
            if (data.success) {
                setStatus('success')
                setResult(data)
            } else {
                setStatus('error')
                setResult(data)
            }
        } catch (err: any) {
            setStatus('error')
            setResult({ error: err.message || 'Sync failed' })
        }
    }, [])

    const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) handleUpload(file)
    }, [handleUpload])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files?.[0]
        if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
            handleUpload(file)
        }
    }, [handleUpload])

    const handleGenerateAllForms = useCallback(async () => {
        setStatus('uploading')
        setResult(null)
        try {
            const res = await fetch('/api/generate-all-day-forms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assignToSchedule: true }),
            })
            const data = await res.json()
            if (data.success) {
                setStatus('success')
                setResult(data)
            } else {
                setStatus('error')
                setResult(data)
            }
        } catch (err: any) {
            setStatus('error')
            setResult({ error: err.message || 'Form generation failed' })
        }
    }, [])

    return (
        <div style={{ padding: '20px', maxWidth: '700px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>
                Import Day Definitions from Excel
            </h2>
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>
                Upload the MESGA Master Daily Log Excel file (.xlsx) to import or update all day definitions,
                prework blocks, IC gate packs, and weekly retros. Existing blocks with the same key will be updated.
            </p>

            {/* Drop zone */}
            <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                style={{
                    border: `2px dashed ${dragOver ? '#ffcc00' : '#ddd'}`,
                    borderRadius: '12px',
                    padding: '40px 20px',
                    textAlign: 'center',
                    backgroundColor: dragOver ? '#f0f8ff' : '#fafafa',
                    marginBottom: '16px',
                    transition: 'all 0.2s',
                    cursor: 'pointer',
                }}
                onClick={() => document.getElementById('xlsx-upload')?.click()}
            >
                <input
                    id="xlsx-upload"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileInput}
                    style={{ display: 'none' }}
                />
                {status === 'uploading' ? (
                    <p style={{ color: '#ffcc00', fontWeight: '600' }}>Importing... please wait</p>
                ) : (
                    <>
                        <p style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
                            Drop .xlsx file here or click to upload
                        </p>
                        <p style={{ fontSize: '13px', color: '#999' }}>
                            Accepts: {CURRICULUM_SOURCE_DEFAULT_PATH} (curriculum sync with all variants)
                        </p>
                    </>
                )}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
                <button
                    onClick={handleSeedFromServer}
                    disabled={status === 'uploading'}
                    style={{
                        padding: '10px 20px',
                        backgroundColor: '#333',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: status === 'uploading' ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        opacity: status === 'uploading' ? 0.5 : 1,
                    }}
                >
                    1. Import Day Definitions
                </button>
                <button
                    onClick={handleGenerateAllForms}
                    disabled={status === 'uploading'}
                    style={{
                        padding: '10px 20px',
                        backgroundColor: '#ffcc00',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: status === 'uploading' ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        opacity: status === 'uploading' ? 0.5 : 1,
                    }}
                >
                    2. Generate All Forms + Assign to Schedule
                </button>
            </div>
            <p style={{ fontSize: '12px', color: '#999', marginBottom: '16px' }}>
                Step 1: Import definitions from Excel. Step 2: Generate FounderForms from those definitions and assign day blocks to the default schedule.
            </p>

            {/* Result */}
            {result && (
                <div style={{
                    padding: '16px',
                    borderRadius: '8px',
                    backgroundColor: status === 'success' ? '#f0fdf4' : '#fef2f2',
                    border: `1px solid ${status === 'success' ? '#bbf7d0' : '#fecaca'}`,
                    marginTop: '12px',
                }}>
                    {status === 'success' && (
                        <>
                            <p style={{ fontWeight: '600', color: '#166534', marginBottom: '8px' }}>{result.message}</p>
                            <ul style={{ fontSize: '13px', color: '#555', listStyle: 'disc', paddingLeft: '20px' }}>
                                <li>Created: {result.created} new blocks</li>
                                <li>Updated: {result.updated} existing blocks</li>
                                <li>Total blocks processed: {result.totalBlocks}</li>
                            </ul>
                            {result.errors && result.errors.length > 0 && (
                                <div style={{ marginTop: '12px' }}>
                                    <p style={{ fontWeight: '600', color: '#991b1b', fontSize: '13px' }}>Errors ({result.errors.length}):</p>
                                    <ul style={{ fontSize: '12px', color: '#991b1b', listStyle: 'disc', paddingLeft: '20px', maxHeight: '200px', overflow: 'auto' }}>
                                        {result.errors.map((e: string, i: number) => <li key={i}>{e}</li>)}
                                    </ul>
                                </div>
                            )}
                        </>
                    )}
                    {status === 'error' && (
                        <p style={{ fontWeight: '600', color: '#991b1b' }}>{result.error || 'Import failed'}</p>
                    )}
                </div>
            )}
        </div>
    )
}
