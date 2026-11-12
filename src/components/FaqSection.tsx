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
            className={`not-prose ${isStandalonePage ? 'mb-0' : 'mb-32 sm:mb-40'}`}
            itemScope
            itemType="https://schema.org/FAQPage"
        >
            <div
                className={`border-t-2 pt-16 sm:pt-20 ${
                    isLight ? 'border-[#203e5f]/20' : 'border-[#203e5f]'
                }`}
            >
                <div className="grid gap-10 md:grid-cols-12 mb-12 items-end">
                    <div className="md:col-span-6">
                        <div
                            className={`text-xs font-bold uppercase tracking-widest mb-3 ${
                                isLight ? 'text-[#203e5f]' : 'text-[#ffcc00]'
                            }`}
                        >
                            {label}
                        </div>
                        <h2
                            className={`m-0 text-3xl font-bold leading-tight tracking-tight sm:text-5xl ${
                                isLight ? 'text-[#1a2634]' : 'text-[#eaeaea]'
                            }`}
                        >
                            {title}
                        </h2>
                    </div>
                    <div className="md:col-span-6">
                        <p
                            className={`m-0 text-base leading-relaxed ${
                                isLight ? 'text-[#203e5f]' : 'text-[#fee5b1]'
                            }`}
                        >
                            {intro}
                        </p>
                    </div>
                </div>

                <div
                    className={`divide-y border-t-2 border-b-2 ${
                        isLight
                            ? 'divide-[#203e5f]/15 border-[#203e5f]/20'
                            : 'divide-[#203e5f] border-[#203e5f]'
                    }`}
                >
                    {faq.items.map((item, index) => (
                        <article
                            key={`${item.question}-${index}`}
                            className="py-7 sm:py-9 grid gap-4 md:grid-cols-12 md:gap-10 items-baseline"
                            itemProp="mainEntity"
                            itemScope
                            itemType="https://schema.org/Question"
                        >
                            <div className="md:col-span-5 flex items-baseline gap-4">
                                <span
                                    className={`text-xs font-bold px-2 py-0.5 rounded shrink-0 ${
                                        isLight ? 'bg-[#203e5f] text-[#ffcc00]' : 'bg-[#203e5f] text-[#ffcc00]'
                                    }`}
                                >
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
                                className="md:col-span-7"
                                itemProp="acceptedAnswer"
                                itemScope
                                itemType="https://schema.org/Answer"
                            >
                                <p
                                    itemProp="text"
                                    className={`m-0 text-base leading-relaxed ${
                                        isLight ? 'text-[#1a2634]/85' : 'text-[#eaeaea]/85'
                                    }`}
                                >
                                    {item.answer}
                                </p>
                            </div>
                        </article>
                    ))}
                </div>

                <div className="mt-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <p className={`text-xs m-0 font-medium ${isLight ? 'text-[#203e5f]' : 'text-[#fee5b1]/80'}`}>
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
