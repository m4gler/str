import { getPayload } from 'payload'
import config from '@/payload.config'
import { headers, cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import EcosystemMapClient from '@/components/EcosystemMapClient'
import { findUserFromPayloadToken } from '@/lib/payloadUserToken'

export const dynamic = 'force-dynamic'

export default async function EcosystemPage() {
    const payload = await getPayload({ config })
    const headersObj = await headers()
    const cookieStore = await cookies()
    const token = cookieStore.get('payload-token')?.value

    let user: any = null

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

    if (user.role !== 'founder') {
        redirect('/')
    }

    const ecosystemResult = await payload.find({
        collection: 'ecosystem-items',
        where: {
            user: { equals: user.id },
        },
        limit: 500,
        sort: '-createdAt',
        depth: 0,
    })

    const introResult = await payload.find({
        collection: 'intro-requests',
        where: {
            user: { equals: user.id },
        },
        limit: 200,
        sort: '-createdAt',
        depth: 1,
    })

    return (
        <EcosystemMapClient
            user={user}
            ecosystemItems={ecosystemResult.docs as any[]}
            introRequests={introResult.docs as any[]}
        />
    )
}
