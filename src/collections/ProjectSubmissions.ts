import type { CollectionConfig } from 'payload'
import { after } from 'next/server'
import { analyzeSpaceDataRelevance, buildSpaceDataConfig } from '@/lib/copernicus'
import { getAppUrl } from '@/lib/appUrl'
import { isSpaceTrackSlug } from '@/lib/availableTracks'
import { getRelationId, queueDashboardCalendarNotice } from '@/lib/dashboardCalendarNotice'
import { notifyProjectSubmissionCreatedAlert, notifyProjectSubmissionDecision } from '@/lib/notifications'

function scheduleBackgroundTask(task: () => Promise<void>): void {
    try {
        after(task)
    } catch (error) {
        if (error instanceof Error && error.message.includes('outside a request scope')) {
            void Promise.resolve().then(task)
            return
        }
        throw error
    }
}

function getPopulatedTrackSlug(track: unknown): string | null {
    if (!track || typeof track !== 'object') return null
    const slug = (track as { slug?: unknown }).slug
    return typeof slug === 'string' ? slug : null
}

async function resolveTrackSlug(payload: any, track: unknown): Promise<string | null> {
    if (track && typeof track === 'object' && (track as { isActive?: unknown }).isActive === false) {
        return null
    }

    const populatedSlug = getPopulatedTrackSlug(track)
    if (populatedSlug) return populatedSlug

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

export const ProjectSubmissions: CollectionConfig = {
    slug: 'project-submissions',
    trash: true,
    admin: {
        useAsTitle: 'projectDescription',
        group: '📋 Reviews',
        defaultColumns: ['user', 'status', 'autoDenied', 'reviewedAt', 'createdAt'],
        description: 'Project descriptions submitted by founders for review before program access.',
    },
    hooks: {
        beforeChange: [
            ({ req, data }) => {
                // Deliberately block authenticated direct REST/admin writes from
                // non-admins. Founder and partner writes must go through server
                // actions, which enforce additional business rules.
                if (req.user && req.user.role !== 'admin') {
                    throw new Error('Direct API writes are disabled for project submissions.')
                }
                return data
            },
        ],
        afterChange: [
            async ({ doc, previousDoc, req, operation }) => {
                const payload = req.payload
                const previousTrackId = getRelationId(previousDoc?.track)
                const nextTrackId = getRelationId(doc.track)
                const trackChangedByAdmin =
                    operation === 'update' &&
                    req.user?.role === 'admin' &&
                    String(previousTrackId ?? '') !== String(nextTrackId ?? '')

                if (trackChangedByAdmin) {
                    const userId = getRelationId(doc.user)

                    if (userId) {
                        await queueDashboardCalendarNotice(payload, {
                            userId,
                            previousTrackId,
                            nextTrackId,
                            currentTrackId: nextTrackId,
                        })
                    }
                }

                const currentTrackSlug = await resolveTrackSlug(payload, doc.track)
                const previousTrackSlug = String(previousTrackId ?? '') === String(nextTrackId ?? '')
                    ? currentTrackSlug
                    : await resolveTrackSlug(payload, previousDoc?.track)
                const isCurrentSpaceTrack = isSpaceTrackSlug(currentTrackSlug)
                const wasSpaceTrack = isSpaceTrackSlug(previousTrackSlug)

                const projectDescription = normalizeProjectDescription(doc.projectDescription)
                const previousDescription = normalizeProjectDescription(previousDoc?.projectDescription)
                const submissionBecameFilled = projectDescription.length > 0 && previousDescription.length === 0
                const reviewStatusChanged =
                    ['approved', 'denied'].includes(doc.status) &&
                    previousDoc?.status !== doc.status

                if (submissionBecameFilled) {
                    const sendSubmissionAlert = async () => {
                        try {
                            const userId = typeof doc.user === 'object' ? (doc.user as any).id : doc.user
                            if (!userId) return

                            const founder = await payload.findByID({
                                collection: 'users',
                                id: userId,
                                depth: 0,
                            }).catch(() => null) as any

                            if (!founder?.email) return

                            const trackId = typeof doc.track === 'object' ? (doc.track as any)?.id : doc.track
                            const trackDoc = trackId
                                ? await payload.findByID({
                                    collection: 'tracks',
                                    id: trackId,
                                    depth: 0,
                                }).catch(() => null) as any
                                : null

                            await notifyProjectSubmissionCreatedAlert(
                                payload,
                                {
                                    submissionId: doc.id,
                                    submitterEmail: founder.email,
                                    projectDescription,
                                    trackName: trackDoc?.name ?? null,
                                },
                                getAppUrl(),
                            )
                        } catch (err) {
                            console.warn('[ProjectSubmissions] Failed to send submission alert', doc.id, err)
                        }
                    }

                    scheduleBackgroundTask(sendSubmissionAlert)
                }

                if (reviewStatusChanged) {
                    const sendReviewDecision = async () => {
                        try {
                            const userId = typeof doc.user === 'object' ? (doc.user as any).id : doc.user
                            if (!userId) return

                            const founder = await payload.findByID({
                                collection: 'users',
                                id: userId,
                                depth: 0,
                            }).catch(() => null) as any

                            if (!founder?.email) return

                            const trackId = typeof doc.track === 'object' ? (doc.track as any)?.id : doc.track
                            const trackDoc = trackId
                                ? await payload.findByID({
                                    collection: 'tracks',
                                    id: trackId,
                                    depth: 0,
                                }).catch(() => null) as any
                                : null

                            const fallbackComment =
                                doc.partnerComment ||
                                (doc.autoDenied && doc.bannedWordMatched
                                    ? `Automatically blocked because it matched the banned word "${doc.bannedWordMatched}".`
                                    : null)

                            await notifyProjectSubmissionDecision(
                                payload,
                                { email: founder.email, name: founder.email },
                                doc.status as 'approved' | 'denied',
                                getAppUrl(),
                                {
                                    comment: fallbackComment,
                                    trackName: trackDoc?.name ?? null,
                                },
                            )
                        } catch (err) {
                            console.warn('[ProjectSubmissions] Failed to send review email', doc.id, err)
                        }
                    }

                    await sendReviewDecision()
                }

                // Copernicus data belongs only to the space track. Remove legacy
                // results as soon as a submission is saved on any other track.
                if (!isCurrentSpaceTrack && doc.spaceDataRelevance != null) {
                    await payload.update({
                        collection: 'project-submissions',
                        id: doc.id,
                        data: { spaceDataRelevance: null },
                    }).catch((err: unknown) => {
                        console.warn('[Space Data] Failed to clear stale analysis for submission', doc.id, err)
                    })
                }

                // Analyze on first submission, description edits, and when an
                // existing description moves from a non-space track to space.
                const descriptionChanged = !submissionBecameFilled && previousDoc?.projectDescription !== doc.projectDescription && projectDescription.length > 0
                const enteredSpaceTrack = !wasSpaceTrack && isCurrentSpaceTrack
                if (isCurrentSpaceTrack && projectDescription.length > 0 && (submissionBecameFilled || descriptionChanged || enteredSpaceTrack)) {
                    // Run directly via Payload local API (no HTTP round-trip, no auth issues)
                    const runAnalysis = async () => {
                        try {
                            // The task may start after another update. Avoid an
                            // unnecessary external analysis if it is already stale.
                            const currentSubmission = await payload.findByID({
                                collection: 'project-submissions',
                                id: doc.id,
                                depth: 1,
                            }) as any
                            const currentDescription = normalizeProjectDescription(currentSubmission?.projectDescription)
                            const currentSubmissionTrackSlug = await resolveTrackSlug(payload, currentSubmission?.track)
                            if (currentDescription !== projectDescription || !isSpaceTrackSlug(currentSubmissionTrackSlug)) {
                                return
                            }

                            const userId = getRelationId(currentSubmission?.user)
                            if (userId == null) return

                            // Get founder's intake data for keyword extraction
                            let submissionData: Record<string, any> | undefined
                            let coordinates: { lat: number; lng: number } | null = null

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

                            const analysis = await analyzeSpaceDataRelevance(projectDescription, submissionData, coordinates, spaceDataConfig)

                            // The track or description can change while the
                            // external analysis is running. Never save a result
                            // produced for an obsolete submission state.
                            const latestSubmission = await payload.findByID({
                                collection: 'project-submissions',
                                id: doc.id,
                                depth: 1,
                            }) as any
                            const latestDescription = normalizeProjectDescription(latestSubmission?.projectDescription)
                            const latestTrackSlug = await resolveTrackSlug(payload, latestSubmission?.track)
                            if (latestDescription !== projectDescription || !isSpaceTrackSlug(latestTrackSlug)) {
                                console.log(`[Space Data] Skipped stale analysis result for submission ${doc.id}`)
                                return
                            }

                            await payload.update({
                                collection: 'project-submissions',
                                id: doc.id,
                                data: { spaceDataRelevance: analysis as unknown as Record<string, unknown> },
                            })

                            console.log(`[Space Data] Analysis complete for submission ${doc.id}: ${analysis.relevanceScore}% relevance, ${analysis.datasets.length} datasets`)
                        } catch (err) {
                            console.warn('[Space Data] Analysis failed for submission', doc.id, err)
                        }
                    }

                    scheduleBackgroundTask(runAnalysis)
                }
            },
        ],
    },
    access: {
        create: ({ req: { user } }) => Boolean(user) && user?.role === 'founder',
        read: ({ req: { user } }) => {
            if (!user) return false
            if (user.role === 'admin') return true
            if ((user as any).role === 'partner') {
                const partnerId = (user as any).partner?.id ?? (user as any).partner
                if (!partnerId) return false
                return { 'user.partner': { equals: partnerId } } as any
            }
            // Founders can only read their own submission
            return { user: { equals: user.id } }
        },
        update: ({ req: { user } }) => {
            if (!user) return false
            if (user.role === 'admin') return true
            if ((user as any).role === 'partner') {
                const partnerId = (user as any).partner?.id ?? (user as any).partner
                if (!partnerId) return false
                return { 'user.partner': { equals: partnerId } } as any
            }
            return false
        },
        delete: ({ req: { user } }) => user?.role === 'admin',
    },
    fields: [
        {
            name: 'user',
            type: 'relationship',
            relationTo: 'users',
            required: true,
            index: true,
            admin: {
                readOnly: true,
            },
            access: {
                update: () => false,
            },
        },
        {
            name: 'track',
            type: 'relationship',
            relationTo: 'tracks',
            required: false,
            admin: { description: 'Track selected by the founder at submission time.' },
        },
        {
            name: 'projectDescription',
            type: 'textarea',
            required: false,
            label: 'Project Description',
            access: {
                update: ({ req: { user } }) => user?.role === 'admin',
            },
        },
        {
            name: 'workspaceUrl',
            type: 'text',
            required: false,
            label: 'Project Workspace URL',
            validate: (value: unknown) => {
                if (!value) return true
                if (typeof value !== 'string') return 'Workspace URL must be a string.'

                try {
                    const parsed = new URL(value)
                    return ['http:', 'https:'].includes(parsed.protocol)
                        ? true
                        : 'Workspace URL must start with http:// or https://'
                } catch {
                    return 'Workspace URL must be a valid URL'
                }
            },
            admin: {
                description: 'Single hub link where the founder stores ALL daily deliverables (Notion, Google Docs, Figma, Excel, etc.). Replaces the per-day submission URLs.',
            },
            access: {
                update: ({ req: { user } }) => user?.role === 'admin',
            },
        },
        {
            name: 'status',
            type: 'select',
            required: true,
            defaultValue: 'pending',
            index: true,
            options: [
                { label: 'Pending Review', value: 'pending' },
                { label: 'Approved', value: 'approved' },
                { label: 'Denied', value: 'denied' },
            ],
        },
        {
            name: 'partnerComment',
            type: 'textarea',
            label: 'Review Comment',
            admin: {
                description: 'Comment visible to the founder after review.',
            },
        },
        {
            name: 'reviewedBy',
            type: 'relationship',
            relationTo: 'users',
            label: 'Reviewed By',
            admin: {
                readOnly: true,
            },
        },
        {
            name: 'reviewedAt',
            type: 'date',
            label: 'Reviewed At',
            admin: {
                readOnly: true,
                date: { pickerAppearance: 'dayAndTime' },
            },
        },
        {
            name: 'autoDenied',
            type: 'checkbox',
            label: 'Auto-denied (Banned Word)',
            defaultValue: false,
            admin: {
                readOnly: true,
                description: 'Set automatically when a banned word is detected in the project description.',
            },
        },
        {
            name: 'spaceDataRelevance',
            type: 'json',
            label: 'Space Data Relevance',
            access: {
                read: async ({ req, doc }) => {
                    const user = req.user
                    if (!user) return false
                    if (user.role === 'admin' || user.role === 'partner') return true
                    if (user.role !== 'founder') return false

                    const trackSlug = await resolveTrackSlug(req.payload, (doc as any)?.track)
                    return isSpaceTrackSlug(trackSlug)
                },
            },
            admin: {
                description: 'Copernicus/ESA space data relevance analysis based on the project description. Auto-populated on first submission.',
                readOnly: true,
            },
        },
        {
            name: 'bannedWordMatched',
            type: 'text',
            label: 'Banned Word Matched',
            admin: {
                readOnly: true,
                condition: (data) => Boolean(data?.bannedWordMatched),
                description: 'The banned word that triggered automatic denial.',
            },
        },
    ],
}
