import { describe, it, expect } from 'vitest'
import { run } from './driftCheck.mjs'

const ctx = (contents, extraFiles = []) => ({
  files: [...Object.keys(contents), ...extraFiles],
  read: (p) => {
    if (!(p in contents)) throw new Error('ENOENT')
    return contents[p]
  },
  gateIds: [],
})

const PKG = JSON.stringify({
  scripts: { 'harness:validate': 'x', 'harness:test': 'y', build: 'z' },
})
const ROUTING = '| Skill | Domain |\n|---|---|\n| foo-skill | fixture |\n'
const HARNESS_DOC = 'Run `npm run harness:validate` and `npm run harness:test`.\n'

describe('harness-drift gate', () => {
  it('passes full parity', () => {
    const { violations } = run(
      ctx(
        {
          'package.json': PKG,
          'docs/harness-routing.md': ROUTING,
          'docs/harness.md': HARNESS_DOC,
        },
        ['.claude/skills/foo-skill/SKILL.md']
      )
    )
    expect(violations).toEqual([])
  })

  it('flags a tracked skill with no routing row', () => {
    const { violations } = run(
      ctx(
        { 'package.json': PKG, 'docs/harness-routing.md': ROUTING, 'docs/harness.md': HARNESS_DOC },
        ['.claude/skills/foo-skill/SKILL.md', '.claude/skills/bar-skill/SKILL.md']
      )
    )
    expect(violations.some((v) => v.message.includes('bar-skill'))).toBe(true)
  })

  it('flags a routing row whose skill does not exist', () => {
    const routing = ROUTING + '| ghost-skill | fixture |\n'
    const { violations } = run(
      ctx(
        { 'package.json': PKG, 'docs/harness-routing.md': routing, 'docs/harness.md': HARNESS_DOC },
        ['.claude/skills/foo-skill/SKILL.md']
      )
    )
    expect(violations.some((v) => v.message.includes('ghost-skill'))).toBe(true)
  })

  it('flags an undocumented harness script and a documented ghost command', () => {
    const doc = 'Run `npm run harness:validate` and `npm run harness:evals`.\n'
    const { violations } = run(
      ctx(
        { 'package.json': PKG, 'docs/harness-routing.md': ROUTING, 'docs/harness.md': doc },
        ['.claude/skills/foo-skill/SKILL.md']
      )
    )
    expect(violations.some((v) => v.message.includes("'harness:test'"))).toBe(true)
    expect(violations.some((v) => v.message.includes("'harness:evals'"))).toBe(true)
  })

  it('flags missing routing/harness docs once skills or scripts exist', () => {
    const { violations } = run(ctx({ 'package.json': PKG }, ['.claude/skills/foo-skill/SKILL.md']))
    expect(violations.some((v) => v.file === 'docs/harness-routing.md')).toBe(true)
    expect(violations.some((v) => v.file === 'docs/harness.md')).toBe(true)
  })
})
