import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Google Analytics tag', () => {
  it('loads the configured Google tag from the root layout', () => {
    const layout = readFileSync(join(process.cwd(), 'src/app/layout.tsx'), 'utf8')

    expect(layout).toContain('G-5L5PM6S3L5')
    expect(layout).toContain('https://www.googletagmanager.com/gtag/js?id=G-5L5PM6S3L5')
    expect(layout).toContain("gtag('config', 'G-5L5PM6S3L5')")
  })
})
