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
            className={`not-prose ${isStandalonePage ? 'mb-0' : 'mb-24'}`}
            itemScope
            itemType="https://schema.org/FAQPage"
        >
            <div
                className={`border-t-2 pt-12 ${
                    isLight ? 'border-[#1a2634]' : 'border-[#eaeaea]/20'
                }`}
            >
                <div className="grid gap-12 lg:grid-cols-12">
                    {/* Left sticky column */}
                    <div className="lg:col-span-4">
                        <div className="lg:sticky lg:top-28">
                            <div
                                className={`font-mono text-xs font-bold uppercase tracking-[0.2em] mb-3 ${
                                    isLight ? 'text-[#203e5f]' : 'text-[#ffcc00]'
                                }`}
                            >
                                09 // {label}
                            </div>
                            <h2
                                className={`m-0 text-3xl font-bold leading-tight tracking-tight sm:text-4xl ${
                                    isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'
                                }`}
                            >
                                {title}
                            </h2>
                            <p
                                className={`mt-4 text-sm leading-relaxed ${
                                    isLight ? 'text-[#203e5f]' : 'text-[#eaeaea]/75'
                                }`}
                            >
                                {intro}
                            </p>
                            <div
                                className={`mt-6 border-l-2 border-[#ffcc00] pl-4 py-1 text-xs font-semibold leading-relaxed ${
                                    isLight ? 'text-[#1a2634]' : 'text-[#fee5b1]'
                                }`}
                            >
                                {scope}
                            </div>
                            {!isStandalonePage && (
                                <Link
                                    href="/faq"
                                    className={`mt-6 inline-flex items-center gap-2 border-b-2 border-[#ffcc00] pb-1 text-xs font-bold uppercase tracking-wider transition-colors ${
                                        isLight
                                            ? 'text-[#1a2634] hover:text-[#203e5f]'
                                            : 'text-[#eaeaea] hover:text-[#ffcc00]'
                                    }`}
                                >
                                    <span>Open full FAQ documentation</span>
                                    <span>→</span>
                                </Link>
                            )}
                        </div>
                    </div>

                    {/* Right Q&A list */}
                    <div
                        className={`lg:col-span-8 divide-y border-t lg:border-t-0 ${
                            isLight
                                ? 'divide-[#1a2634]/15 border-[#1a2634]/15'
                                : 'divide-[#eaeaea]/12 border-[#eaeaea]/12'
                        }`}
                    >
                        {faq.items.map((item, index) => (
                            <article
                                key={`${item.question}-${index}`}
                                className="py-7 first:pt-0 grid gap-4 sm:grid-cols-[3.5rem_1fr]"
                                itemProp="mainEntity"
                                itemScope
                                itemType="https://schema.org/Question"
                            >
                                <div
                                    className={`font-mono text-xs font-bold pt-1 ${
                                        isLight ? 'text-[#203e5f]' : 'text-[#ffcc00]'
                                    }`}
                                >
                                    /{String(index + 1).padStart(2, '0')}
                                </div>
                                <div>
                                    <h3
                                        itemProp="name"
                                        className={`m-0 text-lg font-bold leading-snug sm:text-xl ${
                                            isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'
                                        }`}
                                    >
                                        {item.question}
                                    </h3>
                                    <div itemProp="acceptedAnswer" itemScope itemType="https://schema.org/Answer">
                                        <p
                                            itemProp="text"
                                            className={`m-0 mt-3 text-sm leading-7 sm:text-base ${
                                                isLight ? 'text-[#203e5f]' : 'text-[#eaeaea]/75'
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
