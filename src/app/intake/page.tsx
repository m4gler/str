import { getPayload } from 'payload'
import config from '@/payload.config'
import { headers, cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import InvestorIntakeForm from '@/components/InvestorIntakeForm'
import FounderForm from '@/components/FounderForm'
import { InvestorForm, FounderForm as FounderFormType } from '@/payload-types'
import { normalizeEstimatedTimeHrs } from '@/lib/estimatedTime'
import { PREFERRED_TRACK_COOKIE, resolvePreferredTrackSlug } from '@/lib/preferredTrack'
import { resolveCurriculumContext, resolveDayDefinitionByBlockKey } from '@/lib/curriculum/resolve'
import { normalizeInvestorFormConfig } from '@/lib/investorForm'
import { findUserFromPayloadToken } from '@/lib/payloadUserToken'
import { buildAvailableTrackOptions } from '@/lib/availableTracks'
import { INTAKE_CONTEXT_COOKIE, parseIntakeContextCookie } from '@/lib/intakeContext'

export default async function IntakePage(props: { searchParams?: Promise<{ form?: string }> }) {
    const searchParams = props.searchParams ? await props.searchParams : {}
    const formSlug = searchParams.form

    const payload = await getPayload({ config })
    const headersObj = await headers()
    const cookieStore = await cookies()
    const token = cookieStore.get('payload-token')?.value
    const platformSettings = await payload.findGlobal({ slug: 'platform-settings' }).catch(() => null) as any
    const storedIntakeContext = parseIntakeContextCookie(cookieStore.get(INTAKE_CONTEXT_COOKIE)?.value || null)
    const legacyPartnerSlug = storedIntakeContext ? null : (cookieStore.get('partner-ref')?.value || null)

    let user = null

    try {
        const authResult = await payload.auth({ headers: headersObj })
        user = authResult.user
    } catch (e) {
    }

    if (!user && token) {
        try {
            user = await findUserFromPayloadToken(payload, token)
        } catch (e) {
        }
    }

    if (!user) {
        redirect('/login')
    }

    const partnersResult = await payload.find({
        collection: 'partners',
        where: { isActive: { equals: true } },
        limit: 100,
        depth: 1,
        overrideAccess: true,
    })
    const partners = partnersResult.docs.map((p: any) => ({ id: p.id as number, name: p.name as string }))
    const legacyPartner = legacyPartnerSlug
        ? partnersResult.docs.find((p: any) => p.slug === legacyPartnerSlug)
        : undefined
    const intakeContext = storedIntakeContext || (
        legacyPartner
            ? {
                version: 1 as const,
                source: 'partner_public' as const,
                partnerId: legacyPartner.id as number,
                partnerSlug: legacyPartner.slug as string,
                partnerLocked: true,
                trackLocked: false,
            }
            : null
    )

    const matchedPartner = intakeContext?.partnerId != null
        ? partnersResult.docs.find((p: any) => Number(p.id) === Number(intakeContext.partnerId))
        : intakeContext?.partnerSlug
            ? partnersResult.docs.find((p: any) => p.slug === intakeContext.partnerSlug)
            : undefined
    const lockedPartner = matchedPartner
        ? {
            id: matchedPartner.id as number,
            name: matchedPartner.name as string,
            slug: matchedPartner.slug as string,
            logoUrl: matchedPartner.logo && typeof matchedPartner.logo === 'object'
                ? matchedPartner.logo?.url ?? null
                : null,
        }
        : null
    const partnerSelectionLocked = Boolean(intakeContext?.partnerLocked && lockedPartner)
    const initialPartnerId = lockedPartner?.id ?? null

    if (user.role === 'investor') {
        const activeFormId = typeof platformSettings?.activeInvestorForm === 'object'
            ? platformSettings.activeInvestorForm?.id
            : platformSettings?.activeInvestorForm

        let formConfig: InvestorForm | undefined

        if (activeFormId) {
            try {
                formConfig = await payload.findByID({
                    collection: 'investor-forms',
                    id: activeFormId,
                }) as InvestorForm
            } catch (e) {
            }
        }

        if (!formConfig) {
            const forms = await payload.find({ collection: 'investor-forms', limit: 1 })
            formConfig = forms.docs[0] as InvestorForm | undefined
        }

        if (!formConfig) {
            return <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">Investor form configuration not found.</div>
        }

        // Only block re-submission when allowMultipleSubmissions is not enabled
        if (!(formConfig as any).allowMultipleSubmissions) {
            const submissions = await payload.find({
                collection: 'investor-form-submissions',
                where: {
                    user: { equals: user.id },
                    form: { equals: formConfig.id }
                },
                limit: 1,
            })
            if (submissions.totalDocs > 0) {
                redirect('/')
            }
        }

        return (
            <InvestorIntakeForm
                form={normalizeInvestorFormConfig(formConfig) || formConfig}
                platformSettings={platformSettings}
            />
        )
    } else if (user.role === 'founder') {
        let formConfig: FounderFormType | undefined
        let availableTracks: Array<{ id: number; name: string; slug: string; description?: string | null }> = []

        if (formSlug) {
            try {
                const forms = await payload.find({
                    collection: 'founder-forms',
                    where: { slug: { equals: formSlug } },
                    limit: 1,
                })
                formConfig = forms.docs[0] as unknown as FounderFormType | undefined
            } catch (e) {
            }
        }

        if (!formConfig) {
            const activeFormId = typeof platformSettings?.activeFounderForm === 'object'
                ? platformSettings.activeFounderForm?.id
                : platformSettings?.activeFounderForm

            if (activeFormId) {
                try {
                    formConfig = await payload.findByID({
                        collection: 'founder-forms',
                        id: activeFormId,
                    }) as unknown as FounderFormType
                } catch (e) {
                }
            }

            if (!formConfig) {
                const forms = await payload.find({ collection: 'founder-forms', limit: 1 })
                formConfig = forms.docs[0] as unknown as FounderFormType | undefined
            }
        }

        if (!formConfig) {
            return <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">Founder form configuration not found.</div>
        }

        try {
            const tracksResult = await payload.find({
                collection: 'tracks',
                where: { isActive: { equals: true } },
                limit: 50,
                depth: 0,
            })
            availableTracks = buildAvailableTrackOptions(tracksResult.docs as any[], platformSettings?.tracks)
        } catch {}

        const partnerAllowedTrackIds = matchedPartner && Array.isArray((matchedPartner as any).tracks)
            ? (matchedPartner as any).tracks
                .map((track: any) => typeof track === 'object' ? track?.id : track)
                .map((id: any) => Number(id))
                .filter((id: number) => Number.isFinite(id))
            : []
        const partnerScopedTracks = partnerSelectionLocked && partnerAllowedTrackIds.length > 0
            ? availableTracks.filter((track) => partnerAllowedTrackIds.includes(Number(track.id)))
            : availableTracks
        const contextTrackSlug = intakeContext?.trackSlug || null
        const contextTrackId = intakeContext?.trackId ?? null
        const matchedTrack = contextTrackId != null
            ? partnerScopedTracks.find((track) => Number(track.id) === Number(contextTrackId))
            : contextTrackSlug
                ? partnerScopedTracks.find((track) => track.slug === contextTrackSlug)
                : null
        const singlePartnerTrack = partnerSelectionLocked && !intakeContext?.trackLocked && partnerScopedTracks.length === 1
            ? partnerScopedTracks[0]
            : null
        const trackSelectionLocked = Boolean((intakeContext?.trackLocked && matchedTrack) || singlePartnerTrack)
        const lockedTrack = intakeContext?.trackLocked
            ? matchedTrack
            : singlePartnerTrack
        const trackOptions = trackSelectionLocked
            ? (lockedTrack ? [lockedTrack] : [])
            : partnerScopedTracks
        const preferredTrackSlug = resolvePreferredTrackSlug(
            lockedTrack?.slug || matchedTrack?.slug || contextTrackSlug || cookieStore.get(PREFERRED_TRACK_COOKIE)?.value || null,
            trackOptions,
        )

        // Only block re-submission when allowMultipleSubmissions is not enabled
        if (!(formConfig as any).allowMultipleSubmissions) {
            const submissions = await payload.find({
                collection: 'founder-form-submissions',
                where: {
                    user: { equals: user.id },
                    form: { equals: formConfig.id },
                },
                limit: 1,
            })
            if (submissions.totalDocs > 0) {
                redirect('/')
            }
        }

        // Load day definition metadata + progression for daily/weekly/gate/prework forms
        const isDailyForm = formSlug?.startsWith('daily-')
        let dayDefinitionContext: any = null
        let dailyFormDayNumber: number | null = null
        let blockKey: string | null = null

        if (formSlug) {
            // Parse slug to determine block key and program day number
            const dayMatch = formSlug.match(/^daily-day-block-(\d+)$/)
            const gateMatch = formSlug.match(/^daily-gate-block-(\d+)$/)
            const weekMatch = formSlug.match(/^daily-week-block-(\d+)$/)
            const preworkMatch = formSlug.match(/^daily-prework-block-(\d+)$/)

            if (dayMatch) {
                blockKey = `DAY-BLOCK-${dayMatch[1]}`
                dailyFormDayNumber = parseInt(dayMatch[1]) || null
            } else if (gateMatch) {
                blockKey = `GATE-BLOCK-${gateMatch[1]}`
                dailyFormDayNumber = parseInt(gateMatch[1]) || null // gate days are actual program days (15,30,50,70,94)
            } else if (weekMatch) {
                blockKey = `WEEK-BLOCK-${weekMatch[1]}`
                // Week number → approximate program day (end of that week)
                const weekNum = parseInt(weekMatch[1]) || 0
                dailyFormDayNumber = Math.min(weekNum * 7, 100)
            } else if (preworkMatch) {
                blockKey = `PREWORK-BLOCK-${preworkMatch[1]}`
                dailyFormDayNumber = 1 // Prework shows at the start
            }

            if (blockKey) {
                try {
                    const curriculumContext = await resolveCurriculumContext(payload, {
                        userId: (user as any).id,
                    })
                    const dd = await resolveDayDefinitionByBlockKey(payload, blockKey, curriculumContext)
                    if (dd) {
                        dayDefinitionContext = {
                            title: dd.title || null,
                            activity: dd.activity || null,
                            blockType: dd.blockType || null,
                            theme: dd.theme || null,
                            founderCommandment: dd.founderCommandment || null,
                            deliverable: dd.deliverable || null,
                            exampleProject: (dd as any).exampleProject || null,
                            whereHowTips: dd.whereHowTips || null,
                            autoCheckCriteria: dd.autoCheckCriteria || null,
                            mesgaIntegration: dd.mesgaIntegration || null,
                            estimatedTimeHrs: normalizeEstimatedTimeHrs(dd.estimatedTimeHrs),
                            eduType: dd.eduType || null,
                            eduLinks: dd.eduLinks || null,
                            blockFocus: dd.blockFocus || null,
                            weekNumber: dd.weekNumber ?? null,
                            coachingNote: dd.coachingNote || null,
                        }
                    }
                } catch {}
            }
        }

        // Load partner branding for progress bar
        let partnerBrandingColors = null
        if (isDailyForm && dailyFormDayNumber) {
            const partnerRef = (user as any).partner
            const partnerId = typeof partnerRef === 'object' ? partnerRef?.id : partnerRef
            if (partnerId) {
                try {
                    const partner = await payload.findByID({ collection: 'partners', id: partnerId }) as any
                    partnerBrandingColors = partner?.brandingColors || null
                } catch {}
            }
        }

        return (
            <FounderForm
                form={formConfig}
                partners={(formConfig as any).showReferredBy ? partners : []}
                initialPartnerId={(formConfig as any).showReferredBy ? initialPartnerId : null}
                platformSettings={platformSettings}
                availableTracks={trackOptions}
                preferredTrackSlug={preferredTrackSlug}
                partnerSelectionLocked={partnerSelectionLocked}
                lockedPartner={lockedPartner}
                trackSelectionLocked={trackSelectionLocked}
                lockedTrack={trackSelectionLocked ? lockedTrack : null}
                dayDefinitionContext={dayDefinitionContext}
                isDailyForm={!!isDailyForm}
                dayNumber={dailyFormDayNumber}
                partnerBrandingColors={partnerBrandingColors}
            />
        )

    } else {
        redirect('/')
    }
}
