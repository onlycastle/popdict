import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Build the context every gate runs against.
 *   root:  absolute repo (or fixture) root
 *   files: git-tracked paths relative to root, POSIX separators.
 *          Pass { files } explicitly in tests to avoid needing git.
 */
export function makeContext(root, { files, gateIds } = {}) {
  const tracked =
    files ??
    execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
      .split('\n')
      .filter(Boolean)
  return {
    root,
    files: tracked,
    gateIds: gateIds ?? [],
    read: (relPath) => readFileSync(path.join(root, relPath), 'utf8'),
  }
}

/** Extract [text](target) markdown links with their 1-based line numbers. */
export function extractLinks(markdown) {
  const out = []
  markdown.split('\n').forEach((lineText, i) => {
    for (const m of lineText.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
      out.push({ target: m[1], line: i + 1 })
    }
  })
  return out
}

/** Fixture trees and binary blobs that content gates must never scan. */
export const SCAN_SKIP_PREFIXES = ['scripts/harness/fixtures/']
export const SCAN_SKIP_EXTENSIONS = new Set([
  '.png', '.icns', '.ico', '.jpg', '.jpeg', '.gif', '.webp',
  '.mp4', '.lock', '.dmg', '.zip', '.woff', '.woff2', '.ttf',
])

export function isScannable(file) {
  if (SCAN_SKIP_PREFIXES.some((p) => file.startsWith(p))) return false
  return !SCAN_SKIP_EXTENSIONS.has(path.extname(file).toLowerCase())
}
