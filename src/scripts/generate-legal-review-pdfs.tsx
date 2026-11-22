import 'dotenv/config'
import fs from 'fs'
import os from 'os'
import path from 'path'
import React from 'react'
import { execFileSync } from 'child_process'
import { getPayload } from 'payload'
import config from '@/payload.config'
import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from '@react-pdf/renderer'
import { getDocumentHref } from '@/lib/documents'
import { getAppUrl } from '@/lib/appUrl'
import { resolveLocalizedLegalDocument } from '@/lib/legalDocuments'
import {
  buildLegalReviewContext,
  buildLegalReviewDrafts,
  type LegalReviewBlock,
  type LegalReviewDraft,
} from '@/lib/legalReviewContent'

let fontsRegistered = false

function ensureFonts() {
  if (fontsRegistered) return

  const fontsDir = path.join(process.cwd(), 'src', 'fonts')
  Font.register({
    family: 'Roboto',
    fonts: [
      { src: path.join(fontsDir, 'Roboto-Regular.ttf') },
      { src: path.join(fontsDir, 'Roboto-Bold.ttf'), fontWeight: 700 },
    ],
  })

  fontsRegistered = true
}

const REVIEW_COLOR = '#C74D2C'

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    paddingTop: 42,
    paddingBottom: 42,
    paddingHorizontal: 44,
    fontFamily: 'Roboto',
    fontSize: 10,
    color: '#161616',
    lineHeight: 1.45,
  },
  header: {
    marginBottom: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#d7d7d7',
  },
  title: {
    fontSize: 21,
    fontWeight: 700,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 11,
    color: '#555555',
    marginBottom: 10,
  },
  notice: {
    backgroundColor: '#FBE5DF',
    borderWidth: 1,
    borderColor: REVIEW_COLOR,
    padding: 10,
    borderRadius: 6,
    fontSize: 9,
    color: REVIEW_COLOR,
  },
  section: {
    marginBottom: 14,
  },
  anchor: {
    fontSize: 8,
    color: '#777777',
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: REVIEW_COLOR,
    marginBottom: 6,
  },
  block: {
    marginBottom: 6,
    backgroundColor: '#FBE5DF',
    borderLeftWidth: 3,
    borderLeftColor: REVIEW_COLOR,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  paragraph: {
    fontSize: 10,
    color: REVIEW_COLOR,
  },
  listItem: {
    fontSize: 10,
    color: REVIEW_COLOR,
    marginBottom: 2,
  },
  footer: {
    position: 'absolute',
    left: 44,
    right: 44,
    bottom: 24,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
    fontSize: 8,
    color: '#777777',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
})

function renderBlock(block: LegalReviewBlock, index: number) {
  if (block.type === 'list') {
    return (
      <View key={index} style={styles.block}>
        {(block.items || []).map((item, itemIndex) => (
          <Text key={itemIndex} style={styles.listItem}>
            - {item}
          </Text>
        ))}
      </View>
    )
  }

  return (
    <View key={index} style={styles.block}>
      <Text style={styles.paragraph}>{block.text}</Text>
    </View>
  )
}

