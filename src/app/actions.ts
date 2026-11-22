'use server'

import { getPayload } from 'payload'
import config from '@/payload.config'
import { headers, cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { calculateScores, extractScoringConfig } from '@/lib/scoring'
import { getActivePersonalityTestFormId } from '@/lib/personalityTest'
import { parseProgramConfig, computeProgramStartDate, isBackfillSubmission, isBackfillWindowOpen, getDayType, computeCalendarDay, type PaymentType } from '@/lib/attemptEngine'
import { getEffectiveMaxAttemptsForUser } from '@/lib/attemptLimits'
import { runAutoCheck } from '@/lib/autoCheck'
import { getAppUrl } from '@/lib/appUrl'
import { getPreworkStartNowEligibility, getStartProgramAttemptEligibility } from '@/lib/programStart'
import { normaliseBranding } from '@/lib/partnerBranding'
import { isTestProgramStatus } from '@/lib/programTestMode'
import { activateProgramInternal, sendFounderChatInviteOnce } from '@/lib/activateProgram'
import {
  applyPaymentCookies,
  initiatePaymentForUser,
  type DiscountCodeValidationResult,
  type InvoiceFormData,
  validateDiscountCodeForUser,
} from '@/lib/paymentFlow'
import {
  hasPendingEmailVerification,
  isVerificationExpired,
} from '@/lib/accountVerification'
import {
  INTAKE_CONTEXT_COOKIE,
  parseIntakeContextCookie,
} from '@/lib/intakeContext'
import {
  PREFERRED_TRACK_COOKIE,
  resolvePreferredTrackId as resolvePreferredTrackIdFromOptions,
} from '@/lib/preferredTrack'
import { isSpaceTrackSlug } from '@/lib/availableTracks'
import { canFounderEditProjectSubmission, isProjectDescriptionRequiredForFounderSave } from '@/lib/projectSubmission'
import { SELECTED_MENTOR_COOKIE } from '@/lib/selectedMentor'
import { findUserFromPayloadToken } from '@/lib/payloadUserToken'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

async function getAuthenticatedUser(payload: any) {
  const headersObj = await headers()
  let { user } = await payload.auth({ headers: headersObj })

  if (!user) {
    const cookieStore = await cookies()
    const token = cookieStore.get('payload-token')?.value
    if (token) {
      try {
        user = await findUserFromPayloadToken(payload, token)
      } catch (e) { console.warn('JWT verify failed:', e) }
    }
  }

  // JWT-based auth doesn't include non-JWT fields like `partner`.
  // Re-fetch full user to ensure partner/emailPreferences are available.
  if (user && !user.partner && (user.role === 'mentor' || user.role === 'partner')) {
    try {
      user = await payload.findByID({
        collection: 'users',
        id: user.id,
        depth: 1,
      })
    } catch {}
  }

  return user
}

async function resolveSelectedMentorId(payload: any, rawMentorId: string | null | undefined): Promise<number | null> {
  const mentorId = rawMentorId?.trim()
  if (!mentorId) return null

  const mentorResult = await payload.find({
    collection: 'mentors',
    where: {
      and: [
        { id: { equals: mentorId } },
        { isActive: { equals: true } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  }).catch(() => ({ docs: [] }))

  const resolvedId = (mentorResult.docs as any[])?.[0]?.id
  return resolvedId != null ? Number(resolvedId) : null
}

export async function login(_prevState: any, formData: FormData) {
  const email = String(formData.get('email') || '').trim().toLowerCase()
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Missing email or password' }
  }

  // Rate limit: 10 login attempts per minute per IP
  const hdrs = await headers()
  const ip = getClientIp(hdrs)
  const rl = checkRateLimit(`login:${ip}`, { limit: 10, windowSeconds: 60 })
  if (!rl.allowed) {
    return { error: 'Too many login attempts. Please try again later.' }
  }

  const payload = await getPayload({ config })

  try {
    const existingUsers = await payload.find({
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

    const existingUser = existingUsers.docs[0] as any
    if (
      existingUser &&
      hasPendingEmailVerification(existingUser) &&
      isVerificationExpired(existingUser.createdAt)
    ) {
      await payload.delete({
        collection: 'users',
        id: existingUser.id,
        overrideAccess: true,
      })

      return {
        verificationExpired: true,
        error: 'Invalid credentials',
      }
    }

    const result = await payload.login({
      collection: 'users',
      data: {
        email,
        password,
      },
    })

    if (result.token) {
      const cookieStore = await cookies()
      cookieStore.set('payload-token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      })
    }

    return { success: true }
  } catch (error: any) {
    if (error?.name === 'UnverifiedEmail') {
      return {
        requiresVerification: true,
        error: 'Confirm your email before signing in.',
      }
    }

    return { error: 'Invalid credentials' }
  }
}

export async function register(_prevState: any, formData: FormData) {
  const email = String(formData.get('email') || '').trim().toLowerCase()
  const password = formData.get('password') as string
  const rawRole = formData.get('role') as string
  const safeRole: 'founder' | 'investor' = rawRole === 'investor' ? 'investor' : 'founder'

  if (!email || !password || !rawRole) {
    return { error: 'Missing required fields' }
  }

  // Rate limit: 5 register attempts per minute per IP
  const hdrs = await headers()
  const ip = getClientIp(hdrs)
  const rl = checkRateLimit(`register:${ip}`, { limit: 5, windowSeconds: 60 })
  if (!rl.allowed) {
    return { error: 'Too many registration attempts. Please try again later.' }
  }

  const payload = await getPayload({ config })
  const cookieStore = await cookies()

  try {
    // Check if user exists
    const existingUsers = await payload.find({
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

    const existingUser = existingUsers.docs[0] as any
    if (existingUser) {
      const canRecycleExpiredUnverifiedAccount =
        hasPendingEmailVerification(existingUser) &&
        isVerificationExpired(existingUser.createdAt)

      if (canRecycleExpiredUnverifiedAccount) {
        await payload.delete({
          collection: 'users',
          id: existingUser.id,
          overrideAccess: true,
        })
      } else if (hasPendingEmailVerification(existingUser)) {
        return {
          requiresVerification: true,
          error: 'An account with this email is already waiting for verification. Check your inbox or resend the confirmation email.',
        }
      } else {
        return { error: 'User already exists' }
      }
    }

    const selectedMentorCookie = await cookieStore.get(SELECTED_MENTOR_COOKIE)
    const selectedMentorId = safeRole === 'founder'
      ? await resolveSelectedMentorId(payload, selectedMentorCookie?.value || null)
      : null

    await payload.create({
      collection: 'users',
      data: {
        email,
        password,
        role: safeRole,
        isOnboarded: true,
        ...(selectedMentorId ? { mentor: selectedMentorId } : {}),
      },
    })

    if (selectedMentorId) {
      cookieStore.delete(SELECTED_MENTOR_COOKIE)
    }

    return {
      success: true,
      requiresVerification: true,
      message: 'We sent a confirmation link to your email. Confirm the account before signing in.',
    }
  } catch (error) {
    console.error('Registration error:', error)
    return { error: 'Registration failed. Please try again.' }
  }
}

export async function logout() {
  const cookieStore = await cookies()
  cookieStore.delete('payload-token')
  redirect('/login')
}

export async function updateProfile(userId: number, data: {
  businessIdea?: string
  phoneNumber?: string
  password?: string
  role?: 'founder' | 'investor'
  isOnboarded?: boolean
}) {
  const payload = await getPayload({ config })
  const user = await getAuthenticatedUser(payload)

  if (!user) {
    throw new Error('Unauthorized')
  }

  if (user.id !== userId) {
    throw new Error('Forbidden')
  }

  if (data.role && data.role !== 'founder' && data.role !== 'investor') {
    throw new Error('Invalid role')
  }
  if (data.role && data.role !== user.role && user.isOnboarded) {
    throw new Error('Role changes are disabled after onboarding')
  }

  const updateData: Record<string, any> = {}
  if (data.businessIdea !== undefined) updateData.businessIdea = data.businessIdea
  if (data.phoneNumber !== undefined) updateData.phoneNumber = data.phoneNumber
  if (data.password) updateData.password = data.password
  if (data.role) updateData.role = data.role
  if (data.isOnboarded !== undefined) updateData.isOnboarded = data.isOnboarded

  await payload.update({
    collection: 'users',
    id: userId,
    data: updateData,
  })

  revalidatePath('/')
  return { success: true }
}

export async function deleteAccount(userId: number) {
  const payload = await getPayload({ config })
  const user = await getAuthenticatedUser(payload)

  if (!user) {
    throw new Error('Unauthorized')
  }

  if (user.id !== userId) {
    throw new Error('Forbidden')
  }

  await payload.delete({
    collection: 'users',
    id: userId,
  })

  const cookieStore = await cookies()
  cookieStore.delete('payload-token')

  return { success: true }
}

// NPS RATING ACTION
export async function saveNpsRating(ratings: { npsMentors?: number; npsTasks?: number; npsBlocks?: number }) {
  const payload = await getPayload({ config })
  const user = await getAuthenticatedUser(payload)
  if (!user) throw new Error('Unauthorized')

  const data: Record<string, number> = {}
  if (ratings.npsMentors != null && ratings.npsMentors >= 0 && ratings.npsMentors <= 10) data.npsMentors = ratings.npsMentors
  if (ratings.npsTasks != null && ratings.npsTasks >= 0 && ratings.npsTasks <= 10) data.npsTasks = ratings.npsTasks
  if (ratings.npsBlocks != null && ratings.npsBlocks >= 0 && ratings.npsBlocks <= 10) data.npsBlocks = ratings.npsBlocks

  if (Object.keys(data).length === 0) return { success: true }

  await payload.update({ collection: 'users', id: user.id, data })
  revalidatePath('/feedback')
  return { success: true }
}

// 100-DAY PROGRAM ACTIONS

export async function startProgramAttempt(userId: string | number) {
  const payload = await getPayload({ config })
  const user = await getAuthenticatedUser(payload)
  if (!user || (String(user.id) !== String(userId) && user.role !== 'admin')) {
    throw new Error('Unauthorized')
  }

  const [currentUser, settings, dayProgram] = await Promise.all([
    payload.findByID({ collection: 'users', id: userId }),
    payload.findGlobal({ slug: 'platform-settings' }).catch(() => ({})) as Promise<any>,
    payload.findGlobal({ slug: 'day-program' }).catch(() => null),
  ])

  const paymentEnabled = (settings as any)?.paymentEnabled !== false
  const currentAttempts = (currentUser as any).programAttempts || 0

  // Determine payment type from user context
  const partnerId = (currentUser as any).partner?.id ?? (currentUser as any).partner
  let paymentType: PaymentType = 'self_paid'
  if (!paymentEnabled) paymentType = 'free'
  else if (partnerId) {
    const partner = await payload.findByID({ collection: 'partners', id: partnerId }).catch(() => null) as any
    if (partner?.customPricing?.enabled && partner?.customPricing?.type === 'free') {
      paymentType = 'sponsored'
    }
  }

  const cfg = parseProgramConfig(dayProgram)
  const maxAttempts = await getEffectiveMaxAttemptsForUser(payload, currentUser as any, paymentType, cfg)
  const openAttempts = await payload.find({
    collection: 'attempts',
    where: {
      user: { equals: userId },
      status: { in: ['active', 'warned_1', 'warned_2'] },
    },
    sort: '-attemptNumber',
    limit: 1,
    depth: 0,
  }).catch(() => null)
  const eligibility = getStartProgramAttemptEligibility({
    paymentEnabled,
    hasPaid100Days: Boolean((currentUser as any).hasPaid100Days),
    currentAttempts,
    maxAttempts,
    hasOpenAttempt: Boolean(openAttempts?.docs?.[0]),
  })

  if (!eligibility.allowed) {
    throw new Error(eligibility.message)
  }

  // Create Attempt record
  const attempt = await payload.create({
    collection: 'attempts',
    data: {
      user: Number(userId),
      attemptNumber: currentAttempts + 1,
      status: 'active',
      missCount: 0,
      currentDay: 1,
      missedDays: [],
      startedAt: new Date().toISOString(),
      paymentType,
    },
  })

  // Update user — start in prework phase (Day 1 unlocks after prework completion)
  await payload.update({
    collection: 'users',
    id: userId,
    data: {
      programAttempts: currentAttempts + 1,
      programStatus: 'prework',
      programStartDate: null,
    },
    overrideAccess: true,
  })

  await sendFounderChatInviteOnce(payload, currentUser as any)

  // Update team attemptsUsed if user belongs to a team
  const userDoc = await payload.findByID({ collection: 'users', id: userId, depth: 0 }) as any
  const teamId = userDoc?.team?.id ?? userDoc?.team
  if (teamId) {
    const team = await payload.findByID({ collection: 'teams', id: teamId, depth: 0 }) as any
    if (team) {
      await payload.update({
        collection: 'teams',
        id: teamId,
        data: { attemptsUsed: (team.attemptsUsed || 0) + 1 },
      })
    }
  }

  revalidatePath('/')
  return { success: true, attemptId: attempt.id }
}

export async function startProgramAfterPrework(): Promise<{ success: true } | { error: string }> {
  const payload = await getPayload({ config })
  const user = await getAuthenticatedUser(payload)

  if (!user || user.role !== 'founder') {
    return { error: 'Unauthorized' }
  }

  const [currentUser, dayProgramGlobal, activeAttempts] = await Promise.all([
    payload.findByID({ collection: 'users', id: user.id, depth: 0 }),
    payload.findGlobal({ slug: 'day-program' }).catch(() => null),
    payload.find({
      collection: 'attempts',
      where: {
        user: { equals: user.id },
        status: { in: ['active', 'warned_1', 'warned_2'] },
      },
      sort: '-attemptNumber',
      limit: 1,
      depth: 0,
    }),
  ])

  if ((currentUser as any)?.programStatus === 'active') {
    revalidatePath('/')
    return { success: true }
  }

  const cfg = parseProgramConfig(dayProgramGlobal)
  const scheduleFormIds = (dayProgramGlobal as any)?.preworkSchedule
    ? Object.values((dayProgramGlobal as any).preworkSchedule).filter((v): v is number => v != null)
    : []
  const preworkFormIds = scheduleFormIds.length > 0
    ? scheduleFormIds
    : await getPreworkFormIds(payload)

  if (preworkFormIds.length === 0) {
    return { error: 'No prework forms are configured.' }
  }

  const preworkSubs = await payload.find({
    collection: 'founder-form-submissions',
    where: {
      user: { equals: user.id },
      form: { in: preworkFormIds },
    },
    limit: 100,
    depth: 0,
  })
  const submittedFormIds = new Set(preworkSubs.docs.map((submission: any) =>
    typeof submission.form === 'object' ? submission.form.id : submission.form
  ))
  const totalPreworkBlocks = scheduleFormIds.length > 0 ? cfg.totalPreworkBlocks : preworkFormIds.length
  const activeAttempt = activeAttempts.docs[0] as any
  const eligibility = getPreworkStartNowEligibility({
    programStatus: (currentUser as any)?.programStatus,
    completedPreworkBlocks: submittedFormIds.size,
    totalPreworkBlocks,
    hasActiveAttempt: Boolean(activeAttempt),
  })

  if (!eligibility.allowed) {
    return { error: eligibility.message || 'Cannot start the 100-day program yet.' }
  }

  const now = new Date().toISOString()

  await payload.update({
    collection: 'attempts',
    id: activeAttempt.id,
    data: {
      startedAt: now,
      preworkCompletedAt: activeAttempt.preworkCompletedAt || now,
      currentDay: 1,
    },
    overrideAccess: true,
  })

  await payload.update({
    collection: 'users',
    id: user.id,
    data: {
      programStatus: 'active',
      programStartDate: now,
    },
    overrideAccess: true,
  })

  revalidatePath('/')
  return { success: true }
}

export async function failProgramAttempt(userId: string | number) {
  const payload = await getPayload({ config })
  const user = await getAuthenticatedUser(payload)

  if (!user || (String(user.id) !== String(userId) && user.role !== 'admin')) {
    throw new Error('Unauthorized')
  }

  // Find and close the active attempt
  const activeAttempts = await payload.find({
    collection: 'attempts',
    where: {
      user: { equals: userId },
      status: { in: ['active', 'warned_1', 'warned_2'] },
    },
    limit: 1,
  })

  if (activeAttempts.docs[0]) {
    await payload.update({
      collection: 'attempts',
      id: activeAttempts.docs[0].id,
      data: {
        status: 'failed',
        endedAt: new Date().toISOString(),
      },
    })
  }

  await payload.update({
    collection: 'users',
    id: userId,
    data: { programStatus: 'failed' },
    overrideAccess: true,
  })

  return { success: true }
}

export async function activateProgram(userId: string | number) {
  const payload = await getPayload({ config })
  const user = await getAuthenticatedUser(payload)

  if (!user || user.role !== 'admin') {
    throw new Error('Unauthorized')
  }

  return activateProgramInternal(userId)
}


// PAYMENT ACTIONS

// ---------------------------------------------------------------------------
// Discount code validation (client-callable, returns effective price)
// ---------------------------------------------------------------------------
export async function validateDiscountCode(
  code: string
): Promise<DiscountCodeValidationResult> {
  const trimmed = code.trim().toUpperCase()
  if (!trimmed) return { valid: false, error: 'No code provided' }

  const payload = await getPayload({ config })
  const user = await getAuthenticatedUser(payload)
  if (!user) return { valid: false, error: 'Authentication required' }

  return validateDiscountCodeForUser(payload, user, trimmed)
}

// ---------------------------------------------------------------------------
// Bulk code generation (admin only)
// ---------------------------------------------------------------------------
function makeCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no confusable chars (0/O, 1/I)
  const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `${seg()}-${seg()}-${seg()}`
}

export async function generateDiscountCodes(params: {
  count: number
  type: 'percent' | 'fixed_amount'
  value: number
  label?: string
  maxUses: number
}): Promise<{ count: number }> {
  const payload = await getPayload({ config })
  const user = await getAuthenticatedUser(payload)
  if (!user || (user as any).role !== 'admin') throw new Error('Unauthorized')

  const { count, type, value, label, maxUses } = params
  const n = Math.min(Math.max(1, count), 1000)
  let created = 0

  for (let i = 0; i < n; i++) {
    let attempts = 0
    while (attempts < 5) {
      try {
        await payload.create({
          collection: 'discount-codes',
          data: {
            code: makeCode(),
            type,
            value,
            ...(label ? { label } : {}),
            isActive: true,
            maxUses,
            useCount: 0,
          },
        })
        created++
        break
      } catch {
        attempts++ // retry on duplicate code collision (extremely rare)
      }
    }
  }

  return { count: created }
}

// ---------------------------------------------------------------------------
// Initiate payment — handles partner pricing, discount codes, and free access
// ---------------------------------------------------------------------------
export async function initiatePayment(
  invoiceData?: InvoiceFormData,
  discountCode?: string
): Promise<{ redirectUrl: string } | { error: string }> {
  const payload = await getPayload({ config })
  const user = await getAuthenticatedUser(payload)
  const result = await initiatePaymentForUser({
    payload,
    user,
    invoiceData,
    discountCode,
  })

  if (!result.ok) {
    return { error: result.error }
  }

  const cookieStore = await cookies()
  applyPaymentCookies(cookieStore, result.cookies)

  return { redirectUrl: result.redirectUrl }
}

// PROJECT SUBMISSION ACTIONS

async function getActiveTrackOptions(payload: any) {
  const result = await payload.find({
    collection: 'tracks',
    where: {
      isActive: { equals: true },
    },
    limit: 50,
    depth: 0,
    overrideAccess: true,
  })

  return (result.docs as any[]).map((track) => ({
    id: track.id,
    slug: track.slug,
  }))
}

async function resolvePreferredTrackIdFromCookie(
  payload: any,
  preferredTrackSlug: string | null | undefined,
): Promise<number | null> {
  const activeTracks = await getActiveTrackOptions(payload)
  const trackId = Number(resolvePreferredTrackIdFromOptions(preferredTrackSlug, activeTracks))
  return Number.isSafeInteger(trackId) && trackId > 0 ? trackId : null
}

async function resolveActiveTrackId(payload: any, requestedTrackId?: number | null): Promise<number | null> {
  const normalizedTrackId = Number(requestedTrackId)
  if (!Number.isSafeInteger(normalizedTrackId) || normalizedTrackId <= 0) {
    return null
  }

  const track = await payload.findByID({
    collection: 'tracks',
    id: normalizedTrackId,
    depth: 0,
    overrideAccess: true,
  }).catch(() => null) as any

  if (!track || track.isActive === false) {
    return null
  }

  return Number(track.id)
}

async function resolveTrackIdFromSlug(payload: any, trackSlug: string | null | undefined): Promise<number | null> {
  const normalizedSlug = String(trackSlug || '').trim().toLowerCase()
  if (!normalizedSlug) return null

  const result = await payload.find({
    collection: 'tracks',
    where: {
      and: [
        { slug: { equals: normalizedSlug } },
        { isActive: { equals: true } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  }).catch(() => null)

  const track = result?.docs?.[0] as any
  return track ? Number(track.id) : null
}

async function resolveTrackIdFromCurrentContext(payload: any, cookieStore: Awaited<ReturnType<typeof cookies>>) {
  const intakeContext = parseIntakeContextCookie(cookieStore.get(INTAKE_CONTEXT_COOKIE)?.value || null)

  if (intakeContext?.trackId != null) {
    const fromId = await resolveActiveTrackId(payload, Number(intakeContext.trackId))
    if (fromId != null) return fromId
  }

  if (intakeContext?.trackSlug) {
    const fromSlug = await resolveTrackIdFromSlug(payload, intakeContext.trackSlug)
    if (fromSlug != null) return fromSlug
  }

  return resolvePreferredTrackIdFromCookie(payload, cookieStore.get(PREFERRED_TRACK_COOKIE)?.value || null)
}

async function resolvePartnerIdFromSlug(payload: any, partnerSlug: string | null | undefined): Promise<number | null> {
  const normalizedSlug = String(partnerSlug || '').trim().toLowerCase()
  if (!normalizedSlug) return null

  const result = await payload.find({
    collection: 'partners',
    where: {
      and: [
        { slug: { equals: normalizedSlug } },
        { isActive: { equals: true } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  }).catch(() => null)

  const partner = result?.docs?.[0] as any
  return partner ? Number(partner.id) : null
}

async function resolveIntakeContextAssignment(payload: any, cookieStore: Awaited<ReturnType<typeof cookies>>) {
  const intakeContext = parseIntakeContextCookie(cookieStore.get(INTAKE_CONTEXT_COOKIE)?.value || null)

  let partnerId: number | null = null
  let trackId: number | null = null

  if (intakeContext?.partnerId != null) {
    partnerId = await resolveActivePartnerId(payload, Number(intakeContext.partnerId))
  } else if (intakeContext?.partnerSlug) {
    partnerId = await resolvePartnerIdFromSlug(payload, intakeContext.partnerSlug)
  }

  if (intakeContext?.trackId != null) {
    trackId = await resolveActiveTrackId(payload, Number(intakeContext.trackId))
  } else if (intakeContext?.trackSlug) {
    trackId = await resolveTrackIdFromSlug(payload, intakeContext.trackSlug)
  }

  return { intakeContext, partnerId, trackId }
}

export async function reviewProject(
  submissionId: string | number,
  action: 'approved' | 'denied',
  comment?: string
): Promise<{ success: boolean } | { error: string }> {
  const payload = await getPayload({ config })
  const user = await getAuthenticatedUser(payload)

  if (!user || ((user as any).role !== 'admin' && (user as any).role !== 'partner')) {
    return { error: 'Unauthorized' }
  }

  // Partner: verify the submission belongs to one of their users
  if ((user as any).role === 'partner') {
    const submission = await payload.findByID({
      collection: 'project-submissions',
      id: submissionId,
      depth: 2,
    }).catch(() => null) as any

    if (!submission) return { error: 'Submission not found' }

    const submissionUserId = submission.user?.id ?? submission.user
    const submissionUser = await payload.findByID({
      collection: 'users',
      id: submissionUserId,
      depth: 0,
    }).catch(() => null) as any

    if (!submissionUser) return { error: 'Submission not found' }

    const currentPartnerId = String((user as any).partner?.id ?? (user as any).partner)
    const subPartnerId = String(submissionUser.partner?.id ?? submissionUser.partner)

    if (!currentPartnerId || currentPartnerId !== subPartnerId) {
      return { error: 'Access denied' }
    }
  }

  await payload.update({
    collection: 'project-submissions',
    id: submissionId,
    data: {
      status: action,
      partnerComment: comment?.trim() ?? '',
      reviewedBy: user.id,
      reviewedAt: new Date().toISOString(),
    },
  })

  revalidatePath('/')
  revalidatePath('/partner')
  return { success: true }
}

export async function updatePartnerLogo(
  formData: FormData
): Promise<{ success: boolean; logoUrl?: string } | { error: string }> {
  const payload = await getPayload({ config })
  const user = await getAuthenticatedUser(payload)

  if (!user || (user as any).role !== 'partner') return { error: 'Unauthorized' }

  const partnerRaw = (user as any).partner
  const partnerId = partnerRaw?.id ?? partnerRaw
  if (!partnerId) return { error: 'No partner organization assigned to your account' }

  const file = formData.get('logo') as File | null
  if (!file || file.size === 0) return { error: 'No file provided' }
  if (!file.type.startsWith('image/')) return { error: 'File must be an image' }
  if (file.size > 5 * 1024 * 1024) return { error: 'File must be under 5 MB' }

  const buffer = Buffer.from(await file.arrayBuffer())

  const mediaDoc = await (payload as any).create({
    collection: 'media',
    data: { alt: `${partnerId}-logo` },
    file: { data: buffer, mimetype: file.type, name: file.name, size: file.size },
    overrideAccess: true,
  })

  await payload.update({
    collection: 'partners',
    id: partnerId,
    data: { logo: mediaDoc.id },
    overrideAccess: true,
  })

  return { success: true, logoUrl: mediaDoc.url ?? null }
}

export async function updatePartnerBannedWords(
  bannedWords: string
): Promise<{ success: boolean } | { error: string }> {
  const payload = await getPayload({ config })
  const user = await getAuthenticatedUser(payload)

  if (!user || (user as any).role !== 'partner') return { error: 'Unauthorized' }

  const partnerRaw = (user as any).partner
  const partnerId = partnerRaw?.id ?? partnerRaw
  if (!partnerId) return { error: 'No partner organization assigned to your account' }

  await payload.update({
    collection: 'partners',
    id: partnerId,
    data: { bannedWords: bannedWords.trim() },
  })

  return { success: true }
}

export async function updatePartnerBrandingColors(
  brandingColors: unknown
): Promise<{ success: boolean } | { error: string }> {
  const payload = await getPayload({ config })
  const user = await getAuthenticatedUser(payload)

  if (!user || (user as any).role !== 'partner') return { error: 'Unauthorized' }

  const partnerRaw = (user as any).partner
  const partnerId = partnerRaw?.id ?? partnerRaw
  if (!partnerId) return { error: 'No partner organization assigned to your account' }

  await payload.update({
    collection: 'partners',
    id: partnerId,
    data: { brandingColors: normaliseBranding((brandingColors as any) ?? null) } as any,
  })

  return { success: true }
}

// INVESTOR FORM ACTIONS

async function resolveActivePartnerId(payload: any, requestedPartnerId?: number | null): Promise<number | null> {
  if (requestedPartnerId == null) {
    return null
  }

  const partner = await payload.findByID({
    collection: 'partners',
    id: requestedPartnerId,
    depth: 0,
    overrideAccess: true,
  }).catch(() => null) as any

  if (!partner || partner.isActive === false) {
    return null
  }

  return Number(partner.id)
}

async function resolveSubmissionPartnerId(
  payload: any,
  user: any,
  requestedPartnerId?: number | null,
  options?: { preferRequested?: boolean },
): Promise<number | null> {
  if (options?.preferRequested && requestedPartnerId != null) {
    const requestedPartner = await resolveActivePartnerId(payload, requestedPartnerId)
    if (requestedPartner != null) return requestedPartner
  }

  const assignedPartnerId = (user as any)?.partner?.id ?? (user as any)?.partner
  if (assignedPartnerId) {
    return Number(assignedPartnerId)
  }

  return resolveActivePartnerId(payload, requestedPartnerId)
}

async function clearDraftForUser(payload: any, userId: number | string, formSlug?: string | null): Promise<void> {
  if (!formSlug) return

  const existing = await payload.find({
    collection: 'form-drafts',
    where: {
      and: [
        { user: { equals: userId } },
        { formSlug: { equals: formSlug } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const draft = existing.docs?.[0]
  if (!draft) return

  await payload.delete({
    collection: 'form-drafts',
    id: draft.id,
    overrideAccess: true,
  })
}

export async function submitInvestorForm(formId: number, submissionData: any, partnerId?: number | null, formSlug?: string | null) {
  const payload = await getPayload({ config })
  const user = await getAuthenticatedUser(payload)

  if (!user) {
    return { error: 'Authentication required' }
  }

  const email = user.email || (submissionData.email as string) || null
  const effectivePartnerId = await resolveSubmissionPartnerId(payload, user, partnerId)

  try {
    await payload.create({
      collection: 'investor-form-submissions',
      data: {
        form: formId,
        submissionData,
        email: email,
        user: user.id,
        status: 'new',
        ...(effectivePartnerId != null ? { partner: effectivePartnerId } : {}),
      },
    })
    await clearDraftForUser(payload, user.id, formSlug)
    revalidatePath('/')
    return { success: true }
  } catch (error) {
    console.error('Form submission error:', error)
    return { error: 'Submission failed' }
  }
}

// FOUNDER FORM ACTIONS

export async function submitFounderForm(
  formId: number,
  submissionData: any,
  partnerId?: number | null,
  requestedProgramDay?: number | null,
  formSlug?: string | null,
  selectedTrackSlug?: string | null,
) {
  const payload = await getPayload({ config })
  const user = await getAuthenticatedUser(payload)
  const cookieStore = await cookies()

  if (!user) {
    return { error: 'Authentication required' }
  }

  const email = user.email || (submissionData.email as string) || null
  let effectivePartnerId = await resolveSubmissionPartnerId(payload, user, partnerId)
  let isMainIntakeForm = false
  let resolvedContextPartnerId: number | null = null
  let resolvedContextTrackId: number | null = null

  let personalityScores = null
  let platformSettings: any = null
  try {
    platformSettings = await payload.findGlobal({ slug: 'platform-settings' }).catch(() => null)
    const activePTFormId = getActivePersonalityTestFormId(platformSettings)
    const activeFounderFormRef = platformSettings?.activeFounderForm
    const activeFounderFormIdStr = String(typeof activeFounderFormRef === 'object' ? activeFounderFormRef?.id : activeFounderFormRef)
    const submittedFormIdStr = String(formId)
    const isPersonalityTest = activePTFormId != null && submittedFormIdStr === activePTFormId
    isMainIntakeForm = submittedFormIdStr === activeFounderFormIdStr && (!activePTFormId || submittedFormIdStr !== activePTFormId)

    if (isMainIntakeForm) {
      const intakeContextAssignment = await resolveIntakeContextAssignment(payload, cookieStore)
      resolvedContextPartnerId = intakeContextAssignment.partnerId
      resolvedContextTrackId = intakeContextAssignment.trackId

      if (intakeContextAssignment.intakeContext?.trackLocked) {
        if (resolvedContextTrackId == null) {
          return { error: 'The assigned track is no longer available.' }
        }
      } else if (selectedTrackSlug != null) {
        resolvedContextTrackId = await resolveTrackIdFromSlug(payload, selectedTrackSlug)
        if (resolvedContextTrackId == null) {
          return { error: 'Please select an active track.' }
        }
      }

      if (resolvedContextPartnerId != null) {
        effectivePartnerId = await resolveSubmissionPartnerId(
          payload,
          user,
          resolvedContextPartnerId,
          { preferRequested: true },
        )
      }
    }

    if (isPersonalityTest) {
      const scoringConfig = extractScoringConfig(platformSettings)
      personalityScores = calculateScores(submissionData, scoringConfig)
    }
  } catch (e) {
    console.warn('Scoring calculation failed:', e)
  }

  let programDay: number | undefined = undefined
  try {
    const activePTFormId = getActivePersonalityTestFormId(platformSettings)
    const submittedFormIdStr = String(formId)

    const isSystemForm = (activePTFormId != null && submittedFormIdStr === activePTFormId) || isMainIntakeForm

    const firstSub = await payload.find({
      collection: 'founder-form-submissions',
      where: { user: { equals: user.id } },
      sort: 'createdAt',
      limit: 1,
      depth: 0,
    })

    // Prefer the active attempt start date; keep the user field as a legacy fallback.
    const freshUser = await payload.findByID({ collection: 'users', id: user.id, depth: 0 })
    const programStatus = (freshUser as any)?.programStatus || 'not_started'
    const isTestMode = isTestProgramStatus(programStatus)
    const activeAttempts = await payload.find({
      collection: 'attempts',
      where: {
        user: { equals: user.id },
        status: { in: ['active', 'warned_1', 'warned_2'] },
      },
      sort: '-attemptNumber',
      limit: 1,
      depth: 0,
    }).catch(() => null)
    const activeAttemptForDate = activeAttempts?.docs?.[0] as any
    const programStartDate = activeAttemptForDate?.startedAt || (freshUser as any)?.programStartDate || null

    if (!isSystemForm && (firstSub.totalDocs > 0 || isTestMode)) {
      if (programStatus !== 'active' && programStatus !== 'prework' && !isTestMode) {
        return { error: 'Your 100-day program is not currently active.' }
      }

      const ptSub = activePTFormId == null
        ? { docs: [] }
        : await payload.find({
            collection: 'founder-form-submissions',
            where: {
              user: { equals: user.id },
              form: { equals: activePTFormId },
            },
            sort: '-createdAt',
            limit: 1,
            depth: 0,
          })
      const archetype = (ptSub.docs[0] as any)?.archetype || null
      const founderTrack = (ptSub.docs[0] as any)?.track || null

      if (programStartDate || isTestMode) {
        const { validateDaySubmission } = await import('@/lib/dayProgression')
        const validation = await validateDaySubmission(
          payload,
          user.id,
          programStartDate,
          archetype,
          formId,
          founderTrack,
          effectivePartnerId ?? null,
          requestedProgramDay,
        )
        if (!validation.allowed) {
          return { error: validation.error || 'Day submission not allowed' }
        }
        if (validation.programDay > 0) {
          programDay = validation.programDay
        }
      }
    }
  } catch (e) {
    console.warn('Day validation skipped:', e)
  }

  // Backfill detection — PRD Section 5.2
  let isBackfill = false
  let attemptId: number | undefined = undefined
  let activeAttempt: any = null
  let dayType: 'standard' | 'retro' | 'gate' | 'prework' | undefined = undefined
  let isTestProgramSubmission = false

  if (programDay != null) {
    try {
      const freshUser = await payload.findByID({ collection: 'users', id: user.id, depth: 0 }) as any
      isTestProgramSubmission = isTestProgramStatus(freshUser?.programStatus)

      const dayProgramGlobal = await payload.findGlobal({ slug: 'day-program' }).catch(() => null)
      const cfg = parseProgramConfig(dayProgramGlobal)
      dayType = getDayType(programDay, cfg)

      // Always attach test submissions to the user's active attempt when one exists.
      const activeAttempts = await payload.find({
        collection: 'attempts',
        where: {
          user: { equals: user.id },
          status: { in: ['active', 'warned_1', 'warned_2'] },
        },
        sort: '-attemptNumber',
        limit: 1,
      })
      if (activeAttempts.docs[0]) {
        activeAttempt = activeAttempts.docs[0] as any
        attemptId = activeAttempt.id as number
      }

      const programStartDate = activeAttempt?.startedAt || freshUser?.programStartDate

      if (!isTestProgramSubmission && programStartDate) {
        const calendarDay = computeCalendarDay(new Date(programStartDate), new Date(), 'Europe/Warsaw')
        isBackfill = isBackfillSubmission(programDay, calendarDay)

        if (isBackfill && !isBackfillWindowOpen(programDay, calendarDay, cfg)) {
          return { error: `The backfill window for Day ${programDay} has expired.` }
        }
      }
    } catch (e) {
      console.warn('Backfill detection failed:', e)
    }
  } else {
    const submittedSlug = formSlug
      || (await payload.findByID({ collection: 'founder-forms', id: formId, depth: 0 }).catch(() => null) as any)?.slug
    if (String(submittedSlug || '').startsWith('daily-prework-block-')) {
      dayType = 'prework'
    }
  }

  // Retro validation — PRD Phase 2 Item 8
  if (dayType === 'retro' && submissionData) {
    const whatWorked = String(submissionData.retro_what_worked || '').trim()
    const whatDidntWork = String(submissionData.retro_what_didnt_work || '').trim()
    if (whatWorked.length < 100) {
      return { error: '"What worked this week?" must be at least 100 characters.' }
    }
    if (whatDidntWork.length < 100) {
      return { error: '"What didn\'t work?" must be at least 100 characters.' }
    }
  }

  try {
    const submission = await payload.create({
      collection: 'founder-form-submissions',
      data: {
        form: formId,
        submissionData,
        email: email,
        user: user.id,
        status: 'new',
        ...(effectivePartnerId != null ? { partner: effectivePartnerId } : {}),
        ...(programDay != null ? { programDay } : {}),
        ...(isBackfill ? { isBackfill: true } : {}),
        ...(isBackfill && programDay != null && Array.isArray(activeAttempt?.missedDays) && activeAttempt.missedDays.includes(programDay)
          ? { missedCounted: true }
          : {}),
        ...(attemptId ? { attempt: attemptId } : {}),
        ...(dayType ? { dayType } : {}),
        ...(personalityScores ? {
          personalityScores: personalityScores as unknown as Record<string, unknown>,
          archetype: personalityScores.archetype,
          track: personalityScores.track as 'Operator Track' | 'Explorer Track' | 'Support Track' | 'Starter Track',
        } : {}),
      },
    })

    // Fire-and-forget auto-check + AI summary for daily submissions
    if (programDay != null && programDay > 0) {
      runAutoCheck(payload, submission.id, user.id, attemptId, programDay, submissionData || {}, formId).catch(console.error)
    }

    // Prework completion check — PRD Section 3.B.2
    // If this was a prework form, check if all prework blocks are now complete
    if (programDay == null) {
      // Check if the submitted form is a prework form
      try {
        const freshUser = await payload.findByID({ collection: 'users', id: user.id, depth: 0 }) as any
        if (freshUser?.programStatus === 'prework') {
          const dayProgramGlobal = await payload.findGlobal({ slug: 'day-program' }).catch(() => null) as any
          const cfg = parseProgramConfig(dayProgramGlobal)

          // Get prework form IDs from schedule or fallback to slug-based lookup
          const scheduleFormIds = dayProgramGlobal?.preworkSchedule
            ? Object.values(dayProgramGlobal.preworkSchedule).filter((v): v is number => v != null)
            : []
          const preworkFormIds = scheduleFormIds.length > 0
            ? scheduleFormIds
            : await getPreworkFormIds(payload)

          // Check if submitted form is a prework form
          const isPreworkForm = preworkFormIds.includes(Number(formId))
            || (await payload.findByID({ collection: 'founder-forms', id: formId, depth: 0 }) as any)?.slug?.startsWith('daily-prework-block-')

          if (isPreworkForm) {
            // Count completed prework submissions
            const preworkSubs = await payload.find({
              collection: 'founder-form-submissions',
              where: {
                user: { equals: user.id },
                form: { in: preworkFormIds },
              },
              limit: 0,
              depth: 0,
            })

            if (preworkSubs.totalDocs >= cfg.totalPreworkBlocks) {
              // All prework done! Compute Day 1 start date
              const now = new Date()
              const programStartDateVal = computeProgramStartDate(now, 'Europe/Warsaw')

              // Update Attempt
              const activeAttempts = await payload.find({
                collection: 'attempts',
                where: {
                  user: { equals: user.id },
                  status: { in: ['active', 'warned_1', 'warned_2'] },
                },
                limit: 1,
              })
              if (activeAttempts.docs[0]) {
                await payload.update({
                  collection: 'attempts',
                  id: activeAttempts.docs[0].id,
                  data: {
                    preworkCompletedAt: now.toISOString(),
                    startedAt: programStartDateVal.toISOString(),
                  },
                })
              }

              // Update User — activate program
              await payload.update({
                collection: 'users',
                id: user.id,
                data: {
                  programStatus: 'prework',
                  programStartDate: programStartDateVal.toISOString(),
                },
                overrideAccess: true,
              })
            }
          }
        }
      } catch (e) {
        console.warn('Prework completion check failed:', e)
      }
    }

    // Keep self-selected referrals scoped to submissions only. Partner pricing
    // should come from a server-side user assignment, not client-chosen input.


    // Auto-create a project submission when the main intake form is submitted
    // (not a personality test, not a daily form)
    const isDailyWorkflowForm = programDay != null

    if (isMainIntakeForm && !isDailyWorkflowForm) {
      if (resolvedContextPartnerId != null) {
        const currentUser = await payload.findByID({
          collection: 'users',
          id: user.id,
          depth: 0,
          overrideAccess: true,
        }).catch(() => null) as any

        const currentPartnerId = currentUser?.partner?.id ?? currentUser?.partner ?? null
        if (!currentPartnerId) {
          await payload.update({
            collection: 'users',
            id: user.id,
            data: { partner: resolvedContextPartnerId },
            overrideAccess: true,
          })
        }
      }

      try {
        const payloadAny = payload as any
        const preferredTrackId =
          resolvedContextTrackId != null
            ? resolvedContextTrackId
            : await resolveTrackIdFromCurrentContext(payload, cookieStore)

        const existingProj = await payloadAny.find({
          collection: 'project-submissions',
          where: { user: { equals: user.id } },
          limit: 1,
        })

        if (existingProj.totalDocs === 0) {
          await payloadAny.create({
            collection: 'project-submissions',
            data: {
              user: user.id,
              projectDescription: '',
              ...(preferredTrackId ? { track: preferredTrackId } : {}),
              status: 'pending',
              autoDenied: false,
            },
          })
        } else if (preferredTrackId && !existingProj.docs[0]?.track) {
          await payloadAny.update({
            collection: 'project-submissions',
            id: existingProj.docs[0].id,
            data: { track: preferredTrackId },
          })
        }
      } catch (e) {
        console.warn('Auto project submission creation failed:', e)
      }
    }

    await clearDraftForUser(payload, user.id, formSlug)
    return { success: true, personalityScores }
  } catch (error) {
    console.error('Founder form submission error:', error)
    return { error: 'Submission failed' }
  }
}

export async function saveProjectSubmission(
  description: string,
  trackId?: number | null,
  workspaceUrl?: string | null,
): Promise<{ success: boolean } | { error: string }> {
  const payload = await getPayload({ config })
  const user = await getAuthenticatedUser(payload)

  if (!user || (user as any).role !== 'founder') {
    return { error: 'Unauthorized' }
  }

  const trimmed = description.trim()

  const trimmedWorkspaceUrl = (workspaceUrl ?? '').trim()
  if (!trimmedWorkspaceUrl) {
    return { error: 'Project workspace URL is required' }
  }

  try {
    const parsed = new URL(trimmedWorkspaceUrl)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { error: 'Workspace URL must start with http:// or https://' }
    }
  } catch {
    return { error: 'Workspace URL is not a valid URL' }
  }

  const payloadAny = payload as any
  const existing = await payloadAny.find({
    collection: 'project-submissions',
    where: { user: { equals: user.id } },
    limit: 1,
    depth: 0,
  })

  const existingDoc = existing.docs[0]
  if (isProjectDescriptionRequiredForFounderSave(existingDoc) && !trimmed) {
    return { error: 'Description cannot be empty' }
  }

  const existingTrackRef = existingDoc?.track
  const existingTrackIdValue = typeof existingTrackRef === 'object' ? existingTrackRef?.id : existingTrackRef
  const existingTrackId = Number.isSafeInteger(Number(existingTrackIdValue)) && Number(existingTrackIdValue) > 0
    ? Number(existingTrackIdValue)
    : null
  const isReviewed = existing.totalDocs > 0 && ['approved', 'denied'].includes(existingDoc.status)

  let requestedTrackId: number | null = null
  if (trackId != null) {
    const normalizedTrackId = Number(trackId)
    if (!Number.isSafeInteger(normalizedTrackId) || normalizedTrackId <= 0) {
      return { error: 'Please select an active track' }
    }
    requestedTrackId = normalizedTrackId
  }

  let resolvedTrackId: number | null
  if (isReviewed) {
    if (requestedTrackId != null && requestedTrackId !== existingTrackId) {
      return { error: 'Cannot change track after review' }
    }
    resolvedTrackId = existingTrackId
  } else if (requestedTrackId != null && requestedTrackId === existingTrackId) {
    // Preserve an already assigned track even if it has since been deactivated.
    resolvedTrackId = existingTrackId
  } else if (requestedTrackId != null) {
    resolvedTrackId = await resolveActiveTrackId(payload, requestedTrackId)
    if (resolvedTrackId == null) {
      return { error: 'Please select an active track' }
    }
  } else if (existingTrackId != null) {
    resolvedTrackId = existingTrackId
  } else {
    resolvedTrackId = null
  }

  if (!isReviewed && resolvedTrackId == null) {
    return { error: 'Please select a track' }
  }

  const data: Record<string, any> = { projectDescription: trimmed }
  if (!isReviewed && resolvedTrackId != null && resolvedTrackId !== existingTrackId) {
    data.track = resolvedTrackId
    if (existing.totalDocs > 0) data.spaceDataRelevance = null
  }
  data.workspaceUrl = trimmedWorkspaceUrl

  if (existing.totalDocs > 0) {
    const doc = existingDoc
    const editRules = canFounderEditProjectSubmission(doc)
    if (!editRules.canEditDescription && trimmed !== (doc.projectDescription || '').trim()) {
      return { error: 'Cannot edit project description after review' }
    }
    if (!editRules.canEditWorkspaceUrl && trimmedWorkspaceUrl !== (doc.workspaceUrl || '').trim()) {
      return { error: 'Cannot edit workspace URL after review' }
    }
    if (!editRules.canEditDescription && editRules.canEditWorkspaceUrl) {
      data.projectDescription = doc.projectDescription || trimmed
    }
    if (trimmed !== (doc.projectDescription || '').trim() && editRules.canEditDescription) {
      data.spaceDataRelevance = null
    }
    await payloadAny.update({
      collection: 'project-submissions',
      id: doc.id,
      data,
    })
  } else {
    await payloadAny.create({
      collection: 'project-submissions',
      data: {
        user: user.id,
        ...data,
        status: 'pending',
      },
    })
  }

  await clearDraftForUser(payload, user.id, 'project-submission')
  revalidatePath('/')
  return { success: true }
}

export async function getMyProjectSubmissionPreview(): Promise<{
  projectSubmission: {
    id: number
    status: string
    partnerComment?: string | null
    spaceDataRelevance?: any
    projectDescription?: string | null
    workspaceUrl?: string | null
    trackId?: number | null
  } | null
} | { error: string }> {
  const payload = await getPayload({ config })
  const user = await getAuthenticatedUser(payload)

  if (!user || (user as any).role !== 'founder') {
    return { error: 'Unauthorized' }
  }

  const existing = await (payload as any).find({
    collection: 'project-submissions',
    where: { user: { equals: user.id } },
    limit: 1,
    depth: 1,
  })

  if (!existing.totalDocs) {
    return { projectSubmission: null }
  }

  const doc = existing.docs[0]
  const trackRef = doc.track
  const trackId = typeof trackRef === 'object' ? trackRef?.id : trackRef
  const trackSlug = typeof trackRef === 'object' && trackRef?.isActive !== false ? trackRef?.slug : null

  return {
    projectSubmission: {
      id: doc.id,
      status: doc.status,
      partnerComment: doc.partnerComment ?? null,
      spaceDataRelevance: isSpaceTrackSlug(trackSlug) ? doc.spaceDataRelevance ?? null : null,
      projectDescription: doc.projectDescription ?? null,
      workspaceUrl: doc.workspaceUrl ?? null,
      trackId: trackId ?? null,
    },
  }
}

export async function acknowledgeDashboardCalendarNotice(
  version: number,
): Promise<{ success: boolean } | { error: string }> {
  const payload = await getPayload({ config })
  const user = await getAuthenticatedUser(payload)

  if (!user || (user as any).role !== 'founder') {
    return { error: 'Unauthorized' }
  }

  const fullUser = await payload.findByID({
    collection: 'users',
    id: user.id,
    depth: 0,
  }).catch(() => null) as any

  if (!fullUser) {
    return { error: 'User not found' }
  }

  const notice = (fullUser.dashboardCalendarNotice ?? {}) as {
    seenVersion?: number | null
  }
  const currentSeenVersion = Number(notice.seenVersion ?? 0)
  const nextSeenVersion = Math.max(currentSeenVersion, Number(version || 0))

  if (nextSeenVersion === currentSeenVersion) {
    return { success: true }
  }

  await (payload as any).update({
    collection: 'users',
    id: user.id,
    data: {
      dashboardCalendarNotice: {
        ...notice,
        seenVersion: nextSeenVersion,
      },
    },
  })

  return { success: true }
}

// PARTNER DECISION ACTION — Phase 2 Item 6

export async function submitPartnerDecision(
  attemptId: string | number,
  decision: 'grant' | 'end',
): Promise<{ success: boolean } | { error: string }> {
  const payload = await getPayload({ config })
  const user = await getAuthenticatedUser(payload)

  if (!user || ((user as any).role !== 'partner' && (user as any).role !== 'admin')) {
    return { error: 'Unauthorized' }
  }

  const attempt = await payload.findByID({
    collection: 'attempts',
    id: attemptId,
    depth: 2,
  }) as any

  if (!attempt) return { error: 'Attempt not found' }
  if (attempt.partnerDecision !== 'pending') return { error: 'This attempt does not have a pending partner decision' }

  const founder = typeof attempt.user === 'object' ? attempt.user : null
  if (!founder) return { error: 'Founder not found on attempt' }

  if ((user as any).role === 'partner') {
    const currentPartnerId = String((user as any).partner?.id ?? (user as any).partner ?? '')
    const founderPartnerId = String((founder as any).partner?.id ?? (founder as any).partner ?? '')

    if (!currentPartnerId || currentPartnerId !== founderPartnerId) {
      return { error: 'Access denied' }
    }
  }

  const appUrl = getAppUrl()

  if (decision === 'grant') {
    // Check partner has remaining grants
    const partnerId = (user as any).partner?.id ?? (user as any).partner
    if (!partnerId && (user as any).role !== 'admin') return { error: 'No partner organization assigned' }

    if (partnerId) {
      const partner = await payload.findByID({ collection: 'partners', id: partnerId }) as any
      if ((partner?.overrideGrantsRemaining ?? 0) <= 0) {
        return { error: 'No override grants remaining. Contact admin to request more.' }
      }
      // Decrement grants
      await payload.update({
        collection: 'partners',
        id: partnerId,
        data: { overrideGrantsRemaining: Math.max(0, (partner.overrideGrantsRemaining || 0) - 1) },
      })
    }

    // Mark old attempt as granted
    await payload.update({
      collection: 'attempts',
      id: attemptId,
      data: { partnerDecision: 'granted' },
    })

    const newAttemptNumber = (attempt.attemptNumber || 1) + 1

    // Create fresh attempt
    await payload.create({
      collection: 'attempts',
      data: {
        user: founder.id,
        attemptNumber: newAttemptNumber,
        status: 'active',
        missCount: 0,
        currentDay: 1,
        missedDays: [],
        startedAt: new Date().toISOString(),
        paymentType: attempt.paymentType,
        ...(attempt.cohort ? { cohort: typeof attempt.cohort === 'object' ? attempt.cohort.id : attempt.cohort } : {}),
      },
    })

    // Update user
    await payload.update({
      collection: 'users',
      id: founder.id,
      data: {
        programStatus: 'active',
        programAttempts: newAttemptNumber,
        programStartDate: new Date().toISOString(),
      },
      overrideAccess: true,
    })

    const { notifyPartnerGranted, notifyPartnerGrantsDepleted } = await import('@/lib/notifications')
    await notifyPartnerGranted(payload, { email: founder.email }, newAttemptNumber, appUrl)

    // Notify admins when partner's grants are fully depleted
    if (partnerId) {
      const updatedPartner = await payload.findByID({ collection: 'partners', id: partnerId }) as any
      if ((updatedPartner?.overrideGrantsRemaining ?? 0) <= 0) {
        await notifyPartnerGrantsDepleted(payload, updatedPartner.name || 'Unknown', partnerId, appUrl)
      }
    }

    revalidatePath('/')
    revalidatePath('/partner')
    return { success: true }
  } else {
    // End process
    await payload.update({
      collection: 'attempts',
      id: attemptId,
      data: { partnerDecision: 'ended' },
    })

    await payload.update({
      collection: 'users',
      id: founder.id,
      data: { programStatus: 'frozen' },
      overrideAccess: true,
    })

    const { notifyPartnerEnded } = await import('@/lib/notifications')
    await notifyPartnerEnded(payload, { email: founder.email }, appUrl)

    revalidatePath('/')
    revalidatePath('/partner')
    return { success: true }
  }
}

async function getPreworkFormIds(payload: any): Promise<number[]> {
  const forms = await payload.find({
    collection: 'founder-forms',
    where: {
      slug: { like: 'daily-prework-block-%' },
    },
    limit: 20,
    depth: 0,
  })
  return forms.docs.map((f: any) => f.id)
}

export async function createMentorReview(data: {
  submissionId: number
  dayNumber: number
  score: number
  comment: string
  internalNote?: string
  isGateReview?: boolean
  gateDecision?: 'pass' | 'fail' | 'revise' | null
  evidencePackUrl?: string
}): Promise<{ success: boolean; reviewId?: number } | { error: string }> {
  const payload = await getPayload({ config })
  const user = await getAuthenticatedUser(payload)

  if (!user) return { error: 'Unauthorized' }
  const role = (user as any).role
  if (role !== 'admin' && role !== 'mentor' && role !== 'partner') {
    return { error: 'Only admins, partners, and mentors can create reviews' }
  }

  if (data.score < 1 || data.score > 5) return { error: 'Score must be 1-5' }
  if (!data.comment?.trim()) return { error: 'Comment is required' }

  // Verify submission exists (overrideAccess since we already auth-checked above)
  const submission = await payload.findByID({
    collection: 'founder-form-submissions',
    id: data.submissionId,
    depth: 2,
    overrideAccess: true,
  }).catch(() => null) as any

  if (!submission) return { error: 'Submission not found' }

  // Partner mentors and partner accounts can only review their partner's founders
  if (role === 'mentor' || role === 'partner') {
    const mentorPartnerId = (user as any).partner?.id ?? (user as any).partner
    if (mentorPartnerId) {
      const founderUser = typeof submission.user === 'object' ? submission.user : null
      const founderPartnerId = founderUser?.partner?.id ?? founderUser?.partner
      if (String(founderPartnerId) !== String(mentorPartnerId)) {
        return { error: 'You can only review submissions from your partner\'s founders' }
      }
    } else if (role === 'partner') {
      return { error: 'No partner organization assigned to your account' }
    }
  }

  // Check for duplicate review
  const existing = await payload.find({
    collection: 'mentor-reviews',
    where: {
      submission: { equals: data.submissionId },
      reviewer: { equals: user.id },
    },
    limit: 1,
    overrideAccess: true,
  })
  if (existing.totalDocs > 0) {
    return { error: 'You have already reviewed this submission' }
  }

  const dayType = submission.dayType || 'standard'
  const isRetro = dayType === 'retro'

  const reviewData: Record<string, any> = {
    submission: data.submissionId,
    reviewer: user.id,
    dayNumber: data.dayNumber,
    score: data.score,
    comment: data.comment.trim(),
    isRetro,
    isGateReview: data.isGateReview || false,
  }

  if (data.internalNote?.trim()) {
    reviewData.internalNote = data.internalNote.trim()
  }

  if (data.isGateReview && data.gateDecision) {
    reviewData.gateDecision = data.gateDecision
  }

  if (data.evidencePackUrl?.trim()) {
    reviewData.evidencePackUrl = data.evidencePackUrl.trim()
  }

  const review = await (payload as any).create({
    collection: 'mentor-reviews',
    data: reviewData,
    overrideAccess: true,
  })

  revalidatePath('/mentor')
  revalidatePath('/partner')
  revalidatePath('/')
  return { success: true, reviewId: review.id }
}

export async function updateMentorReview(
  reviewId: number,
  data: {
    score?: number
    comment?: string
    internalNote?: string
    gateDecision?: 'pass' | 'fail' | 'revise' | null
    evidencePackUrl?: string
  },
): Promise<{ success: boolean } | { error: string }> {
  const payload = await getPayload({ config })
  const user = await getAuthenticatedUser(payload)

  if (!user) return { error: 'Unauthorized' }
  const role = (user as any).role
  if (role !== 'admin' && role !== 'mentor' && role !== 'partner') {
    return { error: 'Only admins, partners, and mentors can update reviews' }
  }

  const review = await payload.findByID({
    collection: 'mentor-reviews',
    id: reviewId,
    depth: 0,
    overrideAccess: true,
  }).catch(() => null) as any

  if (!review) return { error: 'Review not found' }

  // Mentors and partner accounts can only update their own reviews
  const reviewerId = typeof review.reviewer === 'object' ? review.reviewer.id : review.reviewer
  if ((role === 'mentor' || role === 'partner') && reviewerId !== user.id) {
    return { error: 'You can only edit your own reviews' }
  }

  const updateData: Record<string, any> = {}
  if (data.score !== undefined) {
    if (data.score < 1 || data.score > 5) return { error: 'Score must be 1-5' }
    updateData.score = data.score
  }
  if (data.comment !== undefined) updateData.comment = data.comment.trim()
  if (data.internalNote !== undefined) updateData.internalNote = data.internalNote.trim()
  if (data.gateDecision !== undefined) updateData.gateDecision = data.gateDecision
  if (data.evidencePackUrl !== undefined) updateData.evidencePackUrl = data.evidencePackUrl.trim()

  await payload.update({
    collection: 'mentor-reviews',
    id: reviewId,
    data: updateData,
    overrideAccess: true,
  })

  revalidatePath('/mentor')
  revalidatePath('/partner')
  revalidatePath('/')
  return { success: true }
}

async function ensurePartnerLandingMentorProfile(payload: any, partnerId: number | string) {
  const existing = await payload.find({
    collection: 'mentors',
    where: {
      and: [
        { partner: { equals: partnerId } },
        { user: { exists: false } },
      ],
    },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  })

  const existingProfile = existing.docs?.[0] as any
  if (existingProfile) {
    return existingProfile
  }

  const partner = await payload.findByID({
    collection: 'partners',
    id: partnerId,
    depth: 0,
    overrideAccess: true,
  }).catch(() => null) as any

  return (payload as any).create({
    collection: 'mentors',
    data: {
      title: partner?.name ? `${partner.name} mentor` : 'Landing mentor profile',
      landingOrder: 0,
      isActive: false,
      partner: partnerId,
    },
    overrideAccess: true,
  })
}

/**
 * Create a mentor account.
 * - Partners can create mentors scoped to their own partner org.
 * - Admins can create mentors with or without a partner (no partner = global mentor).
 */
export async function createMentor(data: {
  email: string
  password: string
}): Promise<{ success: boolean; userId?: number; mentorId?: number } | { error: string }> {
  const payload = await getPayload({ config })
  const user = await getAuthenticatedUser(payload)

  if (!user) return { error: 'Unauthorized' }
  const role = (user as any).role
  if (role !== 'admin' && role !== 'partner') {
    return { error: 'Only admins and partners can create mentors' }
  }

  if (!data.email?.trim()) return { error: 'Email is required' }
  if (!data.password || data.password.length < 6) return { error: 'Password must be at least 6 characters' }

  // Check if email already exists
  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: data.email.trim().toLowerCase() } },
    limit: 1,
  })
  if (existing.totalDocs > 0) {
    return { error: 'A user with this email already exists' }
  }

  // Partners can only create mentors for their own org
  let mentorPartnerId: number | string | null = null
  if (role === 'partner') {
    mentorPartnerId = (user as any).partner?.id ?? (user as any).partner
    if (!mentorPartnerId) {
      return { error: 'Your account has no partner organization assigned' }
    }
  }

  const newUser = await (payload as any).create({
    collection: 'users',
    disableVerificationEmail: true,
    data: {
      email: data.email.trim().toLowerCase(),
      password: data.password,
      role: 'mentor',
      ...(mentorPartnerId ? { partner: mentorPartnerId } : {}),
    },
    overrideAccess: true,
    user: {
      ...(user as any),
      collection: 'users',
    },
  })

  const profileTitle = data.email.trim().toLowerCase()
  const mentorProfile = await (payload as any).create({
    collection: 'mentors',
    data: {
      title: profileTitle,
      landingOrder: 0,
      isActive: false,
      user: newUser.id,
      ...(mentorPartnerId ? { partner: mentorPartnerId } : {}),
    },
    overrideAccess: true,
  })

  revalidatePath('/partner')
  revalidatePath('/')
  return { success: true, userId: newUser.id as number, mentorId: mentorProfile.id as number }
}

/**
 * List mentors visible to the current user.
 * - Partners see only their own partner's mentors.
 * - Admins see all mentors.
 */
export async function listMentors(): Promise<{ mentors: Array<{ id: number; userId: number | string | null; email: string; partnerId: number | string | null; title: string; profileTitle: string; profileIsActive: boolean; createdAt: string }> } | { error: string }> {
  const payload = await getPayload({ config })
  const user = await getAuthenticatedUser(payload)

  if (!user) return { error: 'Unauthorized' }
  const role = (user as any).role
  if (role !== 'admin' && role !== 'partner') {
    return { error: 'Only admins and partners can list mentors' }
  }

  const where: Record<string, any> = {}

  if (role === 'partner') {
    const partnerId = (user as any).partner?.id ?? (user as any).partner
    if (!partnerId) return { error: 'No partner organization assigned' }
    await ensurePartnerLandingMentorProfile(payload, partnerId)
    where.partner = { equals: partnerId }
  }

  const result = await payload.find({
    collection: 'mentors',
    where,
    limit: 100,
    depth: 1,
    sort: 'title',
    overrideAccess: true,
  })

  return {
    mentors: (result.docs as any[]).map(m => ({
      id: m.id,
      userId: typeof m.user === 'object' ? m.user?.id ?? null : m.user ?? null,
      email: typeof m.user === 'object' ? m.user?.email ?? m.title : m.title,
      partnerId: typeof m.partner === 'object' ? m.partner?.id ?? null : m.partner ?? null,
      title: m.title ?? '',
      profileTitle: m.title ?? '',
      profileIsActive: m.isActive !== false,
      createdAt: m.createdAt,
    })),
  }
}

export async function updateMentorProfile(data: {
  mentorId: number
  title: string
  isActive: boolean
}): Promise<{ success: boolean } | { error: string }> {
  const payload = await getPayload({ config })
  const user = await getAuthenticatedUser(payload)

  if (!user) return { error: 'Unauthorized' }
  const role = (user as any).role
  if (role !== 'admin' && role !== 'partner') {
    return { error: 'Only admins and partners can update mentor profiles' }
  }

  const mentor = await payload.findByID({
    collection: 'mentors',
    id: data.mentorId,
    depth: 0,
    overrideAccess: true,
  }).catch(() => null) as any

  if (!mentor) return { error: 'Mentor profile not found' }
  if (!data.title?.trim()) return { error: 'Mentor display name is required' }

  if (role === 'partner') {
    const partnerId = (user as any).partner?.id ?? (user as any).partner
    const mentorPartnerId = typeof mentor.partner === 'object' ? mentor.partner?.id : mentor.partner
    if (!partnerId || String(partnerId) !== String(mentorPartnerId)) {
      return { error: 'You can only update mentors from your partner organization' }
    }
  }

  await payload.update({
    collection: 'mentors',
    id: data.mentorId,
    data: {
      title: data.title.trim(),
      isActive: Boolean(data.isActive),
    },
    overrideAccess: true,
  })

  revalidatePath('/partner')
  revalidatePath('/')
  return { success: true }
}

async function resolveManagedPartnerId(payload: any, user: any, requestedPartnerId?: number | null): Promise<number | null> {
  const role = (user as any)?.role
  if (role === 'partner') {
    const partnerId = (user as any)?.partner?.id ?? (user as any)?.partner
    return partnerId ? Number(partnerId) : null
  }

  if (role !== 'admin') return null
  return resolveActivePartnerId(payload, requestedPartnerId ?? null)
}

async function getPartnerAllowedTrackIds(payload: any, partnerId: number): Promise<number[]> {
  const partner = await payload.findByID({
    collection: 'partners',
    id: partnerId,
    depth: 1,
    overrideAccess: true,
  }).catch(() => null) as any

  if (!partner) return []

  return Array.isArray(partner.tracks)
    ? partner.tracks
        .map((track: any) => {
          const id = typeof track === 'object' ? track?.id : track
          return id == null ? null : Number(id)
        })
        .filter((id: number | null): id is number => Number.isFinite(id))
    : []
}

async function validateAllowedTrackIds(payload: any, trackIds: number[]): Promise<number[]> {
  const uniqueTrackIds = Array.from(new Set(trackIds.map((id) => Number(id)).filter((id) => Number.isFinite(id))))
  if (uniqueTrackIds.length === 0) return []

  const result = await payload.find({
    collection: 'tracks',
    where: {
      and: [
        { id: { in: uniqueTrackIds } },
        { isActive: { equals: true } },
      ],
    },
    limit: uniqueTrackIds.length,
    depth: 0,
    overrideAccess: true,
  })

  return (result.docs as any[]).map((track) => Number(track.id))
}

export async function updatePartnerReferralTracks(params: {
  trackIds: number[]
  partnerId?: number | null
}): Promise<{ success: boolean } | { error: string }> {
  const payload = await getPayload({ config })
  const user = await getAuthenticatedUser(payload)

  if (!user) return { error: 'Unauthorized' }
  if ((user as any).role !== 'admin' && (user as any).role !== 'partner') {
    return { error: 'Only admins and partners can manage referral tracks' }
  }

  const partnerId = await resolveManagedPartnerId(payload, user, params.partnerId)
  if (!partnerId) return { error: 'Partner not found or unavailable' }

  const validatedTrackIds = await validateAllowedTrackIds(payload, params.trackIds || [])

  await payload.update({
    collection: 'partners',
    id: partnerId,
    data: { tracks: validatedTrackIds },
    overrideAccess: true,
  })

  revalidatePath('/partner')
  return { success: true }
}

export async function createPartnerInviteLink(params: {
  label: string
  trackId: number
  partnerId?: number | null
}): Promise<{ success: boolean } | { error: string }> {
  const payload = await getPayload({ config })
  const user = await getAuthenticatedUser(payload)

  if (!user) return { error: 'Unauthorized' }
  if ((user as any).role !== 'admin' && (user as any).role !== 'partner') {
    return { error: 'Only admins and partners can create referral links' }
  }

  const partnerId = await resolveManagedPartnerId(payload, user, params.partnerId)
  if (!partnerId) return { error: 'Partner not found or unavailable' }

  const trackId = await resolveActiveTrackId(payload, Number(params.trackId))
  if (!trackId) return { error: 'Track not found or inactive' }

  const allowedTrackIds = await getPartnerAllowedTrackIds(payload, partnerId)
  if (!allowedTrackIds.includes(trackId)) {
    return { error: 'This track is not enabled for the selected partner' }
  }

  const label = String(params.label || '').trim()
  if (!label) return { error: 'Label is required' }

  await (payload as any).create({
    collection: 'partner-invite-links',
    data: {
      label,
      partner: partnerId,
      track: trackId,
      isActive: true,
      createdBy: user.id,
    },
    overrideAccess: true,
  })

  revalidatePath('/partner')
  return { success: true }
}

export async function setPartnerInviteLinkActive(params: {
  linkId: number
  isActive: boolean
  partnerId?: number | null
}): Promise<{ success: boolean } | { error: string }> {
  const payload = await getPayload({ config })
  const user = await getAuthenticatedUser(payload)

  if (!user) return { error: 'Unauthorized' }
  if ((user as any).role !== 'admin' && (user as any).role !== 'partner') {
    return { error: 'Only admins and partners can manage referral links' }
  }

  const link = await payload.findByID({
    collection: 'partner-invite-links',
    id: params.linkId,
    depth: 0,
    overrideAccess: true,
  }).catch(() => null) as any

  if (!link) return { error: 'Referral link not found' }

  const managedPartnerId = await resolveManagedPartnerId(payload, user, params.partnerId ?? Number(link.partner))
  if (!managedPartnerId || Number(link.partner) !== Number(managedPartnerId)) {
    return { error: 'This link does not belong to your partner scope' }
  }

  await payload.update({
    collection: 'partner-invite-links',
    id: link.id,
    data: { isActive: Boolean(params.isActive) },
    overrideAccess: true,
  })

  revalidatePath('/partner')
  return { success: true }
}

export async function createEcosystemItem(data: {
  itemType: string
  name: string
  description?: string
  url?: string
  notes?: string
  status?: string
  priority?: string
  eventDate?: string
  city?: string
  country?: string
}) {
  const payload = await getPayload({ config })
  const user = await getAuthenticatedUser(payload)
  if (!user) return { error: 'Not authenticated' }
  if (user.role !== 'founder' && user.role !== 'admin') return { error: 'Only founders can add ecosystem items' }

  try {
    await payload.create({
      collection: 'ecosystem-items',
      data: {
        user: user.id,
        itemType: data.itemType as 'online_group' | 'physical_place' | 'event' | 'angel_vc' | 'operator' | 'signal_account',
        name: data.name,
        description: data.description || undefined,
        url: data.url || undefined,
        notes: data.notes || undefined,
        status: (data.status || 'identified') as 'identified' | 'contacted' | 'engaged' | 'active' | 'archived',
        priority: (data.priority || 'medium') as 'high' | 'medium' | 'low',
        eventDate: data.eventDate || undefined,
        location: (data.city || data.country) ? {
          city: data.city || undefined,
          country: data.country || undefined,
        } : undefined,
      },
    })

    revalidatePath('/ecosystem')
    return { success: true }
  } catch (error: any) {
    console.error('createEcosystemItem error:', error)
    return { error: error?.message || 'Failed to create ecosystem item' }
  }
}

export async function updateEcosystemItem(itemId: number, data: {
  itemType: string
  name: string
  description?: string
  url?: string
  notes?: string
  status?: string
  priority?: string
  eventDate?: string
  city?: string
  country?: string
}) {
  const payload = await getPayload({ config })
  const user = await getAuthenticatedUser(payload)
  if (!user) return { error: 'Not authenticated' }
  if (user.role !== 'founder' && user.role !== 'admin') return { error: 'Only founders can edit ecosystem items' }

  try {
    const existing = await payload.findByID({
      collection: 'ecosystem-items',
      id: itemId,
      depth: 0,
    })

    const ownerId = typeof existing.user === 'object' ? existing.user?.id : existing.user
    if (user.role !== 'admin' && String(ownerId) !== String(user.id)) {
      return { error: 'You can only edit your own ecosystem items' }
    }

    await payload.update({
      collection: 'ecosystem-items',
      id: itemId,
      data: {
        itemType: data.itemType as 'online_group' | 'physical_place' | 'event' | 'angel_vc' | 'operator' | 'signal_account',
        name: data.name,
        description: data.description || undefined,
        url: data.url || undefined,
        notes: data.notes || undefined,
        status: (data.status || 'identified') as 'identified' | 'contacted' | 'engaged' | 'active' | 'archived',
        priority: (data.priority || 'medium') as 'high' | 'medium' | 'low',
        eventDate: data.eventDate || undefined,
        location: (data.city || data.country)
          ? {
              city: data.city || undefined,
              country: data.country || undefined,
            }
          : undefined,
      },
    })

    revalidatePath('/ecosystem')
    return { success: true }
  } catch (error: any) {
    console.error('updateEcosystemItem error:', error)
    return { error: error?.message || 'Failed to update ecosystem item' }
  }
}

export async function createIntroRequest(data: {
  targetName: string
  targetRole?: string
  targetOrganization?: string
  targetUrl?: string
  reason: string
}) {
  const payload = await getPayload({ config })
  const user = await getAuthenticatedUser(payload)
  if (!user) return { error: 'Not authenticated' }
  if (user.role !== 'founder' && user.role !== 'admin') return { error: 'Only founders can request introductions' }

  try {
    await payload.create({
      collection: 'intro-requests',
      data: {
        user: user.id,
        targetName: data.targetName,
        targetRole: data.targetRole || undefined,
        targetOrganization: data.targetOrganization || undefined,
        targetUrl: data.targetUrl || undefined,
        reason: data.reason,
        status: 'requested',
      },
    })

    revalidatePath('/ecosystem')
    return { success: true }
  } catch (error: any) {
    console.error('createIntroRequest error:', error)
    return { error: error?.message || 'Failed to create intro request' }
  }
}

// INVESTOR PROFILE ACTIONS

export async function updateInvestorProfile(
  submissionId: number,
  updatedData: Record<string, any>,
) {
  const payload = await getPayload({ config })
  const user = await getAuthenticatedUser(payload)

  if (!user) {
    return { error: 'Authentication required' }
  }

  if (user.role !== 'investor' && user.role !== 'admin') {
    return { error: 'Only investors can update their profile' }
  }

  try {
    // Fetch the submission to verify ownership
    const submission = await payload.findByID({
      collection: 'investor-form-submissions',
      id: submissionId,
      depth: 0,
      overrideAccess: true,
    }) as any

    if (!submission) {
      return { error: 'Submission not found' }
    }

    const submissionUserId = typeof submission.user === 'object' ? submission.user?.id : submission.user
    if (String(submissionUserId) !== String(user.id) && user.role !== 'admin') {
      return { error: 'You can only edit your own submission' }
    }

    // Prevent consent from being changed after submission.
    const { I0_CONSENT: _ignoredConsent, ...safeUpdatedData } = updatedData || {}

    // Merge updated fields into existing submissionData
    const existingData = submission.submissionData || {}
    const mergedData = { ...existingData, ...safeUpdatedData }

    await payload.update({
      collection: 'investor-form-submissions',
      id: submissionId,
      data: {
        submissionData: mergedData,
      },
      overrideAccess: true,
    })

    revalidatePath('/')
    revalidatePath('/investor-profile')
    return { success: true }
  } catch (error: any) {
    console.error('updateInvestorProfile error:', error)
    return { error: error?.message || 'Failed to update profile' }
  }
}

const DRAFT_FORM_TYPES = [
  'founder_intake',
  'personality',
  'daily',
  'weekly',
  'gate',
  'prework',
  'investor',
  'project_submission',
] as const

type DraftFormType = (typeof DRAFT_FORM_TYPES)[number]

function isDraftFormType(v: string): v is DraftFormType {
  return (DRAFT_FORM_TYPES as readonly string[]).includes(v)
}

async function findExistingDraft(payload: any, userId: number | string, formSlug: string) {
  const existing = await payload.find({
    collection: 'form-drafts',
    where: {
      and: [
        { user: { equals: userId } },
        { formSlug: { equals: formSlug } },
      ],
    },
    limit: 1,
    depth: 0,
  })
  return existing.docs[0] || null
}

export async function saveDraft(
  formSlug: string,
  formType: string,
  answers: Record<string, unknown>,
): Promise<{ savedAt: string } | { error: string }> {
  if (!formSlug || typeof formSlug !== 'string') return { error: 'Invalid form slug' }
  if (!isDraftFormType(formType)) return { error: 'Invalid form type' }

  const payload = await getPayload({ config })
  const user = await getAuthenticatedUser(payload)
  if (!user) return { error: 'Unauthorized' }

  try {
    const existing = await findExistingDraft(payload, user.id, formSlug)
    const savedAt = new Date().toISOString()

    if (existing) {
      await (payload as any).update({
        collection: 'form-drafts',
        id: existing.id,
        data: { answers, formType, lastSavedAt: savedAt },
        overrideAccess: true,
      })
    } else {
      await (payload as any).create({
        collection: 'form-drafts',
        data: {
          user: user.id,
          formSlug,
          formType,
          answers,
          lastSavedAt: savedAt,
        },
        overrideAccess: true,
      })
    }

    return { savedAt }
  } catch (error: any) {
    console.warn('[saveDraft] failed', formSlug, error?.message)
    return { error: 'Failed to save draft' }
  }
}

export async function loadDraft(
  formSlug: string,
): Promise<{ answers: Record<string, unknown>; lastSavedAt: string } | null | { error: string }> {
  if (!formSlug || typeof formSlug !== 'string') return { error: 'Invalid form slug' }

  const payload = await getPayload({ config })
  const user = await getAuthenticatedUser(payload)
  if (!user) return { error: 'Unauthorized' }

  try {
    const draft = await findExistingDraft(payload, user.id, formSlug)
    if (!draft) return null
    return {
      answers: (draft.answers as Record<string, unknown>) || {},
      lastSavedAt: draft.lastSavedAt || draft.updatedAt,
    }
  } catch (error: any) {
    console.warn('[loadDraft] failed', formSlug, error?.message)
    return { error: 'Failed to load draft' }
  }
}

export async function deleteDraft(formSlug: string): Promise<{ success: boolean }> {
  if (!formSlug || typeof formSlug !== 'string') return { success: false }

  const payload = await getPayload({ config })
  const user = await getAuthenticatedUser(payload)
  if (!user) return { success: false }

  try {
    const draft = await findExistingDraft(payload, user.id, formSlug)
    if (!draft) return { success: true }
    await (payload as any).delete({
      collection: 'form-drafts',
      id: draft.id,
      overrideAccess: true,
    })
    return { success: true }
  } catch (error: any) {
    console.warn('[deleteDraft] failed', formSlug, error?.message)
    return { success: false }
  }
}
