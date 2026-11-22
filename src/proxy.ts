import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify, SignJWT } from 'jose'
import {
  extractLanguageFromPathname,
  LANGUAGE_COOKIE_KEY,
  LANGUAGE_COOKIE_MAX_AGE,
} from '@/lib/language'

// Refresh the token if it expires within this window (7 days)
const REFRESH_THRESHOLD_SECONDS = 60 * 60 * 24 * 7
const TOKEN_LIFETIME_SECONDS = 60 * 60 * 24 * 30 // 30 days

export default async function proxy(request: NextRequest) {
  const languageFromPath = extractLanguageFromPathname(request.nextUrl.pathname)

  if (languageFromPath) {
    const targetUrl = request.nextUrl.clone()
    targetUrl.pathname = '/'

    const response = NextResponse.redirect(targetUrl)
    response.cookies.set(LANGUAGE_COOKIE_KEY, languageFromPath, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: LANGUAGE_COOKIE_MAX_AGE,
    })

    return response
  }

  const token = request.cookies.get('payload-token')?.value
  if (!token) return NextResponse.next()

  const secret = process.env.PAYLOAD_SECRET
  if (!secret) return NextResponse.next()

  const secretKey = new TextEncoder().encode(secret)

  try {
    const { payload: claims } = await jwtVerify(token, secretKey)
    const now = Math.floor(Date.now() / 1000)
    const exp = claims.exp

    // Only refresh if token is approaching expiry
    if (!exp || exp - now > REFRESH_THRESHOLD_SECONDS) {
      return NextResponse.next()
    }

    // Re-sign with the same claims but a fresh expiry
    const { iat, exp: _exp, nbf: _nbf, ...fieldsToSign } = claims
    const newToken = await new SignJWT(fieldsToSign)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(now)
      .setExpirationTime(now + TOKEN_LIFETIME_SECONDS)
      .sign(secretKey)

    const response = NextResponse.next()
    response.cookies.set('payload-token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: TOKEN_LIFETIME_SECONDS,
    })

    return response
  } catch {
    // Don't delete the cookie — let server-side auth handlers deal with
    // invalid/expired tokens. Deleting here would race with freshly-set cookies.
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    // Only run on page navigations, skip API routes, server actions, static assets, and Payload admin
    '/((?!api/|_next/|admin|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
