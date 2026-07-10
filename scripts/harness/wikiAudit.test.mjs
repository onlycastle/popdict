import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeContext } from './lib.mjs'
import { run } from './wikiAudit.mjs'

const root = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'wiki-audit',
  'repo'
)

// Fixed clock: 2026-07-03. Keeps staleness tests deterministic forever.
const NOW = Date.parse('2026-07-03')
const ctx = (files) => makeContext(root, { files, now: NOW })

describe('wiki-audit gate', () => {
  it('passes when no wiki exists yet', () => {
    expect(run(ctx(['README.md'])).violations).toEqual([])
  })

  it('passes a valid page with index present', () => {
    const { violations } = run(ctx(['docs/llm-wiki/index.md', 'docs/llm-wiki/valid.md']))
    expect(violations).toEqual([])
  })

  it('requires index.md once any wiki page exists', () => {
    const { violations } = run(ctx(['docs/llm-wiki/valid.md']))
    expect(violations.some((v) => v.message.includes('index.md'))).toBe(true)
  })

  it('flags a page without frontmatter', () => {
    const { violations } = run(ctx(['docs/llm-wiki/index.md', 'docs/llm-wiki/no-front.md']))
    expect(violations.some((v) => v.file.endsWith('no-front.md') && v.message.includes('frontmatter'))).toBe(true)
  })

  it('flags a stale last-verified date', () => {
    const { violations } = run(ctx(['docs/llm-wiki/index.md', 'docs/llm-wiki/stale.md']))
    expect(violations.some((v) => v.file.endsWith('stale.md') && v.message.includes('days old'))).toBe(true)
  })

  it('flags an oversized page', () => {
    const { violations } = run(ctx(['docs/llm-wiki/index.md', 'docs/llm-wiki/big.md']))
    expect(violations.some((v) => v.file.endsWith('big.md') && v.message.includes('lines'))).toBe(true)
  })
})
