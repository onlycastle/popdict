import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeContext } from './lib.mjs'
import { run } from './secretScan.mjs'

const root = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'secret-scan',
  'repo'
)

const ctx = (files) => makeContext(root, { files })

describe('secret-scan gate', () => {
  it('flags fake key material in a tracked doc', () => {
    const { violations } = run(ctx(['docs/leaky.md']))
    expect(violations.length).toBeGreaterThanOrEqual(2)
    expect(violations[0].file).toBe('docs/leaky.md')
    const kinds = violations.map((v) => v.message)
    expect(kinds.some((m) => m.includes('jwt'))).toBe(true)
    expect(kinds.some((m) => m.includes('aws-key-id'))).toBe(true)
  })

  it('passes a clean file', () => {
    expect(run(ctx(['docs/clean.md'])).violations).toEqual([])
  })

  it('skips the harness fixtures dir', () => {
    expect(run(ctx(['scripts/harness/fixtures/planted.md'])).violations).toEqual([])
  })

  it('skips binary extensions without reading them', () => {
    // assets/icon.png does not exist in the fixture tree; if the gate tried to
    // read it before the extension check, this would throw instead of passing.
    expect(run(ctx(['assets/icon.png'])).violations).toEqual([])
  })
})
