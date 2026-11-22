import { normalizeArchetypeKey } from '@/lib/curriculum/constants'

export interface ScoringSettings {
  EXEC_high: number
  EXEC_min: number
  ADAPT_high: number
  ES_low: number
  RT_low: number
  RT_high: number
  RT_ideal: number
  RISK_CAL_slope: number
  HONESTY_flag: number
  execWeightC: number
  execWeightSE: number
  execWeightES: number
  adaptWeightO: number
  adaptWeightE: number
  adaptWeightES: number
}

export interface RuleCondition {
  metric: string
  operator: '>=' | '<=' | '>' | '<'
  value: number
}

export interface ArchetypeRule {
  key: string
  emoji: string
  tagline: string
  matchMode: 'all' | 'any'
  rules: RuleCondition[]
}

export interface TrackRule {
  track: string
  matchMode: 'all' | 'any'
  rules: RuleCondition[]
}

export interface ScoringConfig extends ScoringSettings {
  reverseItems: Set<string>
  scaleItems: Record<string, string[]>
  archetypeRules: ArchetypeRule[]
  trackRules: TrackRule[]
}

export const DEFAULT_SETTINGS: ScoringSettings = {
  EXEC_high: 4.0,
  EXEC_min: 3.2,
  ADAPT_high: 3.9,
  ES_low: 3.0,
  RT_low: 3.0,
  RT_high: 4.4,
  RT_ideal: 3.7,
  RISK_CAL_slope: 2,
  HONESTY_flag: 2,
  execWeightC: 0.45,
  execWeightSE: 0.35,
  execWeightES: 0.2,
  adaptWeightO: 0.55,
  adaptWeightE: 0.25,
  adaptWeightES: 0.2,
}

const DEFAULT_REVERSE_ITEMS = new Set([
  'E2', 'E4', 'A2', 'C2', 'C4', 'N2', 'N4', 'O2', 'O3', 'SE4', 'RT2', 'RT4',
])

const DEFAULT_SCALE_ITEMS: Record<string, string[]> = {
  E: ['E1', 'E2', 'E3', 'E4'],
  A: ['A1', 'A2', 'A3', 'A4'],
  C: ['C1', 'C2', 'C3', 'C4'],
  N: ['N1', 'N2', 'N3', 'N4'],
  O: ['O1', 'O2', 'O3', 'O4'],
  SE: ['SE1', 'SE2', 'SE3', 'SE4', 'SE5'],
  RT: ['RT1', 'RT2', 'RT3', 'RT4', 'RT5'],
}

const DEFAULT_ARCHETYPE_RULES: ArchetypeRule[] = [
  // Evaluated in order; first match wins. Explorer (QC fail) is handled separately in calculateScores.
  { key: 'Builder', emoji: '⚒️', tagline: 'Ship It, Fix It, Ship Again', matchMode: 'all', rules: [{ metric: 'EXEC', operator: '>=', value: 4.0 }, { metric: 'ES', operator: '>=', value: 3.0 }, { metric: 'RT_DISTANCE', operator: '<=', value: 0.7 }] },
  { key: 'Driver', emoji: '⚡', tagline: 'Close Fast, Keep Leverage', matchMode: 'all', rules: [{ metric: 'E', operator: '>=', value: 3.8 }, { metric: 'EXEC', operator: '>=', value: 3.2 }, { metric: 'RT', operator: '>=', value: 3.7 }] },
  { key: 'Seeker', emoji: '🔍', tagline: "See the Market Before It's Obvious", matchMode: 'all', rules: [{ metric: 'ADAPT', operator: '>=', value: 3.9 }, { metric: 'SE', operator: '>=', value: 3.5 }, { metric: 'EXEC', operator: '>=', value: 3.2 }] },
  { key: 'Architect', emoji: '📐', tagline: 'Find the Shortcut, Stay Invisible', matchMode: 'all', rules: [{ metric: 'C', operator: '>=', value: 3.8 }, { metric: 'EXEC', operator: '>=', value: 4.0 }, { metric: 'E', operator: '<=', value: 3.2 }, { metric: 'ADAPT', operator: '>=', value: 3.0 }] },
  { key: 'Nexus', emoji: '🔗', tagline: 'Build the Hive, Trigger the Flywheel', matchMode: 'all', rules: [{ metric: 'A', operator: '>=', value: 3.8 }, { metric: 'EXEC', operator: '>=', value: 3.2 }, { metric: 'ES', operator: '>=', value: 3.0 }] },
  { key: 'Guardian', emoji: '🛡️', tagline: 'Spot Risks Early, Avoid Crashes', matchMode: 'all', rules: [{ metric: 'RT_DISTANCE', operator: '<=', value: 0.5 }, { metric: 'ES', operator: '>=', value: 3.0 }, { metric: 'EXEC', operator: '>=', value: 3.2 }] },
  { key: 'Challenger', emoji: '🚀', tagline: 'Big Engine, Big Upside', matchMode: 'all', rules: [{ metric: 'SE', operator: '>=', value: 3.8 }, { metric: 'ES', operator: '<', value: 3.0 }] },
  { key: 'Challenger', emoji: '🚀', tagline: 'Big Engine, Big Upside', matchMode: 'all', rules: [{ metric: 'SE', operator: '>=', value: 3.8 }, { metric: 'EXEC', operator: '<', value: 3.2 }] },
  { key: 'Anchor', emoji: '⚓', tagline: 'Balanced, Relentless Operator', matchMode: 'all', rules: [] },
]

