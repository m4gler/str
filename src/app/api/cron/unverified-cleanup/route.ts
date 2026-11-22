import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { hasPendingEmailVerification, isVerificationExpired } from '@/lib/accountVerification'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }

  const authHeader = request.headers.get('authorization') || ''
  const expected = `Bearer ${cronSecret}`
  if (
    authHeader.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await getPayload({ config })

  try {
    const candidates = await payload.find({
      collection: 'users',
      where: {
        and: [
          { role: { in: ['founder', 'investor'] } },
          { _verified: { equals: false } },
          { _verificationToken: { exists: true } },
        ],
      },
      limit: 500,
      overrideAccess: true,
      showHiddenFields: true,
      depth: 0,
    })

    let deleted = 0

    for (const doc of candidates.docs as any[]) {
      if (!hasPendingEmailVerification(doc) || !isVerificationExpired(doc.createdAt)) {
        continue
      }

      await payload.delete({
        collection: 'users',
        id: doc.id,
        overrideAccess: true,
      })

      deleted++
    }

    return NextResponse.json({
      ok: true,
      scanned: candidates.totalDocs,
      deleted,
    })
  } catch (error: any) {
    console.error('[cron/unverified-cleanup] Error:', error)
    return NextResponse.json({ error: error?.message || 'Cleanup failed' }, { status: 500 })
  }
}
