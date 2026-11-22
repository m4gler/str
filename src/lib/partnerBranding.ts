import { DEFAULT_PROGRAM_CONFIG } from '@/lib/attemptEngine'

export interface PhaseColorConfig {
    type: 'solid' | 'gradient'
    color?: string       // hex, solid
    from?: string        // hex, gradient start
    to?: string          // hex, gradient end
    angle?: number       // 0–360, default 135
}

export interface ProgramPhase {
    key: string
    label: string
    subtitle?: string
    startDay: number
    endDay: number
    color?: PhaseColorConfig
}

export interface ProgramGate {
    day: number
    label: string
}

export interface ProgramStructure {
    totalDays?: number
    programName?: string
    phases?: ProgramPhase[]
    gates?: ProgramGate[]
}

export interface BrandingColors {
    // Phase colors for default 4-phase structure (legacy, kept for backwards compat)
    mix?: PhaseColorConfig
    proof?: PhaseColorConfig
    bake?: PhaseColorConfig
    glaze?: PhaseColorConfig
    // Additional UI element colors
    dayCounter?: PhaseColorConfig   // "Day X" heading
    // Card styling
    cardBorderColor?: string        // hex, default transparent/white-10%
    // Program structure overrides
    program?: ProgramStructure
}

export type PhaseKey = 'mix' | 'proof' | 'bake' | 'glaze'

export const DEFAULT_PHASE_COLORS: Record<string, string> = {
    mix: '#2CB1A1',
    proof: '#E0C188',
    bake: '#C96A4A',
    glaze: '#E4B94D',
}

export const DEFAULT_PHASES: ProgramPhase[] = [
    { key: 'mix',   label: 'MIX',   subtitle: 'Get the ingredients right', startDay: 1,  endDay: 21  },
    { key: 'proof', label: 'PROOF', subtitle: 'Prove the dough works',      startDay: 22, endDay: 49  },
    { key: 'bake',  label: 'BAKE',  subtitle: 'Put it in the oven',         startDay: 50, endDay: 77  },
    { key: 'glaze', label: 'GLAZE', subtitle: 'Finish and serve',           startDay: 78, endDay: 100 },
]

const DEFAULT_GATE_LABELS: Record<number, string> = {
    15: 'IC Gate #1',
    30: 'IC Gate #2',
    50: 'IC Gate #3',
    70: 'IC Gate #4',
    94: 'IC Gate #5 (final internal)',
}

export const DEFAULT_GATES: ProgramGate[] = DEFAULT_PROGRAM_CONFIG.gateDays.map(day => ({
    day,
    label: `Day ${day} — ${DEFAULT_GATE_LABELS[day] ?? 'IC Gate'}`,
}))

const LEGACY_DEFAULT_GATES: ProgramGate[] = [
    { day: 30, label: 'Day 30 — First Review' },
    { day: 60, label: 'Day 60 — Mid-Program Gate' },
    { day: 100, label: 'Day 100 — Final Gate' },
]

function isLegacyDefaultGateSet(gates: ProgramGate[]): boolean {
    if (gates.length !== LEGACY_DEFAULT_GATES.length) return false

    return LEGACY_DEFAULT_GATES.every((legacyGate, index) => {
        const gate = gates[index]
        return gate?.day === legacyGate.day && gate?.label === legacyGate.label
    })
}

export function normalizeProgramGates(gates: ProgramGate[] | null | undefined): ProgramGate[] {
    if (!Array.isArray(gates) || gates.length === 0) return DEFAULT_GATES

    const normalizedGates = gates
        .filter(gate => gate && Number.isFinite(gate.day) && gate.day > 0)
        .map(gate => ({
            day: Math.round(gate.day),
            label: String(gate.label || `Day ${Math.round(gate.day)}`).trim(),
        }))

    if (normalizedGates.length === 0) return DEFAULT_GATES
    if (isLegacyDefaultGateSet(normalizedGates)) return DEFAULT_GATES

    return normalizedGates
}