const DEFAULT_TRACK_RULES: TrackRule[] = [
  { track: 'Operator Track', matchMode: 'all', rules: [{ metric: 'EXEC', operator: '>=', value: 4.0 }] },
  { track: 'Explorer Track', matchMode: 'all', rules: [{ metric: 'ADAPT', operator: '>=', value: 3.9 }] },
  { track: 'Support Track', matchMode: 'all', rules: [{ metric: 'ES', operator: '<', value: 3.0 }] },
  { track: 'Support Track', matchMode: 'all', rules: [{ metric: 'EXEC', operator: '<', value: 3.2 }] },
  { track: 'Starter Track', matchMode: 'all', rules: [] },
]

const VALUE_MAP: Record<string, number> = {
  'strongly_disagree': 1,
  'disagree': 2,
  'neither': 3,
  'neither_agree_nor_disagree': 3,
  'agree': 4,
  'strongly_agree': 5,
  '1': 1, '2': 2, '3': 3, '4': 4, '5': 5,
}

function toNumeric(val: any): number {
  if (typeof val === 'number') return val
  const mapped = VALUE_MAP[String(val).toLowerCase().trim()]
  if (mapped !== undefined) return mapped
  const num = Number(val)
  return isNaN(num) ? NaN : num
}

function reverse(v: number): number {
  return 6 - v
}

function avg(values: number[]): number {
  const valid = values.filter(v => !isNaN(v) && v >= 1 && v <= 5)
  if (valid.length === 0) return 0
  return valid.reduce((a, b) => a + b, 0) / valid.length
}

function getVal(responses: Record<string, any>, key: string, reverseItems: Set<string>): number {
  const raw = toNumeric(responses[key])
  if (isNaN(raw) || raw < 1 || raw > 5) return NaN
  return reverseItems.has(key) ? reverse(raw) : raw
}

function getVals(responses: Record<string, any>, keys: string[], reverseItems: Set<string>): number[] {
  return keys.map(k => getVal(responses, k, reverseItems))
}

export interface PersonalityScores {
  raw: {
    E: number
    A: number
    C: number
    N: number
    O: number
    SE: number
    RT: number
  }
  composite: {
    ES: number
    EXEC: number
    ADAPT: number
    RISK_CAL: number
  }
  archetype: string
  archetypeEmoji: string
  archetypeTagline: string
  track: string
  flags: {
    attn_pass: boolean
    honesty_ok: boolean
    low_ES: boolean
    low_exec: boolean
    high_risk: boolean
    low_risk: boolean
  }
}

function evaluateCondition(condition: RuleCondition, metrics: Record<string, number>): boolean {
  const metricVal = metrics[condition.metric]
  if (metricVal === undefined || isNaN(metricVal)) return false
  switch (condition.operator) {
    case '>=': return metricVal >= condition.value
    case '<=': return metricVal <= condition.value
    case '>':  return metricVal > condition.value
    case '<':  return metricVal < condition.value
    default:   return false
  }
}

function matchesRules(rules: RuleCondition[], matchMode: 'all' | 'any', metrics: Record<string, number>): boolean {
  if (rules.length === 0) return true // no rules = always matches (fallback)
  if (matchMode === 'any') {
    return rules.some(r => evaluateCondition(r, metrics))
  }
  return rules.every(r => evaluateCondition(r, metrics))
}

