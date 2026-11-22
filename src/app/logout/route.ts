import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { NextRequest } from 'next/server'
import { getAppUrl } from '@/lib/appUrl'

export async function POST(_req: NextRequest) {
  const cookieStore = await cookies()
  cookieStore.delete('payload-token')

  // Use NEXT_PUBLIC_LANDING_URL if set and not a localhost URL in production,
  // otherwise fall back to the app root (always correct origin).
  const configured = process.env.NEXT_PUBLIC_LANDING_URL
  const isProduction = process.env.NODE_ENV === 'production'
  const isLocalhost = (url: string) => /^https?:\/\/(localhost|127\.0\.0\.1)/.test(url)

  const landingUrl =
    configured && !(isProduction && isLocalhost(configured))
      ? configured
      : getAppUrl()

  redirect(landingUrl)
}
