'use client';

import React, { useEffect } from 'react';
import type { PersonalityScores } from '@/lib/scoring';
import { normalizeArchetypeKey } from '@/lib/curriculum/constants';
import { buildNormalizedArchetypeMap } from '@/lib/personalityConfig';

interface Props {
    scores: PersonalityScores;
    onContinue: () => void;
    platformSettings?: any;
    isPopup?: boolean;
}

function ScoreBar({ label, value, max = 5, color }: { label: string; value: number; max?: number; color: string }) {
    const pct = Math.min(100, Math.max(0, (value / max) * 100));
    return (
        <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.8)' }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color }}>{value.toFixed(2)}</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div
                    style={{
                        height: '100%', borderRadius: 4, backgroundColor: color,
                        width: `${pct}%`, transition: 'width 1s ease-out',
                        boxShadow: `0 0 12px ${color}50`,
                    }}
                />
            </div>
        </div>
    );
}

export default function PersonalityResults({ scores, onContinue, platformSettings, isPopup }: Props) {
    useEffect(() => {
        if (!isPopup) {
            window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
        }
    }, [isPopup]);

    const p = platformSettings?.personality ?? {};
    const r = p.results ?? {};
    const tl = p.traitLabels ?? {};
    const cl = p.compositeLabels ?? {};
    const fl = p.flagLabels ?? {};
    const tn = p.trackNames ?? {};
    const archetypeKey = normalizeArchetypeKey(scores.archetype)

    // Resolve archetype metadata from Payload (source of truth).
    // scores.archetypeEmoji / archetypeTagline are minimal fallbacks stored at submit time.
    const payloadArchetypes = buildNormalizedArchetypeMap(p.archetypes)
    const pMeta = payloadArchetypes[archetypeKey] ?? {};

    const displayStrengths: string[] = pMeta.strengths?.map((s: any) => s.text).filter(Boolean) ?? [];
    const displayBlindSpots: string[] = pMeta.blindSpots?.map((s: any) => s.text).filter(Boolean) ?? [];
    const displayBestRole: string = pMeta.bestRole ?? '';
    const displayEmoji: string = pMeta.emoji || scores.archetypeEmoji;
    const displayTagline: string = pMeta.tagline || scores.archetypeTagline;

    // Track display name mapping
    const trackDisplayMap: Record<string, string> = {
        'Operator Track': tn.operatorTrack || 'Operator Track',
        'Explorer Track': tn.explorerTrack || 'Explorer Track',
        'Support Track': tn.supportTrack || 'Support Track',
        'Starter Track': tn.starterTrack || 'Starter Track',
    };
    const displayTrack = trackDisplayMap[scores.track] ?? scores.track;

    const traitColors: Record<string, string> = {
        E: '#E8A838',
        A: '#38C9E8',
        C: '#38E87A',
        N: '#E85B38',
        O: '#B038E8',
        SE: '#38E8C9',
        RT: '#E83870',
    };

    const compositeColors: Record<string, string> = {
        ES: '#38E87A',
        EXEC: '#3888E8',
        ADAPT: '#B038E8',
        RISK_CAL: '#E8A838',
    };

    const traitLabels: Record<string, string> = {
        E: tl.E || 'Extraversion',
        A: tl.A || 'Agreeableness',
        C: tl.C || 'Conscientiousness',
        N: tl.N || 'Neuroticism',
        O: tl.O || 'Openness',
        SE: tl.SE || 'Self-Efficacy',
        RT: tl.RT || 'Risk-Taking',
    };

    const compositeLabels: Record<string, string> = {
        ES: cl.ES || 'Emotional Stability',
        EXEC: cl.EXEC || 'Execution',
        ADAPT: cl.ADAPT || 'Adaptability',
        RISK_CAL: cl.RISK_CAL || 'Risk Calibration',
    };

    if (!scores.archetype) return null;

    return (
        <div style={{
            minHeight: isPopup ? 'auto' : '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: isPopup ? '20px 0' : '40px 16px', background: isPopup ? 'transparent' : '#1a2634',
        }}>
            <div style={{
                maxWidth: 640, width: '100%',
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 20, padding: '40px 32px', position: 'relative', overflow: 'hidden',
            }}>
                <div style={{
                    position: 'absolute', top: -80, right: -80, width: 250, height: 250,
                    background: 'radial-gradient(circle, rgba(255,204,0,0.12) 0%, transparent 70%)',
                    pointerEvents: 'none',
                }} />

                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <div style={{ fontSize: 64, marginBottom: 8 }}>{displayEmoji}</div>
                    <h1 style={{
                        fontSize: 28, fontWeight: 800, color: '#fff', margin: '0 0 4px',
                        background: 'linear-gradient(135deg, #ffcc00, #a855f7)',
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    }}>
                        {archetypeKey}
                    </h1>
                    <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', fontStyle: 'italic', margin: 0 }}>
                        {displayTagline}
                    </p>
                </div>

                <div style={{
                    display: 'inline-block', padding: '6px 16px', borderRadius: 20,
                    background: 'rgba(255,204,0,0.1)', border: '1px solid rgba(255,204,0,0.2)',
                    fontSize: 13, fontWeight: 600, color: '#ffcc00', marginBottom: 24,
                    width: '100%', textAlign: 'center',
                }}>
                    {displayTrack}
                </div>

                <div style={{ marginBottom: 28 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>
                        {r.coreStrengthsLabel || 'Core Strengths'}
                    </h3>
                    {displayStrengths.map((s, i) => (
                        <div key={i} style={{
                            display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start',
                        }}>
                            <span style={{ color: '#38E87A', fontSize: 14, flexShrink: 0, marginTop: 2 }}>✦</span>
                            <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>{s}</span>
                        </div>
                    ))}
                </div>

                <div style={{ marginBottom: 28 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>
                        {r.blindSpotsLabel || 'Blind Spots'}
                    </h3>
                    {displayBlindSpots.map((s, i) => (
                        <div key={i} style={{
                            display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start',
                        }}>
                            <span style={{ color: '#E8A838', fontSize: 14, flexShrink: 0, marginTop: 2 }}>⚠</span>
                            <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>{s}</span>
                        </div>
                    ))}
                </div>

                <div style={{
                    padding: '12px 16px', borderRadius: 12,
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                    marginBottom: 28,
                }}>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
                        {r.bestTeamRoleLabel || 'BEST TEAM ROLE'}
                    </span>
                    <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.85)', margin: '4px 0 0', fontWeight: 600 }}>
                        {displayBestRole}
                    </p>
                </div>

                <div style={{ marginBottom: 28 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>
                        {r.personalityTraitsLabel || 'Personality Traits'}
                    </h3>
                    {Object.entries(scores.raw).map(([key, value]) => (
                        <ScoreBar key={key} label={traitLabels[key] || key} value={value} color={traitColors[key] || '#888'} />
                    ))}
                </div>

                <div style={{ marginBottom: 32 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>
                        {r.compositeScoresLabel || 'Composite Scores'}
                    </h3>
                    {Object.entries(scores.composite).map(([key, value]) => (
                        <ScoreBar key={key} label={compositeLabels[key] || key} value={value} color={compositeColors[key] || '#888'} />
                    ))}
                </div>

                {(scores.flags.low_ES || scores.flags.low_exec || scores.flags.high_risk || scores.flags.low_risk) && (
                    <div style={{
                        padding: '12px 16px', borderRadius: 12,
                        background: 'rgba(232,88,56,0.05)', border: '1px solid rgba(232,88,56,0.15)',
                        marginBottom: 28,
                    }}>
                        <span style={{ fontSize: 12, color: '#E85B38', fontWeight: 700 }}>
                            {r.flagsLabel || 'FLAGS'}
                        </span>
                        <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {scores.flags.low_ES && <span style={flagStyle}>{fl.lowES || 'Low Emotional Stability'}</span>}
                            {scores.flags.low_exec && <span style={flagStyle}>{fl.lowExec || 'Low Execution'}</span>}
                            {scores.flags.high_risk && <span style={flagStyle}>{fl.highRisk || 'High Risk Appetite'}</span>}
                            {scores.flags.low_risk && <span style={flagStyle}>{fl.lowRisk || 'Low Risk Appetite'}</span>}
                        </div>
                    </div>
                )}

                {!isPopup && (
                    <button
                        onClick={onContinue}
                        style={{
                            width: '100%', padding: '14px 24px', borderRadius: 12,
                            background: 'linear-gradient(135deg, #ffcc00, #203e5f)',
                            color: '#fff', fontSize: 16, fontWeight: 700,
                            border: 'none', cursor: 'pointer',
                            boxShadow: '0 4px 20px rgba(255,204,0,0.3)',
                            transition: 'transform 0.2s, box-shadow 0.2s',
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(255,204,0,0.4)'; }}
                        onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(255,204,0,0.3)'; }}
                    >
                        {r.continueButtonText || 'Continue to Dashboard →'}
                    </button>
                )}
            </div>
        </div>
    );
}

const flagStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6,
    background: 'rgba(232,88,56,0.1)', color: '#E85B38', border: '1px solid rgba(232,88,56,0.2)',
};