function determineArchetypeFromRules(
  archetypeRules: ArchetypeRule[],
  metrics: Record<string, number>,
): { key: string; emoji: string; tagline: string } {
  for (const archetype of archetypeRules) {
    if (matchesRules(archetype.rules, archetype.matchMode, metrics)) {
      return { key: archetype.key, emoji: archetype.emoji, tagline: archetype.tagline }
    }
  }
  return { key: 'Anchor', emoji: '⚓', tagline: 'Balanced, Relentless Operator' }
}

function determineTrackFromRules(
  trackRules: TrackRule[],
  metrics: Record<string, number>,
): string {
  for (const tr of trackRules) {
    if (matchesRules(tr.rules, tr.matchMode, metrics)) {
      return tr.track
    }
  }
  return 'Starter Track'
}

function parseCommaSeparated(val: string | undefined | null): string[] {
  if (!val) return []
  return val.split(',').map(s => s.trim()).filter(Boolean)
}

/** Extract full ScoringConfig from a PlatformSettings Payload global object. */
export function extractScoringConfig(platformSettings: any): Partial<ScoringConfig> {
  const p = platformSettings?.personality
  if (!p) return {}

  const ss = p.scoringSettings
  const fw = p.formulaWeights
  const result: Partial<ScoringConfig> = {}

  // Scoring thresholds
  if (ss) {
    if (typeof ss.EXEC_high === 'number') result.EXEC_high = ss.EXEC_high
    if (typeof ss.EXEC_min === 'number') result.EXEC_min = ss.EXEC_min
    if (typeof ss.ADAPT_high === 'number') result.ADAPT_high = ss.ADAPT_high
    if (typeof ss.ES_low === 'number') result.ES_low = ss.ES_low
    if (typeof ss.RT_low === 'number') result.RT_low = ss.RT_low
    if (typeof ss.RT_high === 'number') result.RT_high = ss.RT_high
    if (typeof ss.RT_ideal === 'number') result.RT_ideal = ss.RT_ideal
    if (typeof ss.RISK_CAL_slope === 'number') result.RISK_CAL_slope = ss.RISK_CAL_slope
    if (typeof ss.HONESTY_flag === 'number') result.HONESTY_flag = ss.HONESTY_flag
  }

  // Formula weights
  if (fw) {
    if (typeof fw.execWeightC === 'number') result.execWeightC = fw.execWeightC
    if (typeof fw.execWeightSE === 'number') result.execWeightSE = fw.execWeightSE
    if (typeof fw.execWeightES === 'number') result.execWeightES = fw.execWeightES
    if (typeof fw.adaptWeightO === 'number') result.adaptWeightO = fw.adaptWeightO
    if (typeof fw.adaptWeightE === 'number') result.adaptWeightE = fw.adaptWeightE
    if (typeof fw.adaptWeightES === 'number') result.adaptWeightES = fw.adaptWeightES
  }

  // Reverse items
  if (typeof p.reverseItems === 'string' && p.reverseItems.trim()) {
    result.reverseItems = new Set(parseCommaSeparated(p.reverseItems))
  }

  // Scale items
  if (p.scaleItems) {
    const si: Record<string, string[]> = {}
    let hasAny = false
    for (const scale of ['E', 'A', 'C', 'N', 'O', 'SE', 'RT']) {
      const items = parseCommaSeparated(p.scaleItems[scale])
      if (items.length > 0) {
        si[scale] = items
        hasAny = true
      }
    }
    if (hasAny) result.scaleItems = { ...DEFAULT_SCALE_ITEMS, ...si }
  }

  // Archetype rules
  if (Array.isArray(p.archetypes) && p.archetypes.length > 0) {
    const hasRules = p.archetypes.some((a: any) => Array.isArray(a.rules) && a.rules.some((r: any) => r.metric && r.operator && typeof r.value === 'number'))
    if (hasRules) {
      result.archetypeRules = p.archetypes.map((a: any) => ({
        key: normalizeArchetypeKey(a.key || 'Unknown'),
        emoji: a.emoji || '🔮',
        tagline: a.tagline || '',
        matchMode: a.matchMode === 'any' ? 'any' as const : 'all' as const,
        rules: Array.isArray(a.rules)
          ? a.rules.filter((r: any) => r.metric && r.operator && typeof r.value === 'number').map((r: any) => ({
              metric: r.metric,
              operator: r.operator,
              value: r.value,
            }))
          : [],
      }))
    }
  }

  // Track rules
  if (Array.isArray(p.trackRules) && p.trackRules.length > 0) {
    result.trackRules = p.trackRules.map((t: any) => ({
      track: t.track || 'Starter Track',
      matchMode: t.matchMode === 'any' ? 'any' as const : 'all' as const,
      rules: Array.isArray(t.rules)
        ? t.rules.filter((r: any) => r.metric && r.operator && typeof r.value === 'number').map((r: any) => ({
            metric: r.metric,
            operator: r.operator,
            value: r.value,
          }))
        : [],
    }))
  }

  return result
}

