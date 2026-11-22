import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { getAppUrl } from '@/lib/appUrl'
import { isVerificationExpired } from '@/lib/accountVerification'

export const dynamic = 'force-dynamic'

function buildRedirect(path: string, request: NextRequest): NextResponse {
  const appUrl = getAppUrl()
  const target = new URL(path, appUrl)

  if (request.nextUrl.searchParams.get('next')?.startsWith('/')) {
    target.searchParams.set('next', request.nextUrl.searchParams.get('next') as string)
  }

  return NextResponse.redirect(target)
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')

  if (!token) {
    return buildRedirect('/login?verification=invalid', request)
  }

  const payload = await getPayload({ config })

  try {
    const users = await payload.find({
      collection: 'users',
      where: {
        _verificationToken: {
          equals: token,
        },
      },
      limit: 1,
      overrideAccess: true,
      showHiddenFields: true,
    })

    const user = users.docs[0] as any

    if (!user) {
      return buildRedirect('/login?verification=invalid', request)
    }

    if (user._verified === false && isVerificationExpired(user.createdAt)) {
      await payload.delete({
        collection: 'users',
        id: user.id,
        overrideAccess: true,
      })

      return buildRedirect('/login?verification=expired', request)
    }

    await payload.verifyEmail({
      collection: 'users',
      token,
    })

    return buildRedirect('/login?verified=1', request)
  } catch (error) {
    console.error('[auth/verify-email] Failed to verify email:', error)
    return buildRedirect('/login?verification=invalid', request)
  }
}
