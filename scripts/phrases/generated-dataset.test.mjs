import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { sqlForRows } from './build-dataset.mjs'

function parseCsvLine(line) {
  const fields = ['']
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        fields[fields.length - 1] += '"'
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (character === ',' && !quoted) {
      fields.push('')
    } else {
      fields[fields.length - 1] += character
    }
  }
  if (quoted) throw new Error('Unclosed quoted CSV field')
  return fields
}

const manifest = JSON.parse(readFileSync('data/phrases/manifest.json', 'utf8'))
const migration = readFileSync(
  'supabase/migrations/20260716115323_seed_phrase_entries.sql',
  'utf8'
)
const csvLines = readFileSync('data/phrases/phrase-entries.csv', 'utf8')
  .trimEnd()
  .split('\n')
const headers = parseCsvLine(csvLines[0])
const rows = csvLines.slice(1).map((line) => {
  const values = parseCsvLine(line)
  const row = Object.fromEntries(headers.map((header, index) => [header, values[index]]))
  return {
    ...row,
    sense_rank: Number(row.sense_rank),
    example: row.example || null,
    synonyms: JSON.parse(row.synonyms),
    antonyms: JSON.parse(row.antonyms),
    usage_labels: JSON.parse(row.usage_labels),
  }
})

describe('generated phrase dataset', () => {
  it('matches generated counts and three-sense rank limits', () => {
    expect(rows).toHaveLength(manifest.rowCount)
    expect(manifest.phraseCount).toBeGreaterThan(1000)
    expect(manifest.rowCount).toBeGreaterThanOrEqual(manifest.phraseCount)
    expect(manifest.rowCount).toBeLessThanOrEqual(manifest.phraseCount * 3)
    expect(migration.match(/insert into public\.phrase_entries/g)?.length).toBe(
      Math.ceil(manifest.rowCount / 1000)
    )
  })

  it('matches the generated migration exactly', () => {
    expect(migration).toBe(sqlForRows(rows, manifest))
  })

  it('retains licensed attribution and contains known idioms', () => {
    expect(manifest.license).toBe('CC BY-SA 4.0')
    expect(migration).toContain("'rain cats and dogs'")
    expect(migration).toContain("'your mileage may vary'")
    expect(migration).not.toMatch(
      /array\[[^\]]*'(?:archaic|obsolete|dated|rare|nonstandard)'[^\]]*\]::text\[\], 'https:\/\/en\.wiktionary\.org\//i,
    )
  })
})
