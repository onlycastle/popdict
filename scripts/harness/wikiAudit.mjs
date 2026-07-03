// llm-wiki page contract: frontmatter (title + last-verified), compact,
// re-verified within MAX_AGE_DAYS. Link validity is covered by doc-links.
const MAX_LINES = 120
const MAX_AGE_DAYS = 180
const WIKI_PREFIX = 'docs/llm-wiki/'

function parseFrontmatter(lines) {
  if (lines[0] !== '---') return null
  const end = lines.indexOf('---', 1)
  if (end === -1) return null
  const fm = {}
  for (const l of lines.slice(1, end)) {
    const m = l.match(/^([A-Za-z-]+):\s*(.*)$/)
    if (m) fm[m[1]] = m[2].trim()
  }
  return fm
}

export const gate = 'wiki-audit'

export function run(ctx) {
  const violations = []
  const pages = ctx.files.filter((f) => f.startsWith(WIKI_PREFIX) && f.endsWith('.md'))
  if (pages.length === 0) return { gate, violations }

  if (!pages.includes(`${WIKI_PREFIX}index.md`)) {
    violations.push({
      file: `${WIKI_PREFIX}index.md`,
      message: 'wiki pages exist but index.md is missing',
    })
  }

  for (const file of pages) {
    let text
    try {
      text = ctx.read(file)
    } catch {
      continue
    }
    const lines = text.split('\n')
    if (lines.length > MAX_LINES) {
      violations.push({
        file,
        message: `page is ${lines.length} lines (max ${MAX_LINES}) — tighten or split; the wiki is a pointer layer, not documentation`,
      })
    }
    const fm = parseFrontmatter(lines)
    if (!fm) {
      violations.push({ file, line: 1, message: 'missing frontmatter (title, last-verified)' })
      continue
    }
    if (!fm.title) violations.push({ file, line: 1, message: 'frontmatter missing title' })
    const lv = fm['last-verified']
    if (!lv || !/^\d{4}-\d{2}-\d{2}$/.test(lv)) {
      violations.push({ file, line: 1, message: 'frontmatter missing last-verified (YYYY-MM-DD)' })
    } else {
      const ageDays = Math.floor((ctx.now - Date.parse(lv)) / 86_400_000)
      if (ageDays > MAX_AGE_DAYS) {
        violations.push({
          file,
          line: 1,
          message: `last-verified ${lv} is ${ageDays} days old (max ${MAX_AGE_DAYS}) — re-verify against the code and bump the date`,
        })
      }
    }
  }
  return { gate, violations }
}
