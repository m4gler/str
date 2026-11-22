import { describe, expect, it } from 'vitest'
import { DEFAULT_LANDING_FAQ_ITEMS, resolveLandingFaqSettings } from '@/lib/landingFaq'

describe('landing FAQ settings', () => {
  it('falls back to the MESGA AI-search FAQ copy', () => {
    const faq = resolveLandingFaqSettings({})

    expect(faq.title).toBe('MESGA startup accelerator FAQ')
    expect(faq.items).toHaveLength(6)
    expect(faq.items[0].question).toBe('What is MESGA?')
    expect(faq.items[0].answer).toContain('Make European Startups Great Again')
    expect(faq.items[1].answer).toContain('May 31, 2026')
    expect(DEFAULT_LANDING_FAQ_ITEMS[2].answer).toContain('startup accelerator Poland')
  })

  it('uses Payload overrides and ignores incomplete FAQ rows', () => {
    const faq = resolveLandingFaqSettings({
      faqSectionTitle: 'Custom FAQ',
      faqSectionIntro: 'Editable intro',
      faqItems: [
        { question: 'Visible question?', answer: 'Visible answer.' },
        { question: 'Missing answer', answer: '' },
        { question: '', answer: 'Missing question' },
      ],
    })

    expect(faq.title).toBe('Custom FAQ')
    expect(faq.intro).toBe('Editable intro')
    expect(faq.items).toEqual([{ question: 'Visible question?', answer: 'Visible answer.' }])
  })
})
