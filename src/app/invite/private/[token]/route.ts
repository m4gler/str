import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { PREFERRED_TRACK_COOKIE } from '@/lib/preferredTrack'
import {
    buildPrivatePartnerIntakeContext,
    getIntakeContextCookieOptions,
    serializeIntakeContextCookie,
} from '@/lib/intakeContext'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> },
) {
    const { token } = await params
    const payload = await getPayload({ config })
    const response = NextResponse.redirect(new URL('/login?role=founder&next=/intake', request.url))

    const linkResult = await payload.find({
        collection: 'partner-invite-links',
        where: {
            and: [
                { token: { equals: token } },
                { isActive: { equals: true } },
            ],
        },
        limit: 1,
        depth: 2,
        overrideAccess: true,
    }).catch(() => null)

    const link = linkResult?.docs?.[0] as any
    const partner = link?.partner
    const track = link?.track
    const intakeContext = buildPrivatePartnerIntakeContext({
        partnerId: partner?.id ?? link?.partner,
        partnerSlug: partner?.slug,
        trackId: track?.id ?? link?.track,
        trackSlug: track?.slug,
        privateToken: link?.token,
    })

    response.cookies.delete('partner-ref')

    if (intakeContext) {
        response.cookies.set(
            'intake-context',
            serializeIntakeContextCookie(intakeContext),
            getIntakeContextCookieOptions(),
        )

        if (typeof track?.slug === 'string' && track.slug.trim()) {
            response.cookies.set(PREFERRED_TRACK_COOKIE, track.slug.trim().toLowerCase(), {
                httpOnly: false,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
                maxAge: 60 * 60 * 24 * 30,
            })
        }

        await payload.update({
            collection: 'partner-invite-links',
            id: link.id,
            data: {
                lastUsedAt: new Date().toISOString(),
                useCount: Number(link.useCount || 0) + 1,
            },
            overrideAccess: true,
        }).catch(() => null)
    } else {
        response.cookies.delete('intake-context')
        response.cookies.delete(PREFERRED_TRACK_COOKIE)
    }

    return response
}
