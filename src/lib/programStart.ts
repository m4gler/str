export type StartProgramAttemptEligibilityReason =
  | 'payment_required'
  | 'no_attempts_remaining'
  | 'attempt_in_progress'

export type PreworkStartNowEligibilityReason =
  | 'not_in_prework'
  | 'prework_incomplete'
  | 'no_active_attempt'

export function getStartProgramAttemptEligibility(input: {
  paymentEnabled: boolean
  hasPaid100Days: boolean
  currentAttempts: number
  maxAttempts: number
  hasOpenAttempt: boolean
}): {
  allowed: boolean
  reason?: StartProgramAttemptEligibilityReason
  message?: string
} {
  if (input.hasOpenAttempt) {
    return {
      allowed: false,
      reason: 'attempt_in_progress',
      message: 'An attempt is already in progress.',
    }
  }

  if (input.paymentEnabled && !input.hasPaid100Days) {
    return {
      allowed: false,
      reason: 'payment_required',
      message: 'Payment required',
    }
  }

  if (input.currentAttempts >= input.maxAttempts) {
    return {
      allowed: false,
      reason: 'no_attempts_remaining',
      message: 'No attempts remaining',
    }
  }

  return { allowed: true }
}

export function getPreworkStartNowEligibility(input: {
  programStatus: string | null | undefined
  completedPreworkBlocks: number
  totalPreworkBlocks: number
  hasActiveAttempt: boolean
}): {
  allowed: boolean
  reason?: PreworkStartNowEligibilityReason
  message?: string
} {
  if (input.programStatus !== 'prework') {
    return {
      allowed: false,
      reason: 'not_in_prework',
      message: 'This program is not in prework.',
    }
  }

  if (!input.hasActiveAttempt) {
    return {
      allowed: false,
      reason: 'no_active_attempt',
      message: 'No active attempt found.',
    }
  }

  if (input.totalPreworkBlocks <= 0 || input.completedPreworkBlocks < input.totalPreworkBlocks) {
    return {
      allowed: false,
      reason: 'prework_incomplete',
      message: 'Complete all prework modules before starting the 100-day program.',
    }
  }

  return { allowed: true }
}
