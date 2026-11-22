/**
 * Copernicus Data Space Ecosystem — STAC API integration.
 *
 * Dynamically fetches the real Copernicus collection catalog, then scores
 * each collection against the founder's project description using keyword
 * overlap. Verified via STAC search with the founder's coordinates.
 *
 * All tunable parameters are loaded from PlatformSettings → Space Data tab.
 * Falls back to sensible defaults when no config is provided.
 *
 * API: https://stac.dataspace.copernicus.eu/v1/
 * No API key required for catalog browsing + search.
 */

// Cache fetched collections for configurable TTL
let collectionsCache: CatalogCollection[] | null = null
let collectionsCacheTime = 0

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CatalogCollection {
  id: string
  title: string
  description: string
  keywords: string[]
  euSpaceAsset: string
  links: Array<{ rel: string; href: string; type?: string }>
}

export interface SpaceDataRelevance {
  relevanceScore: number
  summary: string
  keywords: string[]
  euSpaceAssets: string[]
  datasets: Array<{
    name: string
    type: string
    description: string
    collectionId: string
    euSpaceAsset: string
    useCase: string
    sampleItemCount?: number
    dataUrl?: string
  }>
  galileoRelevance: string | null
  analyzedAt: string
}

/** Config object loaded from PlatformSettings.spaceData* fields */
export interface SpaceDataConfig {
  // STAC API
  stacBaseUrl: string
  cacheTtlMinutes: number
  minMatchScore: number
  maxDatasets: number
  bboxDeltaDegrees: number
  dataWindowDays: number
  // Scoring weights
  titleWeight: number
  descriptionWeight: number
  keywordWeight: number
  // Relevance formula
  matchQualityMax: number
  matchQualityDivisor: number
  liveDataPerDataset: number
  liveDataMax: number
  catalogPerDataset: number
  catalogMax: number
  coordinatesBonus: number
  galileoTextBonus: number
  strongMatchBonus: number
  strongMatchThreshold: number
  // Galileo
  galileoIndicators: string[]
  // Stop words (empty = use defaults)
  stopWords: Set<string>
  // Summary templates
  noMatchSummary: string
  matchSummaryPrefix: string
  liveDataSuffix: string
  assetsSuffix: string
  galileoSuffix: string
}

// ---------------------------------------------------------------------------
// Defaults (used when PlatformSettings is empty / not loaded)
// ---------------------------------------------------------------------------

