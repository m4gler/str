import type { Payload } from 'payload'

type RelationId = number | string | null | undefined

export type DashboardCalendarNoticeReason = 'partner' | 'track' | 'partner_track'

type DashboardCalendarNoticeState = {
  version?: number | null
  seenVersion?: number | null
  reason?: DashboardCalendarNoticeReason | null
  previousCalendarLabel?: string | null
  nextCalendarLabel?: string | null
  previousPartnerName?: string | null
  nextPartnerName?: string | null
  previousPartnerLogoUrl?: string | null
  nextPartnerLogoUrl?: string | null
  previousTrackName?: string | null
  nextTrackName?: string | null
  changedAt?: string | null
}

type PartnerSnapshot = {
  name: string | null
  logoUrl: string | null
}

type TrackSnapshot = {
  name: string | null
}

function relationId(value: unknown): number | string | null {
  if (!value) return null
  if (typeof value === 'object' && value !== null && 'id' in value) {
    const nestedId = (value as { id?: number | string | null }).id
    return nestedId ?? null
  }
  if (typeof value === 'number' || typeof value === 'string') {
    return value
  }
  return null
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').trim()
}

function namesDiffer(a: string | null | undefined, b: string | null | undefined): boolean {
  return normalizeText(a) !== normalizeText(b)
}

async function readUserPartnerId(payload: Payload, userId: number | string): Promise<number | string | null> {
  const userDoc = await payload.findByID({
    collection: 'users',
    id: userId,
    depth: 0,
    overrideAccess: true,
  }).catch(() => null) as any

  return relationId(userDoc?.partner)
}

async function readPartnerSnapshot(payload: Payload, id: RelationId): Promise<PartnerSnapshot> {
  if (!id) {
    return { name: null, logoUrl: null }
  }

  const doc = await payload.findByID({
    collection: 'partners',
    id,
    depth: 1,
    overrideAccess: true,
  }).catch(() => null) as any

  const logo = doc?.logo

  return {
    name: typeof doc?.name === 'string' && doc.name.trim() ? doc.name.trim() : null,
    logoUrl: logo && typeof logo === 'object' && typeof logo.url === 'string' && logo.url.trim()
      ? logo.url.trim()
      : null,
  }
}

async function readTrackSnapshot(payload: Payload, id: RelationId): Promise<TrackSnapshot> {
  if (!id) {
    return { name: null }
  }

  const doc = await payload.findByID({
    collection: 'tracks',
    id,
    depth: 0,
    overrideAccess: true,
  }).catch(() => null) as any

  return {
    name: typeof doc?.name === 'string' && doc.name.trim() ? doc.name.trim() : null,
  }
}

