import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  hasFilteredSenseQualifier,
  sqlForRows,
  TARGET_LANGUAGES,
} from './build-dataset.mjs'

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

const manifest = JSON.parse(readFileSync('data/translations/manifest.json', 'utf8'))
const csvLines = readFileSync('data/translations/word-translations.csv', 'utf8')
  .trimEnd()
  .split('\n')
const rows = csvLines.slice(1).map((line) => {
  const [normalizedWord, languageCode, rank, translation, senseLabel] = parseCsvLine(line)
  return {
    normalizedWord,
    languageCode,
    rank: Number(rank),
    translation,
    senseLabel: senseLabel || null,
  }
})
const sqlRows = rows.map((row) => ({
  normalized_word: row.normalizedWord,
  language_code: row.languageCode,
  rank: row.rank,
  translation: row.translation,
  sense_label: row.senseLabel,
}))

describe('generated translation dataset', () => {
  it('matches its manifest and rank/deduplication invariants', () => {
    expect(manifest.headwordCount).toBe(5049)
    expect(rows).toHaveLength(manifest.rowCount)
    expect(new Set(rows.map((row) => row.languageCode))).toEqual(new Set(TARGET_LANGUAGES))
    const groups = new Map()
    for (const row of rows) {
      expect(row.normalizedWord).toMatch(/^[a-z]+(?:['-][a-z]+)*$/)
      expect(row.translation.length).toBeGreaterThan(0)
      expect(row.translation.length).toBeLessThanOrEqual(120)
      const key = `${row.normalizedWord}\u0000${row.languageCode}`
      const group = groups.get(key) ?? []
      group.push(row)
      groups.set(key, group)
    }
    for (const group of groups.values()) {
      expect(group.map((row) => row.rank)).toEqual(
        Array.from({ length: group.length }, (_value, index) => index + 1)
      )
      expect(group.length).toBeLessThanOrEqual(3)
      expect(new Set(group.map((row) => row.translation.normalize('NFKC').toLowerCase())).size)
        .toBe(group.length)
    }
  })

  it('matches the final corrective migration exactly', () => {
    const migration = readFileSync(
      'supabase/migrations/20260716115341_replace_translation_data_all_ngsl.sql',
      'utf8'
    )
    expect(migration).toBe(sqlForRows(sqlRows, manifest, true))
  })

  it('contains no retired editorial qualifiers or unresolved wiki markup', () => {
    for (const row of rows) {
      expect(row.translation).not.toMatch(/\{\{|\}\}|\[\[|\]\]/)
      if (row.senseLabel) {
        expect(row.senseLabel).not.toMatch(/\{\{|\}\}|\[\[|\]\]|'{2,3}/)
        expect(hasFilteredSenseQualifier(row.senseLabel)).toBe(false)
      }
    }
  })

  it('preserves the multilingual golden cases', () => {
    const bank = rows.filter((row) => row.normalizedWord === 'bank')
    expect(new Set(bank.map((row) => row.languageCode))).toEqual(new Set(TARGET_LANGUAGES))
    expect(bank.filter((row) => row.languageCode === 'es').map((row) => row.translation))
      .toEqual(['banca', 'sucursal', 'almacén'])
    const simplifiedBank = bank
      .filter((row) => row.languageCode === 'zh-Hans')
      .map((row) => row.translation)
    expect(simplifiedBank).toContain('银行')
    expect(simplifiedBank).not.toContain('銀行')

    const portugueseBus = rows.filter(
      (row) => row.normalizedWord === 'bus' && row.languageCode === 'pt-BR'
    )
    expect(portugueseBus[0]?.translation).toBe('ônibus')
    expect(portugueseBus.map((row) => row.translation)).not.toContain('autocarro')
    expect(portugueseBus.map((row) => row.translation)).not.toContain('machimbombo')

    const japanese = rows.filter((row) => row.languageCode === 'ja')
    expect(japanese.every(
      (row) => /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(row.translation)
    )).toBe(true)
  })
})
