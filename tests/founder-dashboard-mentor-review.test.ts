import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const dashboardSource = fs.readFileSync(path.resolve(__dirname, '../src/components/DashboardClient.tsx'), 'utf8')
const pageSource = fs.readFileSync(path.resolve(__dirname, '../src/app/page.tsx'), 'utf8')

describe('founder dashboard mentor review visibility', () => {
  it('loads mentor reviews for the founder and passes the current day review into the dashboard', () => {
    expect(pageSource).toContain("collection: 'mentor-reviews'")
    expect(pageSource).toContain("where: { 'submission.user': { equals: user.id } }")
    expect(pageSource).toContain('currentDayMentorReview')
    expect(pageSource).toContain('mentorReviewsByDay.get(dayNumber)')
  })

  it('renders public mentor review feedback on the submitted mission card', () => {
    expect(dashboardSource).toContain('currentDayMentorReview?: FounderVisibleMentorReview | null')
    expect(dashboardSource).toContain('Mentor feedback')
    expect(dashboardSource).toContain('currentDayMentorReview.comment')
    expect(dashboardSource).not.toContain('currentDayMentorReview.internalNote')
  })
})
