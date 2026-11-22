/**
 * OpenAI integration for AI-powered submission summaries.
 * Model and domain lists are configurable via DayProgram global in Payload.
 *
 * Env: OPENAI_KEY
 */

import { notifyTelegram } from '@/lib/telegram'
import { assertSafeExternalUrl } from '@/lib/networkSafety'

export interface AISummary {
  summary_3s: string
  key_output: string
  decision: 'Go' | 'Flip' | 'Kill' | 'Accelerate' | ''
  learnings: string
  mentor_ask: string
  checks_passed: boolean
  link_reachable: boolean
  generated_at: string
}

interface GenerateSummaryInput {
  dayNumber: number
  dayTitle?: string
  deliverable?: string
  definitionOfDone?: string
  submissionData: Record<string, unknown>
  excerpt?: string
  artifactUrl?: string
  linkReachable?: boolean
  checksPassed?: boolean
}

/**
 * Configuration loaded from DayProgram global. Caller fetches and passes in.
 */
export interface AIConfig {
  aiModel: string
  aiEnabled: boolean
  minExcerptLength: number
  linkCheckTimeoutMs: number
  skipReachabilityDomains: string[]
  videoDomains: string[]
  audioDomains: string[]
}

/** Default config — fallback if DayProgram is unavailable. */
export const DEFAULT_AI_CONFIG: AIConfig = {
  aiModel: 'gpt-4o-mini',
  aiEnabled: true,
  minExcerptLength: 50,
  linkCheckTimeoutMs: 5000,
  skipReachabilityDomains: ['figma.com', 'notion.so', 'notion.site', 'docs.google.com', 'drive.google.com', 'sheets.google.com', 'slides.google.com'],
  videoDomains: ['youtube.com', 'youtu.be', 'loom.com', 'vimeo.com'],
  audioDomains: ['spotify.com', 'soundcloud.com', 'anchor.fm'],
}

/**
 * Parse AIConfig from a DayProgram global document.
 */
export function parseAIConfig(dayProgram: any): AIConfig {
  return {
    aiModel: dayProgram?.aiModel || DEFAULT_AI_CONFIG.aiModel,
    aiEnabled: dayProgram?.aiEnabled ?? DEFAULT_AI_CONFIG.aiEnabled,
    minExcerptLength: dayProgram?.minExcerptLength ?? DEFAULT_AI_CONFIG.minExcerptLength,
    linkCheckTimeoutMs: dayProgram?.linkCheckTimeoutMs ?? DEFAULT_AI_CONFIG.linkCheckTimeoutMs,
    skipReachabilityDomains: Array.isArray(dayProgram?.skipReachabilityDomains) ? dayProgram.skipReachabilityDomains : DEFAULT_AI_CONFIG.skipReachabilityDomains,
    videoDomains: Array.isArray(dayProgram?.videoDomains) ? dayProgram.videoDomains : DEFAULT_AI_CONFIG.videoDomains,
    audioDomains: Array.isArray(dayProgram?.audioDomains) ? dayProgram.audioDomains : DEFAULT_AI_CONFIG.audioDomains,
  }
}

/**
 * Generate an AI summary of a founder's daily submission.
 * Returns a structured AISummary object stored in AutoCheckResult.aiSummary.
 *
 * This is NOT an evaluation — label it "AI preview, not a grade."
 */
export async function generateAISummary(
  input: GenerateSummaryInput,
  cfg: AIConfig = DEFAULT_AI_CONFIG,
): Promise<AISummary> {
  const apiKey = process.env.OPENAI_KEY
  if (!apiKey || !cfg.aiEnabled) {
    console.warn('[openai] AI summaries disabled or OPENAI_KEY not set')
    return fallbackSummary(input)
  }

  const systemPrompt = `You are an AI assistant for a startup accelerator program. Your job is to create brief summaries of founder daily submissions. These summaries help mentors quickly preview submissions before reviewing.

IMPORTANT: You are NOT grading or evaluating the work. This is a preview/summary only.

Output ONLY valid JSON matching this schema (no markdown, no code fences):
{
  "summary_3s": "Max 3 sentences — what the founder did, the result, their decision.",
  "key_output": "The single most important fact/number/quote from the submission (max 100 chars).",
  "decision": "One of: Go, Flip, Kill, Accelerate, or empty string if not stated.",
  "learnings": "Key learnings mentioned by the founder (1-2 sentences).",
  "mentor_ask": "What the founder requested from their mentor, or empty string."
}`

  const userContent = buildUserPrompt(input)

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.aiModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error(`[openai] API error ${response.status}: ${errText}`)
      await notifyTelegram('error', `OpenAI API error ${response.status}`, `Day ${input.dayNumber}\n${errText.slice(0, 500)}`)
      return fallbackSummary(input)
    }

    const data = await response.json()
    const raw = data.choices?.[0]?.message?.content?.trim()

    if (!raw) {
      console.error('[openai] Empty response from API')
      return fallbackSummary(input)
    }

    const parsed = JSON.parse(raw)

    return {
      summary_3s: String(parsed.summary_3s || ''),
      key_output: String(parsed.key_output || '').slice(0, 100),
      decision: (['Go', 'Flip', 'Kill', 'Accelerate'].includes(parsed.decision) ? parsed.decision : '') as AISummary['decision'],
      learnings: String(parsed.learnings || ''),
      mentor_ask: String(parsed.mentor_ask || ''),
      checks_passed: input.checksPassed ?? false,
      link_reachable: input.linkReachable ?? false,
      generated_at: new Date().toISOString(),
    }
  } catch (err: any) {
    console.error('[openai] Failed to generate summary:', err)
    await notifyTelegram('error', 'OpenAI summary generation failed', `Day ${input.dayNumber}\n${err?.message || String(err)}`)
    return fallbackSummary(input)
  }
}

