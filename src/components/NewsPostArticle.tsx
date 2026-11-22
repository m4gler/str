import Link from 'next/link'
import {
  ArrowUpRight,
  Briefcase,
  CalendarDays,
  Clock3,
  Globe2,
  Quote,
  Rocket,
  Target,
} from 'lucide-react'
import type { NewsPost, NewsPostBlock, NewsPostOfferGridBlock } from '@/lib/newsPosts'

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('en', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function OfferIcon({ icon }: { icon: NewsPostOfferGridBlock['items'][number]['icon'] }) {
  const icons = {
    rocket: Rocket,
    globe: Globe2,
    target: Target,
    briefcase: Briefcase,
  }
  const Icon = icons[icon] || Target

  return <Icon className="h-5 w-5" aria-hidden="true" />
}

function ArticleBlock({ block }: { block: NewsPostBlock }) {
  if (block.blockType === 'paragraph') {
    return <p className="text-base leading-8 text-white/68 md:text-[17px]">{block.body}</p>
  }

  if (block.blockType === 'cta') {
    return (
      <aside className="my-10 overflow-hidden rounded-2xl border border-[#ffcc00]/45 bg-[linear-gradient(135deg,rgba(228,185,77,0.14),rgba(255,204,0,0.08))] p-7 text-center shadow-[0_34px_90px_-64px_rgba(228,185,77,0.8)] md:p-9">
        {block.label && (
          <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.24em] text-[#ffcc00]">
            {block.label}
          </div>
        )}
        <h2 className="text-2xl font-bold leading-tight text-[#ffcc00] md:text-3xl">{block.headline}</h2>
        {block.sub && <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-white/76 md:text-base">{block.sub}</p>}
        <a
          href={block.href}
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-[#ffcc00] px-6 py-3 text-sm font-bold uppercase tracking-[0.12em] text-[#1a2634] transition-all hover:-translate-y-0.5 hover:bg-[#f5d777]"
        >
          {block.buttonLabel}
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </a>
        {block.note && <p className="mt-3 text-xs font-semibold text-white/48">{block.note}</p>}
      </aside>
    )
  }

  if (block.blockType === 'offerGrid') {
    return (
      <div className="my-10 grid gap-4 sm:grid-cols-2">
        {block.items.map((item) => (
          <div
            key={`${item.title}-${item.icon}`}
            className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-[0_24px_60px_-54px_rgba(0,0,0,0.95)]"
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-[#ffcc00]/25 bg-[#ffcc00]/10 text-[#ffcc00]">
              <OfferIcon icon={item.icon} />
            </div>
            <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-white">{item.title}</h3>
            <p className="mt-2 text-sm leading-7 text-white/58">{item.desc}</p>
          </div>
        ))}
      </div>
    )
  }

  if (block.blockType === 'pullQuote') {
    return (
      <blockquote className="my-10 rounded-2xl border border-white/10 bg-[#203e5f] p-7 shadow-[0_28px_80px_-70px_rgba(255,204,0,0.9)] md:p-8">
        <Quote className="mb-5 h-7 w-7 text-[#ffcc00]" aria-hidden="true" />
        <p className="text-xl font-bold leading-8 text-[#f5d777] md:text-2xl">{block.quote}</p>
        {block.cite && (
          <cite className="mt-5 block text-[11px] font-bold uppercase tracking-[0.2em] text-white/45">
            {block.cite}
          </cite>
        )}
      </blockquote>
    )
  }

  return null
}

export default function NewsPostArticle({ post }: { post: NewsPost }) {
  const shareUrl = `/news/${post.slug}`

  return (
    <main className="relative z-10 mx-auto max-w-5xl px-6 pb-24 pt-10 md:pt-14">
      <Link
        href="/news"
        className="mb-7 inline-flex text-sm font-bold text-white/48 transition-colors hover:text-[#ffcc00]"
      >
        Back to News
      </Link>

      {post.urgencyText && (
        <div className="mb-7 rounded-2xl border border-[#ffcc00]/40 bg-[#ffcc00]/12 px-5 py-4 text-sm font-bold leading-6 text-[#f5d777] shadow-[0_26px_80px_-70px_rgba(228,185,77,0.9)]">
          {post.urgencyText}
        </div>
      )}

      <article className="overflow-hidden rounded-[28px] border border-white/10 bg-[#203e5f] shadow-[0_42px_140px_-95px_rgba(255,204,0,0.95)]">
        <div className="relative min-h-[280px] overflow-hidden border-b border-white/10 bg-[#0d1626] md:min-h-[340px]">
          <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,204,0,0.22),transparent_38%),linear-gradient(300deg,rgba(228,185,77,0.18),transparent_44%)]" />
          <div className="absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(255,255,255,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.16)_1px,transparent_1px)] [background-size:34px_34px]" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-[#ffcc00] to-transparent" />
          <div className="relative flex min-h-[280px] items-center justify-center px-6 py-14 text-center md:min-h-[340px]">
            <div className="max-w-3xl">
              <div className="mx-auto mb-5 inline-flex rounded-full border border-[#ffcc00]/40 bg-[#ffcc00]/10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.24em] text-[#ffcc00]">
                {post.heroBadge.label}
              </div>
              <div className="text-4xl font-black leading-none text-[#ffcc00] sm:text-5xl md:text-6xl">
                {post.heroBadge.main}
              </div>
              <p className="mx-auto mt-5 max-w-2xl text-sm font-semibold leading-7 text-white/78 md:text-base">
                {post.heroBadge.sub}
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-9 md:px-12 md:py-12">
          <div className="mb-6 flex flex-wrap items-center gap-3 text-xs font-bold uppercase tracking-[0.14em] text-white/42">
            <span className="rounded-full bg-[#ffcc00] px-3 py-1 text-[#1a2634]">{post.category}</span>
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              {formatDate(post.publishedAt)}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock3 className="h-4 w-4" aria-hidden="true" />
              {post.readTime}
            </span>
          </div>

          <h1 className="max-w-4xl text-4xl font-bold leading-tight tracking-tight text-white md:text-5xl">
            {post.title}
          </h1>
          <p className="mt-5 max-w-3xl border-l-2 border-[#ffcc00] pl-5 text-base font-semibold leading-8 text-white/76 md:text-lg">
            {post.excerpt}
          </p>

          <div className="my-10 h-px bg-linear-to-r from-white/10 via-white/5 to-transparent" />

          <div className="space-y-6">
            {post.blocks.map((block, index) => (
              <ArticleBlock key={`${block.blockType}-${index}`} block={block} />
            ))}
          </div>
        </div>

        <footer className="flex flex-col justify-between gap-6 border-t border-white/10 bg-[#203e5f] px-6 py-7 md:flex-row md:items-center md:px-12">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#ffcc00]/60 bg-[#ffcc00]/10 text-sm font-black text-[#ffcc00]">
              {post.author.initials}
            </div>
            <div>
              <div className="font-bold text-white">{post.author.name}</div>
              <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#ffcc00]">{post.author.role}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.16em] text-white/42">
            <span>Share</span>
            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=https://mesga.eu${shareUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-white/10 px-3 py-2 text-white/58 transition-colors hover:border-[#ffcc00]/45 hover:text-[#ffcc00]"
            >
              LinkedIn
            </a>
            <a
              href={`https://twitter.com/intent/tweet?url=https://mesga.eu${shareUrl}&text=${encodeURIComponent(post.title)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-white/10 px-3 py-2 text-white/58 transition-colors hover:border-[#ffcc00]/45 hover:text-[#ffcc00]"
            >
              X
            </a>
          </div>
        </footer>
      </article>
    </main>
  )
}
