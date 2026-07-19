import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, stat, writeFile } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { createGunzip } from 'node:zlib'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const INCLUDED_PARTS_OF_SPEECH = new Set(['phrase', 'prep_phrase', 'proverb'])
const BANNED_LABEL_PARTS = ['archaic', 'obsolete', 'dated', 'rare', 'nonstandard']
const SOURCE_URL = 'https://kaikki.org/dictionary/English/index.html'
const WIKTIONARY_URL = 'https://en.wiktionary.org/'
const LICENSE_NAME = 'CC BY-SA 4.0'
const LICENSE_URL = 'https://creativecommons.org/licenses/by-sa/4.0/'

export function normalizePhrase(value) {
  if (typeof value !== 'string') return null
  const normalized = value
    .normalize('NFKC')
    .replaceAll('’', "'")
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["“”'‘’.,!?;:()[\]{}]+|["“”'‘’.,!?;:()[\]{}]+$/g, '')
    .trim()
    .toLowerCase()
  if (!normalized || normalized.length > 160 || !/\s/.test(normalized)) return null
  return /[\p{L}\p{N}]/u.test(normalized) ? normalized : null
}

function cleanText(value, maxLength) {
  if (typeof value !== 'string') return null
  const cleaned = value
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned ? cleaned.slice(0, maxLength) : null
}

function normalizedTags(value) {
  return Array.isArray(value)
    ? value
      .filter((tag) => typeof tag === 'string')
      .map((tag) => tag.normalize('NFKC').trim())
      .filter(Boolean)
    : []
}

function tagHasPart(tag, part) {
  return tag.toLowerCase().replaceAll('_', '-').includes(part)
}

export function hasBannedLabel(tags) {
  return normalizedTags(tags).some((tag) =>
    BANNED_LABEL_PARTS.some((part) => tagHasPart(tag, part))
  )
}

function relatedWords(value) {
  if (!Array.isArray(value)) return []
  const seen = new Set()
  const words = []
  for (const item of value) {
    const raw = typeof item === 'string' ? item : item?.word
    const word = cleanText(raw, 160)
    const key = word?.toLocaleLowerCase('und')
    if (!word || !key || seen.has(key)) continue
    seen.add(key)
    words.push(word)
    if (words.length === 20) break
  }
  return words
}

function firstExample(value) {
  if (!Array.isArray(value)) return null
  const ordered = [
    ...value.filter((example) => example?.type === 'example'),
    ...value.filter((example) => example?.type !== 'example'),
  ]
  for (const example of ordered) {
    const text = cleanText(example?.text, 1200)
    if (text) return text
  }
  return null
}

function partOfSpeechLabel(value) {
  if (value === 'prep_phrase') return 'prepositional phrase'
  return String(value || 'phrase').replaceAll('_', ' ')
}

export function candidatesFromEntry(entry, sequenceStart = 0) {
  if (!entry || entry.lang_code !== 'en') return []
  const normalizedPhrase = normalizePhrase(entry.word)
  if (!normalizedPhrase || !Array.isArray(entry.senses)) return []
  const includedPos = INCLUDED_PARTS_OF_SPEECH.has(entry.pos)
  const phrase = cleanText(entry.word, 160)
  if (!phrase) return []

  const rows = []
  let sequence = sequenceStart
  for (const sense of entry.senses) {
    sequence += 1
    const tags = normalizedTags(sense?.tags)
    const idiomatic = tags.some((tag) => tag.toLowerCase() === 'idiomatic')
    if ((!includedPos && !idiomatic) || hasBannedLabel(tags)) continue
    const definition = cleanText(sense?.glosses?.[0], 1200)
    if (!definition) continue
    rows.push({
      normalizedPhrase,
      phrase,
      partOfSpeech: partOfSpeechLabel(entry.pos),
      definition,
      example: firstExample(sense.examples),
      synonyms: relatedWords(sense.synonyms),
      antonyms: relatedWords(sense.antonyms),
      usageLabels: tags.slice(0, 12).map((tag) => tag.slice(0, 80)),
      sourceUrl: `${WIKTIONARY_URL}wiki/${encodeURIComponent(phrase.replaceAll(' ', '_'))}#English`,
      licenseName: LICENSE_NAME,
      licenseUrl: LICENSE_URL,
      idiomatic,
      sequence,
    })
  }
  return rows
}

export function rankCandidates(candidates) {
  const groups = new Map()
  for (const candidate of candidates) {
    const group = groups.get(candidate.normalizedPhrase) ?? []
    group.push(candidate)
    groups.set(candidate.normalizedPhrase, group)
  }

  const rows = []
  for (const group of groups.values()) {
    const selected = []
    const seenDefinitions = new Set()
    for (const candidate of group.sort(
      (a, b) => Number(b.idiomatic) - Number(a.idiomatic) || a.sequence - b.sequence
    )) {
      const key = candidate.definition.normalize('NFKC').toLocaleLowerCase('und')
      if (seenDefinitions.has(key)) continue
      seenDefinitions.add(key)
      selected.push(candidate)
      if (selected.length === 3) break
    }
    selected.forEach((candidate, index) => rows.push({
      normalized_phrase: candidate.normalizedPhrase,
      phrase: candidate.phrase,
      part_of_speech: candidate.partOfSpeech,
      sense_rank: index + 1,
      definition: candidate.definition,
      example: candidate.example,
      synonyms: candidate.synonyms,
      antonyms: candidate.antonyms,
      usage_labels: candidate.usageLabels,
      source_url: candidate.sourceUrl,
      license_name: candidate.licenseName,
      license_url: candidate.licenseUrl,
    }))
  }
  return rows.sort((a, b) =>
    a.normalized_phrase.localeCompare(b.normalized_phrase, 'en') || a.sense_rank - b.sense_rank
  )
}

async function readCandidates(filePaths) {
  const paths = Array.isArray(filePaths) ? filePaths : [filePaths]
  const combined = Readable.from((async function* chunks() {
    for (const path of paths) {
      for await (const chunk of createReadStream(path)) yield chunk
    }
  })())
  const input = (paths.length > 1 || paths[0].endsWith('.gz'))
    ? combined.pipe(createGunzip())
    : combined
  input.setEncoding('utf8')
  const candidates = []
  let lineCount = 0
  let sequence = 0
  let pending = ''

  const processLine = (rawLine) => {
    lineCount += 1
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine
    if (!line.trim()) return
    let entry
    try {
      entry = JSON.parse(line)
    } catch {
      throw new Error(`Malformed Kaikki JSONL at line ${lineCount}`)
    }
    const entryCandidates = candidatesFromEntry(entry, sequence)
    sequence += Array.isArray(entry?.senses) ? entry.senses.length : 1
    candidates.push(...entryCandidates)
  }

  for await (const chunk of input) {
    pending += chunk
    let newline = pending.indexOf('\n')
    while (newline >= 0) {
      processLine(pending.slice(0, newline))
      pending = pending.slice(newline + 1)
      newline = pending.indexOf('\n')
    }
  }
  if (pending) processLine(pending)
  return { candidates, lineCount }
}

function csvQuote(value) {
  const text = Array.isArray(value) ? JSON.stringify(value) : value === null ? '' : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function csvForRows(rows) {
  const columns = [
    'normalized_phrase', 'phrase', 'part_of_speech', 'sense_rank', 'definition',
    'example', 'synonyms', 'antonyms', 'usage_labels', 'source_url', 'license_name', 'license_url',
  ]
  return [
    columns.join(','),
    ...rows.map((row) => columns.map((column) => csvQuote(row[column])).join(',')),
    '',
  ].join('\n')
}

const sqlString = (value) => value === null ? 'null' : `'${String(value).replaceAll("'", "''")}'`
const sqlArray = (values) => values.length === 0
  ? `'{}'::text[]`
  : `array[${values.map(sqlString).join(', ')}]::text[]`

export function sqlForRows(rows, metadata) {
  const header = [
    '-- Generated phrase data: CC BY-SA 4.0 (not MIT).',
    `-- Kaikki raw snapshot: ${metadata.snapshotDate}; English Wiktionary dump: ${metadata.wiktionaryDumpDate}`,
    `-- Kaikki SHA-256: ${metadata.kaikkiSha256}`,
    `-- ${metadata.phraseCount} phrases / ${metadata.rowCount} ranked senses.`,
    '-- Generated by scripts/phrases/build-dataset.mjs. Do not hand-edit.',
    '',
  ]
  const statements = []
  for (let start = 0; start < rows.length; start += 1000) {
    const values = rows.slice(start, start + 1000).map((row) =>
      `  (${sqlString(row.normalized_phrase)}, ${sqlString(row.phrase)}, ` +
      `${sqlString(row.part_of_speech)}, ${row.sense_rank}, ${sqlString(row.definition)}, ` +
      `${sqlString(row.example)}, ${sqlArray(row.synonyms)}, ${sqlArray(row.antonyms)}, ` +
      `${sqlArray(row.usage_labels)}, ${sqlString(row.source_url)}, ` +
      `${sqlString(row.license_name)}, ${sqlString(row.license_url)})`
    )
    statements.push([
      'insert into public.phrase_entries',
      '  (normalized_phrase, phrase, part_of_speech, sense_rank, definition, example,',
      '   synonyms, antonyms, usage_labels, source_url, license_name, license_url)',
      'values',
      `${values.join(',\n')};`,
      '',
    ].join('\n'))
  }
  return `${header.join('\n')}${statements.join('')}`
}

async function sha256(filePaths) {
  const hash = createHash('sha256')
  for (const path of filePaths) {
    for await (const chunk of createReadStream(path)) hash.update(chunk)
  }
  return hash.digest('hex')
}

function argsFrom(argv) {
  const args = new Map()
  for (let index = 0; index < argv.length; index += 2) args.set(argv[index], argv[index + 1])
  const required = (name) => {
    const value = args.get(name)
    if (!value) throw new Error(`Missing ${name}`)
    return value
  }
  return {
    kaikki: required('--kaikki').split(',').map((path) => resolve(path)),
    outCsv: resolve(required('--out-csv')),
    outSql: resolve(required('--out-sql')),
    outManifest: resolve(required('--out-manifest')),
    snapshotDate: args.get('--snapshot-date') ?? 'unknown',
    wiktionaryDumpDate: args.get('--wiktionary-dump-date') ?? 'unknown',
  }
}

export async function buildDataset(options) {
  const paths = Array.isArray(options.kaikki) ? options.kaikki : [options.kaikki]
  const { candidates, lineCount } = await readCandidates(paths)
  const rows = rankCandidates(candidates)
  const metadata = {
    snapshotDate: options.snapshotDate,
    wiktionaryDumpDate: options.wiktionaryDumpDate,
    kaikkiSourceUrl: SOURCE_URL,
    wiktionarySourceUrl: WIKTIONARY_URL,
    license: LICENSE_NAME,
    licenseUrl: LICENSE_URL,
    attribution: 'English Wiktionary via Kaikki — filtered and ranked by PopDict',
    phraseCount: new Set(rows.map((row) => row.normalized_phrase)).size,
    rowCount: rows.length,
    kaikkiLineCount: lineCount,
    kaikkiCompressedBytes: (await Promise.all(paths.map((path) => stat(path))))
      .reduce((total, file) => total + file.size, 0),
    kaikkiSha256: await sha256(paths),
    filtering: [
      'multi-word English senses tagged idiomatic',
      'phrase, prepositional-phrase, and proverb parts of speech',
      'archaic, obsolete, dated, rare, and nonstandard senses removed',
      'regional, slang, vulgar, and offensive labels retained',
      'duplicate definitions removed and at most three senses ranked per normalized phrase',
    ],
  }
  await Promise.all([options.outCsv, options.outSql, options.outManifest]
    .map((path) => mkdir(dirname(path), { recursive: true })))
  await Promise.all([
    writeFile(options.outCsv, csvForRows(rows), 'utf8'),
    writeFile(options.outSql, sqlForRows(rows, metadata), 'utf8'),
    writeFile(options.outManifest, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8'),
  ])
  return metadata
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  buildDataset(argsFrom(process.argv.slice(2))).then(
    (metadata) => process.stdout.write(`${JSON.stringify(metadata)}\n`),
    (error) => {
      process.stderr.write(`${error instanceof Error ? error.stack : error}\n`)
      process.exitCode = 1
    }
  )
}