function buildUserPrompt(input: GenerateSummaryInput): string {
  const parts: string[] = [
    `Day ${input.dayNumber}${input.dayTitle ? ` — ${input.dayTitle}` : ''}`,
  ]

  if (input.deliverable) parts.push(`Expected deliverable: ${input.deliverable}`)
  if (input.definitionOfDone) parts.push(`Definition of done: ${input.definitionOfDone}`)

  parts.push('')
  parts.push('=== SUBMISSION DATA ===')

  for (const [key, value] of Object.entries(input.submissionData)) {
    if (value !== null && value !== undefined && value !== '') {
      const display = typeof value === 'object' ? JSON.stringify(value) : String(value)
      if (display.length > 0) {
        parts.push(`${key}: ${display.slice(0, 1000)}`)
      }
    }
  }

  if (input.excerpt) {
    parts.push('')
    parts.push(`=== PASTE EXCERPT ===`)
    parts.push(input.excerpt.slice(0, 3000))
  }

  if (input.artifactUrl) {
    parts.push(`Artifact URL: ${input.artifactUrl}`)
    parts.push(`Link reachable: ${input.linkReachable ? 'yes' : 'no'}`)
  }

  return parts.join('\n')
}

function fallbackSummary(input: GenerateSummaryInput): AISummary {
  return {
    summary_3s: `Day ${input.dayNumber} submission received. AI summary unavailable — please review manually.`,
    key_output: '',
    decision: '',
    learnings: '',
    mentor_ask: '',
    checks_passed: input.checksPassed ?? false,
    link_reachable: input.linkReachable ?? false,
    generated_at: new Date().toISOString(),
  }
}

// ── Link Validation ──

/**
 * Validate a URL: check format, and optionally check reachability via HEAD request.
 * Domain lists are configurable via DayProgram global.
 */
export async function validateArtifactLink(
  url: string,
  cfg: AIConfig = DEFAULT_AI_CONFIG,
): Promise<{
  valid: boolean
  reachable: boolean | null
  proofType: string
  error?: string
}> {
  let parsed: URL
  try {
    parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, reachable: null, proofType: 'link', error: 'URL must use http or https protocol.' }
    }
  } catch {
    return { valid: false, reachable: null, proofType: 'link', error: 'Invalid URL format.' }
  }

  const hostname = parsed.hostname.toLowerCase()

  // Detect proof type from configurable domain lists
  let proofType = 'link'
  if (cfg.videoDomains.some((d) => hostname.includes(d))) proofType = 'video_link'
  if (cfg.audioDomains.some((d) => hostname.includes(d))) proofType = 'audio_link'

  // Skip reachability for configured domains
  if (cfg.skipReachabilityDomains.some((d) => hostname.includes(d))) {
    return { valid: true, reachable: null, proofType }
  }

  try {
    await assertSafeExternalUrl(parsed)
  } catch (err: any) {
    return {
      valid: false,
      reachable: null,
      proofType,
      error: err?.message || 'Private or internal network URLs are not allowed.',
    }
  }

  // HEAD request with configurable timeout
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), cfg.linkCheckTimeoutMs)

    let currentUrl = parsed
    let res: Response | null = null

    for (let redirectCount = 0; redirectCount < 3; redirectCount++) {
      res = await fetch(currentUrl, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: 'manual',
        headers: { 'User-Agent': 'MESGA-LinkChecker/1.0' },
      })

      if (res.status < 300 || res.status >= 400) {
        break
      }

      const location = res.headers.get('location')
      if (!location) {
        break
      }

      currentUrl = new URL(location, currentUrl)
      await assertSafeExternalUrl(currentUrl)
    }

    clearTimeout(timeout)

    if (!res) {
      return { valid: true, reachable: false, proofType, error: 'Could not reach the link. Please verify it is publicly accessible.' }
    }

    if (res.status >= 400) {
      return {
        valid: true,
        reachable: false,
        proofType,
        error: `Link returned HTTP ${res.status}. Please check the URL is correct and publicly accessible.`,
      }
    }

    return { valid: true, reachable: true, proofType }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return { valid: true, reachable: false, proofType, error: `Link check timed out (${cfg.linkCheckTimeoutMs}ms). The URL may be unreachable.` }
    }
    return { valid: true, reachable: false, proofType, error: 'Could not reach the link. Please verify it is publicly accessible.' }
  }
}
