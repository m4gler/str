/**
 * Auto-check runner: validates artifact links and generates AI summaries
 * for daily form submissions.
 *
 * Called fire-and-forget from submitFounderForm() — never throws.
 */

import type { Payload } from 'payload'
import { parseAIConfig, validateArtifactLink, generateAISummary } from '@/lib/openai'
import { findDocumentByDownloadLocator, getDocumentLocatorFromDownloadPath, isDocumentDownloadPath } from '@/lib/documents'
import { getProofTypeFromMime } from '@/lib/fileValidation'
import { getDayType, parseProgramConfig } from '@/lib/attemptEngine'
import { resolveCurriculumContext, resolveDayDefinitionByBlockKey } from '@/lib/curriculum/resolve'

/**
 * Extract the first artifact reference found in submission data values.
 */
export function extractArtifactReference(submissionData: Record<string, unknown>): {
  value: string
  kind: 'external_url' | 'document_download'
  documentLocator?: string
} | null {
  for (const value of Object.values(submissionData)) {
    if (typeof value === 'string') {
      if (isDocumentDownloadPath(value)) {
        const documentLocator = getDocumentLocatorFromDownloadPath(value)
        if (documentLocator) {
          return {
            value,
            kind: 'document_download',
            documentLocator,
          }
        }
      }

      try {
        const url = new URL(value)
        if (isDocumentDownloadPath(url.pathname)) {
          const documentLocator = getDocumentLocatorFromDownloadPath(url.pathname)
          if (documentLocator) {
            return {
              value,
              kind: 'document_download',
              documentLocator,
            }
          }
        }

        if (url.protocol === 'http:' || url.protocol === 'https:') {
          return {
            value,
            kind: 'external_url',
          }
        }
      } catch {
        // not a URL — continue
      }
    }
  }
  return null
}

export async function runAutoCheck(
  payload: Payload,
  submissionId: string | number,
  userId: string | number,
  attemptId: string | number | undefined,
  programDay: number,
  submissionData: Record<string, unknown>,
  formId: string | number,
): Promise<void> {
  try {
    // Load AI config from DayProgram global
    const dayProgram = await payload.findGlobal({ slug: 'day-program' }).catch(() => null)
    const aiConfig = parseAIConfig(dayProgram)
    const cfg = parseProgramConfig(dayProgram)
    const dayType = getDayType(programDay, cfg)
    const blockKey = dayType === 'gate'
      ? `GATE-BLOCK-${programDay}`
      : dayType === 'retro'
        ? `WEEK-BLOCK-${Math.floor(programDay / cfg.retroEveryNDays)}`
        : `DAY-BLOCK-${programDay}`
    const curriculumContext = await resolveCurriculumContext(payload, { userId })
    const dayDef = await resolveDayDefinitionByBlockKey(payload, blockKey, curriculumContext) as any | null

    // Extract and validate artifact link
    const artifactRef = extractArtifactReference(submissionData)
    const artifactUrl = artifactRef?.value ?? null
    let linkReachable = false
    let proofType = 'text'
    let linkError: string | undefined

    if (artifactRef?.kind === 'document_download' && artifactRef.documentLocator) {
      const uploadedDocument = await findDocumentByDownloadLocator(
        payload,
        artifactRef.documentLocator,
        0,
      ) as any

      if (!uploadedDocument?.url) {
        linkError = 'Uploaded document is no longer available.'
      } else {
        linkReachable = true
        proofType = getProofTypeFromMime(uploadedDocument.mimeType || '') || 'text'
      }
    } else if (artifactUrl) {
      const linkResult = await validateArtifactLink(artifactUrl, aiConfig)
      linkReachable = linkResult.reachable === true
      proofType = linkResult.proofType
      if (linkResult.error) linkError = linkResult.error
    }

    // Basic checks passed (submission exists + optional link is valid format)
    const checksPassed = !linkError

    // Generate AI summary
    const aiSummary = await generateAISummary({
      dayNumber: programDay,
      dayTitle: dayDef?.activity || dayDef?.title || undefined,
      deliverable: dayDef?.deliverable || undefined,
      definitionOfDone: dayDef?.autoCheckCriteria || undefined,
      submissionData,
      artifactUrl: artifactUrl || undefined,
      linkReachable,
      checksPassed,
    }, aiConfig)

    // Create AutoCheckResult record
    await payload.create({
      collection: 'auto-check-results',
      data: {
        submission: Number(submissionId),
        user: Number(userId),
        ...(attemptId ? { attempt: Number(attemptId) } : {}),
        dayNumber: programDay,
        checksPassed,
        linkReachable,
        linkUrl: artifactUrl || undefined,
        proofType: proofType as any,
        aiSummary: aiSummary as unknown as Record<string, unknown>,
        autoCheckDetails: {
          linkCheck: artifactUrl ? { url: artifactUrl, reachable: linkReachable, error: linkError } : null,
        },
        errorMessage: linkError || undefined,
      },
      overrideAccess: true,
    })
  } catch (err) {
    console.error('[autoCheck] Failed:', err)
  }
}