async function readLatestProjectTrackId(
  payload: Payload,
  userId: number | string,
): Promise<number | string | null> {
  const result = await payload.find({
    collection: 'project-submissions',
    where: { user: { equals: userId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  }).catch(() => null)

  return relationId(result?.docs?.[0]?.track)
}

function formatCalendarLabel({
  partnerName,
  trackName,
  partnerChanged,
  trackChanged,
}: {
  partnerName: string | null
  trackName: string | null
  partnerChanged: boolean
  trackChanged: boolean
}): string {
  if (partnerChanged && trackChanged && partnerName && trackName) {
    return `${partnerName} + ${trackName} calendar`
  }

  if (partnerChanged && partnerName) {
    return `${partnerName} partner calendar`
  }

  if (trackChanged && trackName) {
    return `${trackName} track calendar`
  }

  if (partnerName) {
    return `${partnerName} partner calendar`
  }

  if (trackName) {
    return `${trackName} track calendar`
  }

  return 'Default MESGA calendar'
}

function hasPendingNotice(existingNotice?: DashboardCalendarNoticeState | null): boolean {
  return (existingNotice?.version ?? 0) > (existingNotice?.seenVersion ?? 0)
}

function hasExistingPartnerChange(existingNotice?: DashboardCalendarNoticeState | null): boolean {
  return namesDiffer(existingNotice?.previousPartnerName, existingNotice?.nextPartnerName)
}

function hasExistingTrackChange(existingNotice?: DashboardCalendarNoticeState | null): boolean {
  return namesDiffer(existingNotice?.previousTrackName, existingNotice?.nextTrackName)
}

export async function buildDashboardCalendarNoticeData(
  payload: Payload,
  {
    userId,
    existingNotice,
    previousPartnerId,
    nextPartnerId,
    currentPartnerId,
    previousTrackId,
    nextTrackId,
    currentTrackId,
  }: {
    userId: number | string
    existingNotice?: DashboardCalendarNoticeState | null
    previousPartnerId?: RelationId
    nextPartnerId?: RelationId
    currentPartnerId?: RelationId
    previousTrackId?: RelationId
    nextTrackId?: RelationId
    currentTrackId?: RelationId
  },
) {
  const unseenNotice = hasPendingNotice(existingNotice)
  const partnerUpdatedThisCall = previousPartnerId !== undefined || nextPartnerId !== undefined
  const trackUpdatedThisCall = previousTrackId !== undefined || nextTrackId !== undefined

  const resolvedCurrentPartnerId = currentPartnerId !== undefined
    ? currentPartnerId
    : await readUserPartnerId(payload, userId)
  const resolvedCurrentTrackId = currentTrackId !== undefined
    ? currentTrackId
    : await readLatestProjectTrackId(payload, userId)

  const livePreviousPartnerId = previousPartnerId !== undefined ? previousPartnerId : resolvedCurrentPartnerId
  const liveNextPartnerId = nextPartnerId !== undefined ? nextPartnerId : resolvedCurrentPartnerId
  const livePreviousTrackId = previousTrackId !== undefined ? previousTrackId : resolvedCurrentTrackId
  const liveNextTrackId = nextTrackId !== undefined ? nextTrackId : resolvedCurrentTrackId

  const [
    livePreviousPartner,
    liveNextPartner,
    livePreviousTrack,
    liveNextTrack,
  ] = await Promise.all([
    readPartnerSnapshot(payload, livePreviousPartnerId),
    readPartnerSnapshot(payload, liveNextPartnerId),
    readTrackSnapshot(payload, livePreviousTrackId),
    readTrackSnapshot(payload, liveNextTrackId),
  ])

  const previousPartner = unseenNotice && hasExistingPartnerChange(existingNotice)
    ? {
        name: existingNotice?.previousPartnerName ?? null,
        logoUrl: existingNotice?.previousPartnerLogoUrl ?? null,
      }
    : livePreviousPartner
  const nextPartner = unseenNotice && hasExistingPartnerChange(existingNotice) && !partnerUpdatedThisCall
    ? {
        name: existingNotice?.nextPartnerName ?? null,
        logoUrl: existingNotice?.nextPartnerLogoUrl ?? null,
      }
    : liveNextPartner

  const previousTrack = unseenNotice && hasExistingTrackChange(existingNotice)
    ? {
        name: existingNotice?.previousTrackName ?? null,
      }
    : livePreviousTrack
  const nextTrack = unseenNotice && hasExistingTrackChange(existingNotice) && !trackUpdatedThisCall
    ? {
        name: existingNotice?.nextTrackName ?? null,
      }
    : liveNextTrack

  const partnerChanged = namesDiffer(previousPartner.name, nextPartner.name)
  const trackChanged = namesDiffer(previousTrack.name, nextTrack.name)

  const reason: DashboardCalendarNoticeReason =
    partnerChanged && trackChanged
      ? 'partner_track'
      : partnerChanged
        ? 'partner'
        : 'track'

  const baselineVersion = existingNotice?.version ?? 0
  const baselineSeenVersion = existingNotice?.seenVersion ?? 0

  if (!partnerChanged && !trackChanged) {
    return {
      ...(existingNotice ?? {}),
      version: baselineVersion,
      seenVersion: Math.max(baselineSeenVersion, baselineVersion),
      reason: null,
      previousCalendarLabel: null,
      nextCalendarLabel: null,
      previousPartnerName: previousPartner.name,
      nextPartnerName: nextPartner.name,
      previousPartnerLogoUrl: previousPartner.logoUrl,
      nextPartnerLogoUrl: nextPartner.logoUrl,
      previousTrackName: previousTrack.name,
      nextTrackName: nextTrack.name,
      changedAt: new Date().toISOString(),
    }
  }

  return {
    ...(existingNotice ?? {}),
    version: baselineVersion + 1,
    seenVersion: baselineSeenVersion,
    reason,
    previousCalendarLabel: formatCalendarLabel({
      partnerName: previousPartner.name,
      trackName: previousTrack.name,
      partnerChanged,
      trackChanged,
    }),
    nextCalendarLabel: formatCalendarLabel({
      partnerName: nextPartner.name,
      trackName: nextTrack.name,
      partnerChanged,
      trackChanged,
    }),
    previousPartnerName: previousPartner.name,
    nextPartnerName: nextPartner.name,
    previousPartnerLogoUrl: previousPartner.logoUrl,
    nextPartnerLogoUrl: nextPartner.logoUrl,
    previousTrackName: previousTrack.name,
    nextTrackName: nextTrack.name,
    changedAt: new Date().toISOString(),
  }
}

export async function queueDashboardCalendarNotice(
  payload: Payload,
  {
    userId,
    previousPartnerId,
    nextPartnerId,
    currentPartnerId,
    previousTrackId,
    nextTrackId,
    currentTrackId,
  }: {
    userId: number | string
    previousPartnerId?: RelationId
    nextPartnerId?: RelationId
    currentPartnerId?: RelationId
    previousTrackId?: RelationId
    nextTrackId?: RelationId
    currentTrackId?: RelationId
  },
): Promise<void> {
  const userDoc = await payload.findByID({
    collection: 'users',
    id: userId,
    depth: 0,
    overrideAccess: true,
  }).catch(() => null) as any

  if (!userDoc || userDoc.role !== 'founder') {
    return
  }

  const nextNotice = await buildDashboardCalendarNoticeData(payload, {
    userId,
    existingNotice: (userDoc.dashboardCalendarNotice ?? {}) as DashboardCalendarNoticeState,
    previousPartnerId,
    nextPartnerId,
    currentPartnerId: currentPartnerId !== undefined ? currentPartnerId : relationId(userDoc.partner),
    previousTrackId,
    nextTrackId,
    currentTrackId,
  })

  await (payload as any).update({
    collection: 'users',
    id: userId,
    data: {
      dashboardCalendarNotice: nextNotice,
    },
    overrideAccess: true,
    context: {
      skipDashboardCalendarNoticeSync: true,
    },
  })
}

export function getRelationId(value: unknown): number | string | null {
  return relationId(value)
}
