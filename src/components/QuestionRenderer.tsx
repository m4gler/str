'use client';

import React, { useRef, useCallback, useState } from 'react';
import { validateFile } from '@/lib/fileValidation';

export interface UniversalQuestion {
    question_id: string;
    question_text: string;
    question_type: string;
    required?: boolean;
    choices?: { label: string; value: string }[];
    placeholder?: string;
    helperText?: string;
    exampleHintTitle?: string;
    exampleHintBody?: string;
    numberMinType?: 'none' | 'custom' | null;
    numberMinValue?: number | null;
    numberMaxType?: 'none' | 'custom' | null;
    numberMaxValue?: number | null;
    fileUploadAccept?: string;
}

interface QuestionRendererProps {
    question: UniversalQuestion;
    value: any;
    onChange: (value: any) => void;
    className?: string;
    error?: boolean;
    errorMessage?: string;
    otherValue?: string;
    onOtherChange?: (val: string) => void;
    accentColor?: string;
}

const COLOR_PRESETS: Record<string, { bg: string; border: string; text: string; shadow: string; dot: string; ring: string }> = {
    '#ffcc00': {
        bg: 'rgba(228,185,77,0.15)',
        border: '#ffcc00',
        text: '#ffcc00',
        shadow: '0 0 15px rgba(228,185,77,0.15)',
        dot: '#ffcc00',
        ring: '#ffcc00',
    },
    '#0B9DF7': {
        bg: 'rgba(255,204,0,0.15)',
        border: '#0B9DF7',
        text: '#0B9DF7',
        shadow: '0 0 15px rgba(255,204,0,0.15)',
        dot: '#0B9DF7',
        ring: '#0B9DF7',
    },
};

function getColors(accent: string) {
    if (COLOR_PRESETS[accent]) return COLOR_PRESETS[accent];
    return {
        bg: `${accent}26`,
        border: accent,
        text: accent,
        shadow: `0 0 15px ${accent}26`,
        dot: accent,
        ring: accent,
    };
}

function getStepColor(idx: number, total: number): string {
    if (total <= 1) return 'hsl(0, 0%, 50%)';
    const t = idx / (total - 1);

    // Base blue hue for all buttons
    const h = 203; // ~#0B9DF7 hue

    // Vary lightness and saturation to show progression
    // Start with lower saturation and lighter color, end with full color
    const s = Math.round(50 + (t * 45)); // 50% to 95% saturation
    const l = Math.round(70 - (t * 20)); // 70% down to 50% lightness

    return `hsl(${h}, ${s}%, ${l}%)`;
}

