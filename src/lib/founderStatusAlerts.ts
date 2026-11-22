import type { Payload } from 'payload'
import { notifyFounderStatusChangedAlert } from '@/lib/notifications'

export type FounderStatusAlertEvent = {
  eventKey: string
  eventLabel: string
  previousStatus?: string | null
  nextStatus?: string | null
  source?: string | null
}

type NotifyFounderStatusChanged = typeof notifyFounderStatusChangedAlert

const PROGRAM_STATUS_LABELS: Record<string, string> = {
  not_started: 'Not started',
  prework: 'Prework',
  active: '100 Days active',
  test: 'Test mode',
  failed: 'Failed',
  frozen: 'Frozen',
  completed: 'Completed',
}

function cleanStatus(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

export function buildFounderProgramStatusAlertEvent(
  previousStatus: unknown,
  nextStatus: unknown,
): FounderStatusAlertEvent | null {
  const previous = cleanStatus(previousStatus)
  const next = cleanStatus(nextStatus)

  if (!next || previous === next) return null

  return {
    eventKey: `program-status:${previous || 'none'}->${next}`,
    eventLabel: PROGRAM_STATUS_LABELS[next] || next,
    previousStatus: previous,
    nextStatus: next,
  }
}

export function buildFounderPersonalityStatusAlertEvent(): FounderStatusAlertEvent {
  return {
    eventKey: 'milestone:personality-completed',
    eventLabel: 'Personality completed',
    source: 'personality',
  }
}

function hasEvent(history: unknown, eventKey: string): boolean {
  if (!Array.isArray(history)) return false
  return history.some((entry) => {
    if (!entry || typeof entry !== 'object') return false
    return (entry as any).eventKey === eventKey
  })
}

export async function queueFounderStatusAlert(
  payload: Payload,
  userId: string | number,
  event: FounderStatusAlertEvent,
  appUrl: string,
  notify: NotifyFounderStatusChanged = notifyFounderStatusChangedAlert,
): Promise<{ sent: true } | { sent: false; reason: 'already_sent' | 'not_found' | 'not_founder' | 'missing_email' }> {
  const user = await payload.findByID({
    collection: 'users',
    id: userId,
    depth: 0,
    overrideAccess: true,
  }).catch(() => null) as any

  if (!user) return { sent: false, reason: 'not_found' }
  if (user.role !== 'founder') return { sent: false, reason: 'not_founder' }
  if (!user.email) return { sent: false, reason: 'missing_email' }
  if (hasEvent(user.founderStatusAlertHistory, event.eventKey)) {
    return { sent: false, reason: 'already_sent' }
  }

  await notify(
    payload,
    {
      userId: user.id,
      email: user.email,
      eventLabel: event.eventLabel,
      previousStatus: event.previousStatus,
      nextStatus: event.nextStatus,
      source: event.source,
    },
    appUrl,
  )

  await payload.update({
    collection: 'users',
    id: user.id,
    data: {
      founderStatusAlertHistory: [
        ...(Array.isArray(user.founderStatusAlertHistory) ? user.founderStatusAlertHistory : []),
        {
          eventKey: event.eventKey,
          eventLabel: event.eventLabel,
          sentAt: new Date().toISOString(),
        },
      ],
    },
    overrideAccess: true,
    context: {
      skipFounderStatusAlert: true,
    },
  } as any)

  return { sent: true }
}