const DEFAULT_STOP_WORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her',
  'was', 'one', 'our', 'out', 'has', 'his', 'how', 'its', 'may', 'new', 'now',
  'old', 'see', 'way', 'who', 'did', 'get', 'let', 'say', 'she', 'too', 'use',
  'from', 'that', 'this', 'with', 'have', 'been', 'each', 'make', 'like', 'long',
  'look', 'many', 'some', 'them', 'then', 'than', 'made', 'more', 'most', 'very',
  'when', 'what', 'your', 'which', 'their', 'will', 'about', 'would', 'there',
  'these', 'other', 'into', 'could', 'after', 'also', 'just', 'over', 'such',
  'they', 'only', 'well', 'where', 'does', 'being', 'still', 'while', 'using',
  'within', 'between', 'through', 'during', 'before', 'should',
  'email', 'used', 'yes', 'please', 'com', 'www', 'http', 'https', 'url',
  'none', 'null', 'true', 'false', 'select', 'option', 'enter', 'provide',
  'describe', 'name', 'first', 'last', 'answer', 'question', 'form',
  'registration', 'contact', 'profile', 'linkedin', 'facebook', 'twitter',
  'product', 'products', 'data', 'level', 'provides', 'global', 'quality',
  'resolution', 'satellite', 'imagery', 'based', 'derived', 'processing',
  'version', 'day', 'days', 'time', 'daily', 'monthly', 'yearly', 'annual',
  'meter', 'meters', 'band', 'bands', 'full', 'high', 'low', 'medium',
  'critical', 'standard', 'observations', 'coverage', 'spatial', 'temporal',
  'hours', 'highest', 'corrected', 'atmospherically',
  'mesga', 'bakery', 'ventures', 'founder', 'startup', 'idea', 'company',
  'joining', 'solo', 'primary', 'residency', 'country', 'city', 'relocated',
  'education', 'describes', 'today', 'agree', 'process', 'answers', 'selection',
  'matchmaking', 'aggregated', 'ecosystem', 'reporting', 'incorporated',
  'every', 'users', 'user', 'focused', 'best', 'work', 'working', 'different',
  'available', 'possible', 'current', 'currently', 'information', 'system',
  'systems', 'service', 'services', 'support', 'approach', 'specific',
  'number', 'including', 'included', 'include', 'related', 'range', 'areas',
  'area', 'part', 'parts', 'type', 'types', 'value', 'values', 'model',
  'models', 'based', 'following', 'general', 'particular', 'given',
  'result', 'results', 'total', 'found', 'need', 'needs', 'point', 'points',
  'case', 'cases', 'group', 'groups', 'example', 'examples', 'large', 'small',
  'open', 'period', 'periods', 'order', 'set', 'sets', 'line', 'local',
  'state', 'states', 'show', 'shows', 'conditions', 'means', 'early',
  'important', 'significant', 'long', 'short', 'single', 'broad',
  'complete', 'potential', 'detail', 'detailed', 'recent', 'key',
  'major', 'certain', 'individual', 'directly', 'various', 'common',
  'same', 'real', 'able', 'right', 'next', 'both', 'own', 'back',
  'take', 'year', 'years', 'good', 'great', 'want', 'tell', 'know',
  'think', 'help', 'come', 'keep', 'start', 'run', 'call', 'end',
  'turn', 'move', 'play', 'fact', 'thing', 'things', 'place', 'places',
  'world', 'life', 'hand', 'hands', 'home', 'house', 'side', 'test',
  'tests', 'plan', 'plans', 'build', 'create', 'develop', 'design',
  'yes', 'true', 'false', 'other', 'others', 'don', 'didn', 'doesn',
])

const DEFAULT_CONFIG: SpaceDataConfig = {
  stacBaseUrl: 'https://stac.dataspace.copernicus.eu/v1',
  cacheTtlMinutes: 60,
  minMatchScore: 3,
  maxDatasets: 8,
  bboxDeltaDegrees: 1,
  dataWindowDays: 90,
  titleWeight: 3,
  descriptionWeight: 1,
  keywordWeight: 5,
  matchQualityMax: 30,
  matchQualityDivisor: 2,
  liveDataPerDataset: 10,
  liveDataMax: 30,
  catalogPerDataset: 3,
  catalogMax: 15,
  coordinatesBonus: 10,
  galileoTextBonus: 10,
  strongMatchBonus: 5,
  strongMatchThreshold: 10,
  galileoIndicators: [
    'location', 'positioning', 'navigation', 'gps', 'gnss', 'geolocation',
    'tracking', 'mapping', 'geospatial', 'coordinates', 'route', 'routing',
    'fleet', 'delivery', 'logistics', 'transport', 'mobility', 'drone',
    'autonomous', 'precision', 'survey', 'geodetic', 'spatial',
  ],
  stopWords: DEFAULT_STOP_WORDS,
  noMatchSummary: 'Analyzed {total} Copernicus collections — no significant match found for your project description. Try adding more detail about your industry, problem domain, and technology approach.',
  matchSummaryPrefix: 'Analyzed {total} Copernicus collections against your project description. Found {count} relevant dataset(s)',
  liveDataSuffix: ', {liveCount} with verified live data (last {days} days)',
  assetsSuffix: '. EU Space Assets: {assets}.',
  galileoSuffix: ' Galileo/EGNOS positioning applicable.',
}

// ---------------------------------------------------------------------------
// Build config from PlatformSettings data
// ---------------------------------------------------------------------------

