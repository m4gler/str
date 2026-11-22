import { describe, expect, it } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QuestionRenderer } from '@/components/QuestionRenderer'

describe('QuestionRenderer example hints', () => {
  it('renders helper text separately from example-hint content', () => {
    const html = renderToStaticMarkup(
      React.createElement(QuestionRenderer, {
        question: {
          question_id: 'F1_TEST',
          question_text: 'What problem do you solve?',
          question_type: 'short_text',
          helperText: 'Keep this grounded in a real user pain.',
          exampleHintTitle: 'Cleanopatra example',
          exampleHintBody: 'Cleanopatra helps busy families book trusted home cleaners in under two minutes.',
        },
        value: '',
        onChange: () => undefined,
      }),
    )

    expect(html).toContain('Keep this grounded in a real user pain.')
    expect(html).toContain('Example answer')
    expect(html).toContain('Cleanopatra example')
    expect(html).toContain('Cleanopatra helps busy families book trusted home cleaners in under two minutes.')
  })
})

