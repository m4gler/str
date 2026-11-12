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
            className={`not-prose ${isStandalonePage ? 'mb-0' : 'mb-36 sm:mb-48'}`}
            itemScope
            itemType="https://schema.org/FAQPage"
        >
            <div
                className={`border-t pt-16 sm:pt-24 ${
                    isLight ? 'border-[#203e5f]/20' : 'border-[#ffcc00]/20'
                }`}
            >
                <div className="mb-14 max-w-3xl">
                    <div
                        className={`text-xs font-bold uppercase tracking-widest mb-3 ${
                            isLight ? 'text-[#203e5f]' : 'text-[#ffcc00]'
                        }`}
                    >
                        {label}
                    </div>
                    <h2
                        className={`m-0 text-3xl font-bold leading-tight tracking-tight sm:text-5xl ${
                            isLight ? 'text-[#1a2634]' : 'text-white'
                        }`}
                    >
                        {title}
                    </h2>
                    <p
                        className={`mt-5 text-base sm:text-lg leading-relaxed ${
                            isLight ? 'text-[#203e5f]' : 'text-[#fee5b1]/80'
                        }`}
                    >
                        {intro}
                    </p>
                </div>

                <div
                    className={`divide-y border-t border-b ${
                        isLight
                            ? 'divide-[#203e5f]/15 border-[#203e5f]/20'
                            : 'divide-[#eaeaea]/12 border-[#eaeaea]/15'
                    }`}
                >
                    {faq.items.map((item, index) => (
                        <article
                            key={`${item.question}-${index}`}
                            className="py-8 sm:py-10 grid gap-4 lg:grid-cols-12 lg:gap-12 items-baseline"
                            itemProp="mainEntity"
                            itemScope
                            itemType="https://schema.org/Question"
                        >
                            <div className="lg:col-span-5 flex items-baseline gap-4">
                                <span className={`text-xs font-bold shrink-0 ${isLight ? 'text-[#203e5f]' : 'text-[#ffcc00]'}`}>
                                    0{index + 1}
                                </span>
                                <h3
                                    itemProp="name"
                                    className={`m-0 text-lg font-bold leading-snug sm:text-xl ${
                                        isLight ? 'text-[#1a2634]' : 'text-[#fee5b1]'
                                    }`}
                                >
                                    {item.question}
                                </h3>
                            </div>
                            <div
                                className="lg:col-span-7"
                                itemProp="acceptedAnswer"
                                itemScope
                                itemType="https://schema.org/Answer"
                            >
                                <p
                                    itemProp="text"
                                    className={`m-0 text-base leading-relaxed ${
                                        isLight ? 'text-[#1a2634]/80' : 'text-[#eaeaea]/80'
                                    }`}
                                >
                                    {item.answer}
                                </p>
                            </div>
                        </article>
                    ))}
                </div>

                <div className="mt-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <p className={`text-xs m-0 ${isLight ? 'text-[#203e5f]' : 'text-[#fee5b1]/70'}`}>
                        {scope}
                    </p>
                    {!isStandalonePage && (
                        <Link
                            href="/faq"
                            className={`inline-flex items-center gap-2 text-sm font-bold underline decoration-[#ffcc00] decoration-2 underline-offset-4 transition-colors ${
                                isLight
                                    ? 'text-[#1a2634] hover:text-[#203e5f]'
                                    : 'text-[#ffcc00] hover:text-[#fee5b1]'
                            }`}
                        >
                            <span>Read full FAQ</span>
                            <span>→</span>
                        </Link>
                    )}
                </div>
            </div>
        </section>
    )
}
