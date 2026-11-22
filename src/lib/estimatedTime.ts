export function normalizeEstimatedTimeHrs(value: unknown): number | null {
  const hours = typeof value === 'number' ? value : Number(value)

  if (!Number.isFinite(hours) || hours <= 0 || hours > 24) {
    return null
  }

  return Number.isInteger(hours) ? hours : Math.round(hours * 10) / 10
}
