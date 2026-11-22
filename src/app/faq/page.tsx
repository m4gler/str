import type { Metadata } from 'next'
import { getPayload } from 'payload'
import config from '@/payload.config'
import FaqSection from '@/components/FaqSection'
import PublicHeader from '@/components/PublicHeader'
import SiteFooter from '@/components/SiteFooter'
import { resolveLandingFaqSettings } from '@/lib/landingFaq'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
    title: 'FAQ for CEE Startup Accelerators',
    description: 'MESGA FAQ for founders asking where to apply for startup acceleration in Poland, CEE, the EU, and Europe.',
    alternates: {
        canonical: '/faq',
    },
    openGraph: {
        title: 'MESGA FAQ for CEE founders',
        description: 'Answers about MESGA, startup acceleration in Poland and CEE, free May 2026 access, tracks, applications, and equity.',
        url: '/faq',
        type: 'website',
    },
}

export default async function FaqPage() {
    const payload = await getPayload({ config })
    const settings: any = await payload.findGlobal({ slug: 'platform-settings' }).catch(() => ({}))
    const companyName = settings?.companyName || 'MESGA'
    const logoUrl = settings?.logo?.url
    const founderBtn = settings?.founderLoginBtn || 'Login dla Startup / Founder'
    const investorBtn = settings?.investorLoginBtn || 'Login dla Inwestora'
    const faq = resolveLandingFaqSettings(settings)
    const faqJsonLd = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faq.items.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: {
                '@type': 'Answer',
                text: item.answer,
            },
        })),
    }).replace(/</g, '\\u003c')

    return (
        <div className="relative min-h-screen overflow-hidden bg-[#1a2634] text-white selection:bg-[#ffcc00]/30">
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJsonLd }} />

            <PublicHeader
                companyName={companyName}
                logoUrl={logoUrl}
                founderButtonText={founderBtn}
                investorButtonText={investorBtn}
                founderHref="/login?role=founder&next=/intake"
            />

            <main className="relative z-10 mx-auto max-w-5xl px-6 pb-24 pt-14 md:pt-18">
                <div className="mx-auto mb-10 max-w-4xl">
                    <div className="mb-4 text-[11px] font-bold uppercase tracking-[0.28em] text-[#ffcc00]">
                        Startup acceleration in CEE
                    </div>
                    <h1 className="m-0 max-w-3xl text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
                        MESGA FAQ for founders comparing startup accelerators in Poland, CEE, and Europe.
                    </h1>
                    <p className="mt-5 max-w-2xl text-base leading-7 text-white/68">
                        A crawler-readable, Payload-managed FAQ for founders asking where to apply, what MESGA offers, and how the May 2026 free access window works.
                    </p>
                </div>

                <FaqSection settings={settings} variant="page" />
            </main>

            <SiteFooter settings={settings} companyName={companyName} variant="full" />
        </div>
    )
}