export function buildSpaceDataConfig(settings: Record<string, any>): SpaceDataConfig {
  const sd = settings?.spaceData || {}
  const sc = settings?.spaceDataScoring || {}
  const rf = settings?.spaceDataRelevanceFormula || {}
  const gal = settings?.spaceDataGalileo || {}
  const st = settings?.spaceDataSummaryTemplates || {}

  // Parse stop words from comma-separated textarea (or use defaults)
  let stopWords = DEFAULT_STOP_WORDS
  const rawStopWords = settings?.spaceDataStopWords
  if (rawStopWords && typeof rawStopWords === 'string' && rawStopWords.trim().length > 0) {
    stopWords = new Set(
      rawStopWords.split(',').map((w: string) => w.trim().toLowerCase()).filter((w: string) => w.length > 0)
    )
  }

  // Parse galileo indicators from comma-separated textarea
  let galileoIndicators = DEFAULT_CONFIG.galileoIndicators
  if (gal.galileoIndicators && typeof gal.galileoIndicators === 'string' && gal.galileoIndicators.trim().length > 0) {
    galileoIndicators = gal.galileoIndicators.split(',').map((w: string) => w.trim().toLowerCase()).filter((w: string) => w.length > 0)
  }

  return {
    stacBaseUrl: sd.stacBaseUrl || DEFAULT_CONFIG.stacBaseUrl,
    cacheTtlMinutes: sd.cacheTtlMinutes ?? DEFAULT_CONFIG.cacheTtlMinutes,
    minMatchScore: sd.minMatchScore ?? DEFAULT_CONFIG.minMatchScore,
    maxDatasets: sd.maxDatasets ?? DEFAULT_CONFIG.maxDatasets,
    bboxDeltaDegrees: sd.bboxDeltaDegrees ?? DEFAULT_CONFIG.bboxDeltaDegrees,
    dataWindowDays: sd.dataWindowDays ?? DEFAULT_CONFIG.dataWindowDays,
    titleWeight: sc.titleWeight ?? DEFAULT_CONFIG.titleWeight,
    descriptionWeight: sc.descriptionWeight ?? DEFAULT_CONFIG.descriptionWeight,
    keywordWeight: sc.keywordWeight ?? DEFAULT_CONFIG.keywordWeight,
    matchQualityMax: rf.matchQualityMax ?? DEFAULT_CONFIG.matchQualityMax,
    matchQualityDivisor: rf.matchQualityDivisor ?? DEFAULT_CONFIG.matchQualityDivisor,
    liveDataPerDataset: rf.liveDataPerDataset ?? DEFAULT_CONFIG.liveDataPerDataset,
    liveDataMax: rf.liveDataMax ?? DEFAULT_CONFIG.liveDataMax,
    catalogPerDataset: rf.catalogPerDataset ?? DEFAULT_CONFIG.catalogPerDataset,
    catalogMax: rf.catalogMax ?? DEFAULT_CONFIG.catalogMax,
    coordinatesBonus: rf.coordinatesBonus ?? DEFAULT_CONFIG.coordinatesBonus,
    galileoTextBonus: rf.galileoTextBonus ?? DEFAULT_CONFIG.galileoTextBonus,
    strongMatchBonus: rf.strongMatchBonus ?? DEFAULT_CONFIG.strongMatchBonus,
    strongMatchThreshold: rf.strongMatchThreshold ?? DEFAULT_CONFIG.strongMatchThreshold,
    galileoIndicators,
    stopWords,
    noMatchSummary: st.noMatchSummary || DEFAULT_CONFIG.noMatchSummary,
    matchSummaryPrefix: st.matchSummaryPrefix || DEFAULT_CONFIG.matchSummaryPrefix,
    liveDataSuffix: st.liveDataSuffix || DEFAULT_CONFIG.liveDataSuffix,
    assetsSuffix: st.assetsSuffix || DEFAULT_CONFIG.assetsSuffix,
    galileoSuffix: st.galileoSuffix || DEFAULT_CONFIG.galileoSuffix,
  }
}

// ---------------------------------------------------------------------------
// EU Space Asset classification (derived from collection ID patterns)
// ---------------------------------------------------------------------------

