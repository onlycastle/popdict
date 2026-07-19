import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const manifest = JSON.parse(readFileSync('data/phrases/manifest.json', 'utf8'))
const migration = readFileSync(
  'supabase/migrations/20260716115323_seed_phrase_entries.sql',
  'utf8'
)

describe('generated phrase dataset', () => {
  it('matches generated counts and three-sense rank limits', () => {
    const csv = readFileSync('data/phrases/phrase-entries.csv', 'utf8').trimEnd().split('\n')
    expect(csv).toHaveLength(manifest.rowCount + 1)
    expect(manifest.phraseCount).toBeGreaterThan(1000)
    expect(manifest.rowCount).toBeGreaterThanOrEqual(manifest.phraseCount)
    expect(manifest.rowCount).toBeLessThanOrEqual(manifest.phraseCount * 3)
    expect(migration.match(/insert into public\.phrase_entries/g)?.length).toBe(
      Math.ceil(manifest.rowCount / 1000)
    )
  })

  it('retains licensed attribution and contains known idioms', () => {
    expect(manifest.license).toBe('CC BY-SA 4.0')
    expect(migration).toContain("'rain cats and dogs'")
    expect(migration).toContain("'your mileage may vary'")
    expect(migration).not.toMatch(/'archaic'|'obsolete'|'dated'|'rare'|'nonstandard'/i)
  })
})
