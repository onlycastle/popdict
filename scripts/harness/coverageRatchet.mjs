// The ratchet: a learning may be marked Closed only while a deterministic
// guard still resolves. Delete the guarding test and CI reopens the learning.
// Entry format (docs/harness-learnings.md):
//   ## L-007: title
//   - Status: Open | Closed
//   - Class: short-slug
//   - Guard: test:<path>[::needle] | script:<path>[::needle] | gate:<id> | (none — reason)
//   - Context: prose
const LEARNINGS = 'docs/harness-learnings.md'
const GUARD_RE = /^(test|script|gate):(.+)$/

export const gate = 'coverage-ratchet'

export function run(ctx) {
  if (!ctx.files.includes(LEARNINGS)) return { gate, violations: [] }
  let text
  try {
    text = ctx.read(LEARNINGS)
  } catch {
    return { gate, violations: [{ file: LEARNINGS, message: 'tracked but unreadable' }] }
  }
  return { gate, violations: audit(text, ctx) }
}

export function audit(text, ctx) {
  const violations = []
  const v = (line, message) => violations.push({ file: LEARNINGS, line, message })

  const lines = text.split('\n')
  const entries = []
  let current = null
  lines.forEach((raw, i) => {
    const heading = raw.match(/^## (L-\d+): (.+)$/)
    if (heading) {
      current = { id: heading[1], line: i + 1, fields: {} }
      entries.push(current)
      return
    }
    if (raw.startsWith('## ')) {
      current = null // non-learning section
      return
    }
    const field = current && raw.match(/^- ([A-Za-z]+): (.+)$/)
    if (field) current.fields[field[1]] = field[2].trim()
  })

  const seen = new Set()
  for (const { id, line, fields } of entries) {
    if (seen.has(id)) v(line, `duplicate learning id ${id}`)
    seen.add(id)

    const status = fields.Status
    if (status !== 'Open' && status !== 'Closed') {
      v(line, `${id}: Status must be Open or Closed`)
      continue
    }
    if (status === 'Open') continue

    const guard = fields.Guard ?? ''
    const m = guard.match(GUARD_RE)
    if (!m) {
      v(line, `${id}: Closed learning needs a resolving guard (test:/script:/gate:), got: ${guard || 'nothing'}`)
      continue
    }
    const [, kind, rest] = m
    if (kind === 'gate') {
      if (!ctx.gateIds.includes(rest)) v(line, `${id}: guard names unregistered gate '${rest}'`)
      continue
    }
    const [file, needle] = rest.split('::')
    if (!ctx.files.includes(file)) {
      v(line, `${id}: guard file ${file} is not tracked — the guard is gone, reopen the learning`)
      continue
    }
    if (needle) {
      let content
      try {
        content = ctx.read(file)
      } catch {
        v(line, `${id}: guard file ${file} unreadable`)
        continue
      }
      if (!content.includes(needle)) {
        v(line, `${id}: guard needle '${needle}' no longer present in ${file} — reopen the learning`)
      }
    }
  }
  return violations
}
