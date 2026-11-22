'use client'

import { useState } from 'react'
import { generateDiscountCodes } from '@/app/actions'

const inputStyle: React.CSSProperties = {
    padding: '6px 10px',
    borderRadius: '4px',
    border: '1px solid var(--theme-elevation-200)',
    background: 'var(--theme-elevation-0)',
    color: 'var(--theme-text)',
    fontSize: '13px',
}

export default function CodeGenerator() {
    const [count, setCount] = useState(10)
    const [type, setType] = useState<'percent' | 'fixed_amount'>('percent')
    const [value, setValue] = useState(20)
    const [label, setLabel] = useState('')
    const [maxUses, setMaxUses] = useState(1)
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

    async function handleGenerate() {
        if (!value || value <= 0) {
            setResult({ ok: false, message: 'Value must be greater than 0.' })
            return
        }
        if (type === 'percent' && value > 100) {
            setResult({ ok: false, message: 'Percentage cannot exceed 100.' })
            return
        }
        setLoading(true)
        setResult(null)
        try {
            const res = await generateDiscountCodes({ count, type, value, label: label || undefined, maxUses })
            setResult({ ok: true, message: `Successfully generated ${res.count} code${res.count !== 1 ? 's' : ''}.` })
        } catch (e: any) {
            setResult({ ok: false, message: `Error: ${e?.message || 'Unknown error'}` })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{
            padding: '20px 24px',
            marginBottom: '20px',
            background: 'var(--theme-elevation-50)',
            borderRadius: '4px',
            border: '1px solid var(--theme-elevation-150)',
        }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 700 }}>Bulk Code Generator</h3>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--theme-text-dim)' }}>
                        Number of codes
                    </label>
                    <input
                        type="number"
                        min={1}
                        max={1000}
                        value={count}
                        onChange={e => setCount(Math.max(1, Math.min(1000, Number(e.target.value))))}
                        style={{ ...inputStyle, width: '90px' }}
                    />
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--theme-text-dim)' }}>
                        Type
                    </label>
                    <select
                        value={type}
                        onChange={e => setType(e.target.value as 'percent' | 'fixed_amount')}
                        style={inputStyle}
                    >
                        <option value="percent">Percentage (%)</option>
                        <option value="fixed_amount">Fixed Amount (PLN)</option>
                    </select>
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--theme-text-dim)' }}>
                        {type === 'percent' ? 'Discount %' : 'Amount off (PLN)'}
                    </label>
                    <input
                        type="number"
                        min={0}
                        max={type === 'percent' ? 100 : undefined}
                        value={value}
                        onChange={e => setValue(Number(e.target.value))}
                        style={{ ...inputStyle, width: '90px' }}
                    />
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--theme-text-dim)' }}>
                        Max uses / code
                    </label>
                    <input
                        type="number"
                        min={0}
                        value={maxUses}
                        onChange={e => setMaxUses(Number(e.target.value))}
                        style={{ ...inputStyle, width: '80px' }}
                        title="0 = unlimited"
                    />
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--theme-text-dim)' }}>
                        Label (optional)
                    </label>
                    <input
                        type="text"
                        value={label}
                        onChange={e => setLabel(e.target.value)}
                        placeholder="e.g. Partner X · March 2025"
                        style={{ ...inputStyle, width: '200px' }}
                    />
                </div>
                <button
                    onClick={handleGenerate}
                    disabled={loading}
                    style={{
                        padding: '7px 18px',
                        background: loading ? 'var(--theme-elevation-200)' : '#16a34a',
                        color: loading ? 'var(--theme-text-dim)' : '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: loading ? 'default' : 'pointer',
                        fontWeight: 600,
                        fontSize: '13px',
                        transition: 'background 0.15s',
                    }}
                >
                    {loading ? 'Generating…' : 'Generate Codes'}
                </button>
            </div>
            {result && (
                <p style={{
                    marginTop: '12px',
                    marginBottom: 0,
                    fontSize: '13px',
                    color: result.ok ? '#16a34a' : '#dc2626',
                    fontWeight: 500,
                }}>
                    {result.message}
                </p>
            )}
        </div>
    )
}
