import { describe, expect, it } from 'vitest'
import {
  countTextMatches,
  findFirstTextMatch,
  findMatchesInForm,
  replaceSelectedFormMatches,
  replaceTextMatches,
  type FormDoc,
} from '../src/lib/formBulkReplace'

const form: FormDoc = {
  id: 4,
  title: 'Daily form',
  sections: [{
    id: 'reflection',
    title: 'Reflection',
    description: 'Ask your mentor',
    questions: [{
      question_id: 'MENTOR_ASK',
      question_text: 'Mentor ask — mentor ask again',
      question_type: 'long_text',
      required: false,
      helperText: 'Ask only when needed',
      choices: [],
    }],
  }],
}

describe('form bulk replace', () => {
  it('finds fields with field and question-type filters', () => {
    const matches = findMatchesInForm(form, 'founder-forms', {
      query: 'ask',
      field: 'question_text',
      questionType: 'long_text',
    })

    expect(matches).toHaveLength(1)
    expect(matches[0]).toMatchObject({ field: 'question_text', occurrences: 2, questionType: 'long_text' })
  })

  it('supports case-sensitive and whole-word replacement', () => {
    expect(countTextMatches('Ask task asking ASK', 'ask', { wholeWord: true })).toBe(2)
    expect(replaceTextMatches('Ask task asking ASK', 'ask', 'Write', { wholeWord: true })).toBe('Write task asking Write')
    expect(replaceTextMatches('Ask ASK', 'Ask', 'Write', { caseSensitive: true })).toBe('Write ASK')
    expect(findFirstTextMatch('asking Ask', 'Ask', { caseSensitive: true, wholeWord: true })).toEqual({ index: 7, length: 3 })
  })

  it('preserves unrelated form data and skips stale fields', () => {
    const matches = findMatchesInForm(form, 'founder-forms', { query: 'Mentor ask' })
    const selected = matches.filter(match => match.field === 'question_text')
    const result = replaceSelectedFormMatches(form, selected, 'Mentor ask', 'Write a question')

    expect(result.replacedFields).toBe(1)
    expect(result.doc.sections?.[0].questions?.[0].question_text).toBe('Write a question — Write a question again')
    expect(result.doc.sections?.[0].questions?.[0].helperText).toBe('Ask only when needed')
    expect(result.doc.sections?.[0].id).toBe('reflection')

    const changed: FormDoc = JSON.parse(JSON.stringify(form))
    changed.sections![0].questions![0].question_text = 'Edited elsewhere'
    const stale = replaceSelectedFormMatches(changed, selected, 'Mentor ask', 'Write a question')
    expect(stale.staleFields).toBe(1)
    expect(stale.replacedFields).toBe(0)
  })
})
