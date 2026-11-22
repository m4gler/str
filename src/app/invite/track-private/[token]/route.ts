import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { PREFERRED_TRACK_COOKIE } from '@/lib/preferredTrack'
import {
    getIntakeContextCookieOptions,
    serializeIntakeContextCookie,
    type IntakeContext,
} from '@/lib/intakeContext'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> },
) {
    const { token } = await params
    const payload = await getPayload({ config })

    const response = NextResponse.redirect(new URL('/login?role=founder&next=/intake', request.url))
    response.cookies.delete('partner-ref')

    const linkResult = await payload.find({
        collection: 'track-invite-links',
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
    const track = link?.track

    if (link && (track?.id || link?.track)) {
        const trackId = track?.id ?? link?.track
        const trackSlug = track?.slug ?? null

        const intakeContext: IntakeContext = {
            version: 1,
            source: 'track',
            trackId,
            trackSlug,
            trackLocked: true,
            partnerLocked: false,
            privateToken: link.token,
        }

        response.cookies.set(
            'intake-context',
            serializeIntakeContextCookie(intakeContext),
            getIntakeContextCookieOptions(),
        )

        if (typeof trackSlug === 'string' && trackSlug.trim()) {
            response.cookies.set(PREFERRED_TRACK_COOKIE, trackSlug.trim().toLowerCase(), {
                httpOnly: false,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
                maxAge: 60 * 60 * 24 * 30,
            })
        }

        await payload.update({
            collection: 'track-invite-links',
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
