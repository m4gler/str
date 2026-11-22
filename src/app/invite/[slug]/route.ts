import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import {
    buildPublicPartnerIntakeContext,
    getIntakeContextCookieOptions,
    serializeIntakeContextCookie,
} from '@/lib/intakeContext'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params
    const payload = await getPayload({ config })
    const partner = await payload.find({
        collection: 'partners',
        where: {
            and: [
                { slug: { equals: slug } },
                { isActive: { equals: true } },
            ],
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
    }).catch(() => null)

    const response = NextResponse.redirect(new URL('/login?role=founder&next=/intake', request.url))
    response.cookies.delete('partner-ref')

    const partnerDoc = partner?.docs?.[0] as any
    const intakeContext = buildPublicPartnerIntakeContext({
        id: partnerDoc?.id,
        slug: partnerDoc?.slug,
    })

    if (intakeContext) {
        response.cookies.set(
            'intake-context',
            serializeIntakeContextCookie(intakeContext),
            getIntakeContextCookieOptions(),
        )
    } else {
        response.cookies.delete('intake-context')
    }

    return response
}
