import { getPayload } from 'payload'
import config from '@/payload.config'
import { headers, cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import InvestorProfileClient from '@/components/InvestorProfileClient'
import type { InvestorForm } from '@/payload-types'
import { normalizeInvestorFormConfig } from '@/lib/investorForm'
import { findUserFromPayloadToken } from '@/lib/payloadUserToken'

export const dynamic = 'force-dynamic'

export default async function InvestorProfilePage() {
    const payload = await getPayload({ config })
    const headersObj = await headers()
    const cookieStore = await cookies()
    const token = cookieStore.get('payload-token')?.value

    let user: any = null

    try {
        const authResult = await payload.auth({ headers: headersObj })
        user = authResult.user
    } catch {}

    if (!user && token) {
        try {
            user = await findUserFromPayloadToken(payload, token)
        } catch {}
    }

    if (!user) {
        redirect('/login')
    }

    if (user.role !== 'investor') {
        redirect('/')
    }

    // Fetch the user's investor form submission
    const submissions = await payload.find({
        collection: 'investor-form-submissions',
        where: { user: { equals: user.id } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
    })

    if (submissions.totalDocs === 0) {
        redirect('/intake')
    }

    const submission = submissions.docs[0] as any

    let settings: any = {}
    try {
        settings = await payload.findGlobal({ slug: 'platform-settings' })
    } catch {}

    // Prefer the currently active investor form so older submissions can fill newly added blocks.
    const activeFormId = typeof settings?.activeInvestorForm === 'object'
        ? settings.activeInvestorForm?.id
        : settings?.activeInvestorForm
    const submissionFormId = typeof submission.form === 'object' ? submission.form?.id : submission.form
    const preferredFormIds = [activeFormId, submissionFormId].filter(Boolean)

    let formConfig: InvestorForm | null = null
    for (const formId of preferredFormIds) {
        try {
            formConfig = await payload.findByID({
                collection: 'investor-forms',
                id: formId,
            }) as InvestorForm
            break
        } catch {}
    }

    return (
        <InvestorProfileClient
            user={user}
            submission={submission}
            formConfig={normalizeInvestorFormConfig(formConfig) || formConfig}
            settings={settings}
        />
    )
}
