import { NextResponse } from 'next/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'
import { getAppUrl } from '@/lib/appUrl'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const rawRole = searchParams.get('role') || 'founder'
  const role = rawRole === 'investor' ? 'investor' : 'founder'
  const source = searchParams.get('source') || 'login'
  const next = searchParams.get('next') || '/'

  const appUrl = getAppUrl()
  const nonce = randomBytes(16).toString('hex')

  const safeNext = next.startsWith('/') ? next : '/'
  const state = JSON.stringify({ role, source, nonce, next: safeNext })

  const cookieStore = await cookies()
  cookieStore.set('oauth-state', nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600, // 10 minutes
  })

  const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth'

  const options = {
    redirect_uri: `${appUrl}/api/auth/google/callback`,
    client_id: process.env.GOOGLE_CLIENT_ID || '657539564972-ljbcdbebhpmcjb6en6h0rvvd5cbbj8o4.apps.googleusercontent.com',
    access_type: 'offline',
    response_type: 'code',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' '),
    state,
  }

  const qs = new URLSearchParams(options)

  return redirect(`${rootUrl}?${qs.toString()}`)
}
