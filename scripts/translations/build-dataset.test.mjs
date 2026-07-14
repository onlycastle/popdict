import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import {
  buildDataset,
  candidatesFromEntry,
  hasFilteredSenseQualifier,
  normalizeSenseLabel,
  parseKaikkiLine,
  parseNgslCsv,
  rankCandidates,
  sqlForRows,
} from './build-dataset.mjs'

const headwords = new Set(['bank', 'bus', 'house'])

function entry(word, translations) {
  return { word, lang_code: 'en', translations }
}

describe('translation dataset generation', () => {
  it('takes the first distinct normalized NGSL-GR headwords', () => {
    const csv = '\uFEFFWordID,Word\n1,Bank\n2, bank \n3,take care\n4,BUS\n5,House\n'
    expect(parseNgslCsv(csv, 3)).toEqual(['bank', 'bus', 'house'])
  })

  it('fails with a line number on malformed Kaikki input', () => {
    expect(() => parseKaikkiLine('{bad', 42)).toThrow(/line 42/)
  })

  it('accepts literal Unicode line separators inside valid Kaikki JSON', () => {
    expect(parseKaikkiLine('{"word":"cyber","example":"one\u2028two"}', 7))
      .toMatchObject({ word: 'cyber', example: 'one\u2028two' })
  })

  it('streams JSONL on LF only when source strings contain Unicode separators', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'popdict-translations-'))
    try {
      const ngsl = join(dir, 'ngsl.csv')
      const kaikkiPart0 = join(dir, 'kaikki.part0')
      const kaikkiPart1 = join(dir, 'kaikki.part1')
      await writeFile(ngsl, 'WordID,Word\n1,bank\n')
      const compressed = gzipSync(
        `${JSON.stringify(entry('bank', [
          { lang_code: 'es', word: 'banco', sense: 'one\u2028two' },
        ]))}\n`
      )
      const splitAt = Math.floor(compressed.length / 2)
      await Promise.all([
        writeFile(kaikkiPart0, compressed.subarray(0, splitAt)),
        writeFile(kaikkiPart1, compressed.subarray(splitAt)),
      ])
      const metadata = await buildDataset({
        ngsl,
        kaikki: [kaikkiPart0, kaikkiPart1],
        outCsv: join(dir, 'rows.csv'),
        outHeadwords: join(dir, 'headwords.txt'),
        outSql: join(dir, 'seed.sql'),
        outManifest: join(dir, 'manifest.json'),
        snapshotDate: '2026-07-09',
        wiktionaryDumpDate: '2026-07-06',
        limit: 1,
      })
      expect(metadata.rowCount).toBe(1)
      expect(metadata.kaikkiLineCount).toBe(1)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('deduplicates candidates, preserves polysemy, and caps each language at three', () => {
    const candidates = candidatesFromEntry(entry('bank', [
      { lang_code: 'es', word: 'banco', sense: 'financial institution' },
      { lang_code: 'es', word: 'Banco', sense: 'financial institution' },
      { lang_code: 'es', word: 'orilla', sense: 'edge of a river' },
      { lang_code: 'es', word: 'ribera', sense: 'edge of a river' },
      { lang_code: 'es', word: 'reserva', sense: 'supply held in reserve' },
      { lang_code: 'es', word: 'banqueta', sense: 'fourth sense' },
    ]), headwords)
    const rows = rankCandidates(candidates)
    expect(rows).toHaveLength(3)
    expect(rows.map((row) => row.translation)).toEqual(['banco', 'orilla', 'reserva'])
    expect(rows.map((row) => row.rank)).toEqual([1, 2, 3])
  })

  it('filters European Portuguese and ranks Brazilian bus first', () => {
    const rows = rankCandidates(candidatesFromEntry(entry('bus', [
      { lang_code: 'pt', word: 'autocarro', tags: ['Portugal'], sense: 'road vehicle' },
      { lang_code: 'pt', word: 'machimbombo', tags: ['Angola'], sense: 'road vehicle' },
      { lang_code: 'pt', word: 'bus', sense: 'road vehicle' },
      { lang_code: 'pt', word: 'ônibus', tags: ['Brazil'], sense: 'road vehicle' },
    ]), headwords))
    expect(rows.map((row) => row.translation)).toEqual(['ônibus', 'bus'])
  })

  it('emits simplified Chinese only and excludes Japanese romanization', () => {
    const rows = rankCandidates([
      ...candidatesFromEntry(entry('bank', [
        { lang_code: 'cmn', word: '銀行 ／ 银行', tags: ['Simplified-Chinese'], sense: 'finance' },
        { lang_code: 'cmn', word: '銀行', tags: ['Traditional-Chinese'], sense: 'finance' },
        { lang_code: 'cmn', word: '銀號', sense: 'finance' },
        { lang_code: 'zh', word: '銀行 ／ 银行', tags: ['Hokkien'], sense: 'finance' },
      ]), headwords),
      ...candidatesFromEntry(entry('bus', [
        { lang_code: 'ja', word: 'basu', sense: 'road vehicle' },
        { lang_code: 'ja', word: 'バス', roman: 'basu', sense: 'road vehicle' },
      ]), headwords),
    ])
    expect(rows.filter((row) => row.language_code === 'zh-Hans').map((row) => row.translation))
      .toEqual(['银行'])
    expect(rows.filter((row) => row.language_code === 'ja').map((row) => row.translation))
      .toEqual(['バス'])
  })

  it('supports all five target languages and drops deprecated tags', () => {
    const rows = rankCandidates(candidatesFromEntry(entry('house', [
      { lang_code: 'ko', word: '집', sense: 'building' },
      { lang_code: 'ja', word: '家', sense: 'building' },
      { lang_code: 'cmn', word: '房子', tags: ['Simplified-Chinese'], sense: 'building' },
      { lang_code: 'es', word: 'casa', sense: 'building' },
      { lang_code: 'pt', word: 'casa', sense: 'building' },
      { lang_code: 'es', word: 'morada', tags: ['archaic'], sense: 'building' },
    ]), headwords))
    expect(new Set(rows.map((row) => row.language_code)))
      .toEqual(new Set(['ko', 'ja', 'zh-Hans', 'es', 'pt-BR']))
    expect(rows.some((row) => row.translation === 'morada')).toBe(false)
  })

  it('drops leading editorial sense qualifiers without matching semantic prose', () => {
    const rows = rankCandidates(candidatesFromEntry(entry('house', [
      { lang_code: 'es', word: 'claramente', sense: '(archaic) plainly' },
      { lang_code: 'es', word: 'cliente', sense: '(obsolete) habitual patron' },
      { lang_code: 'es', word: 'excelente', sense: "''(UK, dated)'' excellent" },
      { lang_code: 'es', word: 'raro', sense: 'rare: uncommon form' },
      { lang_code: 'es', word: 'tener', sense: 'auxiliary (archaic in English): used to be' },
      { lang_code: 'es', word: 'normal', sense: 'a custom that has become obsolete' },
      { lang_code: 'es', word: 'anticuado', sense: 'obsolete, out-of-date' },
    ]), headwords))
    expect(rows.map((row) => row.translation)).toEqual(['normal', 'anticuado'])
    expect(hasFilteredSenseQualifier('nonstandard: informal spelling')).toBe(true)
    expect(hasFilteredSenseQualifier('a tool that is now considered nonstandard')).toBe(false)
    expect(hasFilteredSenseQualifier('obsolete, out-of-date')).toBe(false)
  })

  it('shortens long sense labels deterministically', () => {
    expect(normalizeSenseLabel('financial institution; especially a retail bank.'))
      .toBe('financial institution; especially a retail bank')
    expect(normalizeSenseLabel('x'.repeat(140))).toBeNull()
  })

  it('filters unresolved translation templates and cleans safe sense markup', () => {
    const rows = rankCandidates(candidatesFromEntry(entry('house', [
      { lang_code: 'ja', word: '{{t|1=ja|2=B級品}}', sense: 'inferior quality' },
      { lang_code: 'es', word: '[[casa]]', sense: 'building' },
      { lang_code: 'es', word: 'casa', sense: 'members of the species \'\'Equus ferus\'\'' },
    ]), headwords))
    expect(rows.map((row) => row.translation)).toEqual(['casa'])
    expect(rows[0].sense_label).toBe('members of the species Equus ferus')
    expect(normalizeSenseLabel('to give something a [[shape]]')).toBe('to give something a shape')
    expect(normalizeSenseLabel('a [[bank|financial institution]]')).toBe('a financial institution')
    expect(normalizeSenseLabel('(' + "''transitive''" + ') to shape')).toBe('(transitive) to shape')
    expect(normalizeSenseLabel('{{lb|en|rare}} a form')).toBeNull()
  })

  it('can generate a corrective replacement migration without changing prior seeds', () => {
    const sql = sqlForRows([{
      normalized_word: 'house',
      language_code: 'es',
      rank: 1,
      translation: 'casa',
      sense_label: 'building',
    }], {
      snapshotDate: '2026-07-09',
      wiktionaryDumpDate: '2026-07-06',
      kaikkiSha256: 'documented-fake-kaikki-sha',
      ngslSha256: 'documented-fake-ngsl-sha',
    }, true)
    expect(sql).toContain('delete from public.word_translations;')
    expect(sql.indexOf('delete from')).toBeLessThan(sql.indexOf('insert into'))
  })
})
