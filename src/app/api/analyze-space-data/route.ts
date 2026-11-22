import { getPayload } from 'payload'
import config from '@/payload.config'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { analyzeSpaceDataRelevance, buildSpaceDataConfig } from '@/lib/copernicus'
import { isSpaceTrackSlug } from '@/lib/availableTracks'

function getRelationId(value: unknown): number | string | null {
  if (typeof value === 'number' || typeof value === 'string') return value
  if (!value || typeof value !== 'object') return null

  const id = (value as { id?: unknown }).id
  return typeof id === 'number' || typeof id === 'string' ? id : null
}

async function resolveTrackSlug(payload: any, track: unknown): Promise<string | null> {
  if (track && typeof track === 'object') {
    if ((track as { isActive?: unknown }).isActive === false) return null
    const slug = (track as { slug?: unknown }).slug
    if (typeof slug === 'string') return slug
  }

  const trackId = getRelationId(track)
  if (trackId == null) return null

  const trackDoc = await payload.findByID({
    collection: 'tracks',
    id: trackId,
    depth: 0,
  }).catch(() => null) as { isActive?: unknown; slug?: unknown } | null

  return trackDoc?.isActive !== false && typeof trackDoc?.slug === 'string' ? trackDoc.slug : null
}

function normalizeProjectDescription(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * POST /api/analyze-space-data
 *
 * Triggers Copernicus STAC API analysis for a project submission.
 * Can be called:
 *   - Automatically when a space-track submission is filled or changes (afterChange hook)
 *   - Manually by admin from the admin panel
 *
 * Body: { projectSubmissionId: number }
 * Auth: requires admin role
 */
export async function POST(request: Request) {
  const payload = await getPayload({ config })
  const headersObj = await headers()

  // Auth check
  const { user } = await payload.auth({ headers: headersObj })
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const { projectSubmissionId } = body

  if (!projectSubmissionId) {
    return NextResponse.json({ error: 'projectSubmissionId required' }, { status: 400 })
  }

  try {
    // Fetch the project submission with user data
    const submission = await payload.findByID({
      collection: 'project-submissions',
      id: projectSubmissionId,
      depth: 1,
    }) as any

    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    }

    const trackSlug = await resolveTrackSlug(payload, submission.track)
    if (!isSpaceTrackSlug(trackSlug)) {
      return NextResponse.json(
        { error: 'Space data analysis is only available for space-track submissions' },
        { status: 400 },
      )
    }

    const projectDescription = normalizeProjectDescription(submission.projectDescription)

    // Try to get the user's intake form submission for more context
    const userId = typeof submission.user === 'object' ? submission.user.id : submission.user
    let submissionData: Record<string, any> | undefined
    let coordinates: { lat: number; lng: number } | null = null

    // Fetch founder's intake form data for keywords
    const intakeSubs = await payload.find({
      collection: 'founder-form-submissions',
      where: { user: { equals: userId } },
      sort: 'createdAt',
      limit: 1,
      depth: 0,
    })
    if (intakeSubs.docs[0]) {
      submissionData = (intakeSubs.docs[0] as any).submissionData
    }

    // Use user-provided coordinates if available (no geocoding)
    const userDoc = await payload.findByID({ collection: 'users', id: userId, depth: 0 }) as any
    if (userDoc?.location?.lat && userDoc?.location?.lng) {
      coordinates = { lat: userDoc.location.lat, lng: userDoc.location.lng }
    }

    // Load space data config from PlatformSettings
    const platformSettings = await payload.findGlobal({ slug: 'platform-settings' }) as any
    const spaceDataConfig = buildSpaceDataConfig(platformSettings)

    // Run the Copernicus analysis
    const analysis = await analyzeSpaceDataRelevance(
      projectDescription,
      submissionData,
      coordinates,
      spaceDataConfig,
    )

    // Analysis may take long enough for an admin or founder to edit the
    // submission. Do not attach an obsolete result to its new state.
    const latestSubmission = await payload.findByID({
      collection: 'project-submissions',
      id: projectSubmissionId,
      depth: 1,
    }).catch(() => null) as any
    const latestTrackSlug = await resolveTrackSlug(payload, latestSubmission?.track)
    if (
      !latestSubmission ||
      !isSpaceTrackSlug(latestTrackSlug) ||
      normalizeProjectDescription(latestSubmission.projectDescription) !== projectDescription
    ) {
      return NextResponse.json(
        { error: 'Submission changed during analysis; result was not saved' },
        { status: 409 },
      )
    }

    // Save results to the project submission
    await payload.update({
      collection: 'project-submissions',
      id: projectSubmissionId,
      data: { spaceDataRelevance: analysis as unknown as Record<string, unknown> },
    })

    return NextResponse.json({
      success: true,
      relevanceScore: analysis.relevanceScore,
      euSpaceAssets: analysis.euSpaceAssets,
      datasetsFound: analysis.datasets.length,
      galileoRelevant: !!analysis.galileoRelevance,
    })
  } catch (error) {
    console.error('Space data analysis error:', error)
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}
