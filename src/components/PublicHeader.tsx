'use client'

import Link from 'next/link'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import MesgaHorizontalLogo from '@/components/MesgaHorizontalLogo'
import { HEADER_MARKETING_NAV_LINKS } from '@/lib/siteNavigation'

type PublicHeaderProps = {
  companyName: string
  logoUrl?: string | null
  founderButtonText: string
  investorButtonText: string
  founderHref?: string
  investorHref?: string
  theme?: 'dark' | 'light'
  onToggleTheme?: () => void
}

export default function PublicHeader({
  companyName,
  logoUrl,
  founderButtonText,
  investorButtonText,
  founderHref = '/login?role=founder',
  investorHref = '/login?role=investor',
  theme = 'dark',
  onToggleTheme,
}: PublicHeaderProps) {
  const isLight = theme === 'light'

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-colors duration-300 backdrop-blur-xl ${
        isLight
          ? 'bg-[#eaeaea]/80 text-[#1a2634] border-b border-[#203e5f]/15'
          : 'bg-[#1a2634]/75 text-[#eaeaea] border-b border-[#ffcc00]/15'
      }`}
    >
      <div className="mx-auto flex w-full max-w-[1360px] items-center justify-between gap-6 px-6 py-5 sm:px-12">
        <div className="flex items-center gap-12">
          <Link href="/" className="group flex items-center">
            <div
              className={
                isLight
                  ? 'rounded-lg bg-[#1a2634] px-3 py-1.5 shadow-sm'
                  : ''
              }
            >
              <MesgaHorizontalLogo
                companyName={companyName}
                logoUrl={logoUrl}
                size="compact"
                className="transition-opacity group-hover:opacity-85"
              />
            </div>
          </Link>

          <nav
            className="hidden lg:flex items-center gap-9 text-[13px] font-semibold"
            aria-label="Public navigation"
          >
            <a
              href="#tracks"
              className={`transition-colors ${
                isLight
                  ? 'text-[#203e5f] hover:text-[#1a2634]'
                  : 'text-[#fee5b1]/80 hover:text-[#ffcc00]'
              }`}
            >
              Tracks
            </a>
            <a
              href="#program"
              className={`transition-colors ${
                isLight
                  ? 'text-[#203e5f] hover:text-[#1a2634]'
                  : 'text-[#fee5b1]/80 hover:text-[#ffcc00]'
              }`}
            >
              100-Day Structure
            </a>
            {HEADER_MARKETING_NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`transition-colors ${
                  isLight
                    ? 'text-[#203e5f] hover:text-[#1a2634]'
                    : 'text-[#fee5b1]/80 hover:text-[#ffcc00]'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <a
              href="#pricing"
              className={`transition-colors ${
                isLight
                  ? 'text-[#203e5f] hover:text-[#1a2634]'
                  : 'text-[#fee5b1]/80 hover:text-[#ffcc00]'
              }`}
            >
              Pricing
            </a>
          </nav>
        </div>

        <div className="flex items-center gap-4 sm:gap-5">
          {onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={isLight ? 'Przełącz na tryb ciemny' : 'Przełącz na tryb jasny'}
              className={`inline-flex items-center gap-2 text-xs font-semibold px-3.5 py-2 rounded-md border transition-colors cursor-pointer ${
                isLight
                  ? 'border-[#203e5f]/25 bg-white/60 text-[#203e5f] hover:bg-[#fee5b1]/60 hover:text-[#1a2634]'
                  : 'border-[#ffcc00]/30 bg-[#203e5f]/45 text-[#fee5b1] hover:bg-[#203e5f]/80 hover:text-[#ffcc00]'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${isLight ? 'bg-[#203e5f]' : 'bg-[#ffcc00]'}`} />
              <span>{isLight ? 'Dark' : 'Light'}</span>
            </button>
          )}

          <div
            className={
              isLight
                ? '[&_button]:rounded-md! [&_button]:border-[#203e5f]/20! [&_button]:bg-white/60! [&_button]:text-[#1a2634]!'
                : '[&_button]:rounded-md! [&_button]:border-[#eaeaea]/15! [&_button]:bg-[#203e5f]/40!'
            }
          >
            <LanguageSwitcher />
          </div>

          <Link
            href={investorHref}
            className={`hidden sm:inline-flex items-center rounded-md border px-4 py-2 text-[13px] font-semibold transition-colors ${
              isLight
                ? 'border-[#203e5f]/25 bg-white/50 text-[#203e5f] hover:bg-[#203e5f] hover:text-white'
                : 'border-[#fee5b1]/25 bg-[#203e5f]/35 text-[#fee5b1] hover:border-[#ffcc00] hover:text-[#ffcc00]'
            }`}
          >
            {investorButtonText}
          </Link>

          <Link
            href={founderHref}
            className="inline-flex items-center justify-center rounded-md bg-[#ffcc00] px-4.5 py-2 text-[13px] font-bold text-[#1a2634] transition-colors hover:bg-[#fee5b1]"
          >
            {founderButtonText}
          </Link>
        </div>
      </div>
    </header>
  )
}
