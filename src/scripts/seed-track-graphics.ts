/**
 * Uploads the four existing track graphic PNGs from /public/images/ into the
 * Payload media collection and links each one to the matching track entry in
 * PlatformSettings.tracks via the new `graphic` upload field.
 *
 * Run once:
 *   npx tsx src/scripts/seed-track-graphics.ts
 */

import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { getPayload } from 'payload'
import config from '@/payload.config'

const GRAPHICS: { key: string; file: string; alt: string }[] = [
  { key: 'satc',    file: 'graphic-satc.png',    alt: 'Space & the City Track Graphic' },
  { key: 'edutech', file: 'graphic-edutech.png', alt: 'EduTech Track Graphic' },
  { key: 'general', file: 'graphic-general.png', alt: 'General Track Graphic' },
  { key: 'dadu',    file: 'graphic-dadu.png',    alt: 'DADU Track Graphic' },
]

async function run() {
  const payload = await getPayload({ config })

  const imagesDir = path.resolve(process.cwd(), 'public', 'images')

  // Upload each image to the media collection (skip if already exists by alt text)
  const keyToMediaId: Record<string, string | number> = {}

  for (const { key, file, alt } of GRAPHICS) {
    const filePath = path.join(imagesDir, file)

    if (!fs.existsSync(filePath)) {
      console.warn(`[skip] ${file} not found at ${filePath}`)
      continue
    }

    // Check for existing media with same alt to avoid duplicate uploads
    const existing = await payload.find({
      collection: 'media',
      where: { alt: { equals: alt } },
      limit: 1,
    })

    if (existing.docs.length > 0) {
      console.log(`[exists] ${file} → media id ${existing.docs[0].id}`)
      keyToMediaId[key] = existing.docs[0].id
      continue
    }

    const data = fs.readFileSync(filePath)
    const mediaDoc = await payload.create({
      collection: 'media',
      data: { alt },
      file: {
        data,
        mimetype: 'image/png',
        name: file,
        size: data.length,
      },
    })

    console.log(`[uploaded] ${file} → media id ${mediaDoc.id}`)
    keyToMediaId[key] = mediaDoc.id
  }

  if (Object.keys(keyToMediaId).length === 0) {
    console.log('No images uploaded — nothing to link.')
    process.exit(0)
  }

  // Read current PlatformSettings tracks array and patch graphic IDs
  const settings: any = await payload.findGlobal({ slug: 'platform-settings' })
  const tracks: any[] = Array.isArray(settings?.tracks) ? settings.tracks : []

  if (tracks.length === 0) {
    console.warn('No tracks found in PlatformSettings. Run seed-tracks first.')
    process.exit(1)
  }

  let updated = 0
  const patchedTracks = tracks.map((tr: any) => {
    const mediaId = keyToMediaId[tr.key]
    if (!mediaId) return tr
    if (tr.graphic) {
      const existingId = typeof tr.graphic === 'object' ? tr.graphic.id : tr.graphic
      if (String(existingId) === String(mediaId)) return tr // already set
    }
    updated++
    return { ...tr, graphic: mediaId }
  })

  if (updated === 0) {
    console.log('All tracks already have graphics linked — nothing to update.')
    process.exit(0)
  }

  await payload.updateGlobal({
    slug: 'platform-settings',
    data: { tracks: patchedTracks } as any,
  })

  console.log(`[done] Linked graphics for ${updated} track(s).`)
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