export function getProgressDisplayDay(dayNumber: number, completedDays: number[] = []): number {
    const highestCompletedDay = completedDays
        .filter(day => Number.isFinite(day) && day > 0)
        .reduce((maxDay, day) => Math.max(maxDay, day), 0)

    return highestCompletedDay || dayNumber
}

/** Merges branding program structure with defaults. */
export function getEffectiveProgram(branding: BrandingColors) {
    const prog = branding.program || {}
    return {
        totalDays:   prog.totalDays   ?? 100,
        programName: prog.programName ?? '100 Days Program',
        phases:      prog.phases      ?? DEFAULT_PHASES,
        gates:       normalizeProgramGates(prog.gates),
    }
}

/**
 * Gets the PhaseColorConfig for a phase key.
 * Prioritises: program.phases[i].color > branding[phaseKey] (legacy) > undefined.
 */
export function getPhaseColorConfig(branding: BrandingColors, phaseKey: string): PhaseColorConfig | undefined {
    const cp = branding.program?.phases?.find(p => p.key === phaseKey)?.color
    if (cp) return cp
    return (branding as any)[phaseKey] as PhaseColorConfig | undefined
}

/** Solid CSS hex for text / borders. Returns `from` color when gradient. */
export function getPhaseTextColor(cfg: PhaseColorConfig | undefined, phaseKey: string): string {
    const def = DEFAULT_PHASE_COLORS[phaseKey] ?? '#2CB1A1'
    if (!cfg) return def
    if (cfg.type === 'gradient') return cfg.from || def
    return cfg.color || def
}

/** CSS `background` value — solid hex or `linear-gradient(...)`. */
export function getPhaseBackground(cfg: PhaseColorConfig | undefined, phaseKey: string): string {
    const def = DEFAULT_PHASE_COLORS[phaseKey] ?? '#2CB1A1'
    if (!cfg) return def
    if (cfg.type === 'gradient') {
        return `linear-gradient(${cfg.angle ?? 135}deg, ${cfg.from || def}, ${cfg.to || def})`
    }
    return cfg.color || def
}

/** Solid hex stop for the progress-bar gradient. */
export function getPhaseBarColor(cfg: PhaseColorConfig | undefined, phaseKey: string): string {
    return getPhaseTextColor(cfg, phaseKey)
}

export interface ProgramProgress {
    dayNumber: number
    daysRemaining: number
    totalDays: number
    programName: string
    weekNumber: number
    phases: ProgramPhase[]
    gates: ProgramGate[]
    activePhaseIndex: number
    activePhase: ProgramPhase
    phaseProgress: number
}

/** Computes the current progress state for a given day, using branding structure. */
export function computeProgramProgress(dayNumber: number, branding: BrandingColors): ProgramProgress | null {
    if (!dayNumber || dayNumber < 1) return null
    const { totalDays, programName, phases, gates } = getEffectiveProgram(branding)
    if (!phases.length) return null

    const daysRemaining = Math.max(0, totalDays - dayNumber)

    let activePhaseIndex = phases.length - 1
    for (let i = 0; i < phases.length; i++) {
        if (dayNumber <= phases[i].endDay) { activePhaseIndex = i; break }
    }
    const activePhase = phases[activePhaseIndex]
    const range = Math.max(1, activePhase.endDay - activePhase.startDay)
    const phaseProgress = (dayNumber - activePhase.startDay) / range
    const weekNumber = Math.floor((dayNumber - 1) / 7)

    return { dayNumber, daysRemaining, totalDays, programName, weekNumber, phases, gates, activePhaseIndex, activePhase, phaseProgress }
}

/** Normalise a saved BrandingColors so that phase colors live in program.phases[i].color. */
export function normaliseBranding(saved: BrandingColors | null): BrandingColors {
    const base = saved || {}
    const { totalDays, programName, phases, gates } = getEffectiveProgram(base)
    const normPhases = phases.map(ph => ({
        ...ph,
        color: getPhaseColorConfig(base, ph.key) ?? ph.color,
    }))
    return {
        dayCounter: base.dayCounter,
        cardBorderColor: base.cardBorderColor,
        program: { totalDays, programName, phases: normPhases, gates },
    }
}
