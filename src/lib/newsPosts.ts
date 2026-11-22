export type NewsPostParagraphBlock = {
  blockType: 'paragraph'
  body: string
}

export type NewsPostCtaBlock = {
  blockType: 'cta'
  label: string
  headline: string
  sub: string
  href: string
  buttonLabel: string
  note: string
}

export type NewsPostOfferGridBlock = {
  blockType: 'offerGrid'
  items: Array<{
    icon: 'rocket' | 'globe' | 'target' | 'briefcase'
    title: string
    desc: string
  }>
}

export type NewsPostPullQuoteBlock = {
  blockType: 'pullQuote'
  quote: string
  cite: string
}

export type NewsPostBlock =
  | NewsPostParagraphBlock
  | NewsPostCtaBlock
  | NewsPostOfferGridBlock
  | NewsPostPullQuoteBlock

export type NewsPost = {
  slug: string
  status: 'draft' | 'published'
  title: string
  excerpt: string
  category: string
  publishedAt: string
  readTime: string
  urgencyText: string
  heroBadge: {
    label: string
    main: string
    sub: string
  }
  author: {
    name: string
    role: string
    initials: string
  }
  blocks: NewsPostBlock[]
}

export const DEFAULT_NEWS_POST_SLUG = 'free-mesga-acceleration-may-2026'

const DEFAULT_NEWS_POST: NewsPost = {
  slug: DEFAULT_NEWS_POST_SLUG,
  status: 'published',
  title: 'Free Access to MESGA Acceleration for Founders Starting in May 2026',
  excerpt:
    'We\'re opening free access to the MESGA 100-day accelerator for founders who apply and start in May 2026. No programme fee, no equity at entry.',
  category: 'Announcement',
  publishedAt: '2026-04-30T10:00:00.000Z',
  readTime: '4 min read',
  urgencyText:
    'Spots are limited — free access closes May 31, 2026. Apply now to secure your place.',
  heroBadge: {
    label: 'May 2026 Cohort',
    main: 'FREE ACCESS TO MESGA',
    sub: '100-day acceleration. No programme fee. No equity at entry.',
  },
  author: {
    name: 'Piotr Boulange',
    role: 'Founding Partner, Bakery Ventures',
    initials: 'PB',
  },
  blocks: [
    {
      blockType: 'paragraph',
      body:
        'Starting this month, founders who apply to MESGA and begin their acceleration in May 2026 get full programme access at no cost. No programme fee, no equity taken at the point of entry. This is a one-time window we\'re opening deliberately — we want to bring in the right founders, not just the ones who had the budget lined up.',
    },
    {
      blockType: 'paragraph',
      body:
        'MESGA is a 100-day execution programme. Every day has a mission, a deliverable, and a review. The goal is to get you from idea or early product to something investor-ready — with a documented proof trail, real customer feedback, and a GTM narrative that holds up. It\'s not a bootcamp, it\'s not a course. It\'s closer to an operating system for the first stage of your company.',
    },
    {
      blockType: 'cta',
      label: 'May 2026 — Free Cohort',
      headline: 'Apply now and start for free',
      sub: 'Use the Bakery invite link to get free access. Window closes May 31.',
      href: '/invite/bakery',
      buttonLabel: 'Apply free via Bakery invite',
      note: 'Free access is only available for founders who start in May 2026.',
    },
    {
      blockType: 'paragraph',
      body:
        'The programme runs across focused tracks — EduTech, Space & the City, Defence & Dual-Use, and a general track for founders building in any domain. Each track has dedicated mentors and partner challenges. Regardless of which track you join, the core structure is the same: daily missions, weekly reviews, five milestone gates, and a demo day at day 90.',
    },
    {
      blockType: 'offerGrid',
      items: [
        {
          icon: 'rocket',
          title: '100-Day Structure',
          desc: 'Daily missions and milestones from day one through to investor demo day.',
        },
        {
          icon: 'globe',
          title: 'CEE Network',
          desc: "Mentor access and introductions across Bakery Ventures' investor and partner network.",
        },
        {
          icon: 'target',
          title: 'Real Validation',
          desc: 'Customer discovery, commercial testing, and evidence collection — not pitch prep.',
        },
        {
          icon: 'briefcase',
          title: 'Investor Exposure',
          desc: 'Direct access to Bakery Ventures and the wider CEE VC ecosystem at demo day.',
        },
      ],
    },
    {
      blockType: 'pullQuote',
      quote:
        'The CEE region has no shortage of strong founding talent. What it lacks is structured execution support at the earliest stage. That\'s the gap MESGA is built to close.',
      cite: 'Piotr Boulange, Founding Partner, Bakery Ventures',
    },
    {
      blockType: 'paragraph',
      body:
        'Who should apply: pre-Series A founders with a product in some form of testing, building for European or global markets, and ready to commit to 100 days of structured daily work. If you\'re at idea stage with nothing validated yet, this isn\'t the right moment. If you\'re already past Series A, you\'ve probably outgrown what this programme is designed for. The sweet spot is a team of one to four people with a hypothesis worth accelerating.',
    },
    {
      blockType: 'paragraph',
      body:
        'To apply: use the Bakery invite link below, register your account, select your track, and complete the intake before May 31. The programme starts immediately after acceptance. Founders who apply early get priority review.',
    },
  ],
}

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function cloneDefaultPost(): NewsPost {
  return JSON.parse(JSON.stringify(DEFAULT_NEWS_POST)) as NewsPost
}

