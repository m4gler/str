import fs from 'fs'
import path from 'path'
import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'
import { CURRICULUM_DEFAULT_RELEASE_KEY } from '@/lib/curriculum/constants'
import { parseCurriculumWorkbook } from '@/lib/curriculum/source'

describe('curriculum workbook v3', () => {
  it('parses the promoted workbook as v6.3 without shape changes', () => {
    const filePath = path.join(process.cwd(), 'MESGA_100Days_MASTER_v3.xlsx')
    const workbook = XLSX.read(fs.readFileSync(filePath), {
      type: 'buffer',
      cellFormula: true,
      cellNF: true,
      cellText: true,
    })

    const snapshot = parseCurriculumWorkbook(workbook, {
      sourceFilePath: filePath,
      sourceSignature: 'test-signature',
    })

    expect(snapshot.releaseKey).toBe(CURRICULUM_DEFAULT_RELEASE_KEY)
    expect(snapshot.baseDefinitions).toHaveLength(100)
    expect(snapshot.overrideDefinitions).toHaveLength(214)
    expect(snapshot.overrideDefinitions.filter((definition) => definition.sourceSheet === 'PERSONALITY GUIDE')).toHaveLength(172)

    const day6 = snapshot.baseDefinitions.find((definition) => definition.dayNumber === 6)
    const day28 = snapshot.baseDefinitions.find((definition) => definition.dayNumber === 28)
    const day35 = snapshot.baseDefinitions.find((definition) => definition.dayNumber === 35)
    const day43 = snapshot.baseDefinitions.find((definition) => definition.dayNumber === 43)
    const day52 = snapshot.baseDefinitions.find((definition) => definition.dayNumber === 52)
    const day1PersonalityOverrides = snapshot.overrideDefinitions.filter((definition) => (
      definition.dayNumber === 1 && definition.sourceSheet === 'PERSONALITY GUIDE'
    ))

    expect(day6?.whereHowTips).toContain('LEGAL AWARENESS')
    expect(day43?.title).toBe('Choose legal form and file company registration')
    expect(day43?.mesgaIntegration).toBe('Registration checklist (S24 / KRS) + co-founder agreement template')
    expect(day28?.eduDescription).toBeNull()
    expect(day35?.eduDescription).toBeNull()
    expect(day43?.eduDescription).toBeNull()
    expect(day52?.eduDescription).toBeNull()
    expect(day1PersonalityOverrides.map((definition) => definition.personality)).toEqual([
      'Builder',
      'Driver',
      'Seeker',
      'Architect',
      'Nexus',
      'Guardian',
      'Challenger',
      'Anchor',
    ])
  })
})
