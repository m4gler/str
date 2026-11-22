import { describe, expect, it } from 'vitest'
import { FOOTER_LEGAL_NAV_LINKS, HEADER_MARKETING_NAV_LINKS } from '@/lib/siteNavigation'

describe('site navigation', () => {
  it('exposes FAQ and News next to the public logo', () => {
    expect(HEADER_MARKETING_NAV_LINKS).toEqual([
      { label: 'FAQ', href: '/faq' },
      { label: 'News', href: '/news' },
    ])
  })

  it('adds FAQ to the legal footer link row', () => {
    expect(FOOTER_LEGAL_NAV_LINKS).toEqual([
      { label: 'FAQ', href: '/faq' },
    ])
  })
})
