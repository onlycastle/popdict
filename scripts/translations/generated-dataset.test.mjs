import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  hasFilteredSenseQualifier,
  sqlForRows,
  TARGET_LANGUAGES,
  TRANSLATION_FALLBACKS,
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
const targetHeadwords = readFileSync('data/translations/ngsl-gr-5049.txt', 'utf8')
  .trim()
  .split('\n')
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
    expect(targetHeadwords).toHaveLength(manifest.headwordCount)
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

  it('covers every target headword and records deterministic fallback use', () => {
    const covered = new Set(rows.map((row) => row.normalizedWord))
    expect(covered).toEqual(new Set(targetHeadwords))
    expect(manifest.coveredHeadwordCount).toBe(targetHeadwords.length)
    expect(manifest.fallbackHeadwordCount).toBeGreaterThan(0)
    expect(manifest.fallbackHeadwordCount).toBeLessThanOrEqual(
      Object.keys(TRANSLATION_FALLBACKS).length
    )
    expect(manifest.manualFallbackHeadwordCount).toBeGreaterThan(0)
    expect(manifest.coverageByLanguage).toEqual(Object.fromEntries(
      TARGET_LANGUAGES.map((language) => [
        language,
        new Set(rows
          .filter((row) => row.languageCode === language)
          .map((row) => row.normalizedWord)).size,
      ])
    ))
  })

  it('limits aliases to a vetted sense and excludes known false friends', () => {
    const fallbackHeadwords = new Set(Object.keys(TRANSLATION_FALLBACKS))
    const fallbackRows = rows.filter((row) => fallbackHeadwords.has(row.normalizedWord))
    const groups = new Map()
    for (const row of fallbackRows) {
      const key = `${row.normalizedWord}\u0000${row.languageCode}`
      groups.set(key, (groups.get(key) ?? 0) + 1)
    }
    expect([...groups.values()].every((count) => count === 1)).toBe(true)

    const could = rows.filter((row) => row.normalizedWord === 'could')
    expect(could).toHaveLength(TARGET_LANGUAGES.length)
    const couldFalseFriends = new Set([
      '깡통', '통조림', '缶', '罐头', '金属容器', 'lata', 'regadera', 'regador',
    ])
    expect(could.some((row) => couldFalseFriends.has(row.translation))).toBe(false)
    expect(could.every((row) => /able to|know how|permitted|possibility/i.test(
      row.senseLabel ?? ''
    ))).toBe(true)

    const upon = rows.filter((row) => row.normalizedWord === 'upon')
    const uponFalseFriends = new Set([
      'encendido', 'ligado', 'destinar',
    ])
    expect(upon.some((row) => uponFalseFriends.has(row.translation))).toBe(false)
  })

  it('matches the final corrective migration exactly', () => {
    const migration = readFileSync(
      'supabase/migrations/20260719130000_replace_translation_data_complete_ngsl.sql',
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
