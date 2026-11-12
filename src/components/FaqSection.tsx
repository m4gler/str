'use client'

import Link from 'next/link'
import { createT, useLanguage } from '@/lib/i18n'
import { resolveLandingFaqSettings } from '@/lib/landingFaq'

type FaqSectionProps = {
    settings?: any
    variant?: 'landing' | 'page'
    theme?: 'dark' | 'light'
}

export default function FaqSection({ settings, variant = 'landing', theme = 'dark' }: FaqSectionProps) {
    const { lang } = useLanguage()
    const t = createT(settings, lang)
    const faq = resolveLandingFaqSettings(settings)
    const isLight = theme === 'light'

    const label = t('faqSectionLabel', faq.label)
    const title = t('faqSectionTitle', faq.title)
    const intro = t('faqSectionIntro', faq.intro)
    const scope = t('faqSectionScope', faq.scope)
    const isStandalonePage = variant === 'page'

    return (
        <section
            id="faq"
            className={`not-prose ${isStandalonePage ? 'mb-0' : 'mb-36 sm:mb-44'}`}
            itemScope
            itemType="https://schema.org/FAQPage"
        >
            <div
                className={`border-t pt-20 sm:pt-28 ${
                    isLight ? 'border-[#1a2634]/10' : 'border-white/[0.08]'
                }`}
            >
                <div className="grid gap-14 lg:grid-cols-12 lg:gap-20">
                    {/* Left sticky column */}
                    <div className="lg:col-span-4">
                        <div className="lg:sticky lg:top-32 space-y-6">
                            <div
                                className={`font-mono text-xs font-semibold uppercase tracking-[0.22em] ${
                                    isLight ? 'text-[#203e5f]/70' : 'text-[#eaeaea]/55'
                                }`}
                            >
                                09 // {label}
                            </div>
                            <h2
                                className={`m-0 text-3xl font-bold leading-tight tracking-tight sm:text-4xl ${
                                    isLight ? 'text-[#1a2634]' : 'text-white'
                                }`}
                            >
                                {title}
                            </h2>
                            <p
                                className={`m-0 text-base leading-relaxed ${
                                    isLight ? 'text-[#1a2634]/70' : 'text-[#eaeaea]/70'
                                }`}
                            >
                                {intro}
                            </p>
                            <div
                                className={`rounded-2xl border p-5 text-xs font-medium leading-relaxed backdrop-blur-md ${
                                    isLight
                                        ? 'border-[#1a2634]/10 bg-white/55 text-[#1a2634]/80'
                                        : 'border-white/10 bg-white/[0.03] text-[#eaeaea]/75'
                                }`}
                            >
                                {scope}
                            </div>
                            {!isStandalonePage && (
                                <Link
                                    href="/faq"
                                    className={`inline-flex items-center gap-2.5 pt-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                                        isLight
                                            ? 'text-[#203e5f] hover:text-[#1a2634]'
                                            : 'text-[#fee5b1] hover:text-[#ffcc00]'
                                    }`}
                                >
                                    <span>Open full FAQ documentation</span>
                                    <span>→</span>
                                </Link>
                            )}
                        </div>
                    </div>

                    {/* Right Q&A cards with breathing room */}
                    <div className="lg:col-span-8 space-y-5">
                        {faq.items.map((item, index) => (
                            <article
                                key={`${item.question}-${index}`}
                                className={`rounded-2xl border p-7 sm:p-9 backdrop-blur-xl transition-colors grid gap-4 sm:grid-cols-[3.5rem_1fr] ${
                                    isLight
                                        ? 'border-[#1a2634]/[0.08] bg-white/60 hover:bg-white/80'
                                        : 'border-white/[0.08] bg-white/[0.025] hover:bg-white/[0.045]'
                                }`}
                                itemProp="mainEntity"
                                itemScope
                                itemType="https://schema.org/Question"
                            >
                                <div
                                    className={`font-mono text-xs font-semibold pt-1 ${
                                        isLight ? 'text-[#1a2634]/45' : 'text-[#eaeaea]/45'
                                    }`}
                                >
                                    /{String(index + 1).padStart(2, '0')}
                                </div>
                                <div>
                                    <h3
                                        itemProp="name"
                                        className={`m-0 text-lg font-bold leading-snug sm:text-xl ${
                                            isLight ? 'text-[#1a2634]' : 'text-white'
                                        }`}
                                    >
                                        {item.question}
                                    </h3>
                                    <div itemProp="acceptedAnswer" itemScope itemType="https://schema.org/Answer">
                                        <p
                                            itemProp="text"
                                            className={`m-0 mt-4 text-sm leading-relaxed sm:text-base ${
                                                isLight ? 'text-[#1a2634]/75' : 'text-[#eaeaea]/70'
                                            }`}
                                        >
                                            {item.answer}
                                        </p>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    )
}
