import { DatabaseSync } from 'node:sqlite'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, readFile, rename, rm, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { createGunzip } from 'node:zlib'
import { pipeline } from 'node:stream/promises'
import * as path from 'node:path'
import { normalizeLookup } from '../../shared/local'
import { isTargetLanguage, type WordTranslation } from '../../shared/language'
import type { DictionaryResult } from '../../src/types/dictionary'

/** Versioned, immutable dictionary. Personal data lives in a separate database. */
export class LocalDictionary {
  private ready: Promise<DatabaseSync> | null = null
  constructor(private resources: string, private cacheDirectory: string) {}

  private open(): Promise<DatabaseSync> {
    if (!this.ready) this.ready = this.load().catch((error) => {
      this.ready = null
      throw error
    })
    return this.ready
  }

  private async load(): Promise<DatabaseSync> {
    const manifest = JSON.parse(await readFile(path.join(this.resources, 'manifest.json'), 'utf8'))
    if (manifest.version !== 1 || !/^[a-f0-9]{64}$/.test(manifest.sqliteSha256)) {
      throw new Error('The bundled dictionary is invalid. Reinstall PopDict.')
    }
    await mkdir(this.cacheDirectory, { recursive: true })
    const file = path.join(this.cacheDirectory, `dictionary-${manifest.sqliteSha256}.sqlite`)
    const hashFile = async (target: string) => {
      const hash = createHash('sha256')
      for await (const chunk of createReadStream(target)) hash.update(chunk)
      return hash.digest('hex')
    }
    const valid = await stat(file).then(async (s) =>
      s.size === manifest.sqliteBytes && await hashFile(file) === manifest.sqliteSha256
    ).catch(() => false)
    if (!valid) {
      const temporary = `${file}.${process.pid}.tmp`
      try {
        await pipeline(createReadStream(path.join(this.resources, 'dictionary.sqlite.gz')), createGunzip(), createWriteStream(temporary))
        if (await hashFile(temporary) !== manifest.sqliteSha256) {
          throw new Error('The bundled dictionary is damaged. Reinstall PopDict.')
        }
        await rename(temporary, file)
      } finally {
        await rm(temporary, { force: true })
      }
    }
    return new DatabaseSync(file, { readOnly: true })
  }

  async lookup(query: string): Promise<DictionaryResult[]> {
    if (typeof query !== 'string' || query.length > 160) return []
    const key = normalizeLookup(query)
    if (!key) return []
    const db = await this.open()
    const exact = db.prepare('SELECT payload FROM entries WHERE key=?').get(key) as { payload: string } | undefined
    if (exact) return [JSON.parse(exact.payload)]
    // Explicit inflections first, then WordNet's conservative suffix rules.
    const candidates = [key]
    for (const [suffix, replacements] of [
      ['s', ['']], ['ies', ['y']], ['es', ['', 'e']], ['ed', ['', 'e']],
      ['ing', ['', 'e']], ['er', ['', 'e']], ['est', ['', 'e']],
    ] as const) {
      if (key.length > suffix.length + 1 && key.endsWith(suffix)) {
        for (const replacement of replacements) candidates.push(key.slice(0, -suffix.length) + replacement)
      }
    }
    for (const candidate of candidates) {
      const rows = db.prepare('SELECT e.payload FROM aliases a JOIN entries e ON e.key=a.target WHERE a.key=? ORDER BY a.target LIMIT 3').all(candidate) as { payload: string }[]
      if (rows.length) return rows.map((r) => JSON.parse(r.payload))
      if (candidate !== key) {
        const row = db.prepare('SELECT payload FROM entries WHERE key=?').get(candidate) as { payload: string } | undefined
        if (row) return [JSON.parse(row.payload)]
      }
    }
    return []
  }

  async translate(word: string, language: string): Promise<WordTranslation[]> {
    if (typeof word !== 'string' || word.length > 160 || !isTargetLanguage(language)) return []
    const db = await this.open()
    return db.prepare('SELECT text, sense AS senseLabel, rank FROM translations WHERE key=? AND language=? ORDER BY rank LIMIT 3')
      .all(normalizeLookup(word), language) as WordTranslation[]
  }
}
