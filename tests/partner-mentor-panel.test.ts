import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const partnerDashboardSource = fs.readFileSync(path.resolve(__dirname, '../src/components/PartnerDashboard.tsx'), 'utf8')
const partnerMentorPanelSource = fs.readFileSync(path.resolve(__dirname, '../src/components/PartnerMentorPanel.tsx'), 'utf8')
const actionsSource = fs.readFileSync(path.resolve(__dirname, '../src/app/actions.ts'), 'utf8')

describe('partner mentor review panel', () => {
  it('mounts a separate mentor review panel from the partner dashboard shell', () => {
    expect(partnerDashboardSource).toContain("import PartnerMentorPanel from '@/components/PartnerMentorPanel'")
    expect(partnerDashboardSource).toContain("'reviews'")
    expect(partnerDashboardSource).toContain('<PartnerMentorPanel')
    expect(partnerMentorPanelSource).toContain('FounderProgressPanel')
    expect(partnerMentorPanelSource).toContain('allowReview={true}')
  })

  it('lets partner users create and update mentor reviews through server actions', () => {
    expect(actionsSource).toContain("role !== 'partner'")
    expect(actionsSource).toContain("role === 'mentor' || role === 'partner'")
    expect(actionsSource).toContain("revalidatePath('/partner')")
  })
})
