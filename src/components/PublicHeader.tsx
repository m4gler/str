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
      className={`sticky top-0 z-50 w-full transition-colors duration-200 backdrop-blur-md ${
        isLight
          ? 'bg-[#eaeaea]/90 text-[#1a2634] border-b-2 border-[#203e5f]/20'
          : 'bg-[#1a2634]/90 text-[#eaeaea] border-b border-[#203e5f]'
      }`}
    >
      <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-4 px-6 py-4 sm:px-10">
        <div className="flex items-center gap-6 lg:gap-10">
          <Link href="/" className="group flex items-center shrink-0">
            <div
              className={
                isLight
                  ? 'rounded-md bg-[#1a2634] px-3 py-1.5'
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
            className="hidden md:flex items-center gap-5 lg:gap-7 text-xs font-bold uppercase tracking-wider whitespace-nowrap"
            aria-label="Public navigation"
          >
            <a
              href="#tracks"
              className={`transition-colors ${
                isLight
                  ? 'text-[#203e5f] hover:text-[#1a2634]'
                  : 'text-[#fee5b1] hover:text-[#ffcc00]'
              }`}
            >
              Tracks
            </a>
            <a
              href="#program"
              className={`transition-colors ${
                isLight
                  ? 'text-[#203e5f] hover:text-[#1a2634]'
                  : 'text-[#fee5b1] hover:text-[#ffcc00]'
              }`}
            >
              Structure
            </a>
            {HEADER_MARKETING_NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`transition-colors ${
                  isLight
                    ? 'text-[#203e5f] hover:text-[#1a2634]'
                    : 'text-[#fee5b1] hover:text-[#ffcc00]'
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
                  : 'text-[#fee5b1] hover:text-[#ffcc00]'
              }`}
            >
              Pricing
            </a>
          </nav>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 whitespace-nowrap">
          {onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={isLight ? 'Przełącz na tryb ciemny' : 'Przełącz na tryb jasny'}
              className={`inline-flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-md border transition-colors cursor-pointer whitespace-nowrap ${
                isLight
                  ? 'border-[#203e5f] bg-white text-[#1a2634] hover:bg-[#fee5b1]'
                  : 'border-[#fee5b1]/30 bg-[#203e5f] text-[#fee5b1] hover:border-[#ffcc00] hover:text-[#ffcc00]'
              }`}
            >
              <span className={`h-2 w-2 rounded-full shrink-0 ${isLight ? 'bg-[#1a2634]' : 'bg-[#ffcc00]'}`} />
              <span>{isLight ? 'Dark' : 'Light'}</span>
            </button>
          )}

          <div
            className={
              isLight
                ? '[&_button]:rounded-md! [&_button]:border-[#203e5f]! [&_button]:bg-[#1a2634]! [&_button]:text-[#eaeaea]!'
                : '[&_button]:rounded-md! [&_button]:border-[#fee5b1]/25! [&_button]:bg-[#203e5f]!'
            }
          >
            <LanguageSwitcher />
          </div>

          <Link
            href={investorHref}
            className={`hidden lg:inline-flex items-center rounded-md border px-3.5 py-2 text-xs font-bold transition-colors whitespace-nowrap ${
              isLight
                ? 'border-[#203e5f] bg-white text-[#203e5f] hover:bg-[#203e5f] hover:text-white'
                : 'border-[#fee5b1]/35 bg-[#203e5f]/60 text-[#fee5b1] hover:bg-[#203e5f] hover:border-[#ffcc00]'
            }`}
          >
            {investorButtonText}
          </Link>

          <Link
            href={founderHref}
            className="inline-flex items-center justify-center rounded-md bg-[#ffcc00] px-4 py-2 text-xs font-extrabold text-[#1a2634] transition-colors hover:bg-[#fee5b1] whitespace-nowrap"
          >
            {founderButtonText}
          </Link>
        </div>
      </div>
    </header>
  )
}
