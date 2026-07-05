import { isScannable } from './lib.mjs'

// The service-role key bypasses RLS entirely: it may exist only inside edge
// functions, injected via env. scripts/harness/ is exempt because this gate
// (and its tests) must name the forbidden strings to detect them.
const SERVICE_ROLE = /SUPABASE_SERVICE_ROLE_KEY|service_role/
const EXEMPT_PREFIXES = ['supabase/', 'scripts/harness/']

// The downloads function authenticates its private endpoints with
// caller-supplied tokens; both must always be compared against env values.
const DOWNLOADS_FN = 'supabase/functions/downloads/index.ts'
const DOWNLOADS_TOKENS = ['DOWNLOADS_RECORD_TOKEN', 'DOWNLOADS_STATS_TOKEN']

export const gate = 'supabase-boundary'

export function run(ctx) {
  const violations = []

  for (const file of ctx.files) {
    if (!isScannable(file) || !/\.(ts|tsx|js|mjs|sql)$/.test(file)) continue
    const exempt = EXEMPT_PREFIXES.some((p) => file.startsWith(p))
    let text
    try {
      text = ctx.read(file)
    } catch {
      continue
    }
    const lines = text.split('\n')

    if (!exempt) {
      lines.forEach((line, i) => {
        if (SERVICE_ROLE.test(line)) {
          violations.push({
            file,
            line: i + 1,
            message: 'service-role reference outside supabase/ — the key must never reach app, site, or script code',
          })
        }
      })
    }

    if (/^supabase\/functions\/[^/]+\/index\.ts$/.test(file)) {
      lines.forEach((line, i) => {
        if (line.includes('SUPABASE_SERVICE_ROLE_KEY') && !line.includes("Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')")) {
          violations.push({
            file,
            line: i + 1,
            message: 'service-role key must be read via Deno.env.get, nothing else',
          })
        }
      })
    }
  }

  if (ctx.files.includes(DOWNLOADS_FN)) {
    let text
    try {
      text = ctx.read(DOWNLOADS_FN)
      for (const token of DOWNLOADS_TOKENS) {
        if (!text.includes(`Deno.env.get('${token}')`)) {
          violations.push({
            file: DOWNLOADS_FN,
            message: `expected Deno.env.get('${token}') — private endpoints must stay env-token gated`,
          })
        }
      }
    } catch {
      violations.push({ file: DOWNLOADS_FN, message: 'tracked but unreadable' })
    }
  }

  return { gate, violations }
}