function RangeSlider({ question, value, onChange, colors, hasError, labelEl, containerClasses }: {
    question: UniversalQuestion;
    value: any;
    onChange: (value: any) => void;
    colors: ReturnType<typeof getColors>;
    hasError: boolean;
    labelEl: React.ReactNode;
    containerClasses: string;
}) {
    const steps = question.choices || [];
    const n = steps.length;
    const selectedIdx = steps.findIndex(c => c.value === value);

    return (
        <div className={containerClasses}>
            <div className="flex-1 mb-2">
                {labelEl}
            </div>
            <div className="shrink-0 flex flex-col justify-end w-full">
                <div style={{ paddingTop: 8, paddingBottom: 8 }}>
                    <div style={{ display: 'flex', position: 'relative', zIndex: 1, width: '100%', justifyContent: 'space-between' }}>
                        {steps.map((step, idx) => {
                            const isActive = idx === selectedIdx;
                            const stepColor = getStepColor(idx, n);

                            // Instead of text error, we outline in red if required and not selected
                            const showRedOutline = hasError && selectedIdx < 0;

                            return (
                                <button
                                    key={step.value}
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); onChange(step.value); }}
                                    style={{
                                        flex: '1 1 0', minWidth: 0, background: 'none', border: 'none',
                                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                                        cursor: 'pointer', padding: 0, gap: 10, position: 'relative'
                                    }}
                                >
                                    <div style={{
                                        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        background: isActive ? 'linear-gradient(to right, #ffcc00, #203e5f)' : 'transparent',
                                        border: showRedOutline ? '2px solid #ef4444' : isActive ? 'none' : `2px solid ${stepColor}`,
                                        opacity: selectedIdx < 0 ? 0.8 : isActive ? 1 : 0.4,
                                        transition: 'all 0.2s ease',
                                        zIndex: 2, position: 'relative',
                                        boxShadow: isActive ? '0 4px 14px 0 rgba(255,204,0, 0.39)' : 'none',
                                    }}>
                                        {isActive ? (
                                            <span style={{ color: 'white', fontWeight: 700, fontSize: 13 }}>✓</span>
                                        ) : null}
                                    </div>
                                    <span style={{
                                        fontSize: 12, lineHeight: 1.3, textAlign: 'center',
                                        fontWeight: isActive ? 700 : 400,
                                        color: isActive ? '#ffcc00' : stepColor,
                                        transition: 'color 0.2s',
                                        wordBreak: 'break-word', userSelect: 'none',
                                        opacity: selectedIdx < 0 ? 0.9 : isActive ? 1 : 0.6,
                                    }}>
                                        {step.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

export const QuestionRenderer: React.FC<QuestionRendererProps> = ({
    question,
    value,
    onChange,
    className = '',
    error = false,
    errorMessage,
    otherValue = '',
    onOtherChange,
    accentColor = '#ffcc00',
}) => {
    const { question_id, question_type, question_text, choices, placeholder, required } = question;
    const colors = getColors(accentColor);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [exampleOpen, setExampleOpen] = useState(false);

    const hasError = error || !!errorMessage;
    const exampleHintTitle = question.exampleHintTitle?.trim() || 'Example answer';
    const exampleHintBody = question.exampleHintBody?.trim() || '';
    const hasExampleHint = exampleHintBody.length > 0;

    const containerClasses = `flex flex-col h-full w-full ${className}`;
    const labelClasses = 'text-sm font-medium text-gray-300';
    const baseInputClasses = 'w-full bg-[#1C1C1E] border rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-1 transition-all duration-200 text-sm';
    const errorInputClasses = hasError
        ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500'
        : `border-white/10 focus:border-[${colors.ring}] focus:ring-[${colors.ring}]`;
    const inputClasses = `${baseInputClasses} ${errorInputClasses}`;

    const inputStyle = !hasError ? { '--tw-ring-color': colors.ring } as React.CSSProperties : undefined;
    const focusBorderStyle = !hasError ? { borderColor: undefined } : undefined;

    const errorEl = errorMessage ? (
        <p className="text-xs text-red-400 m-0">{errorMessage}</p>
    ) : null;

    const isConsent = question_id?.endsWith('_CONSENT') || question_id?.endsWith('_consent');

    if (isConsent) {
        const isChecked = value === 'Yes' || value === true;
        return (
            <div className={`flex flex-row items-start space-x-3 ${className}`}>
                <button
                    type="button"
                    onClick={() => onChange(isChecked ? null : 'Yes')}
                    className="shrink-0 w-6 h-6 rounded border flex items-center justify-center transition-all duration-200 mt-0.5"
                    style={isChecked
                        ? {
                            background: 'linear-gradient(to right, #ffcc00, #203e5f)',
                            border: 'none',
                            color: '#fff',
                            boxShadow: '0 4px 14px 0 rgba(255,204,0, 0.39)'
                        }
                        : {
                            backgroundColor: '#1C1C1E',
                            borderColor: hasError ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.2)'
                        }
                    }
                >
                    {isChecked && (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                    )}
                </button>
                <label
                    className={`text-sm text-gray-400 leading-relaxed cursor-pointer select-none ${hasError ? 'text-red-400/80' : ''}`}
                    onClick={() => onChange(isChecked ? null : 'Yes')}
                >
                    {required ? `${question_text}\u00A0` : question_text}
                    {required && <span style={{ color: colors.text }}>*</span>}
                </label>
            </div>
        );
    }

    const hasOtherChoice = choices?.some((c) => c.value === 'Other' || c.value === 'other');

    const accentStar = required ? (
        <span style={{ color: colors.text }}>*</span>
    ) : null;

    const ExampleHint = () => {
        if (!hasExampleHint) return null;

        return (
            <div className="mt-2">
                <button
                    type="button"
                    onClick={() => setExampleOpen((prev) => !prev)}
                    className="inline-flex items-center gap-2 rounded-full border border-[#ffcc00]/20 bg-[#ffcc00]/10 px-3 py-1 text-[11px] font-semibold text-[#7fc8ff] transition-colors hover:border-[#ffcc00]/35 hover:text-[#b9e2ff]"
                >
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-current text-[10px]">i</span>
                    Example answer
                </button>
                <div
                    aria-hidden={!exampleOpen}
                    className={`overflow-hidden transition-all duration-200 ${exampleOpen ? 'mt-2 max-h-72 opacity-100' : 'mt-0 max-h-0 opacity-0'}`}
                >
                    <div className="rounded-2xl border border-[#ffcc00]/15 bg-[#ffcc00]/[0.07] px-4 py-3 text-[13px] leading-relaxed text-[#d6ebff]">
                        <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.22em] text-[#7fc8ff]">
                            {exampleHintTitle}
                        </div>
                        <div className="text-[#d6ebff]/92">
                            {formatHelperLines(exampleHintBody)}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const labelEl = (
        <div>
            <label className={labelClasses}>
                {required ? `${question_text}\u00A0` : question_text}{accentStar}
            </label>
            <ExampleHint />
        </div>
    );

    const otherInput = (show: boolean) =>
        show && onOtherChange ? (
            <input
                type="text"
                className={`${baseInputClasses} border-white/10 mt-2`}
                style={{ '--tw-ring-color': colors.ring } as React.CSSProperties}
                placeholder="Please specify..."
                value={otherValue}
                onChange={(e) => onOtherChange(e.target.value)}
            />
        ) : null;

    const formatHelperLines = (text: string) => {
        const lines = text.split('\n').filter(l => l.trim())
        if (lines.length <= 1) return <span>{text}</span>
        return (
            <div className="space-y-0.5">
                {lines.map((line, i) => {
                    const trimmed = line.trim()
                    if (trimmed.startsWith('•') || trimmed.startsWith('-')) {
                        return <div key={i} className="flex gap-1.5 pl-1"><span className="text-[#ffcc00] shrink-0">•</span><span>{trimmed.replace(/^[•\-]\s*/, '')}</span></div>
                    }
                    if (trimmed.startsWith('→')) {
                        return <div key={i} className="pl-4 text-gray-500/80">{trimmed}</div>
                    }
                    if (/^[A-Z][A-Z\s—]+:/.test(trimmed) || trimmed.startsWith('IMPORTANT')) {
                        return <div key={i} className="text-[#ffcc00]/90 font-semibold mt-1.5 text-[11px] uppercase tracking-wider">{trimmed}</div>
                    }
                    const numMatch = trimmed.match(/^(\d+)\.\s(.*)/)
                    if (numMatch) {
                        return <div key={i} className="flex gap-1.5 pl-1"><span className="text-[#ffcc00] shrink-0 font-medium">{numMatch[1]}.</span><span>{numMatch[2]}</span></div>
                    }
                    return <div key={i}>{trimmed}</div>
                })}
            </div>
        )
    }

    const HelperText = ({ text }: { text: string }) => {
        const lines = text.split('\n').filter(l => l.trim())
        const isLong = lines.length > 3
        const [expanded, setExpanded] = React.useState(false)

        // Short descriptions — always show inline
        if (!isLong) {
            return (
                <div className="mt-1 text-[13px] text-gray-400 leading-relaxed">
                    {formatHelperLines(text)}
                </div>
            )
        }

        // Long descriptions — show first line + expandable
        const firstLine = lines[0].trim()
        return (
            <div className="mt-1">
                <div className="text-[13px] text-gray-400 leading-relaxed">{firstLine}</div>
                {expanded && (
                    <div className="mt-1 text-[13px] text-gray-400/80 leading-relaxed border-l-2 border-[#ffcc00]/20 pl-3 ml-0.5">
                        {formatHelperLines(lines.slice(1).join('\n'))}
                    </div>
                )}
                <button
                    type="button"
                    onClick={() => setExpanded(!expanded)}
                    className="text-[12px] text-[#ffcc00]/70 hover:text-[#ffcc00] mt-0.5 transition-colors"
                >
                    {expanded ? '— Less' : '+ Show details'}
                </button>
            </div>
        )
    }

    const renderContent = (inputNode: React.ReactNode) => (
        <div className={containerClasses} style={{ justifyContent: 'flex-end' }}>
            <div className="mb-1.5">
                {labelEl}
                {question.helperText && <HelperText text={question.helperText} />}
            </div>
            <div className="w-full mt-auto">
                {inputNode}
                <div className="min-h-5 mt-1 w-full flex items-start">
                    {errorEl}
                </div>
            </div>
        </div>
    );

    switch (question_type) {
        case 'statement': {
            // Parse structured text into readable sections
            const formatStatementText = (text: string) => {
                // Split on known section headers (e.g. "WHAT TO DO:", "HOW TO SUBMIT:", etc.)
                const headerPattern = /(?:^|\s)(YOUR MISSION[^:]*:|WHAT TO DO:|WHAT TO DELIVER:|HOW TO KNOW YOU(?:'RE|'RE| ARE) DONE:|HOW TO SUBMIT:|DELIVERABLE:|INSTRUCTIONS:)/gi
                const parts = text.split(headerPattern).filter(Boolean)

                if (parts.length <= 1) {
                    // No recognizable headers — check for numbered items
                    const hasNumberedItems = /\d+\.\s/.test(text)
                    if (hasNumberedItems) {
                        const lines = text.split(/(?=\d+\.\s)/).filter(Boolean)
                        return (
                            <div className="space-y-2">
                                {lines.map((line, i) => {
                                    const trimmed = line.trim()
                                    const numMatch = trimmed.match(/^(\d+)\.\s(.*)/)
                                    if (numMatch) {
                                        return (
                                            <div key={i} className="flex gap-3">
                                                <span className="text-[#ffcc00] font-bold text-sm shrink-0 mt-px">{numMatch[1]}.</span>
                                                <p className="text-sm text-gray-300 leading-relaxed m-0">{numMatch[2]}</p>
                                            </div>
                                        )
                                    }
                                    return <p key={i} className="text-sm text-gray-300 leading-relaxed m-0">{trimmed}</p>
                                })}
                            </div>
                        )
                    }
                    // Plain text
                    return <p className="text-sm text-gray-300 leading-relaxed m-0 whitespace-pre-wrap">{text}</p>
                }

                // Structured content with headers
                const sections: { header?: string; body: string }[] = []
                let currentHeader: string | undefined
                for (const part of parts) {
                    const trimmed = part.trim()
                    if (headerPattern.test(trimmed)) {
                        headerPattern.lastIndex = 0
                        currentHeader = trimmed.replace(/:$/, '')
                        continue
                    }
                    sections.push({ header: currentHeader, body: trimmed })
                    currentHeader = undefined
                }

                return (
                    <div className="space-y-4">
                        {sections.map((section, i) => (
                            <div key={i}>
                                {section.header && (
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#ffcc00]/70 mb-1.5">{section.header}</p>
                                )}
                                <div className="space-y-1.5">
                                    {section.body.split(/(?=\d+\.\s)|(?=→\s)/).filter(Boolean).map((line, j) => {
                                        const trimmed = line.trim()
                                        if (!trimmed) return null
                                        const numMatch = trimmed.match(/^(\d+)\.\s(.*)/)
                                        if (numMatch) {
                                            return (
                                                <div key={j} className="flex gap-3 pl-1">
                                                    <span className="text-[#ffcc00] font-bold text-sm shrink-0 mt-px">{numMatch[1]}.</span>
                                                    <p className="text-sm text-gray-300 leading-relaxed m-0">{numMatch[2]}</p>
                                                </div>
                                            )
                                        }
                                        if (trimmed.startsWith('→')) {
                                            return (
                                                <div key={j} className="flex gap-2 pl-1">
                                                    <span className="text-white/30 shrink-0">→</span>
                                                    <p className="text-sm text-gray-400 leading-relaxed m-0">{trimmed.slice(1).trim()}</p>
                                                </div>
                                            )
                                        }
                                        return <p key={j} className="text-sm text-gray-300 leading-relaxed m-0">{trimmed}</p>
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )
            }

            return (
                <div className={containerClasses}>
                    <div className="rounded-xl border border-white/[0.08] bg-[#1C1C1E]/60 px-6 py-5">
                        {formatStatementText(question_text)}
                        {question.helperText && (
                            <p className="text-xs text-gray-500 mt-3 m-0 pt-3 border-t border-white/5">{question.helperText}</p>
                        )}
                    </div>
                </div>
            );
        }

        case 'file_upload': {
            const accept = question.fileUploadAccept || '.pdf,.pptx,.ppt,.docx,.doc';
            const currentFile = value as File | string | null;
            const fileName = currentFile instanceof File ? currentFile.name : typeof currentFile === 'string' ? currentFile : null;
            const [fileError, setFileError] = useState<string | null>(null);

            return renderContent(
                <div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept={accept}
                        className="hidden"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                                const result = validateFile({ name: file.name, size: file.size, type: file.type });
                                if (!result.valid) {
                                    setFileError(result.error || 'Invalid file');
                                    e.target.value = '';
                                    return;
                                }
                                setFileError(null);
                                onChange(file);
                            }
                        }}
                    />
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className={`w-full px-4 py-4 rounded-lg border-2 border-dashed transition-all duration-200 text-sm flex flex-col items-center gap-2 ${
                            hasError || fileError ? 'border-red-500/50 bg-red-500/5' : 'border-white/10 bg-[#1C1C1E] hover:border-white/20'
                        }`}
                    >
                        {fileName ? (
                            <>
                                <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                <span className="text-gray-300">{fileName}</span>
                                <span className="text-xs text-gray-500">Click to change file</span>
                            </>
                        ) : (
                            <>
                                <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
                                <span className="text-gray-400">Click to upload file</span>
                                <span className="text-xs text-gray-600">PDF (20MB), PPTX (30MB), DOCX (10MB)</span>
                            </>
                        )}
                    </button>
                    {fileError && <p className="text-red-400 text-xs mt-2">{fileError}</p>}
                </div>
            );
        }

        case 'short_text':
            return renderContent(
                <input
                    type="text"
                    className={inputClasses}
                    placeholder={placeholder || ''}
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    required={!!required}
                />
            );

        case 'number': {
            const minAttr = question.numberMinType === 'custom' && question.numberMinValue != null
                ? question.numberMinValue
                : undefined;
            const maxAttr = question.numberMaxType === 'custom' && question.numberMaxValue != null
                ? question.numberMaxValue
                : undefined;
            return renderContent(
                <input
                    type="number"
                    className={inputClasses}
                    placeholder={placeholder || ''}
                    value={value ?? ''}
                    min={minAttr}
                    max={maxAttr}
                    onChange={(e) => onChange(e.target.value)}
                    required={!!required}
                />
            );
        }

        case 'email':
            return renderContent(
                <input
                    type="email"
                    className={inputClasses}
                    placeholder={placeholder || 'name@example.com'}
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    required={!!required}
                />
            );

        case 'url':
            return renderContent(
                <input
                    type="text"
                    className={inputClasses}
                    placeholder={placeholder || 'https://example.com'}
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    required={!!required}
                />
            );

        case 'long_text':
            return renderContent(
                <textarea
                    className={`${inputClasses} min-h-25 resize-none`}
                    placeholder={placeholder || ''}
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    required={!!required}
                />
            );

        case 'yes_no':
            return renderContent(
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                    {['Yes', 'No'].map((opt) => (
                        <button
                            key={opt}
                            type="button"
                            onClick={() => onChange(opt)}
                            className="text-left px-4 py-3 rounded-lg border transition-all duration-200 text-sm font-medium"
                            style={value === opt
                                ? { backgroundColor: colors.bg, borderColor: colors.border, color: '#fff', boxShadow: colors.shadow }
                                : { backgroundColor: '#1C1C1E', borderColor: hasError ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.1)', color: hasError ? 'rgb(254,202,202)' : 'rgb(156,163,175)' }
                            }
                        >
                            {opt}
                        </button>
                    ))}
                </div>
            );

        case 'dropdown':
        case 'multiple_choice_single': {
            const isOtherSelected = value === 'Other' || value === 'other';
            return renderContent(
                <>
                    <div className="relative w-full">
                        <select
                            className={`${inputClasses} appearance-none cursor-pointer w-full`}
                            value={value || ''}
                            onChange={(e) => onChange(e.target.value)}
                            required={!!required}
                        >
                            <option value="" disabled className="bg-[#1C1C1E] text-gray-500">Select option</option>
                            {choices?.map((choice) => (
                                <option key={choice.value} value={choice.value} className="bg-[#1C1C1E] text-white">
                                    {choice.label}
                                </option>
                            ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                        </div>
                    </div>
                    {otherInput(!!hasOtherChoice && isOtherSelected)}
                </>
            );
        }

        case 'multiple_choice_multiple': {
            const currentValues = Array.isArray(value) ? value : [];
            const isOtherSelected = currentValues.includes('Other') || currentValues.includes('other');

            const toggleValue = (val: string) => {
                if (currentValues.includes(val)) {
                    onChange(currentValues.filter((v: string) => v !== val));
                } else {
                    onChange([...currentValues, val]);
                }
            };

            return renderContent(
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                        {choices?.map((choice) => {
                            const isSelected = currentValues.includes(choice.value);
                            return (
                                <button
                                    key={choice.value}
                                    type="button"
                                    onClick={() => toggleValue(choice.value)}
                                    className="text-left px-4 py-3 rounded-lg border transition-all duration-200 text-sm font-medium flex justify-between items-center"
                                    style={isSelected
                                        ? { backgroundColor: colors.bg, borderColor: colors.border, color: '#fff', boxShadow: colors.shadow }
                                        : { backgroundColor: '#1C1C1E', borderColor: hasError ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.1)', color: hasError ? 'rgb(254,202,202)' : 'rgb(156,163,175)' }
                                    }
                                >
                                    <span>{choice.label}</span>
                                    {isSelected && (
                                        <div
                                            className="w-2 h-2 rounded-full shrink-0"
                                            style={{ backgroundColor: colors.dot, boxShadow: `0 0 5px ${colors.dot}` }}
                                        />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    {otherInput(!!hasOtherChoice && isOtherSelected)}
                </>
            );
        }

        case 'range':
        case 'opinion_scale_1_5': {
            return <RangeSlider question={question} value={value} onChange={onChange} colors={colors} hasError={hasError} labelEl={labelEl} containerClasses={containerClasses} />;
        }

        default:
            return null;
    }
};
