'use client'

import Link from 'next/link'
import { Fragment, useEffect, useState } from 'react'
import { useLanguage } from '@/lib/i18n'
import { resolveLocalizedLegalDocument } from '@/lib/legalDocuments'
import { FOOTER_LEGAL_NAV_LINKS } from '@/lib/siteNavigation'

interface SiteFooterProps {
    settings: any
    companyName: string
    variant?: 'full' | 'compact' | 'fixed'
    theme?: 'dark' | 'light'
}

function FooterLegalLink({
    href,
    label,
    className,
}: {
    href: string | null
    label: string
    className: string
}) {
    if (href) {
        return (
            <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
                {label}
            </a>
        )
    }

    return <span className={className}>{label}</span>
}

export default function SiteFooter({ settings, companyName, variant = 'full', theme = 'dark' }: SiteFooterProps) {
    const { lang } = useLanguage()
    const [liveSettings, setLiveSettings] = useState<any | null>(null)
    const isLight = theme === 'light'

    useEffect(() => {
        let cancelled = false

        async function loadFooterSettings() {
            try {
                const response = await fetch('/api/globals/platform-settings?depth=1', {
                    cache: 'no-store',
                    credentials: 'same-origin',
                })

                if (!response.ok) return

                const nextSettings = await response.json()
                if (!cancelled) {
                    setLiveSettings(nextSettings)
                }
            } catch {
            }
        }

        loadFooterSettings()

        return () => {
            cancelled = true
        }
    }, [])

    const effectiveSettings = liveSettings ?? settings
    const inv = effectiveSettings?.invoicing
    const footer = effectiveSettings?.footer
    const legalLinks = footer?.legalLinks

    const sellerName = inv?.sellerName
    const nip = inv?.sellerNip
    const regon = inv?.sellerRegon
    const address = inv?.sellerAddress
    const postalCode = inv?.sellerPostalCode
    const city = inv?.sellerCity
    const contactEmail = inv?.contactEmail || inv?.sellerEmail
    const contactPhone = inv?.sellerPhone
    const privacyLink = resolveLocalizedLegalDocument(
        legalLinks?.privacyPolicy,
        lang,
        lang === 'pl' ? 'Polityka prywatności' : 'Privacy Policy',
    )
    const termsLink = resolveLocalizedLegalDocument(
        legalLinks?.termsOfUse,
        lang,
        lang === 'pl' ? 'Warunki korzystania' : 'Terms of Use',
    )

    const customLinks = (footer?.links || []).filter(
        (link: any) => !['Privacy Policy', 'Terms', 'Terms of Use'].includes(link.label)
    )

    const year = new Date().getFullYear()
    const copyrightText = footer?.copyrightText || companyName

    if (variant === 'fixed') {
        return (
            <footer className="fixed bottom-0 left-0 w-full z-40 border-t border-white/10 py-4 bg-[#1a2634]/80 backdrop-blur-xl">
                <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#eaeaea]/60">
                    <div className="flex items-center gap-2 sm:gap-4 flex-wrap justify-center">
                        <span>&copy; {year} {copyrightText}</span>
                        {sellerName && (
                            <>
                                <div className="bg-[#eaeaea]/20 w-px h-3.5" />
                                <span>{sellerName}</span>
                            </>
                        )}
                        {nip && (
                            <>
                                <div className="bg-[#eaeaea]/20 w-px h-3.5" />
                                <span>NIP: {nip}</span>
                            </>
                        )}
                        <div className="bg-[#eaeaea]/20 w-px h-3.5" />
                        <FooterLegalLink
                            href={privacyLink.href}
                            label={privacyLink.label}
                            className="hover:text-white transition-colors"
                        />
                        <div className="bg-[#eaeaea]/20 w-px h-3.5" />
                        <FooterLegalLink
                            href={termsLink.href}
                            label={termsLink.label}
                            className="hover:text-white transition-colors"
                        />
                        {FOOTER_LEGAL_NAV_LINKS.map((link) => (
                            <Fragment key={link.href}>
                                <div className="bg-[#eaeaea]/20 w-px h-3.5" />
                                <Link href={link.href} className="hover:text-white transition-colors">
                                    {link.label}
                                </Link>
                            </Fragment>
                        ))}
                    </div>
                    <span className="text-[#fee5b1] font-medium hidden sm:inline">Making European Startups Great Again</span>
                </div>
            </footer>
        )
    }

    if (variant === 'compact') {
        return (
            <footer className="relative z-10 w-full border-t border-white/10 pt-12 pb-10 px-6 bg-[#1a2634]/80 backdrop-blur-xl">
                <div className="mx-auto w-full max-w-7xl">
                    <div className="flex flex-col justify-between gap-8 md:flex-row">
                        <div>
                            <h3 className="text-xl font-bold tracking-wide text-white">{companyName}</h3>
                            <p className="mt-1 text-sm font-medium text-[#fee5b1]/80">Make European Startups Great Again</p>
                            {sellerName && (
                                <p className="mt-3 text-xs text-[#eaeaea]/50">{sellerName}{nip ? ` | NIP: ${nip}` : ''}{regon ? ` | REGON: ${regon}` : ''}</p>
                            )}
                            {(address || city) && (
                                <p className="text-xs text-[#eaeaea]/50">{[address, [postalCode, city].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</p>
                            )}
                            {contactEmail && (
                                <p className="mt-1 text-xs text-[#eaeaea]/50">{contactEmail}{contactPhone ? ` | ${contactPhone}` : ''}</p>
                            )}
                        </div>
                        <div className="flex flex-col gap-2 text-sm text-[#eaeaea]/65">
                            {customLinks.map((link: any, i: number) => (
                                <Link key={i} href={link.url} target={link.newTab ? '_blank' : undefined} className="hover:text-white transition-colors">
                                    {link.label}
                                </Link>
                            ))}
                        </div>
                    </div>
                    <div className="flex flex-row justify-between items-center mt-8 border-t border-white/10 pt-6">
                        <div className="flex flex-row items-center gap-2 sm:gap-4">
                            <FooterLegalLink
                                href={privacyLink.href}
                                label={privacyLink.label}
                                className="text-[10px] sm:text-xs text-[#eaeaea]/60 hover:text-white transition-colors whitespace-nowrap"
                            />
                            <div className="bg-[#eaeaea]/20 w-0.5 h-4.5" />
                            <FooterLegalLink
                                href={termsLink.href}
                                label={termsLink.label}
                                className="text-[10px] sm:text-xs text-[#eaeaea]/60 hover:text-white transition-colors whitespace-nowrap"
                            />
                            {FOOTER_LEGAL_NAV_LINKS.map((link) => (
                                <Fragment key={link.href}>
                                    <div className="bg-[#eaeaea]/20 w-0.5 h-4.5" />
                                    <Link
                                        href={link.href}
                                        className="text-[10px] sm:text-xs text-[#eaeaea]/60 hover:text-white transition-colors whitespace-nowrap"
                                    >
                                        {link.label}
                                    </Link>
                                </Fragment>
                            ))}
                        </div>
                        <p className="text-[10px] sm:text-xs text-[#eaeaea]/50">&copy; {year} {copyrightText}</p>
                    </div>
                </div>
            </footer>
        )
    }

    // Full variant — for landing page
    return (
        <footer
            className={`mt-28 w-full border-t pt-16 pb-12 px-6 sm:px-10 relative z-10 transition-colors duration-300 backdrop-blur-xl ${
                isLight
                    ? 'border-[#1a2634]/10 bg-white/55 text-[#1a2634]'
                    : 'border-white/[0.08] bg-white/[0.02] text-[#eaeaea]'
            }`}
        >
            <div className="mx-auto w-full max-w-7xl">
                <div className="flex flex-col justify-between gap-12 md:flex-row">
                    <div>
                        <div className="inline-flex items-center gap-3">
                            <span
                                className={`inline-flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold border ${
                                    isLight
                                        ? 'bg-[#1a2634] text-[#ffcc00] border-[#1a2634]/10'
                                        : 'bg-white/[0.06] text-[#ffcc00] border-white/10'
                                }`}
                            >
                                ★
                            </span>
                            <h3 className={`text-2xl font-bold tracking-wide ${isLight ? 'text-[#1a2634]' : 'text-white'}`}>
                                {companyName}
                            </h3>
                        </div>
                        <p className={`mt-2.5 text-sm font-medium ${isLight ? 'text-[#203e5f]' : 'text-[#eaeaea]/65'}`}>
                            Make European Startups Great Again
                        </p>

                        <div className={`mt-6 space-y-1.5 text-xs ${isLight ? 'text-[#1a2634]/65' : 'text-[#eaeaea]/55'}`}>
                            {sellerName && <p>{sellerName}</p>}
                            {(address || city) && (
                                <p>{[address, [postalCode, city].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</p>
                            )}
                            {nip && <p>NIP: {nip}</p>}
                            {regon && <p>REGON: {regon}</p>}
                            {contactEmail && (
                                <p className="mt-2">
                                    <a href={`mailto:${contactEmail}`} className="hover:underline transition-colors">{contactEmail}</a>
                                </p>
                            )}
                            {contactPhone && (
                                <p>
                                    <a href={`tel:${contactPhone}`} className="hover:underline transition-colors">{contactPhone}</a>
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-col gap-10 sm:flex-row sm:gap-20">
                        <div className={`flex flex-col gap-3 text-sm ${isLight ? 'text-[#1a2634]/75' : 'text-[#eaeaea]/70'}`}>
                            {customLinks.map((link: any, i: number) => (
                                <Link key={i} href={link.url} target={link.newTab ? '_blank' : undefined} className="hover:underline transition-colors">
                                    {link.label}
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
                <div
                    className={`flex flex-col sm:flex-row justify-between items-center gap-4 mt-12 border-t pt-8 ${
                        isLight ? 'border-[#1a2634]/10' : 'border-white/[0.08]'
                    }`}
                >
                    <div className="flex flex-row flex-wrap items-center justify-center gap-3 sm:gap-5">
                        <FooterLegalLink
                            href={privacyLink.href}
                            label={privacyLink.label}
                            className={`text-xs transition-colors whitespace-nowrap ${
                                isLight ? 'text-[#1a2634]/65 hover:text-[#1a2634]' : 'text-[#eaeaea]/60 hover:text-white'
                            }`}
                        />
                        <div className={`w-px h-3.5 ${isLight ? 'bg-[#1a2634]/20' : 'bg-white/15'}`} />
                        <FooterLegalLink
                            href={termsLink.href}
                            label={termsLink.label}
                            className={`text-xs transition-colors whitespace-nowrap ${
                                isLight ? 'text-[#1a2634]/65 hover:text-[#1a2634]' : 'text-[#eaeaea]/60 hover:text-white'
                            }`}
                        />
                        {FOOTER_LEGAL_NAV_LINKS.map((link) => (
                            <Fragment key={link.href}>
                                <div className={`w-px h-3.5 ${isLight ? 'bg-[#1a2634]/20' : 'bg-white/15'}`} />
                                <Link
                                    href={link.href}
                                    className={`text-xs transition-colors whitespace-nowrap ${
                                        isLight ? 'text-[#1a2634]/65 hover:text-[#1a2634]' : 'text-[#eaeaea]/60 hover:text-white'
                                    }`}
                                >
                                    {link.label}
                                </Link>
                            </Fragment>
                        ))}
                    </div>
                    <p className={`text-xs whitespace-nowrap ${isLight ? 'text-[#1a2634]/55' : 'text-[#eaeaea]/50'}`}>
                        &copy; {year} {copyrightText}
                    </p>
                </div>
            </div>
        </footer>
    )
}
