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
      className={`sticky top-0 z-50 w-full border-b transition-colors duration-300 backdrop-blur-xl ${
        isLight
          ? 'border-[#1a2634]/[0.08] bg-[#eaeaea]/70 text-[#1a2634]'
          : 'border-white/[0.08] bg-[#1a2634]/60 text-[#eaeaea]'
      }`}
    >
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-6 px-5 py-4 sm:px-10 sm:py-5">
        <div className="flex items-center gap-10 lg:gap-14">
          <Link href="/" className="group flex items-center">
            <div
              className={`transition-all ${
                isLight
                  ? 'rounded-xl bg-[#1a2634]/90 backdrop-blur-md px-3.5 py-1.5 shadow-sm'
                  : ''
              }`}
            >
              <MesgaHorizontalLogo
                companyName={companyName}
                logoUrl={logoUrl}
                size="compact"
                className="transition-opacity group-hover:opacity-90"
              />
            </div>
          </Link>

          <nav
            className="hidden md:flex items-center gap-8 text-xs font-semibold uppercase tracking-[0.18em]"
            aria-label="Public navigation"
          >
            {HEADER_MARKETING_NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`py-1 transition-colors ${
                  isLight
                    ? 'text-[#1a2634]/70 hover:text-[#1a2634]'
                    : 'text-[#eaeaea]/65 hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <a
              href="#tracks"
              className={`py-1 transition-colors ${
                isLight
                  ? 'text-[#1a2634]/70 hover:text-[#1a2634]'
                  : 'text-[#eaeaea]/65 hover:text-white'
              }`}
            >
              Tracks
            </a>
            <a
              href="#pricing"
              className={`py-1 transition-colors ${
                isLight
                  ? 'text-[#1a2634]/70 hover:text-[#1a2634]'
                  : 'text-[#eaeaea]/65 hover:text-white'
              }`}
            >
              Pricing
            </a>
          </nav>
        </div>

        <div className="flex items-center gap-3 sm:gap-3.5">
          {onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={isLight ? 'Przełącz na tryb ciemny' : 'Przełącz na tryb jasny'}
              className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold tracking-wider transition-all backdrop-blur-md cursor-pointer ${
                isLight
                  ? 'border-[#1a2634]/12 bg-white/60 text-[#1a2634] hover:bg-white/90'
                  : 'border-white/12 bg-white/[0.05] text-[#eaeaea]/90 hover:bg-white/[0.1] hover:text-white'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  isLight ? 'bg-[#203e5f]' : 'bg-[#fee5b1]'
                }`}
              />
              <span>{isLight ? 'Dark' : 'Light'}</span>
            </button>
          )}

          <div
            className={
              isLight
                ? '[&_button]:rounded-xl! [&_button]:border-[#1a2634]/12! [&_button]:bg-white/60! [&_button]:text-[#1a2634]! [&_button]:backdrop-blur-md!'
                : '[&_button]:rounded-xl! [&_button]:border-white/12! [&_button]:bg-white/[0.05]! [&_button]:backdrop-blur-md!'
            }
          >
            <LanguageSwitcher />
          </div>

          <Link
            href={investorHref}
            className={`hidden sm:inline-flex items-center justify-center rounded-xl border px-4 py-2 text-xs font-semibold tracking-wide transition-all backdrop-blur-md ${
              isLight
                ? 'border-[#1a2634]/15 bg-white/50 text-[#1a2634] hover:bg-white/85'
                : 'border-white/15 bg-white/[0.04] text-[#eaeaea] hover:bg-white/[0.1] hover:border-white/25'
            }`}
          >
            {investorButtonText}
          </Link>

          <Link
            href={founderHref}
            className="inline-flex items-center justify-center rounded-xl bg-[#ffcc00] px-4.5 py-2 text-xs font-bold tracking-wide text-[#1a2634] shadow-sm transition-all hover:bg-[#fee5b1]"
          >
            {founderButtonText}
          </Link>
        </div>
      </div>
    </header>
  )
}
