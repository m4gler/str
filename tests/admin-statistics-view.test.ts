import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = path.resolve(__dirname, '..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

describe('admin statistics view', () => {
  it('includes a top-left link back to the Payload admin dashboard', () => {
    const view = read('src/components/admin/StatisticsView.tsx')

    expect(view).toContain("import Link from 'next/link'")
    expect(view).toContain('href="/admin"')
    expect(view).toContain('Back to Payload')
    expect(view).toContain('aria-label="Back to Payload admin"')
  })

  it('requires confirmation before sending statistics emails', () => {
    const view = read('src/components/admin/StatisticsView.tsx')

    expect(view).toContain('Are you sure?')
    expect(view).toContain('Send now')
    expect(view).toContain('Edit')
    expect(view).toContain('confirmingEmailSend')
  })
})
