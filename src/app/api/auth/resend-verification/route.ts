import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'

import config from '@/payload.config'
import {
  createEmailVerificationToken,
  hasPendingEmailVerification,
  isVerificationExpired,
  isVerificationResendCoolingDown,
  getVerificationResendCooldownRemainingSeconds,
  sendVerificationEmail,
  shouldAutoVerifyLoginUser,
} from '@/lib/accountVerification'
import { EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS } from '@/lib/verificationWindow'

export const dynamic = 'force-dynamic'

const GENERIC_RESPONSE = {
  ok: true,
  message: 'If this account still needs verification, we sent a new confirmation link.',
  cooldownRemainingSeconds: EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS,
}

export async function POST(request: NextRequest) {
  let email = ''

  try {
    const body = await request.json()
    email = String(body?.email || '').trim().toLowerCase()
  } catch {
    return NextResponse.json(GENERIC_RESPONSE)
  }

  if (!email) {
    return NextResponse.json(GENERIC_RESPONSE)
  }

  const payload = await getPayload({ config })

  try {
    const users = await payload.find({
      collection: 'users',
      where: {
        email: {
          equals: email,
        },
      },
      limit: 1,
      overrideAccess: true,
      showHiddenFields: true,
    })

    const user = users.docs[0] as any

    if (!user) {
      return NextResponse.json(GENERIC_RESPONSE)
    }

    if (shouldAutoVerifyLoginUser(user)) {
      await payload.update({
        collection: 'users',
        id: user.id,
        data: {
          _verified: true,
          _verificationToken: null,
          verificationEmailLastSentAt: null,
        } as any,
        overrideAccess: true,
        showHiddenFields: true,
      })

      return NextResponse.json(GENERIC_RESPONSE)
    }

    if (!hasPendingEmailVerification(user)) {
      return NextResponse.json(GENERIC_RESPONSE)
    }

    if (isVerificationExpired(user.createdAt)) {
      await payload.delete({
        collection: 'users',
        id: user.id,
        overrideAccess: true,
      })

      return NextResponse.json({
        ok: true,
        expired: true,
        message: 'The previous verification window expired. Register again to create a fresh account.',
      })
    }

    if (
      user.verificationEmailLastSentAt &&
      isVerificationResendCoolingDown(user.verificationEmailLastSentAt)
    ) {
      return NextResponse.json({
        ok: true,
        cooldownRemainingSeconds: getVerificationResendCooldownRemainingSeconds(
          user.verificationEmailLastSentAt,
        ),
        message: 'Please wait before requesting another confirmation email.',
      })
    }

    const token = createEmailVerificationToken()
    const verificationEmailLastSentAt = new Date().toISOString()

    await payload.update({
      collection: 'users',
      id: user.id,
      data: {
        _verificationToken: token,
        verificationEmailLastSentAt,
      } as any,
      overrideAccess: true,
      showHiddenFields: true,
    })

    await sendVerificationEmail(payload, user, token)

    return NextResponse.json({
      ok: true,
      cooldownRemainingSeconds: EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS,
      message: 'If this account still needs verification, we sent a new confirmation link.',
    })
  } catch (error) {
    console.error('[auth/resend-verification] Failed to resend verification email:', error)
    return NextResponse.json(GENERIC_RESPONSE)
  }
}
