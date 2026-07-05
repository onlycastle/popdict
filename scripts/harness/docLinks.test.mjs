import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeContext } from './lib.mjs'
import { run } from './docLinks.mjs'

const root = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'doc-links',
  'repo'
)

const ctx = (files) => makeContext(root, { files })

describe('doc-links gate', () => {
  it('passes tracked targets, https links, anchors, and .claude/skills links', () => {
    const { violations } = run(
      ctx(['docs/good.md', 'docs/existing.md', '.claude/skills/foo/SKILL.md'])
    )
    expect(violations).toEqual([])
  })

  it('flags a relative link whose target is not tracked', () => {
    const { violations } = run(ctx(['docs/broken.md']))
    expect(violations).toHaveLength(1)
    expect(violations[0].message).toContain('missing.md')
  })

  it('flags links into local-only paths, even when scoped under .claude', () => {
    const { violations } = run(ctx(['docs/local-only.md']))
    expect(violations).toHaveLength(2)
    expect(violations.map((v) => v.message).join(' ')).toContain('docs/superpowers')
    expect(violations.map((v) => v.message).join(' ')).toContain('.claude/settings.local.json')
  })

  it('allows linking to a tracked directory', () => {
    const { violations } = run(ctx(['docs/dir-link.md', 'docs/llm-wiki/index.md']))
    expect(violations).toEqual([])
  })
})
