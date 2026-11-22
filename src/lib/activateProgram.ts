import { getPayload } from 'payload'
import config from '@/payload.config'
import { notifyFounderChatInvite } from '@/lib/notifications'

/**
 * Activate the 100-day program for a user (marks hasPaid100Days = true).
 * This is a server-only utility — NOT a server action.
 * Only call from trusted server contexts (webhook handlers, server components).
 */
export async function activateProgramInternal(userId: string | number) {
  const payload = await getPayload({ config })
  const existingUser = await payload.findByID({
    collection: 'users',
    id: userId,
    overrideAccess: true,
  }).catch(() => null) as any

  await payload.update({
    collection: 'users',
    id: userId,
    data: { hasPaid100Days: true },
    overrideAccess: true,
  })

  if (existingUser && existingUser.hasPaid100Days !== true) {
    await sendFounderChatInviteOnce(payload, existingUser)
  }

  return { success: true }
}

export async function sendFounderChatInviteOnce(payload: any, user: any): Promise<void> {
  if (!user?.id) return
  if (user.role !== 'founder') return
  if (!user.email) return
  if (user.founderChatInviteSentAt) return

  await notifyFounderChatInvite(payload, user)

  await payload.update({
    collection: 'users',
    id: user.id,
    data: {
      founderChatInviteSentAt: new Date().toISOString(),
    },
    overrideAccess: true,
  }).catch((error: unknown) => {
    console.warn('[activateProgram] Failed to mark founder chat invite as sent', user.id, error)
  })
}
