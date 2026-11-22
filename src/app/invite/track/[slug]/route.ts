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
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params
    const payload = await getPayload({ config })

    const response = NextResponse.redirect(new URL('/login?role=founder&next=/intake', request.url))
    response.cookies.delete('partner-ref')

    const trackResult = await payload.find({
        collection: 'tracks',
        where: { slug: { equals: slug } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
    }).catch(() => null)

    const track = trackResult?.docs?.[0] as any

    if (track?.id && track?.slug) {
        const intakeContext: IntakeContext = {
            version: 1,
            source: 'track',
            trackId: track.id,
            trackSlug: track.slug,
            trackLocked: false,
            partnerLocked: false,
        }

        response.cookies.set(
            'intake-context',
            serializeIntakeContextCookie(intakeContext),
            getIntakeContextCookieOptions(),
        )

        response.cookies.set(PREFERRED_TRACK_COOKIE, track.slug.trim().toLowerCase(), {
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 30,
        })
    } else {
        response.cookies.delete('intake-context')
        response.cookies.delete(PREFERRED_TRACK_COOKIE)
    }

    return response
}
