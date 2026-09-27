import { createRequire } from 'node:module'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'
import { build } from 'vite'
import { expect, it } from 'vitest'

it('keeps SQLite functional through the main-process production bundler', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'popdict-sqlite-bundle-'))
  try {
    const entry = path.join(dir, 'entry.ts')
    await writeFile(entry, `import { DatabaseSync } from 'node:sqlite'; export function check() { const db = new DatabaseSync(':memory:'); try { return db.prepare('SELECT 1 AS ok').get().ok; } finally { db.close(); } }`)
    await build({ configFile: path.resolve('vite.main.config.ts'), logLevel: 'silent',
      build: { lib: { entry, formats: ['cjs'], fileName: () => 'probe.cjs' }, outDir: path.join(dir, 'out'), emptyOutDir: true } })
    const require = createRequire(import.meta.url)
    expect(require(path.join(dir, 'out/probe.cjs')).check()).toBe(1)
  } finally { await rm(dir, { recursive: true, force: true }) }
})
