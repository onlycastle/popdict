import path from 'node:path'
import { extractLinks, isScannable } from './lib.mjs'

// Mirrors the .gitignore paths that exist locally but never in a clone.
// A tracked doc linking into these would 404 for every other reader.
const LOCAL_ONLY_PREFIXES = [
  'docs/superpowers/',
  'output/',
  'out/',
  'security_best_practices_report.md',
  '.env',
]

function isLocalOnly(target) {
  if (target.startsWith('.claude/')) return !target.startsWith('.claude/skills/')
  return LOCAL_ONLY_PREFIXES.some((p) => target === p.replace(/\/$/, '') || target.startsWith(p))
}

function isExempt(target) {
  return /^[a-z][a-z+.-]*:/i.test(target) || target.startsWith('#')
}

export const gate = 'doc-links'

export function run(ctx) {
  const violations = []
  const tracked = new Set(ctx.files)
  const existsTracked = (p) =>
    tracked.has(p) || ctx.files.some((f) => f.startsWith(p + '/'))

  for (const file of ctx.files) {
    if (!file.endsWith('.md') || !isScannable(file)) continue
    let text
    try {
      text = ctx.read(file)
    } catch {
      continue
    }
    for (const { target, line } of extractLinks(text)) {
      if (isExempt(target)) continue
      const bare = target.split('#')[0]
      if (!bare) continue
      let resolved = path.posix
        .normalize(path.posix.join(path.posix.dirname(file), bare))
        .replace(/\/$/, '')
      if (resolved.startsWith('./')) resolved = resolved.slice(2)
      if (resolved.startsWith('..')) {
        violations.push({ file, line, message: `link escapes the repo: ${target}` })
      } else if (isLocalOnly(resolved)) {
        violations.push({ file, line, message: `link into local-only path: ${resolved}` })
      } else if (!existsTracked(resolved)) {
        violations.push({ file, line, message: `broken link: ${resolved}` })
      }
    }
  }
  return { gate, violations }
}