function classifyEuSpaceAsset(collectionId: string, title: string): string {
  const id = collectionId.toLowerCase()
  const t = title.toLowerCase()
  if (id.startsWith('sentinel-1')) return 'Copernicus Sentinel-1'
  if (id.startsWith('sentinel-2')) return 'Copernicus Sentinel-2'
  if (id.startsWith('sentinel-3')) return 'Copernicus Sentinel-3'
  if (id.startsWith('sentinel-5p') || id.startsWith('sentinel-5')) return 'Copernicus Sentinel-5P'
  if (id.startsWith('sentinel-6')) return 'Copernicus Sentinel-6'
  if (id.includes('clms') || id.includes('urban-atlas') || id.includes('corine')) return 'Copernicus Land Monitoring Service (CLMS)'
  if (id.includes('cop-dem') || id.includes('dem')) return 'Copernicus DEM'
  if (id.includes('modis') && (t.includes('temperature') || t.includes('fire'))) return 'Copernicus Climate/Atmosphere Service'
  if (id.includes('modis') && t.includes('vegetation')) return 'Copernicus Land Monitoring Service (CLMS)'
  if (id.includes('modis')) return 'Copernicus Contributing Mission (MODIS)'
  if (id.includes('landsat')) return 'Copernicus Contributing Mission (Landsat)'
  if (id.startsWith('ccm')) return 'Copernicus Contributing Mission'
  return 'Copernicus Data Space'
}

// ---------------------------------------------------------------------------
// Build the browser URL for a collection on Copernicus Data Space
// ---------------------------------------------------------------------------

function getCollectionUrl(collectionId: string, stacBaseUrl: string): string {
  // CDSE STAC Browser — uses the same collection IDs as the STAC API
  // See: https://documentation.dataspace.copernicus.eu/APIs/STAC.html
  if (stacBaseUrl.includes('dataspace.copernicus.eu')) {
    return `https://browser.stac.dataspace.copernicus.eu/collections/${encodeURIComponent(collectionId)}`
  }
  // Fallback: link to STAC collection endpoint
  return `${stacBaseUrl}/collections/${encodeURIComponent(collectionId)}`
}

// ---------------------------------------------------------------------------
// Fetch catalog collections dynamically from STAC API
// ---------------------------------------------------------------------------

async function fetchAllCollections(cfg: SpaceDataConfig): Promise<CatalogCollection[]> {
  const now = Date.now()
  const cacheTtlMs = cfg.cacheTtlMinutes * 60 * 1000
  if (collectionsCache && now - collectionsCacheTime < cacheTtlMs) {
    return collectionsCache
  }

  const allCollections: CatalogCollection[] = []
  let nextUrl: string | null = `${cfg.stacBaseUrl}/collections?limit=100`

  while (nextUrl) {
    const url: string = nextUrl
    nextUrl = null
    try {
      const res: Response = await fetch(url, {
        headers: { 'User-Agent': 'MESGA-Platform/1.0' },
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) break

      const data: any = await res.json()
      const collections = data.collections || []

      for (const col of collections) {
        const id = col.id || ''
        const title = col.title || id
        const desc = col.description || ''
        const keywords = col.keywords || []
        const links = col.links || []
        allCollections.push({
          id,
          title,
          description: desc,
          keywords: keywords.map((k: string) => k.toLowerCase()),
          euSpaceAsset: classifyEuSpaceAsset(id, title),
          links,
        })
      }

      const pageLinks: any[] = data.links || []
      const nextLink = pageLinks.find((l) => l.rel === 'next')
      nextUrl = nextLink?.href || null
    } catch {
      break
    }
  }

  if (allCollections.length > 0) {
    collectionsCache = allCollections
    collectionsCacheTime = now
  }

  return allCollections
}

// ---------------------------------------------------------------------------
// Score a collection against the founder's text
// ---------------------------------------------------------------------------

function tokenize(text: string, stopWords: Set<string>): Set<string> {
  return new Set(
    text.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w))
  )
}

function scoreCollection(col: CatalogCollection, userTokens: Set<string>, cfg: SpaceDataConfig): number {
  let score = 0

  const titleTokens = tokenize(col.title, cfg.stopWords)
  for (const t of titleTokens) {
    if (userTokens.has(t)) score += cfg.titleWeight
  }

  const descTokens = tokenize(col.description, cfg.stopWords)
  for (const t of descTokens) {
    if (userTokens.has(t)) score += cfg.descriptionWeight
  }

  for (const kw of col.keywords) {
    const kwTokens = tokenize(kw, cfg.stopWords)
    for (const t of kwTokens) {
      if (userTokens.has(t)) score += cfg.keywordWeight
    }
  }

  return score
}

