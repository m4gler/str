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
      className={`sticky top-0 z-50 w-full border-b transition-colors duration-200 ${
        isLight
          ? 'border-[#1a2634]/15 bg-[#eaeaea]/95 text-[#1a2634]'
          : 'border-[#eaeaea]/12 bg-[#1a2634]/95 text-[#eaeaea]'
      } backdrop-blur-md`}
    >
      {/* Top thin institutional bar */}
      <div
        className={`w-full border-b px-4 py-1.5 text-[11px] font-medium sm:px-8 ${
          isLight
            ? 'border-[#1a2634]/10 bg-[#203e5f] text-[#eaeaea]'
            : 'border-[#eaeaea]/8 bg-[#203e5f]/60 text-[#fee5b1]'
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="inline-block h-2 w-2 rounded-full bg-[#ffcc00]" />
            <span className="tracking-wide uppercase font-mono text-[10px]">
              EUROPEAN VENTURE EXECUTION SYSTEM · COHORT 2026
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-[10px] font-mono uppercase tracking-wider opacity-80">
            <span>CEE &amp; EU SCOPE</span>
            <span>/</span>
            <span>100-DAY CADENCE</span>
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3.5 sm:px-8">
        <div className="flex items-center gap-8">
          <Link href="/" className="group flex items-center">
            <div
              className={`transition-all ${
                isLight ? 'rounded-lg bg-[#1a2634] px-3 py-1.5' : ''
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
            className="hidden md:flex items-center gap-6 text-xs font-bold uppercase tracking-[0.16em]"
            aria-label="Public navigation"
          >
            {HEADER_MARKETING_NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`py-1 transition-colors border-b-2 border-transparent ${
                  isLight
                    ? 'text-[#203e5f] hover:border-[#1a2634] hover:text-[#1a2634]'
                    : 'text-[#eaeaea]/75 hover:border-[#ffcc00] hover:text-[#eaeaea]'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <a
              href="#tracks"
              className={`py-1 transition-colors border-b-2 border-transparent ${
                isLight
                  ? 'text-[#203e5f] hover:border-[#1a2634] hover:text-[#1a2634]'
                  : 'text-[#eaeaea]/75 hover:border-[#ffcc00] hover:text-[#eaeaea]'
              }`}
            >
              Tracks
            </a>
            <a
              href="#pricing"
              className={`py-1 transition-colors border-b-2 border-transparent ${
                isLight
                  ? 'text-[#203e5f] hover:border-[#1a2634] hover:text-[#1a2634]'
                  : 'text-[#eaeaea]/75 hover:border-[#ffcc00] hover:text-[#eaeaea]'
              }`}
            >
              Pricing
            </a>
          </nav>
        </div>

        <div className="flex items-center gap-2.5">
          {onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={isLight ? 'Przełącz na tryb ciemny' : 'Przełącz na tryb jasny'}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                isLight
                  ? 'border-[#1a2634]/20 bg-white text-[#1a2634] hover:bg-[#fee5b1]'
                  : 'border-[#eaeaea]/20 bg-[#203e5f]/50 text-[#eaeaea] hover:border-[#ffcc00] hover:text-[#ffcc00]'
              }`}
            >
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  isLight ? 'bg-[#1a2634]' : 'bg-[#ffcc00]'
                }`}
              />
              <span>{isLight ? 'Dark' : 'Light'}</span>
            </button>
          )}

          <div className={isLight ? '[&_button]:rounded-lg! [&_button]:border-[#1a2634]/20! [&_button]:bg-[#1a2634]! [&_button]:text-[#eaeaea]!' : '[&_button]:rounded-lg!'}>
            <LanguageSwitcher />
          </div>

          <Link
            href={investorHref}
            className={`hidden sm:inline-flex items-center justify-center rounded-lg border px-4 py-2 text-xs font-bold tracking-wide transition-colors ${
              isLight
                ? 'border-[#203e5f] text-[#203e5f] hover:bg-[#203e5f] hover:text-[#eaeaea]'
                : 'border-[#eaeaea]/25 text-[#eaeaea] hover:border-[#fee5b1] hover:text-[#fee5b1]'
            }`}
          >
            {investorButtonText}
          </Link>

          <Link
            href={founderHref}
            className="inline-flex items-center justify-center rounded-lg bg-[#ffcc00] px-4 py-2 text-xs font-extrabold tracking-wide text-[#1a2634] transition-colors hover:bg-[#fee5b1]"
          >
            {founderButtonText}
          </Link>
        </div>
      </div>
    </header>
  )
}
