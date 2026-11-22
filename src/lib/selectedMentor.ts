export const SELECTED_MENTOR_COOKIE = 'selected-mentor'
export const SELECTED_MENTOR_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

export function setSelectedMentorCookie(mentorId: number | string | undefined | null) {
  if (typeof document === 'undefined' || mentorId == null) return

  const normalized = String(mentorId).trim()
  if (!normalized || normalized === 'general') return

  document.cookie = `${SELECTED_MENTOR_COOKIE}=${encodeURIComponent(normalized)}; path=/; max-age=${SELECTED_MENTOR_MAX_AGE_SECONDS}; samesite=lax`
}
