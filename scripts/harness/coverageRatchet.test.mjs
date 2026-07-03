import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeContext } from './lib.mjs'
import { run, audit } from './coverageRatchet.mjs'

const root = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'coverage-ratchet',
  'repo'
)

// Minimal hand-built ctx for string-level tests.
const fakeCtx = (contents = {}, gateIds = []) => ({
  files: Object.keys(contents),
  read: (p) => {
    if (!(p in contents)) throw new Error('ENOENT')
    return contents[p]
  },
  gateIds,
})

const entry = (fields) => `## L-001: some learning\n${fields.map((f) => `- ${f}`).join('\n')}\n`

describe('coverage-ratchet gate', () => {
  it('passes vacuously when no learnings file is tracked', () => {
    expect(run(makeContext(root, { files: ['README.md'] })).violations).toEqual([])
  })

  it('passes the valid fixture ledger end-to-end', () => {
    const ctx = makeContext(root, {
      files: ['docs/harness-learnings.md', 'tests/guard.test.ts'],
      gateIds: ['supabase-boundary'],
    })
    expect(run(ctx).violations).toEqual([])
  })

  it('accepts an Open learning without a guard', () => {
    const v = audit(entry(['Status: Open', 'Guard: (none — manual smoke)']), fakeCtx())
    expect(v).toEqual([])
  })

  it('rejects a Closed learning without a resolving guard', () => {
    const v = audit(entry(['Status: Closed', 'Guard: (none — TODO)']), fakeCtx())
    expect(v.some((x) => x.message.includes('resolving guard'))).toBe(true)
  })

  it('rejects a Closed learning with no Guard field at all', () => {
    const v = audit(entry(['Status: Closed']), fakeCtx())
    expect(v.some((x) => x.message.includes('resolving guard'))).toBe(true)
  })

  it('rejects a guard pointing at an untracked file', () => {
    const v = audit(entry(['Status: Closed', 'Guard: test:tests/gone.test.ts']), fakeCtx())
    expect(v.some((x) => x.message.includes('not tracked'))).toBe(true)
  })

  it('rejects a guard whose needle is missing from the file', () => {
    const v = audit(
      entry(['Status: Closed', 'Guard: test:tests/a.test.ts::missing-needle']),
      fakeCtx({ 'tests/a.test.ts': 'no such marker here' })
    )
    expect(v.some((x) => x.message.includes('missing-needle'))).toBe(true)
  })

  it('rejects a gate guard naming an unregistered gate', () => {
    const v = audit(entry(['Status: Closed', 'Guard: gate:not-a-gate']), fakeCtx({}, ['secret-scan']))
    expect(v.some((x) => x.message.includes('not-a-gate'))).toBe(true)
  })

  it('rejects an entry without a Status field and duplicate ids', () => {
    const text = '## L-001: a\n- Guard: gate:secret-scan\n\n## L-001: b\n- Status: Open\n'
    const v = audit(text, fakeCtx({}, ['secret-scan']))
    expect(v.some((x) => x.message.includes('Status'))).toBe(true)
    expect(v.some((x) => x.message.includes('duplicate'))).toBe(true)
  })
})
