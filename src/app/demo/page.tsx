import { getPayload } from 'payload'
import config from '@/payload.config'
import DemoClient from '@/components/DemoClient'
import { resolveDayDefinitionByBlockKey } from '@/lib/curriculum/resolve'
import { buildAvailableTrackOptions } from '@/lib/availableTracks'

export const dynamic = 'force-dynamic'

export default async function DemoPage() {
    // Only available in development mode
    if (process.env.NODE_ENV !== 'development') {
        const { notFound } = await import('next/navigation')
        notFound()
    }

    const payload = await getPayload({ config })

    // Fetch platform settings
    const settings: any = await payload.findGlobal({ slug: 'platform-settings' }).catch(() => ({}))

    // Fetch founder intake form (active one)
    let intakeForm: any = null
    const founderFormRef = settings?.activeFounderForm
    const founderFormId = founderFormRef
        ? (typeof founderFormRef === 'object' ? founderFormRef?.id : founderFormRef)
        : null
    if (founderFormId) {
        try {
            intakeForm = await payload.findByID({ collection: 'founder-forms', id: founderFormId })
        } catch {}
    }

    // Fetch personality test form
    let ptForm: any = null
    const ptFormRef = settings?.activePersonalityTestForm
    const ptFormId = ptFormRef
        ? (typeof ptFormRef === 'object' ? ptFormRef?.id : ptFormRef)
        : null
    if (ptFormId) {
        try {
            ptForm = await payload.findByID({ collection: 'founder-forms', id: ptFormId })
        } catch {}
    }

    // Fetch day forms: day 1, day 2, gate 15, prework 1
    const dayForms: Record<string, any> = {}
    const dayDefs: Record<string, any> = {}
    const slugsToFetch = ['daily-day-block-1', 'daily-day-block-2', 'daily-gate-block-15', 'daily-prework-block-1']

    for (const slug of slugsToFetch) {
        try {
            const formDocs = await payload.find({
                collection: 'founder-forms',
                where: { slug: { equals: slug } },
                limit: 1,
            })
            if (formDocs.docs[0]) {
                dayForms[slug] = formDocs.docs[0]
            }
        } catch {}

        // Also get day definition for context
        try {
            const blockKeyMatch = slug.match(/^daily-(.+)$/)
            if (blockKeyMatch) {
                const blockKey = blockKeyMatch[1].toUpperCase()
                const definition = await resolveDayDefinitionByBlockKey(payload, blockKey)
                if (definition) {
                    dayDefs[slug] = definition
                }
            }
        } catch {}
    }

    // Fetch available tracks
    let tracks: any[] = []
    try {
        const t = await payload.find({ collection: 'tracks', limit: 10 })
        tracks = buildAvailableTrackOptions(t.docs as any[], settings?.tracks)
    } catch {}

    return (
        <DemoClient
            settings={settings}
            intakeForm={intakeForm}
            ptForm={ptForm}
            dayForms={dayForms}
            dayDefs={dayDefs}
            tracks={tracks}
        />
    )
}