// ---------------------------------------------------------------------------
// Generate a use-case description dynamically based on overlap
// ---------------------------------------------------------------------------

function generateUseCase(col: CatalogCollection, userTokens: Set<string>, stopWords: Set<string>): string {
  const descTokens = tokenize(col.description, stopWords)
  const kwTokens = new Set(col.keywords.flatMap(k => [...tokenize(k, stopWords)]))
  const allColTokens = new Set([...descTokens, ...kwTokens])
  const overlapping = [...allColTokens].filter(t => userTokens.has(t))

  if (overlapping.length > 0) {
    return `Matched on: ${overlapping.slice(0, 6).join(', ')}. ${col.description}`
  }

  return col.description
}

// ---------------------------------------------------------------------------
// Core: build user text from project description + intake fields
// ---------------------------------------------------------------------------

function buildSearchText(projectDescription: string, submissionData?: Record<string, any>): string {
  const parts = [projectDescription]

  if (submissionData) {
    for (const [, val] of Object.entries(submissionData)) {
      if (typeof val === 'string' && val.length > 1) {
        parts.push(val)
      } else if (Array.isArray(val)) {
        for (const item of val) {
          if (typeof item === 'string') parts.push(item)
        }
      }
    }
  }

  return parts.join(' ').toLowerCase()
}

// ---------------------------------------------------------------------------
// STAC search — verify data near founder's location
// ---------------------------------------------------------------------------

