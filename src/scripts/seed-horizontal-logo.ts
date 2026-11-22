import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { getPayload } from 'payload'
import config from '@/payload.config'

const LOGO_FILE = 'mesga-horizontal-logo.png'
const LOGO_ALT = 'MESGA horizontal logo'

async function run() {
  const payload = await getPayload({ config })
  const filePath = path.resolve(process.cwd(), 'public', 'assets', LOGO_FILE)

  if (!fs.existsSync(filePath)) {
    throw new Error(`Logo file not found: ${filePath}`)
  }

  const existing = await payload.find({
    collection: 'media',
    where: { alt: { equals: LOGO_ALT } },
    limit: 1,
  })

  let mediaId: string | number

  if (existing.docs[0]) {
    mediaId = existing.docs[0].id
    console.log(`[exists] ${LOGO_FILE} -> media id ${mediaId}`)
  } else {
    const data = fs.readFileSync(filePath)
    const mediaDoc = await payload.create({
      collection: 'media',
      data: { alt: LOGO_ALT },
      file: {
        data,
        mimetype: 'image/png',
        name: LOGO_FILE,
        size: data.length,
      },
    })
    mediaId = mediaDoc.id
    console.log(`[uploaded] ${LOGO_FILE} -> media id ${mediaId}`)
  }

  const settings: any = await payload.findGlobal({ slug: 'platform-settings' }).catch(() => ({}))
  const currentId = typeof settings?.logo === 'object'
    ? settings.logo?.id
    : settings?.logo

  if (String(currentId || '') === String(mediaId)) {
    console.log('[done] PlatformSettings logo already points to this media.')
    return
  }

  await payload.updateGlobal({
    slug: 'platform-settings',
    data: {
      logo: mediaId,
    } as any,
  })

  console.log(`[done] PlatformSettings logo set to media id ${mediaId}.`)
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
}).then(() => process.exit(0))
