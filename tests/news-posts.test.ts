import { describe, expect, it } from 'vitest'
import {
  DEFAULT_NEWS_POST_SLUG,
  getDefaultNewsPost,
  normalizeNewsPost,
  resolveNewsPostFromPayloadResult,
} from '@/lib/newsPosts'

describe('news posts', () => {
  it('keeps the May 2026 free-access article available as the default post', () => {
    const post = getDefaultNewsPost()

    expect(post.slug).toBe(DEFAULT_NEWS_POST_SLUG)
    expect(post.title).toBe('Free Access to MESGA Acceleration - For Founders Who Start in May 2026')
    expect(post.excerpt).toContain('100-day accelerator')
    expect(post.urgencyText).toContain('May 31')
    expect(post.blocks.some((block) => block.blockType === 'cta')).toBe(true)
    expect(post.blocks.some((block) => block.blockType === 'offerGrid')).toBe(true)
    expect(post.author.name).toBe('Piotr Boulange')
  })

  it('normalizes a published Payload post and ignores incomplete content blocks', () => {
    const post = normalizeNewsPost({
      slug: 'custom-post',
      status: 'published',
      title: 'Custom post',
      excerpt: 'Readable excerpt',
      category: 'Update',
      publishedAt: '2026-05-01T10:00:00.000Z',
      readTime: '2 min read',
      content: [
        { blockType: 'paragraph', body: 'First paragraph.' },
        { blockType: 'paragraph', body: '' },
        {
          blockType: 'cta',
          label: 'Apply',
          headline: 'Start now',
          sub: 'No fee.',
          href: 'https://mesga.eu',
          buttonLabel: 'Apply',
          note: 'Limited window.',
        },
      ],
    })

    expect(post?.slug).toBe('custom-post')
    expect(post?.blocks).toEqual([
      { blockType: 'paragraph', body: 'First paragraph.' },
      {
        blockType: 'cta',
        label: 'Apply',
        headline: 'Start now',
        sub: 'No fee.',
        href: 'https://mesga.eu',
        buttonLabel: 'Apply',
        note: 'Limited window.',
      },
    ])
  })

  it('falls back to the default article when Payload has no published record for the default slug', () => {
    const post = resolveNewsPostFromPayloadResult({ docs: [] }, DEFAULT_NEWS_POST_SLUG)

    expect(post?.slug).toBe(DEFAULT_NEWS_POST_SLUG)
  })

  it('returns null for unknown missing slugs', () => {
    expect(resolveNewsPostFromPayloadResult({ docs: [] }, 'missing')).toBeNull()
  })
})
