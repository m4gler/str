import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { cookies } from 'next/headers'
import { SignJWT } from 'jose'
import { randomBytes } from 'crypto'
import { getAppUrl } from '@/lib/appUrl'

export async function GET(request: Request) {
  const appUrl = getAppUrl()
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const stateParam = searchParams.get('state')

  let role = 'founder'
  let roleSource = 'login'
  let nextPath = '/'

  const cookieStore = await cookies()
  const storedNonce = cookieStore.get('oauth-state')?.value
  cookieStore.delete('oauth-state')

  // Validate CSRF state nonce
  try {
    if (stateParam) {
      if (stateParam.startsWith('{')) {
        const stateObj = JSON.parse(stateParam)
        role = stateObj.role || 'founder'
        roleSource = stateObj.source || 'login'
        const rawNext = stateObj.next ? String(stateObj.next) : '/'
        // Strict path validation: must start with single slash, no protocol-relative URLs
        nextPath = /^\/[a-zA-Z0-9_\-/?.=&%]*$/.test(rawNext) && !rawNext.startsWith('//') ? rawNext : '/'

        if (!storedNonce || stateObj.nonce !== storedNonce) {
          return NextResponse.redirect(`${appUrl}/login?error=invalid_state`)
        }
      } else {
        // Legacy plain-string state has no nonce — reject it
        return NextResponse.redirect(`${appUrl}/login?error=invalid_state`)
      }
    } else {
      return NextResponse.redirect(`${appUrl}/login?error=invalid_state`)
    }
  } catch (e) {
    return NextResponse.redirect(`${appUrl}/login?error=invalid_state`)
  }

  // Ensure role is valid
  role = (role === 'investor' || role === 'founder') ? role : 'founder'

  if (!code) {
    return NextResponse.redirect(`${appUrl}/login?error=no_code`)
  }

  try {
    const redirectUri = `${appUrl}/api/auth/google/callback`

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    const tokens = await tokenResponse.json()
    if (!tokens.access_token) {
      console.error('Failed to retrieve tokens:', tokens)
      throw new Error('Failed to get tokens')
    }

    const userResponse = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      }
    )
    const googleUser = await userResponse.json()

    if (!googleUser.email) {
      throw new Error('Google user has no email')
    }

    const payload = await getPayload({ config })

    // Find existing user by googleId or email
    const existingUsers = await payload.find({
      collection: 'users',
      where: {
        or: [
          { googleId: { equals: googleUser.id } },
          { email: { equals: googleUser.email } },
        ],
      },
      limit: 1,
      overrideAccess: true,
      showHiddenFields: true,
    })

    let user = existingUsers.docs[0]

    if (!user) {
      // Create new user with cryptographically secure random password
      const randomPassword = randomBytes(32).toString('hex')
      user = await payload.create({
        collection: 'users',
        disableVerificationEmail: true,
        data: {
          email: googleUser.email,
          googleId: googleUser.id,
          role: role as 'founder' | 'investor',
          password: randomPassword,
          isOnboarded: roleSource === 'register',
          _verified: true,
          _verificationToken: null,
        } as any,
        context: {
          trustedVerificationBypass: true,
        },
      })
    } else {
      const updateData: Record<string, any> = {}

      if (!user.googleId) {
        updateData.googleId = googleUser.id
      }

      if ((user as any)._verified !== true) {
        updateData._verified = true
        updateData._verificationToken = null
      }

      if (Object.keys(updateData).length > 0) {
        user = await payload.update({
          collection: 'users',
          id: user.id,
          data: updateData,
          context: {
            trustedVerificationBypass: true,
          },
        })
      }
    }

    // Generate Payload JWT manually — 30 days to match Users auth config
    const now = Math.floor(Date.now() / 1000)
    const thirtyDays = 60 * 60 * 24 * 30

    const fieldsToSign = {
      email: user.email,
      id: user.id,
      collection: 'users',
      role: user.role,
    }

    const token = await new SignJWT(fieldsToSign)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(now)
      .setExpirationTime(now + thirtyDays)
      .sign(new TextEncoder().encode(payload.secret))

    // Set session cookie
    cookieStore.set('payload-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: thirtyDays,
    })

    return NextResponse.redirect(`${appUrl}${nextPath}`)

  } catch (error) {
    console.error('Google Auth Error:', error)
    return NextResponse.redirect(`${appUrl}/login?error=auth_failed`)
  }
}
