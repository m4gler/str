import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = path.resolve(__dirname, '..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

describe('selected mentor connection', () => {
  it('keeps selected mentor assignment available outside the landing flow', () => {
    const landing = read('src/components/LandingPage.tsx')
    const selectedMentor = read('src/lib/selectedMentor.ts')

    expect(selectedMentor).toContain("export const SELECTED_MENTOR_COOKIE = 'selected-mentor'")
    expect(selectedMentor).toContain('setSelectedMentorCookie')
    expect(landing).not.toContain("import { setSelectedMentorCookie } from '@/lib/selectedMentor'")
    expect(landing).not.toContain('setSelectedMentorCookie(')
  })

  it('assigns the selected active mentor to newly registered founders', () => {
    const actions = read('src/app/actions.ts')

    expect(actions).toContain("import { SELECTED_MENTOR_COOKIE } from '@/lib/selectedMentor'")
    expect(actions).toContain("cookieStore.get(SELECTED_MENTOR_COOKIE)")
    expect(actions).toContain('resolveSelectedMentorId')
    expect(actions).toContain("collection: 'mentors'")
    expect(actions).toContain("isActive: { equals: true }")
    expect(actions).toContain('...(selectedMentorId ? { mentor: selectedMentorId } : {})')
  })

  it('scopes mentor dashboard founders to users assigned to that mentor profile', () => {
    const mentorPage = read('src/app/mentor/page.tsx')

    expect(mentorPage).toContain('assignedMentorProfileIds')
    expect(mentorPage).toContain("collection: 'mentors'")
    expect(mentorPage).toContain('user: { equals: user.id }')
    expect(mentorPage).toContain('mentor: { in: assignedMentorProfileIds.join')
    expect(mentorPage).toContain('user: { in: founderIds.join')
    expect(mentorPage).not.toContain("mentorType === 'partner' && mentorPartnerId\n      ? { role: { equals: 'founder' }, partner: { equals: mentorPartnerId } }")
  })
})