/** @deprecated Use extractScoringConfig instead */
export function extractScoringSettings(platformSettings: any): Partial<ScoringSettings> {
  return extractScoringConfig(platformSettings)
}

export function calculateScores(
  responses: Record<string, any>,
  configOverride?: Partial<ScoringConfig>,
): PersonalityScores {
  const s: ScoringSettings = { ...DEFAULT_SETTINGS, ...configOverride }
  const reverseItems = configOverride?.reverseItems ?? DEFAULT_REVERSE_ITEMS
  const scaleItems = configOverride?.scaleItems ?? DEFAULT_SCALE_ITEMS
  const archetypeRules = configOverride?.archetypeRules ?? DEFAULT_ARCHETYPE_RULES
  const trackRules = configOverride?.trackRules ?? DEFAULT_TRACK_RULES

  const attnVal = toNumeric(responses['S1_ATTN'])
  const attn_pass = attnVal >= 4 // accept Agree (4) or Strongly agree (5)
  const honestyVal = toNumeric(responses['S2_HONESTY'])
  const honesty_ok = !isNaN(honestyVal) && honestyVal > s.HONESTY_flag

  const E = avg(getVals(responses, scaleItems.E || [], reverseItems))
  const A = avg(getVals(responses, scaleItems.A || [], reverseItems))
  const C = avg(getVals(responses, scaleItems.C || [], reverseItems))
  const N = avg(getVals(responses, scaleItems.N || [], reverseItems))
  const O = avg(getVals(responses, scaleItems.O || [], reverseItems))
  const SE = avg(getVals(responses, scaleItems.SE || [], reverseItems))
  const RT = avg(getVals(responses, scaleItems.RT || [], reverseItems))

  const ES = Math.max(1, Math.min(5, 6 - N))
  const EXEC = (s.execWeightC * C) + (s.execWeightSE * SE) + (s.execWeightES * ES)
  const ADAPT = (s.adaptWeightO * O) + (s.adaptWeightE * E) + (s.adaptWeightES * ES)
  const RISK_CAL = Math.max(1, Math.min(5, 5 - (s.RISK_CAL_slope * Math.abs(RT - s.RT_ideal))))
  const RT_DISTANCE = Math.abs(RT - s.RT_ideal)

  const metrics: Record<string, number> = {
    E, A, C, N, O, SE, RT, ES, EXEC, ADAPT, RISK_CAL, RT_DISTANCE,
  }

  // Explorer: only applies when QC questions are present in the submission and fail.
  // If S1_ATTN is absent (e.g. regular intake form), skip QC gating entirely.
  const hasQC = responses['S1_ATTN'] !== undefined && responses['S1_ATTN'] !== null && responses['S1_ATTN'] !== ''
  const isExplorerFallback = hasQC && (!attn_pass || !honesty_ok)
  const archetypeResult = isExplorerFallback
    ? { key: 'Explorer', emoji: '🧭', tagline: 'Needs Calibration' }
    : determineArchetypeFromRules(archetypeRules, metrics)
  const track = isExplorerFallback ? 'Starter Track' : determineTrackFromRules(trackRules, metrics)

  return {
    raw: { E: round2(E), A: round2(A), C: round2(C), N: round2(N), O: round2(O), SE: round2(SE), RT: round2(RT) },
    composite: { ES: round2(ES), EXEC: round2(EXEC), ADAPT: round2(ADAPT), RISK_CAL: round2(RISK_CAL) },
    archetype: archetypeResult.key,
    archetypeEmoji: archetypeResult.emoji,
    archetypeTagline: archetypeResult.tagline,
    track,
    flags: {
      attn_pass,
      honesty_ok,
      low_ES: ES < s.ES_low,
      low_exec: EXEC < s.EXEC_min,
      high_risk: RT > s.RT_high,
      low_risk: RT < s.RT_low,
    },
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