function LegalReviewPdf({ draft }: { draft: LegalReviewDraft }) {
  return (
    <Document
      title={draft.title}
      author="MESGA"
      subject={draft.subtitle}
      language={draft.language}
      producer="MESGA legal review generator"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{draft.title}</Text>
          <Text style={styles.subtitle}>{draft.subtitle}</Text>
          <Text style={styles.notice}>{draft.reviewNotice}</Text>
        </View>

        {draft.sections.map((section, sectionIndex) => (
          <View key={sectionIndex} style={styles.section}>
            <Text style={styles.anchor}>{section.anchor}</Text>
            <Text style={styles.sectionTitle}>{section.heading}</Text>
            {section.blocks.map((block, blockIndex) => renderBlock(block, blockIndex))}
          </View>
        ))}

        <View style={styles.footer} fixed>
          <Text>{draft.filename}</Text>
          <Text render={({ pageNumber, totalPages }) => `Addendum ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}

function toAbsoluteDocumentUrl(href: string): string {
  if (/^https?:\/\//i.test(href)) return href

  const candidates = [
    getAppUrl(),
    process.env.NEXT_PUBLIC_SERVER_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    'https://mesga.eu',
  ].filter(Boolean) as string[]

  for (const candidate of candidates) {
    try {
      return new URL(href, candidate).toString()
    } catch {}
  }

  throw new Error(`Could not resolve absolute document URL for ${href}`)
}

async function fetchExistingPdfBuffer(href: string): Promise<Buffer> {
  const candidates = [toAbsoluteDocumentUrl(href)]

  if (!candidates.includes('https://mesga.eu' + href) && href.startsWith('/')) {
    candidates.push(`https://mesga.eu${href}`)
  }

  let lastError: unknown = null

  for (const url of candidates) {
    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      return Buffer.from(await response.arrayBuffer())
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Failed to fetch source PDF from ${href}`)
}

function mergePdfs(sourcePdfPath: string, addendumPdfPath: string, outputPath: string) {
  execFileSync('gs', [
    '-q',
    '-dNOPAUSE',
    '-dBATCH',
    '-sDEVICE=pdfwrite',
    `-sOutputFile=${outputPath}`,
    sourcePdfPath,
    addendumPdfPath,
  ], {
    stdio: 'inherit',
  })
}

function getLegalLinkSettings(settings: any, sourceKey: 'terms' | 'privacy') {
  return sourceKey === 'terms'
    ? settings?.footer?.legalLinks?.termsOfUse
    : settings?.footer?.legalLinks?.privacyPolicy
}

function getFallbackLabel(sourceKey: 'terms' | 'privacy', language: string): string {
  if (sourceKey === 'terms') {
    return language === 'pl' ? 'Warunki korzystania' : 'Terms of Use'
  }

  return language === 'pl' ? 'Polityka prywatnosci' : 'Privacy Policy'
}

async function main() {
  ensureFonts()

  const payload = await getPayload({ config })
  const settings = await payload.findGlobal({ slug: 'platform-settings' }).catch(() => ({}))
  const context = buildLegalReviewContext(settings)
  const drafts = buildLegalReviewDrafts(context)
  const outputDir = path.join(process.cwd(), 'docs', 'legal-review')

  fs.mkdirSync(outputDir, { recursive: true })

  for (const draft of drafts) {
    const legalLink = resolveLocalizedLegalDocument(
      getLegalLinkSettings(settings, draft.sourceKey),
      draft.language,
      getFallbackLabel(draft.sourceKey, draft.language),
    )

    if (!legalLink.document) {
      throw new Error(`Missing source document for ${draft.sourceKey} (${draft.language})`)
    }

    const sourceHref = getDocumentHref(legalLink.document as any)
    if (!sourceHref || sourceHref === '#') {
      throw new Error(`Could not resolve source PDF for ${draft.sourceKey} (${draft.language})`)
    }

    const sourcePdf = await fetchExistingPdfBuffer(sourceHref)
    const addendumPdf = await renderToBuffer(<LegalReviewPdf draft={draft} />)
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesga-legal-review-'))
    const sourcePdfPath = path.join(tempDir, 'source.pdf')
    const addendumPdfPath = path.join(tempDir, 'addendum.pdf')
    const outputPath = path.join(outputDir, draft.filename)

    fs.writeFileSync(sourcePdfPath, sourcePdf)
    fs.writeFileSync(addendumPdfPath, addendumPdf)
    mergePdfs(sourcePdfPath, addendumPdfPath, outputPath)
    fs.rmSync(tempDir, { recursive: true, force: true })

    console.log(`[legal:pdfs] Generated ${outputPath}`)
  }

  process.exit(0)
}

main().catch((error) => {
  console.error('[legal:pdfs] Failed to generate review PDFs:', error)
  process.exit(1)
})
