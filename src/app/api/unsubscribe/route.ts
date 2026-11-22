import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import crypto from 'crypto'

/**
 * GET /api/unsubscribe?token=<hmac>&email=<email>&type=<category>
 *
 * One-click email unsubscribe. The token is an HMAC-SHA256 of `email:type`
 * using PAYLOAD_SECRET, so users cannot forge unsubscribe links for others.
 *
 * Supported types: newsletter, attemptNotifications, paymentReminders, gateNotifications, programUpdates, all
 */

const VALID_TYPES = ['newsletter', 'attemptNotifications', 'paymentReminders', 'gateNotifications', 'programUpdates', 'all'] as const
type UnsubType = (typeof VALID_TYPES)[number]

function generateToken(email: string, type: string): string {
  const secret = process.env.PAYLOAD_SECRET
  if (!secret) throw new Error('PAYLOAD_SECRET is required')
  return crypto.createHmac('sha256', secret).update(`${email}:${type}`).digest('hex')
}

export function createUnsubscribeUrl(baseUrl: string, email: string, type: string): string {
  const token = generateToken(email, type)
  return `${baseUrl}/api/unsubscribe?email=${encodeURIComponent(email)}&type=${encodeURIComponent(type)}&token=${token}`
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')
  const type = searchParams.get('type') as UnsubType | null
  const token = searchParams.get('token')

  if (!email || !type || !token) {
    return new NextResponse(renderPage('Missing parameters', 'The unsubscribe link is invalid.'), {
      status: 400,
      headers: { 'Content-Type': 'text/html' },
    })
  }

  if (!VALID_TYPES.includes(type)) {
    return new NextResponse(renderPage('Invalid type', 'The unsubscribe category is not recognized.'), {
      status: 400,
      headers: { 'Content-Type': 'text/html' },
    })
  }

  // Verify HMAC token
  const expectedToken = generateToken(email, type)
  if (!crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expectedToken))) {
    return new NextResponse(renderPage('Invalid link', 'This unsubscribe link is invalid or has expired.'), {
      status: 403,
      headers: { 'Content-Type': 'text/html' },
    })
  }

  try {
    const payload = await getPayload({ config })

    const users = await payload.find({
      collection: 'users',
      where: { email: { equals: email } },
      limit: 1,
    })

    if (users.docs.length === 0) {
      return new NextResponse(renderPage('Not found', 'No account found with this email address.'), {
        status: 404,
        headers: { 'Content-Type': 'text/html' },
      })
    }

    const user = users.docs[0]
    const updateData: Record<string, any> = {}

    if (type === 'all') {
      updateData['emailPreferences.newsletter'] = false
      updateData['emailPreferences.attemptNotifications'] = false
      updateData['emailPreferences.paymentReminders'] = false
      updateData['emailPreferences.gateNotifications'] = false
      updateData['emailPreferences.programUpdates'] = false
    } else {
      updateData[`emailPreferences.${type}`] = false
    }

    await payload.update({
      collection: 'users',
      id: user.id,
      data: updateData,
    })

    const label = type === 'all' ? 'all email notifications' : type.replace(/([A-Z])/g, ' $1').toLowerCase()
    return new NextResponse(
      renderPage('Unsubscribed', `You have been unsubscribed from ${label}. You can re-enable notifications from your account settings.`),
      { status: 200, headers: { 'Content-Type': 'text/html' } },
    )
  } catch (err: any) {
    console.error('[unsubscribe] Error:', err)
    return new NextResponse(renderPage('Error', 'Something went wrong. Please try again later.'), {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
    })
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderPage(title: string, message: string): string {
  const safeTitle = escapeHtml(title)
  const safeMessage = escapeHtml(message)
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle} — MESGA</title>
  <style>
    body { margin: 0; padding: 0; background: #1c1c1e; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: #141416; border-radius: 16px; padding: 48px; max-width: 480px; text-align: center; border: 1px solid rgba(255,255,255,0.1); }
    h1 { color: #fff; font-size: 24px; margin: 0 0 16px; }
    p { color: #a1a1aa; font-size: 16px; line-height: 24px; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${safeTitle}</h1>
    <p>${safeMessage}</p>
  </div>
</body>
</html>`
}
