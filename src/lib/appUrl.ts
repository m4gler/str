const LOCAL_DEV_APP_URL = 'http://localhost:3000'
const PRODUCTION_APP_URL = 'https://mesga.eu'

function normalizeUrl(rawUrl: string): string {
  const parsed = new URL(rawUrl)
  return parsed.toString().replace(/\/+$/, '')
}

function isLocalhostUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    const h = parsed.hostname
    return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h.endsWith('.localhost')
  } catch {
    return false
  }
}

export function getAppUrl(): string {
  const isProduction = process.env.NODE_ENV === 'production'

  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_SERVER_URL,
  ]

  for (const candidate of candidates) {
    if (!candidate) continue
    // In production, never return a localhost URL — it means the env var was left as a dev value
    if (isProduction && isLocalhostUrl(candidate)) continue
    return normalizeUrl(candidate)
  }

  return isProduction ? PRODUCTION_APP_URL : LOCAL_DEV_APP_URL
}

export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} environment variable is required`)
  }
  return value
}
