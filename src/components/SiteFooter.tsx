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

    // Fixed variant — minimal footer for form pages
    if (variant === 'fixed') {
        return (
            <footer className="fixed bottom-0 left-0 w-full z-40 border-t border-[#eaeaea]/10 py-4 bg-[#1a2634]/95 backdrop-blur-md">
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
                            className="hover:text-[#ffcc00] transition-colors"
                        />
                        <div className="bg-[#eaeaea]/20 w-px h-3.5" />
                        <FooterLegalLink
                            href={termsLink.href}
                            label={termsLink.label}
                            className="hover:text-[#ffcc00] transition-colors"
                        />
                        {FOOTER_LEGAL_NAV_LINKS.map((link) => (
                            <Fragment key={link.href}>
                                <div className="bg-[#eaeaea]/20 w-px h-3.5" />
                                <Link href={link.href} className="hover:text-[#ffcc00] transition-colors">
                                    {link.label}
                                </Link>
                            </Fragment>
                        ))}
                    </div>
                    <span className="text-[#ffcc00] font-semibold hidden sm:inline">Making European Startups Great Again</span>
                </div>
            </footer>
        )
    }

    // Compact variant — for dashboards (no full company block)
    if (variant === 'compact') {
        return (
            <footer className="relative z-10 w-full border-t border-[#eaeaea]/10 pt-10 pb-8 px-6 bg-[#1a2634]">
                <div className="mx-auto w-full max-w-7xl">
                    <div className="flex flex-col justify-between gap-8 md:flex-row">
                        <div>
                            <h3 className="text-xl font-bold tracking-wide text-[#eaeaea]">{companyName}</h3>
                            <p className="mt-1 text-sm font-medium text-[#ffcc00]">Make European Startups Great Again</p>
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
                                <Link key={i} href={link.url} target={link.newTab ? '_blank' : undefined} className="hover:text-[#ffcc00] transition-colors">
                                    {link.label}
                                </Link>
                            ))}
                        </div>
                    </div>
                    <div className="flex flex-row justify-between items-center mt-8 border-t border-[#eaeaea]/10 pt-6">
                        <div className="flex flex-row items-center gap-2 sm:gap-4">
                            <FooterLegalLink
                                href={privacyLink.href}
                                label={privacyLink.label}
                                className="text-[10px] sm:text-xs text-[#eaeaea]/60 hover:text-[#ffcc00] transition-colors whitespace-nowrap"
                            />
                            <div className="bg-[#eaeaea]/20 w-0.5 h-4.5" />
                            <FooterLegalLink
                                href={termsLink.href}
                                label={termsLink.label}
                                className="text-[10px] sm:text-xs text-[#eaeaea]/60 hover:text-[#ffcc00] transition-colors whitespace-nowrap"
                            />
                            {FOOTER_LEGAL_NAV_LINKS.map((link) => (
                                <Fragment key={link.href}>
                                    <div className="bg-[#eaeaea]/20 w-0.5 h-4.5" />
                                    <Link
                                        href={link.href}
                                        className="text-[10px] sm:text-xs text-[#eaeaea]/60 hover:text-[#ffcc00] transition-colors whitespace-nowrap"
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
            className={`mt-24 w-full border-t pt-14 pb-10 px-6 relative z-10 transition-colors duration-300 ${
                isLight
                    ? 'border-[#203e5f]/20 bg-[#1a2634] text-[#eaeaea]'
                    : 'border-[#eaeaea]/12 bg-[#1a2634] text-[#eaeaea]'
            }`}
        >
            <div className="mx-auto w-full max-w-6xl">
                <div className="flex flex-col justify-between gap-10 md:flex-row">
                    <div>
                        <div className="inline-flex items-center gap-2.5">
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#203e5f] text-xs text-[#ffcc00] border border-[#ffcc00]/40">
                                ★
                            </span>
                            <h3 className="text-2xl font-extrabold tracking-wide text-[#eaeaea]">{companyName}</h3>
                        </div>
                        <p className="mt-2 text-sm font-semibold text-[#ffcc00]">Make European Startups Great Again</p>

                        {/* Company data block — required by PayNow / Polish e-commerce law */}
                        <div className="mt-6 space-y-1 text-xs text-[#eaeaea]/65">
                            {sellerName && <p>{sellerName}</p>}
                            {(address || city) && (
                                <p>{[address, [postalCode, city].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</p>
                            )}
                            {nip && <p>NIP: {nip}</p>}
                            {regon && <p>REGON: {regon}</p>}
                            {contactEmail && (
                                <p className="mt-2">
                                    <a href={`mailto:${contactEmail}`} className="hover:text-[#ffcc00] transition-colors">{contactEmail}</a>
                                </p>
                            )}
                            {contactPhone && (
                                <p>
                                    <a href={`tel:${contactPhone}`} className="hover:text-[#ffcc00] transition-colors">{contactPhone}</a>
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-col gap-10 sm:flex-row sm:gap-20">
                        <div className="flex flex-col gap-2.5 text-sm text-[#eaeaea]/75">
                            {customLinks.map((link: any, i: number) => (
                                <Link key={i} href={link.url} target={link.newTab ? '_blank' : undefined} className="hover:text-[#ffcc00] transition-colors">
                                    {link.label}
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-10 border-t border-[#eaeaea]/12 pt-6">
                    <div className="flex flex-row flex-wrap items-center justify-center gap-2 sm:gap-4">
                        <FooterLegalLink
                            href={privacyLink.href}
                            label={privacyLink.label}
                            className="text-[10px] sm:text-xs text-[#eaeaea]/70 hover:text-[#ffcc00] transition-colors whitespace-nowrap"
                        />
                        <div className="bg-[#eaeaea]/25 w-0.5 h-4" />
                        <FooterLegalLink
                            href={termsLink.href}
                            label={termsLink.label}
                            className="text-[10px] sm:text-xs text-[#eaeaea]/70 hover:text-[#ffcc00] transition-colors whitespace-nowrap"
                        />
                        {FOOTER_LEGAL_NAV_LINKS.map((link) => (
                            <Fragment key={link.href}>
                                <div className="bg-[#eaeaea]/25 w-0.5 h-4" />
                                <Link
                                    href={link.href}
                                    className="text-[10px] sm:text-xs text-[#eaeaea]/70 hover:text-[#ffcc00] transition-colors whitespace-nowrap"
                                >
                                    {link.label}
                                </Link>
                            </Fragment>
                        ))}
                    </div>
                    <p className="text-[10px] sm:text-xs text-[#eaeaea]/60 whitespace-nowrap">&copy; {year} {copyrightText}</p>
                </div>
            </div>
        </footer>
    )
}
