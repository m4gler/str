import 'dotenv/config'
import { getPayload } from 'payload'
import config from '@/payload.config'

const seed = async () => {
  const payload = await getPayload({ config })

  const existing: any = await payload.findGlobal({ slug: 'platform-settings' }).catch(() => ({}))

  const tracksSectionLabel = existing.tracksSectionLabel || undefined
  const alreadyHasTracks = existing.tracks && existing.tracks.length > 0

  if (alreadyHasTracks && tracksSectionLabel) {
    console.log('Tracks data already exists in PlatformSettings. Skipping seed.')
    process.exit(0)
  }

  console.log('Seeding tracks data into PlatformSettings...')

  await payload.updateGlobal({
    slug: 'platform-settings',
    data: {
      tracksSectionLabel: 'Specialised Tracks',
      tracksSectionTitle: 'Choose your arena.',
      tracksSectionTitleHighlight: 'Define your mission.',
      tracksSectionSubtitle: 'Focused domain tracks with real partner challenges and an ecosystem built for your industry.',
      tracksChallengeTypeLabel: 'Challenge type',
      tracksViewDetailsBtn: 'View full track details →',
      tracksNewTrackLabel: 'New Track',
      tracksNewTrackSubtitle: 'Coming soon',
      tracksNewTrackCta: 'Sponsor a track →',
      tracksNewTrackEmail: 'hello@mesga.eu',
      challengePills: [
        { key: 'general', label: 'General' },
        { key: 'education', label: 'Education' },
        { key: 'space', label: 'Space' },
        { key: 'urban', label: 'Urban' },
        { key: 'other', label: 'Other' },
        { key: 'dualuse', label: 'Dual Use' },
      ],
      tracks: [
        {
          key: 'general',
          icon: '⚡',
          name: 'General Track',
          badge: 'Open Track · All Sectors Welcome',
          tagline: 'For strong founders building outside a specialist lane.',
          desc: 'A flexible entry point for founders whose company does not fit a dedicated thematic track. Bring your product, market problem, and execution plan, and we will pressure-test the fundamentals with you from Day 1.',
          color: '#2CB1A1',
          applyUrl: '/login?role=founder',
          applyButtonText: 'Apply for General Track →',
          challenges: [
            { key: 'general', title: 'General', desc: 'Use the 100-day MESGA structure for a sector-agnostic startup: sharpen the problem, validate demand, build evidence, and prepare for review without forcing the company into a specialist track.' },
          ],
          whatYouGet: [
            { text: 'Generalist founder support across validation, positioning, and go-to-market' },
            { text: 'Mentor feedback focused on execution quality rather than sector branding' },
            { text: 'A clean default path if your startup does not match a specialist track yet' },
            { text: 'Structured pressure-testing of the problem, solution, and commercial wedge' },
            { text: 'Access to the same MESGA platform, workflow, and review process from Day 1' },
            { text: 'Space to refine your direction before moving into a narrower strategic lane' },
          ],
        },
        {
          key: 'satc',
          icon: '🌆',
          name: 'Space & the City',
          badge: 'EUSPA Beta Cohort · Now Open',
          tagline: 'Satellite data. Everyday life. Your idea.',
          desc: "You don't need to build a rocket. This track is for founders using satellite imagery, geolocation data, and Earth observation to solve real urban, civic, agricultural, or consumer problems.",
          color: '#E4B94D',
          applyUrl: '/login?role=founder',
          applyButtonText: 'Apply for Space & the City →',
          challenges: [
            { key: 'space', title: 'Space', desc: 'Build infrastructure, tooling, or services that make space data more accessible, processable, or commercially viable: APIs, analytics platforms, ground segment software, or data pipelines for downstream applications.' },
            { key: 'urban', title: 'Urban', desc: "Turn satellite imagery, Copernicus EO data, or Galileo positioning into a product people actually use for urban planning, mobility, climate monitoring, civic operations, or city services." },
            { key: 'other', title: 'Other', desc: 'Use space-derived data outside the obvious city lane: agriculture, insurance, logistics, environmental monitoring, consumer products, or another applied market where geospatial proof matters.' },
          ],
          whatYouGet: [
            { text: 'Free-tier satellite data: Copernicus, Planet Labs, Sentinel Hub, NASA' },
            { text: 'Geo-data specialists as track mentors' },
            { text: 'Introductions to downstream data buyers: insurance, agri-tech, logistics' },
            { text: 'Working API access to Earth observation datasets from Day 1' },
            { text: 'Guidance on EU geo-data regulation and Copernicus licensing' },
            { text: 'Beta cohort status: direct input into track curriculum design' },
          ],
        },
        {
          key: 'edutech',
          icon: '🎓',
          name: 'EduTech',
          badge: 'Sponsored by TechniSchool',
          tagline: 'Build the future of learning — in 100 days.',
          desc: 'Transform education through technology. K–12, higher education, workforce learning, and corporate training. With TechniSchool as anchor sponsor, get direct access to school networks and a real testbed from Day 1.',
          color: '#0b9df7',
          applyUrl: '/login?role=founder',
          applyButtonText: 'Apply for EduTech Track →',
          challenges: [
            { key: 'education', title: 'Education', desc: 'Build a product that changes how students learn, teachers teach, or institutions measure outcomes — schools, universities, and corporate learning.' },
          ],
          whatYouGet: [
            { text: "Access to TechniSchool's school network for live user testing" },
            { text: 'Pedagogical advisors and curriculum experts as mentors' },
            { text: 'Potential Letter of Intent from TechniSchool if product shows traction' },
            { text: 'EduTech-specific curriculum: regulation, product-led growth, procurement cycles' },
            { text: 'Introductions to Ministry of Education contacts and EU EdTech funding bodies' },
            { text: 'Benchmark data on learning outcomes to validate your product impact' },
          ],
        },
        {
          key: 'dadu',
          icon: '🛡️',
          name: 'Defence & Dual Use',
          badge: 'Dual-use cohort',
          tagline: 'Solve security, resilience, and critical infrastructure problems with commercial-grade execution.',
          desc: 'Build startups for defence, civil resilience, critical infrastructure, and dual-use markets. This track focuses on strong problem framing, operator access, and products that can survive procurement reality.',
          color: '#6EA8FF',
          applyUrl: '/login?role=founder',
          applyButtonText: 'Apply for Defence & Dual Use →',
          challenges: [
            { key: 'dualuse', title: 'Dual Use', desc: 'Build products that can serve defence, public-sector resilience, or critical industries while still working in commercial markets: cybersecurity, infrastructure visibility, readiness tooling, simulation, training, logistics, or secure collaboration.' },
          ],
          whatYouGet: [
            { text: 'Operator-informed feedback on security and resilience problem selection' },
            { text: 'Support for dual-use positioning, procurement readiness, and market sequencing' },
            { text: 'Mentorship on trust, compliance, and adoption barriers in regulated environments' },
            { text: 'A focused track for founders building commercially viable products with defence or civil-security relevance' },
          ],
        },

      ],
    } as any,
  })

  console.log('✅ Tracks data seeded successfully!')
  console.log('   - 4 tracks: General Track, Space & the City, EduTech Track, Defence & Dual Use')
  console.log('   - 6 challenge pills: General, Education, Space, Urban, Other, Dual Use')
  console.log('   - Section labels and buttons configured')
  console.log('   - Apply buttons point to /login?role=founder (configurable in admin)')
  process.exit(0)
}

seed()
