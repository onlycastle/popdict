import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeContext } from './lib.mjs'
import { run } from './electronInvariants.mjs'

const fixtures = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'electron-invariants'
)

const GOOD_FILES = [
  'electron/windows/windowSpecs.ts',
  'electron/main.ts',
  'electron/security.ts',
  'electron/updater.ts',
  'forge.config.ts',
]

describe('electron-invariants gate', () => {
  it('passes a repo with the current hardened shape', () => {
    const { violations } = run(makeContext(path.join(fixtures, 'good'), { files: GOOD_FILES }))
    expect(violations).toEqual([])
  })

  it('flags a required hardening needle that went missing', () => {
    const { violations } = run(makeContext(path.join(fixtures, 'bad'), { files: GOOD_FILES }))
    expect(
      violations.some(
        (v) => v.file === 'electron/main.ts' && v.message.includes('registerWebContentsHardening')
      )
    ).toBe(true)
  })

  it('flags forbidden patterns anywhere under electron/ or src/', () => {
    const { violations } = run(
      makeContext(path.join(fixtures, 'bad'), { files: [...GOOD_FILES, 'electron/evil.ts'] })
    )
    expect(
      violations.some((v) => v.file === 'electron/evil.ts' && v.message.includes('contextIsolation'))
    ).toBe(true)
  })

  it('flags a required file that is no longer tracked', () => {
    const files = GOOD_FILES.filter((f) => f !== 'forge.config.ts')
    const { violations } = run(makeContext(path.join(fixtures, 'good'), { files }))
    expect(violations.some((v) => v.file === 'forge.config.ts' && v.message.includes('missing'))).toBe(true)
  })
})
