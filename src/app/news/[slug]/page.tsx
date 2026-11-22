import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@/payload.config'
import NewsPostArticle from '@/components/NewsPostArticle'
import PublicHeader from '@/components/PublicHeader'
import SiteFooter from '@/components/SiteFooter'
import { resolveNewsPostFromPayloadResult, type NewsPost } from '@/lib/newsPosts'

export const dynamic = 'force-dynamic'

type NewsPostPageProps = {
  params: Promise<{ slug: string }>
}

async function loadNewsPost(slug: string): Promise<{ post: NewsPost | null; settings: any }> {
  const payload = await getPayload({ config })
  const settings: any = await payload.findGlobal({ slug: 'platform-settings' }).catch(() => ({}))
  const result = await (payload as any).find({
    collection: 'news-posts',
    where: {
      and: [
        { slug: { equals: slug } },
        { status: { equals: 'published' } },
      ],
    },
    limit: 1,
    depth: 1,
  }).catch(() => ({ docs: [] }))

  return {
    post: resolveNewsPostFromPayloadResult(result, slug),
    settings,
  }
}

export async function generateMetadata({ params }: NewsPostPageProps): Promise<Metadata> {
  const { slug } = await params
  const { post } = await loadNewsPost(slug)

  if (!post) {
    return {
      title: 'News | MESGA',
    }
  }

  return {
    title: post.title,
    description: post.excerpt,
    alternates: {
      canonical: `/news/${post.slug}`,
    },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      url: `/news/${post.slug}`,
      type: 'article',
      publishedTime: post.publishedAt,
    },
  }
}

export default async function NewsPostPage({ params }: NewsPostPageProps) {
  const { slug } = await params
  const { post, settings } = await loadNewsPost(slug)

  if (!post) notFound()

  const companyName = settings?.companyName || 'MESGA'
  const logoUrl = settings?.logo?.url
  const founderBtn = settings?.founderLoginBtn || 'Login dla Startup / Founder'
  const investorBtn = settings?.investorLoginBtn || 'Login dla Inwestora'
  const articleJsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAt,
    author: {
      '@type': 'Person',
      name: post.author.name,
    },
    publisher: {
      '@type': 'Organization',
      name: companyName,
    },
    mainEntityOfPage: `/news/${post.slug}`,
  }).replace(/</g, '\\u003c')

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#1a2634] text-white selection:bg-[#ffcc00]/30">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: articleJsonLd }} />
      <PublicHeader
        companyName={companyName}
        logoUrl={logoUrl}
        founderButtonText={founderBtn}
        investorButtonText={investorBtn}
        founderHref="/login?role=founder&next=/intake"
      />
      <NewsPostArticle post={post} />
      <SiteFooter settings={settings} companyName={companyName} variant="full" />
    </div>
  )
}
