import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = path.resolve(__dirname, '..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

describe('landing mentor profiles', () => {
  it('registers a dedicated mentors collection with landing profile fields', () => {
    const payloadConfig = read('src/payload.config.ts')
    const mentorsCollection = read('src/collections/Mentors.ts')

    expect(payloadConfig).toContain("import { Mentors } from './collections/Mentors.ts'")
    expect(payloadConfig).toContain('Mentors,')
    expect(mentorsCollection).toContain("slug: 'mentors'")
    expect(mentorsCollection).toContain("name: 'title'")
    expect(mentorsCollection).toContain("name: 'description'")
    expect(mentorsCollection).toContain("name: 'isActive'")
    expect(mentorsCollection).toContain("name: 'user'")
    expect(mentorsCollection).toContain("relationTo: 'users'")
    expect(mentorsCollection).toContain("name: 'partner'")
    expect(mentorsCollection).toContain("relationTo: 'partners'")
  })

  it('lets founders reference their assigned mentor profile', () => {
    const usersCollection = read('src/collections/Users.ts')

    expect(usersCollection).toContain("name: 'mentor'")
    expect(usersCollection).toContain("relationTo: 'mentors'")
    expect(usersCollection).toContain('Mentor assigned to this user')
  })

  it('exposes mentor profile name, description, and active state in partner/admin panel actions', () => {
    const actions = read('src/app/actions.ts')
    const partnerDashboard = read('src/components/PartnerDashboard.tsx')

    expect(actions).toContain('updateMentorProfile')
    expect(actions).toContain("collection: 'mentors'")
    expect(actions).toContain('profileTitle')
    expect(actions).toContain('profileDescription')
    expect(actions).toContain('profileIsActive')
    expect(actions).toContain('title: data.title.trim()')
    expect(partnerDashboard).toContain('updateMentorProfile')
    expect(partnerDashboard).toContain('profileTitle')
    expect(partnerDashboard).toContain('profileDescription')
    expect(partnerDashboard).toContain('profileIsActive')
    expect(partnerDashboard).toContain('setDraftTitle')
    expect(partnerDashboard).toContain('placeholder="Mentor display name"')
  })

  it('creates a partner-owned landing mentor profile when a partner opens mentor settings', () => {
    const actions = read('src/app/actions.ts')
    const partnerDashboard = read('src/components/PartnerDashboard.tsx')

    expect(actions).toContain('ensurePartnerLandingMentorProfile')
    expect(actions).toContain('partner-landing-')
    expect(actions).toContain('Landing mentor profile')
    expect(actions).toContain("description: ''")
    expect(actions).toContain('isActive: false')
    expect(partnerDashboard).toContain('Landing mentor settings')
  })

  it('loads only the assigned mentor for founder accounts', () => {
    const page = read('src/app/page.tsx')
    const dashboard = read('src/components/DashboardClient.tsx')

    expect(page).toContain('assignedMentor')
    expect(page).toContain("collection: 'mentors'")
    expect(dashboard).toContain('assignedMentor?:')
    expect(page).not.toContain("slug: { equals: 'general' }")
    expect(dashboard).not.toContain('This is General mentor')
  })

  it('shows only active API mentors with logos and hides mentor UI when none exist', () => {
    const page = read('src/app/page.tsx')
    const landing = read('src/components/LandingPage.tsx')

    expect(page).toContain('landingMentors')
    expect(page).toContain("collection: 'mentors'")
    expect(page).toContain("isActive: { equals: true }")
    expect(page).toContain('partner.logo')
    expect(page).toContain('logoUrl: partnerLogoUrl')
    expect(page).toContain("<LandingPage settings={settings} partners={landingPartners} mentors={landingMentors} />")
    expect(landing).toContain('mentors?: MentorEntry[]')
    expect(landing).toContain('function EcosystemShowcase')
    expect(landing).toContain('const mentors = getLandingMentors(rawMentors)')
    expect(landing).toContain('if (!hasPartners && !hasMentors) return null')
    expect(landing).toContain("{hasMentors && (")
    expect(landing).toContain('const mentors = getLandingMentors(trackMentors)')
    expect(landing).toContain('mentors.length > 0 && (')
    expect(landing).toContain('return activeMentors')
    expect(landing).not.toContain('DEFAULT_MENTORS')
    expect(landing).not.toContain('This is General mentor')
    expect(landing).not.toContain('function MentorSelectModal')
    expect(landing).not.toContain('Choose your mentor')
    expect(landing).not.toContain('const displayLogoUrl = mentor.logoUrl || logoUrl')
    expect(landing).not.toContain('className="w-20 h-20 rounded-full border-2')
    expect(landing).toContain('mentor.logoUrl ? mentorLogoFrameClass : mentorAvatarFrameClass')
    expect(landing).toContain('className="max-h-10 w-full object-contain transition-transform duration-200 group-hover:scale-[1.03]"')
    expect(landing).toContain('className="max-h-8 w-full object-contain"')
    expect(landing).not.toContain('src={mentor.logoUrl} alt={mentor.name} className="h-full w-full object-cover"')
  })

  it('starts track CTAs directly without opening the mentor selector', () => {
    const landing = read('src/components/LandingPage.tsx')

    expect(landing).toContain('handleTrackNavigation(modalTrack)')
    expect(landing).not.toContain('setStartTrackTarget(modalTrack)')
    expect(landing).not.toContain('handleTrackLinkClick(event, modalTrack)')
  })

  it('keeps track partner tiles compact inside track cards', () => {
    const landing = read('src/components/LandingPage.tsx')

    expect(landing).toContain("className=\"w-full max-w-[190px]\"")
    expect(landing).toContain('relative w-full max-w-[190px] rounded-xl')
    expect(landing).toContain("isSingle ? 'min-h-[56px] px-3 py-2' : 'min-h-[72px] px-3 py-3'")
    expect(landing).toContain("isSingle ? 'max-h-10' : 'max-h-14'")
    expect(landing).toContain("isSingle ? 'mt-1.5 text-[11px] leading-tight' : 'mt-2 text-[11px] leading-snug'")
    expect(landing).toContain("style={{ minHeight: '112px' }}")
  })

  it('does not auto-create the General mentor profile during Payload startup', () => {
    const payloadConfig = read('src/payload.config.ts')

    expect(payloadConfig).toContain("import { Mentors } from './collections/Mentors.ts'")
    expect(payloadConfig).toContain('Mentors,')
    expect(payloadConfig).not.toContain('ensureGeneralMentor')
    expect(payloadConfig).not.toContain("slug: 'general'")
    expect(payloadConfig).not.toContain('This is General mentor')
  })

  it('includes a cleanup script for removing the General mentor profile', () => {
    const packageJson = read('package.json')
    const cleanupScript = read('src/scripts/delete-general-mentor.ts')

    expect(packageJson).not.toContain('seed:general-mentor')
    expect(packageJson).toContain('cleanup:general-mentor')
    expect(cleanupScript).toContain("slug: { equals: 'general' }")
    expect(cleanupScript).toContain("collection: 'mentors'")
    expect(cleanupScript).toContain("collection: 'users'")
    expect(cleanupScript).toContain('mentor: null')
  })
})
