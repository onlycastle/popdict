// Parity between the pieces agents actually consume: tracked skills must be
// routable, documented commands must exist, existing commands must be
// documented. Catches the "doc says X, repo does Y" class for the harness
// itself deterministically.
export const gate = 'harness-drift'

const ROUTING = 'docs/harness-routing.md'
const HARNESS_DOC = 'docs/harness.md'

export function run(ctx) {
  const violations = []

  const skills = ctx.files
    .map((f) => f.match(/^\.claude\/skills\/([^/]+)\/SKILL\.md$/))
    .filter(Boolean)
    .map((m) => m[1])

  const routingTracked = ctx.files.includes(ROUTING)
  if (skills.length && !routingTracked) {
    violations.push({ file: ROUTING, message: 'skills are tracked but the routing doc is missing' })
  }
  if (routingTracked) {
    const routing = ctx.read(ROUTING)
    for (const s of skills) {
      if (!routing.includes(`| ${s} `)) {
        violations.push({ file: ROUTING, message: `skill '${s}' has no routing row` })
      }
    }
    for (const m of routing.matchAll(/^\|\s*([a-z][a-z0-9-]*)\s*\|/gm)) {
      if (!skills.includes(m[1])) {
        violations.push({ file: ROUTING, message: `routing row '${m[1]}' names a skill that is not tracked` })
      }
    }
  }

  if (ctx.files.includes('package.json')) {
    let pkg
    try {
      pkg = JSON.parse(ctx.read('package.json'))
    } catch {
      return { gate, violations }
    }
    const harnessScripts = Object.keys(pkg.scripts ?? {}).filter((s) => s.startsWith('harness:'))
    const docTracked = ctx.files.includes(HARNESS_DOC)
    if (harnessScripts.length && !docTracked) {
      violations.push({ file: HARNESS_DOC, message: 'harness scripts exist but docs/harness.md is missing' })
    }
    if (docTracked) {
      const doc = ctx.read(HARNESS_DOC)
      for (const s of harnessScripts) {
        if (!doc.includes(`npm run ${s}`)) {
          violations.push({ file: HARNESS_DOC, message: `npm script '${s}' is undocumented` })
        }
      }
      for (const m of doc.matchAll(/npm run (harness:[a-z:-]+)/g)) {
        if (!harnessScripts.includes(m[1])) {
          violations.push({
            file: HARNESS_DOC,
            message: `documented command '${m[1]}' does not exist in package.json`,
          })
        }
      }
    }
  }

  return { gate, violations }
}
