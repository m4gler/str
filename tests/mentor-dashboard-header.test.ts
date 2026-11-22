import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const source = fs.readFileSync(path.resolve(__dirname, '../src/components/MentorDashboard.tsx'), 'utf8')
const pageSource = fs.readFileSync(path.resolve(__dirname, '../src/app/mentor/page.tsx'), 'utf8')
const progressSource = fs.readFileSync(path.resolve(__dirname, '../src/components/FounderProgressPanel.tsx'), 'utf8')

describe('mentor dashboard header', () => {
  it('uses the shared branded app header pattern', () => {
    expect(source).toContain("import MesgaHorizontalLogo from '@/components/MesgaHorizontalLogo'")
    expect(source).toContain('<header className="sticky top-0 z-50')
    expect(source).toContain('size="header"')
    expect(source).toContain('<form action="/logout" method="POST">')
    expect(source).toContain("{mentorType === 'partner' ? 'Partner Mentor' : 'Admin Mentor'}")
  })

  it('uses a founder-first workbench with contextual review queue actions', () => {
    expect(source).toContain('selectedFounderPendingSubmissions')
    expect(source).toContain('Founder Workbench')
    expect(source).toContain('Needs review')
    expect(source).toContain('setSelectedDay(sub.programDay)')
    expect(source).toContain('FounderProgressPanel')
    expect(source).not.toContain("const [activeTab, setActiveTab]")
  })

  it('updates review status immediately after a mentor submits a review', () => {
    expect(source).toContain('optimisticReviewedSubmissionIds')
    expect(source).toContain('onReviewCreated={(submissionId)')
    expect(progressSource).toContain('optimisticReviews')
    expect(progressSource).toContain('onDone(optimisticReview)')
  })

  it('lets mentors edit an existing persisted review from the day detail', () => {
    expect(progressSource).toContain('updateMentorReview')
    expect(progressSource).toContain('existingReview')
    expect(progressSource).toContain('Edit review')
    expect(progressSource).toContain('Save review')
  })

  it('maps generated day question names and makes reviewed calendar days distinct', () => {
    expect(pageSource).toContain('question?.questionId')
    expect(pageSource).toContain('question?.questionTitle')
    expect(pageSource).toContain('dayDef?.questions')
    expect(pageSource).toContain('linkedFormById')
    expect(pageSource).toContain('linkedFormObj?.sections')
    expect(progressSource).toContain('getLegacyDailyQuestionLabel')
    expect(progressSource).toContain('getLegacyGateQuestionLabel')
    expect(progressSource).toContain('isSubmissionUrlValue(value)')
    expect(progressSource).toContain('Project workspace URL')
    expect(progressSource).toContain('Evidence pack URL')
    expect(progressSource).toContain('Mentor / IC ask (optional)')
    expect(progressSource).toContain('Mission completed?')
    expect(progressSource).toContain('reviewedDayClass')
    expect(progressSource).toContain('Reviewed')
  })

  it('hydrates reviewed day state from persisted mentor reviews', () => {
    expect(pageSource).toContain('reviewsBySubmissionId.get(sub.id)')
    expect(pageSource).toContain('timelineReview')
    expect(pageSource).toContain('review: timelineReview')
    expect(pageSource).toContain('reviewsById')
  })

  it('formats submitted URL labels without collapsing to query fragments', () => {
    expect(progressSource).toContain('formatSubmissionUrlLabel')
    expect(progressSource).toContain('parsed.hostname')
    expect(progressSource).not.toContain("String(value).split('/').pop()")
  })
})