async function verifyCollection(
  collectionId: string,
  coordinates: { lat: number; lng: number } | null | undefined,
  cfg: SpaceDataConfig,
): Promise<number> {
  try {
    const searchBody: any = {
      collections: [collectionId],
      limit: 1,
    }

    if (coordinates) {
      const delta = cfg.bboxDeltaDegrees
      searchBody.bbox = [
        coordinates.lng - delta,
        coordinates.lat - delta,
        coordinates.lng + delta,
        coordinates.lat + delta,
      ]
    }

    const now = new Date()
    const ago = new Date(now.getTime() - cfg.dataWindowDays * 24 * 60 * 60 * 1000)
    searchBody.datetime = `${ago.toISOString().split('T')[0]}T00:00:00Z/${now.toISOString().split('T')[0]}T23:59:59Z`

    const res = await fetch(`${cfg.stacBaseUrl}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'MESGA-Platform/1.0',
      },
      body: JSON.stringify(searchBody),
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) return 0
    const data = await res.json()
    return data.numberMatched ?? data.features?.length ?? 0
  } catch {
    return 0
  }
}

// ---------------------------------------------------------------------------
// Galileo relevance — based on user's actual text, not hardcoded
// ---------------------------------------------------------------------------

function assessGalileoRelevance(
  text: string,
  coordinates: { lat: number; lng: number } | null | undefined,
  cfg: SpaceDataConfig,
): string | null {
  const matched = cfg.galileoIndicators.filter(k => text.includes(k))

  if (matched.length >= 1) {
    return `Project involves ${matched.slice(0, 4).join(', ')} — directly applicable to Galileo/EGNOS high-accuracy positioning.`
  }

  if (coordinates) {
    return `Galileo/EGNOS positioning applicable for ecosystem mapping and proximity-based mentor/partner matching.`
  }

  return null
}

// ---------------------------------------------------------------------------
// Template helpers
// ---------------------------------------------------------------------------

function renderTemplate(template: string, vars: Record<string, string | number>): string {
  let result = template
  for (const [key, val] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(val))
  }
  return result
}

// ---------------------------------------------------------------------------
// Main analysis function
// ---------------------------------------------------------------------------

export async function analyzeSpaceDataRelevance(
  projectDescription: string,
  submissionData?: Record<string, any>,
  coordinates?: { lat: number; lng: number } | null,
  config?: SpaceDataConfig,
): Promise<SpaceDataRelevance> {
  const cfg = config || DEFAULT_CONFIG
  const text = buildSearchText(projectDescription, submissionData)
  const userTokens = tokenize(text, cfg.stopWords)

  // Step 1: Fetch all collections from Copernicus STAC API
  const allCollections = await fetchAllCollections(cfg)

  // Step 2: Score every collection against user's text
  const scored = allCollections
    .map(col => ({ col, score: scoreCollection(col, userTokens, cfg) }))
    .filter(s => s.score >= cfg.minMatchScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, cfg.maxDatasets)

  // Step 3: Verify data availability via STAC search for top matches
  // Sequential with delay to avoid 429 rate-limiting from Copernicus API
  const verifiedDatasets: SpaceDataRelevance['datasets'] = []
  for (let i = 0; i < scored.length; i++) {
    const { col } = scored[i]
    if (i > 0) await new Promise(r => setTimeout(r, 350))
    try {
      const itemCount = await verifyCollection(col.id, coordinates, cfg)
      verifiedDatasets.push({
        name: col.title,
        type: col.euSpaceAsset,
        description: col.description,
        collectionId: col.id,
        euSpaceAsset: col.euSpaceAsset,
        useCase: generateUseCase(col, userTokens, cfg.stopWords),
        sampleItemCount: itemCount,
        dataUrl: getCollectionUrl(col.id, cfg.stacBaseUrl),
      })
    } catch {
      // skip failed verifications
    }
  }

  // Step 4: Galileo assessment
  const galileoRelevance = assessGalileoRelevance(text, coordinates, cfg)

  // Step 5: Calculate relevance score
  if (scored.length === 0) {
    return {
      relevanceScore: 0,
      summary: renderTemplate(cfg.noMatchSummary, { total: allCollections.length }),
      keywords: [],
      euSpaceAssets: galileoRelevance ? ['Galileo / EGNOS'] : [],
      datasets: [],
      galileoRelevance,
      analyzedAt: new Date().toISOString(),
    }
  }

  const withLiveData = verifiedDatasets.filter(d => (d.sampleItemCount ?? 0) > 0)
  const totalMatchScore = scored.reduce((sum, s) => sum + s.score, 0)
  let relevanceScore = 0
  relevanceScore += Math.min(Math.floor(totalMatchScore / cfg.matchQualityDivisor), cfg.matchQualityMax)
  relevanceScore += Math.min(withLiveData.length * cfg.liveDataPerDataset, cfg.liveDataMax)
  relevanceScore += Math.min(verifiedDatasets.length * cfg.catalogPerDataset, cfg.catalogMax)
  if (coordinates) relevanceScore += cfg.coordinatesBonus
  if (galileoRelevance) relevanceScore += cfg.galileoTextBonus
  if (scored.length > 0 && scored[0].score >= cfg.strongMatchThreshold) relevanceScore += cfg.strongMatchBonus
  relevanceScore = Math.min(relevanceScore, 100)

  // Step 6: Collect EU Space Assets
  const euSpaceAssets = [...new Set(verifiedDatasets.map(d => d.euSpaceAsset))]
  if (galileoRelevance) euSpaceAssets.push('Galileo / EGNOS')

  // Step 7: Generate summary
  const assetNames = euSpaceAssets.slice(0, 5)
  const collectionTokens = new Set<string>()
  for (const { col } of scored) {
    for (const t of tokenize(col.title, cfg.stopWords)) collectionTokens.add(t)
    for (const kw of col.keywords) {
      for (const t of tokenize(kw, cfg.stopWords)) collectionTokens.add(t)
    }
  }
  const matchedKeywords = [...userTokens].filter(t => collectionTokens.has(t)).slice(0, 12)

  let summary = renderTemplate(cfg.matchSummaryPrefix, { total: allCollections.length, count: verifiedDatasets.length })
  if (withLiveData.length > 0) {
    summary += renderTemplate(cfg.liveDataSuffix, { liveCount: withLiveData.length, days: cfg.dataWindowDays })
  }
  summary += renderTemplate(cfg.assetsSuffix, { assets: assetNames.join(', ') })
  if (galileoRelevance) summary += cfg.galileoSuffix

  return {
    relevanceScore,
    summary,
    keywords: matchedKeywords,
    euSpaceAssets,
    datasets: verifiedDatasets,
    galileoRelevance,
    analyzedAt: new Date().toISOString(),
  }
}