function normalizeOfferIcon(value: unknown): NewsPostOfferGridBlock['items'][number]['icon'] {
  const icon = cleanString(value)
  if (icon === 'rocket' || icon === 'globe' || icon === 'target' || icon === 'briefcase') return icon
  return 'target'
}

function normalizeBlocks(blocks: unknown): NewsPostBlock[] {
  if (!Array.isArray(blocks)) return []

  return blocks.flatMap((block): NewsPostBlock[] => {
    const type = cleanString((block as any)?.blockType)

    if (type === 'paragraph') {
      const body = cleanString((block as any)?.body)
      return body ? [{ blockType: 'paragraph' as const, body }] : []
    }

    if (type === 'cta') {
      const headline = cleanString((block as any)?.headline)
      const href = cleanString((block as any)?.href)
      if (!headline || !href) return []

      return [{
        blockType: 'cta' as const,
        label: cleanString((block as any)?.label),
        headline,
        sub: cleanString((block as any)?.sub),
        href,
        buttonLabel: cleanString((block as any)?.buttonLabel) || 'Apply',
        note: cleanString((block as any)?.note),
      }]
    }

    if (type === 'offerGrid') {
      const items = Array.isArray((block as any)?.items) ? (block as any).items : []
      const normalizedItems = items
        .map((item: any) => ({
          icon: normalizeOfferIcon(item?.icon),
          title: cleanString(item?.title),
          desc: cleanString(item?.desc),
        }))
        .filter((item: any) => item.title && item.desc)

      return normalizedItems.length > 0
        ? [{ blockType: 'offerGrid' as const, items: normalizedItems }]
        : []
    }

    if (type === 'pullQuote') {
      const quote = cleanString((block as any)?.quote)
      return quote
        ? [{
            blockType: 'pullQuote' as const,
            quote,
            cite: cleanString((block as any)?.cite),
          }]
        : []
    }

    return []
  })
}

export function getDefaultNewsPost(): NewsPost {
  return cloneDefaultPost()
}

export function normalizeNewsPost(doc: any): NewsPost | null {
  if (!doc) return null

  const slug = cleanString(doc.slug)
  const title = cleanString(doc.title)
  const excerpt = cleanString(doc.excerpt)

  if (!slug || !title || !excerpt) return null

  const fallback = getDefaultNewsPost()
  const content = normalizeBlocks(doc.content ?? doc.blocks)

  return {
    slug,
    status: doc.status === 'draft' ? 'draft' : 'published',
    title,
    excerpt,
    category: cleanString(doc.category) || fallback.category,
    publishedAt: cleanString(doc.publishedAt) || fallback.publishedAt,
    readTime: cleanString(doc.readTime) || fallback.readTime,
    urgencyText: cleanString(doc.urgencyText),
    heroBadge: {
      label: cleanString(doc.heroBadge?.label) || fallback.heroBadge.label,
      main: cleanString(doc.heroBadge?.main) || title,
      sub: cleanString(doc.heroBadge?.sub) || excerpt,
    },
    author: {
      name: cleanString(doc.author?.name) || fallback.author.name,
      role: cleanString(doc.author?.role) || fallback.author.role,
      initials: cleanString(doc.author?.initials) || fallback.author.initials,
    },
    blocks: content,
  }
}

export function resolveNewsPostFromPayloadResult(result: any, requestedSlug = DEFAULT_NEWS_POST_SLUG): NewsPost | null {
  const doc = Array.isArray(result?.docs) ? result.docs[0] : null
  const normalized = normalizeNewsPost(doc)
  if (normalized) return normalized

  return requestedSlug === DEFAULT_NEWS_POST_SLUG ? getDefaultNewsPost() : null
}

export function resolveNewsPostsFromPayloadResult(result: any): NewsPost[] {
  const docs = Array.isArray(result?.docs) ? result.docs : []
  const posts = docs
    .map((doc: any) => normalizeNewsPost(doc))
    .filter((post: NewsPost | null): post is NewsPost => Boolean(post))

  if (!posts.some((post: NewsPost) => post.slug === DEFAULT_NEWS_POST_SLUG)) {
    posts.push(getDefaultNewsPost())
  }

  return posts.sort((a: NewsPost, b: NewsPost) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
}
