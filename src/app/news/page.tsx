import type { Metadata } from 'next'
import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@/payload.config'
import PublicHeader from '@/components/PublicHeader'
import SiteFooter from '@/components/SiteFooter'
import { resolveNewsPostsFromPayloadResult, type NewsPost } from '@/lib/newsPosts'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'MESGA News',
  description: 'Updates from MESGA and Bakery Ventures for CEE founders.',
  alternates: {
    canonical: '/news',
  },
  openGraph: {
    title: 'MESGA News',
    description: 'Updates from MESGA and Bakery Ventures for CEE founders.',
    url: '/news',
    type: 'website',
  },
}

async function loadNewsPosts() {
  const payload = await getPayload({ config })
  const settings: any = await payload.findGlobal({ slug: 'platform-settings' }).catch(() => ({}))
  const result = await (payload as any).find({
    collection: 'news-posts',
    where: {
      status: {
        equals: 'published',
      },
    },
    sort: '-publishedAt',
    limit: 24,
    depth: 1,
  }).catch(() => ({ docs: [] }))

  return {
    settings,
    posts: resolveNewsPostsFromPayloadResult(result),
  }
}

function NewsCard({ post, featured = false }: { post: NewsPost; featured?: boolean }) {
  return (
    <Link
      href={`/news/${post.slug}`}
      className={`group block overflow-hidden rounded-2xl border border-white/10 bg-[#172433] transition-all hover:-translate-y-1 hover:border-[#ffcc00]/35 hover:shadow-[0_32px_90px_-70px_rgba(228,185,77,0.85)] ${featured ? 'md:grid md:grid-cols-[0.9fr_1.1fr]' : ''}`}
    >
      <div className={`relative overflow-hidden bg-[#0d1626] ${featured ? 'min-h-72 md:min-h-full' : 'aspect-16/9'}`}>
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,204,0,0.2),transparent_42%),linear-gradient(300deg,rgba(228,185,77,0.18),transparent_48%)]" />
        <div className="absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(255,255,255,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.16)_1px,transparent_1px)] [background-size:30px_30px]" />
        <div className="relative flex h-full min-h-56 items-center justify-center p-7 text-center">
          <div>
            <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.24em] text-[#ffcc00]">{post.heroBadge.label}</div>
            <div className="text-3xl font-black leading-none text-[#ffcc00]">{post.heroBadge.main}</div>
          </div>
        </div>
      </div>
      <div className="p-7 md:p-9">
        <div className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-[#ffcc00]">{post.category}</div>
        <h2 className={`${featured ? 'text-3xl md:text-4xl' : 'text-2xl'} font-bold leading-tight text-white transition-colors group-hover:text-[#f5d777]`}>
          {post.title}
        </h2>
        <p className="mt-4 text-sm leading-7 text-white/62">{post.excerpt}</p>
        <div className="mt-6 text-sm font-bold text-[#ffcc00]">Read article</div>
      </div>
    </Link>
  )
}

export default async function NewsPage() {
  const { settings, posts } = await loadNewsPosts()
  const companyName = settings?.companyName || 'MESGA'
  const logoUrl = settings?.logo?.url
  const founderBtn = settings?.founderLoginBtn || 'Login dla Startup / Founder'
  const investorBtn = settings?.investorLoginBtn || 'Login dla Inwestora'
  const [featured, ...rest] = posts

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#1a2634] text-white selection:bg-[#ffcc00]/30">
      <PublicHeader
        companyName={companyName}
        logoUrl={logoUrl}
        founderButtonText={founderBtn}
        investorButtonText={investorBtn}
        founderHref="/login?role=founder&next=/intake"
      />

      <main className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-14 md:pt-18">
        <div className="mb-10 max-w-4xl">
          <div className="mb-4 text-[11px] font-bold uppercase tracking-[0.28em] text-[#ffcc00]">
            MESGA News
          </div>
          <h1 className="m-0 max-w-4xl text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
            Updates for founders building through the MESGA acceleration system.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/68">
            Latest announcements, programme updates, and opportunities from the MESGA team.
          </p>
        </div>

        {featured && <NewsCard post={featured} featured />}

        {rest.length > 0 && (
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {rest.map((post) => (
              <NewsCard key={post.slug} post={post} />
            ))}
          </div>
        )}
      </main>

      <SiteFooter settings={settings} companyName={companyName} variant="full" />
    </div>
  )
}
