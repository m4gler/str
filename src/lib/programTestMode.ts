export const TEST_PROGRAM_STATUS = 'test'

export function isTestProgramStatus(status: string | null | undefined): boolean {
  return status === TEST_PROGRAM_STATUS
}

export function normalizeRequestedProgramDay(value: unknown): number | null {
  const day = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(day) || day < 1 || day > 100) return null
  return day
}
