import { isScannable } from './lib.mjs'

// Every needle below is TRUE in the current source (verified 2026-07-03).
// If a refactor moves one, update the path here in the same commit — the
// point is that weakening any of these must be a visible, deliberate act.
const MUST_CONTAIN = [
  {
    file: 'electron/windows/windowSpecs.ts',
    needles: ['contextIsolation: true', 'nodeIntegration: false'],
    why: 'all windows share hardened webPreferences',
  },
  {
    file: 'electron/main.ts',
    needles: ['registerWebContentsHardening()', 'requestSingleInstanceLock()'],
    why: 'navigation hardening wired + single-instance lock',
  },
  {
    file: 'electron/security.ts',
    needles: ['setWindowOpenHandler', 'will-navigate'],
    why: 'popup denial + navigation policy hooks',
  },
  {
    file: 'electron/updater.ts',
    needles: ['update.electronjs.org'],
    why: 'auto-update feed (broken silently in every 1.1.x — see L-004)',
  },
  {
    file: 'forge.config.ts',
    needles: [
      '[FuseV1Options.RunAsNode]: false',
      '[FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false',
      '[FuseV1Options.EnableNodeCliInspectArguments]: false',
      '[FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true',
    ],
    why: 'binary hardening fuses',
  },
]

const MUST_NOT_MATCH = [
  /contextIsolation:\s*false/,
  /nodeIntegration:\s*true/,
  /webSecurity:\s*false/,
  /allowRunningInsecureContent:\s*true/,
  /enableRemoteModule/,
]

export const gate = 'electron-invariants'

export function run(ctx) {
  const violations = []
  const tracked = new Set(ctx.files)

  for (const { file, needles, why } of MUST_CONTAIN) {
    if (!tracked.has(file)) {
      violations.push({ file, message: `required file missing from tracked set (${why})` })
      continue
    }
    let text
    try {
      text = ctx.read(file)
    } catch {
      violations.push({ file, message: `required file unreadable (${why})` })
      continue
    }
    for (const needle of needles) {
      if (!text.includes(needle)) {
        violations.push({ file, message: `invariant missing: \`${needle}\` (${why})` })
      }
    }
  }

  for (const file of ctx.files) {
    if (!(file.startsWith('electron/') || file.startsWith('src/'))) continue
    if (!/\.(ts|tsx|js|mjs)$/.test(file) || !isScannable(file)) continue
    let text
    try {
      text = ctx.read(file)
    } catch {
      continue
    }
    text.split('\n').forEach((line, i) => {
      for (const re of MUST_NOT_MATCH) {
        if (re.test(line)) {
          violations.push({ file, line: i + 1, message: `forbidden pattern: ${re.source}` })
        }
      }
    })
  }

  return { gate, violations }
}
