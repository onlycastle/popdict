import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeContext } from './lib.mjs'
import { run } from './supabaseBoundary.mjs'

const fixtures = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'supabase-boundary'
)

describe('supabase-boundary gate', () => {
  it('passes env-based service-role access confined to supabase functions', () => {
    const { violations } = run(
      makeContext(path.join(fixtures, 'good'), {
        files: ['supabase/functions/foo/index.ts', 'supabase/functions/downloads/index.ts', 'src/app.ts'],
      })
    )
    expect(violations).toEqual([])
  })

  it('flags service-role references outside supabase/', () => {
    const { violations } = run(
      makeContext(path.join(fixtures, 'bad'), { files: ['src/leak.ts'] })
    )
    expect(violations.some((v) => v.file === 'src/leak.ts')).toBe(true)
  })

  it('flags service-role access in a function that bypasses Deno.env.get', () => {
    const { violations } = run(
      makeContext(path.join(fixtures, 'bad'), { files: ['supabase/functions/bar/index.ts'] })
    )
    expect(violations.some((v) => v.file === 'supabase/functions/bar/index.ts')).toBe(true)
  })

  it('flags the downloads function if its access tokens stop coming from env', () => {
    const { violations } = run(
      makeContext(path.join(fixtures, 'bad'), { files: ['supabase/functions/downloads/index.ts'] })
    )
    expect(
      violations.some(
        (v) => v.file === 'supabase/functions/downloads/index.ts' && v.message.includes('DOWNLOADS_STATS_TOKEN')
      )
    ).toBe(true)
  })
})
