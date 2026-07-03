import { isScannable } from './lib.mjs'

// Precise, low-false-positive patterns only. Fixture files under
// scripts/harness/fixtures/ are exempt and must contain documented-fake
// values exclusively (this is a public repo).
const PATTERNS = [
  { name: 'private-key', re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/ },
  { name: 'aws-key-id', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'github-token', re: /\b(?:ghp|gho|ghs)_[A-Za-z0-9]{36}\b|\bgithub_pat_[A-Za-z0-9_]{22,}\b/ },
  { name: 'slack-token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: 'slack-webhook', re: /hooks\.slack\.com\/services\/T[A-Za-z0-9/]+/ },
  { name: 'jwt', re: /\beyJhbGciOi[A-Za-z0-9_\-.]{40,}/ },
  { name: 'supabase-token', re: /\bsbp_[a-f0-9]{40}\b/ },
  { name: 'anthropic-key', re: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/ },
]

export const gate = 'secret-scan'

export function run(ctx) {
  const violations = []
  for (const file of ctx.files) {
    if (!isScannable(file)) continue
    let text
    try {
      text = ctx.read(file)
    } catch {
      continue // tracked but absent from the working tree (mid-rename etc.)
    }
    text.split('\n').forEach((line, i) => {
      for (const { name, re } of PATTERNS) {
        if (re.test(line)) {
          violations.push({ file, line: i + 1, message: `possible ${name} material` })
        }
      }
    })
  }
  return { gate, violations }
}
