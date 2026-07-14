import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { createGunzip } from 'node:zlib'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const TARGET_LANGUAGES = ['ko', 'ja', 'zh-Hans', 'es', 'pt-BR']
const KAIKKI_SOURCE_URL = 'https://kaikki.org/dictionary/raw-wiktextract-data.jsonl.gz'
const NGSL_SOURCE_URL = 'https://www.newgeneralservicelist.com/s/NGSL-GR_rank.csv'
const WIKTIONARY_SOURCE_URL = 'https://en.wiktionary.org/'

const BANNED_TAG_PARTS = ['archaic', 'obsolete', 'dated', 'rare', 'nonstandard']
const NON_MANDARIN_CHINESE_TAG_PARTS = [
  'cantonese', 'dungan', 'hakka', 'hokkien', 'min-dong', 'min-nan', 'teochew', 'wu',
]
const NON_BRAZILIAN_PORTUGUESE_TAG_PARTS = [
  'angola', 'cape-verde', 'east-timor', 'european', 'guinea-bissau', 'macau',
  'madeira', 'mozambique', 'portugal', 'sao-tome', 'timor-leste',
]
const TARGET_CODES = {
  ko: new Set(['ko']),
  ja: new Set(['ja']),
  'zh-Hans': new Set(['cmn', 'zh']),
  es: new Set(['es']),
  'pt-BR': new Set(['pt']),
}

export function normalizeHeadword(value) {
  if (typeof value !== 'string') return null
  const normalized = value
    .replace(/^\uFEFF/, '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replaceAll('’', "'")
    .replace(/\s+/g, ' ')
  return normalized && /^[a-z]+(?:['-][a-z]+)*$/.test(normalized) ? normalized : null
}

export function parseNgslCsv(text, limit = 3000) {
  const rows = text.split(/\r?\n/)
  const seen = new Set()
  const words = []
  for (let index = 1; index < rows.length && words.length < limit; index += 1) {
    if (!rows[index].trim()) continue
    const comma = rows[index].indexOf(',')
    if (comma < 0) throw new Error(`Malformed NGSL-GR row ${index + 1}`)
    const normalized = normalizeHeadword(rows[index].slice(comma + 1))
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    words.push(normalized)
  }
  if (words.length !== limit) {
    throw new Error(`Expected ${limit} distinct NGSL-GR headwords, found ${words.length}`)
  }
  return words
}

function normalizedTags(value) {
  return Array.isArray(value)
    ? value.filter((tag) => typeof tag === 'string').map((tag) => tag.toLowerCase())
    : []
}

function hasTagPart(tags, part) {
  return tags.some((tag) => tag.replaceAll('_', '-').includes(part))
}

function isFilteredTag(tags) {
  return BANNED_TAG_PARTS.some((part) => hasTagPart(tags, part))
}

/**
 * Kaikki can carry editorial labels in the translation's English sense text
 * instead of in `tags`. Only inspect a leading qualifier so ordinary glosses
 * such as "has become obsolete" are not mistaken for editorial metadata.
 */
export function hasFilteredSenseQualifier(value) {
  if (typeof value !== 'string') return false
  const sense = value
    .normalize('NFKC')
    .replace(/<[^>]*>/g, '')
    .trimStart()
  const unformatted = sense.replace(/'{2,3}/g, '').replace(/^[\s*_]+/, '')
  const parenthetical = unformatted.match(/^\(([^)]{1,120})\)/)?.[1]
    ?? unformatted.match(/^\[([^\]]{1,120})\]/)?.[1]
    ?? unformatted.match(/^.{1,40}?\(([^)]{1,120})\)\s*:/)?.[1]
  if (parenthetical && BANNED_TAG_PARTS.some(
    (part) => new RegExp(`(?:^|[,;/\\s])${part}(?:$|[,;/\\s])`, 'i').test(parenthetical)
  )) return true
  return BANNED_TAG_PARTS.some((part) =>
    new RegExp(`^${part}(?:\\s+in\\s+English)?\\s*(?::|;|[—–]|\\s-\\s)`, 'i')
      .test(unformatted)
  )
}

export function normalizeSenseLabel(value) {
  if (typeof value !== 'string') return null
  if (/\{\{|\}\}/.test(value)) return null
  const compact = value
    .replace(/<[^>]*>/g, '')
    .replace(/\[\[([^\[\]|]+)(?:\|([^\[\]]+))?\]\]/g, (_match, target, label) => label ?? target)
    .replace(/'{2,3}/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.;:]$/, '')
  if (!compact || /\[\[|\]\]|\{\{|\}\}/.test(compact)) return null
  if (compact.length <= 100) return compact
  const clause = compact.split(/[;,]/, 1)[0].trim()
  if (clause && clause.length <= 100) return clause
  const prefix = compact.slice(0, 100)
  const lastSpace = prefix.lastIndexOf(' ')
  if (lastSpace < 20) return null
  const shortened = prefix.slice(0, lastSpace).trim()
  return shortened || null
}

function cleanTranslation(value, language, tags) {
  if (typeof value !== 'string') return null
  let text = value.normalize('NFKC').replace(/\s+/g, ' ').trim()
  if (/\{\{|\}\}|\[\[|\]\]/.test(text)) return null
  if (language === 'zh-Hans') {
    const variants = text.split(/\s*(?:\/|／)\s*/).filter(Boolean)
    if (variants.length > 1) text = variants.at(-1)
    const traditional = hasTagPart(tags, 'traditional')
    const simplified = hasTagPart(tags, 'simplified')
    if (traditional && !simplified) return null
    // Without an explicit simplified marker (or the conventional
    // traditional/simplified pair), a Han form cannot be classified safely.
    if (!simplified && variants.length === 1) return null
    if (!/[\p{Script=Han}]/u.test(text)) return null
  }
  if (language === 'ja' && !/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(text)) {
    return null
  }
  if (language === 'ko' && !/[\p{Script=Hangul}]/u.test(text)) return null
  if (!text || text.length > 120 || /[\u0000-\u001F\u007F]/.test(text)) return null
  return text
}

function portugueseRegion(tags) {
  if (NON_BRAZILIAN_PORTUGUESE_TAG_PARTS.some((part) => hasTagPart(tags, part))) return null
  return hasTagPart(tags, 'brazil') ? 0 : 1
}

export function candidatesFromEntry(entry, headwords, sequenceStart = 0) {
  if (!entry || entry.lang_code !== 'en') return []
  const normalizedWord = normalizeHeadword(entry.word)
  if (!normalizedWord || !headwords.has(normalizedWord) || !Array.isArray(entry.translations)) {
    return []
  }

  const candidates = []
  let sequence = sequenceStart
  for (const raw of entry.translations) {
    sequence += 1
    if (!raw || typeof raw !== 'object') continue
    const code = String(raw.lang_code ?? raw.code ?? '')
    const language = TARGET_LANGUAGES.find((target) => TARGET_CODES[target].has(code))
    if (!language) continue
    const tags = normalizedTags(raw.tags)
    if (isFilteredTag(tags) || hasFilteredSenseQualifier(raw.sense)) continue
    if (
      language === 'zh-Hans' &&
      NON_MANDARIN_CHINESE_TAG_PARTS.some((part) => hasTagPart(tags, part))
    ) continue
    const regionPriority = language === 'pt-BR' ? portugueseRegion(tags) : 0
    if (regionPriority === null) continue
    const translation = cleanTranslation(raw.word, language, tags)
    if (!translation) continue
    candidates.push({
      normalizedWord,
      languageCode: language,
      translation,
      senseLabel: normalizeSenseLabel(raw.sense),
      regionPriority,
      sequence,
    })
  }
  return candidates
}

function translationKey(value) {
  return value.normalize('NFKC').toLocaleLowerCase('und')
}

export function rankCandidates(candidates, maxRank = 3) {
  const groups = new Map()
  for (const candidate of candidates) {
    const key = `${candidate.normalizedWord}\u0000${candidate.languageCode}`
    const group = groups.get(key) ?? []
    group.push(candidate)
    groups.set(key, group)
  }

  const rows = []
  for (const group of groups.values()) {
    const deduped = []
    const seenTranslations = new Set()
    for (const candidate of group.sort(
      (a, b) => a.regionPriority - b.regionPriority || a.sequence - b.sequence
    )) {
      const key = translationKey(candidate.translation)
      if (seenTranslations.has(key)) continue
      seenTranslations.add(key)
      deduped.push(candidate)
    }

    const selected = []
    const selectedTranslations = new Set()
    const seenSenses = new Set()
    for (const candidate of deduped) {
      const senseKey = candidate.senseLabel?.toLowerCase() ?? '(unlabelled)'
      if (seenSenses.has(senseKey)) continue
      seenSenses.add(senseKey)
      selected.push(candidate)
      selectedTranslations.add(translationKey(candidate.translation))
      if (selected.length === maxRank) break
    }
    for (const candidate of deduped) {
      if (selected.length === maxRank) break
      if (selectedTranslations.has(translationKey(candidate.translation))) continue
      selected.push(candidate)
      selectedTranslations.add(translationKey(candidate.translation))
    }
    selected.forEach((candidate, index) => rows.push({
      normalized_word: candidate.normalizedWord,
      language_code: candidate.languageCode,
      rank: index + 1,
      translation: candidate.translation,
      sense_label: candidate.senseLabel,
    }))
  }

  return rows.sort((a, b) =>
    (a.normalized_word < b.normalized_word ? -1 : a.normalized_word > b.normalized_word ? 1 : 0) ||
    TARGET_LANGUAGES.indexOf(a.language_code) - TARGET_LANGUAGES.indexOf(b.language_code) ||
    a.rank - b.rank
  )
}

export function parseKaikkiLine(line, lineNumber = 1) {
  try {
    return JSON.parse(line)
  } catch {
    throw new Error(`Malformed Kaikki JSONL at line ${lineNumber}`)
  }
}

async function readKaikkiCandidates(filePaths, headwords) {
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
  let lineNumber = 0
  let sequence = 0
  let pending = ''

  const processLine = (rawLine) => {
    lineNumber += 1
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine
    if (!line.trim()) return
    const entry = parseKaikkiLine(line, lineNumber)
    const entryCandidates = candidatesFromEntry(entry, headwords, sequence)
    sequence += Array.isArray(entry?.translations)
      ? entry.translations.length
      : 1
    candidates.push(...entryCandidates)
  }

  // Kaikki records may contain literal Unicode line/paragraph separators inside
  // JSON strings. Node's readline treats those as record boundaries, so split
  // strictly on the JSONL byte delimiter (LF) instead.
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
  return { candidates, lineCount: lineNumber }
}

export function csvForRows(rows) {
  const quote = (value) => {
    if (value === null) return ''
    const text = String(value)
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
  }
  return [
    'normalized_word,language_code,rank,translation,sense_label',
    ...rows.map((row) => [
      row.normalized_word,
      row.language_code,
      row.rank,
      row.translation,
      row.sense_label,
    ].map(quote).join(',')),
    '',
  ].join('\n')
}

const sqlString = (value) => value === null ? 'null' : `'${String(value).replaceAll("'", "''")}'`

export function sqlForRows(rows, metadata, replaceExisting = false) {
  const values = rows.map((row) =>
    `  (${sqlString(row.normalized_word)}, ${sqlString(row.language_code)}, ${row.rank}, ` +
    `${sqlString(row.translation)}, ${sqlString(row.sense_label)})`
  )
  return [
    '-- Generated translation data: CC BY-SA 4.0 (not MIT).',
    `-- Kaikki raw snapshot: ${metadata.snapshotDate}; English Wiktionary dump: ${metadata.wiktionaryDumpDate}`,
    `-- Kaikki SHA-256: ${metadata.kaikkiSha256}`,
    `-- NGSL-GR 1.0 SHA-256: ${metadata.ngslSha256}`,
    '-- Generated by scripts/translations/build-dataset.mjs. Do not hand-edit.',
    '',
    ...(replaceExisting ? ['delete from public.word_translations;', ''] : []),
    'insert into public.word_translations',
    '  (normalized_word, language_code, rank, translation, sense_label)',
    'values',
    values.join(',\n') + ';',
    '',
  ].join('\n')
}

async function sha256(filePaths) {
  const hash = createHash('sha256')
  const paths = Array.isArray(filePaths) ? filePaths : [filePaths]
  for (const path of paths) {
    for await (const chunk of createReadStream(path)) hash.update(chunk)
  }
  return hash.digest('hex')
}

function argsFrom(argv) {
  const args = new Map()
  for (let index = 0; index < argv.length; index += 2) args.set(argv[index], argv[index + 1])
  const requiredValue = (name) => {
    const value = args.get(name)
    if (!value) throw new Error(`Missing ${name}`)
    return value
  }
  const required = (name) => resolve(requiredValue(name))
  return {
    ngsl: required('--ngsl'),
    kaikki: requiredValue('--kaikki').split(',').map((path) => resolve(path)),
    outCsv: required('--out-csv'),
    outHeadwords: required('--out-headwords'),
    outSql: required('--out-sql'),
    outManifest: required('--out-manifest'),
    snapshotDate: args.get('--snapshot-date') ?? 'unknown',
    wiktionaryDumpDate: args.get('--wiktionary-dump-date') ?? 'unknown',
    limit: Number(args.get('--headwords') ?? '3000'),
    replaceExisting: args.get('--replace-existing') === 'true',
  }
}

export async function buildDataset(options) {
  const ngslText = await readFile(options.ngsl, 'utf8')
  const headwords = parseNgslCsv(ngslText, options.limit)
  const kaikkiPaths = Array.isArray(options.kaikki) ? options.kaikki : [options.kaikki]
  const { candidates, lineCount } = await readKaikkiCandidates(kaikkiPaths, new Set(headwords))
  const rows = rankCandidates(candidates)
  const metadata = {
    snapshotDate: options.snapshotDate,
    wiktionaryDumpDate: options.wiktionaryDumpDate,
    kaikkiSourceUrl: KAIKKI_SOURCE_URL,
    ngslSourceUrl: NGSL_SOURCE_URL,
    wiktionarySourceUrl: WIKTIONARY_SOURCE_URL,
    attribution: 'English Wiktionary via Kaikki — filtered and ranked by PopDict',
    license: 'CC BY-SA 4.0',
    headwordCount: headwords.length,
    rowCount: rows.length,
    kaikkiLineCount: lineCount,
    kaikkiCompressedBytes: (await Promise.all(kaikkiPaths.map((path) => stat(path))))
      .reduce((total, file) => total + file.size, 0),
    kaikkiSha256: await sha256(kaikkiPaths),
    ngslSha256: await sha256(options.ngsl),
    filteringChanges: [
      'first 3,000 distinct normalized single English NGSL-GR headwords',
      'five target languages only',
      'archaic, obsolete, dated, rare, and nonstandard forms and source senses removed',
      'Brazilian Portuguese and Simplified Chinese regional/script filtering',
      'Japanese romanization excluded',
      'unresolved Wiktionary templates removed and safe source-sense markup normalized',
      'Unicode/whitespace normalization, deduplication, sense-aware ranking, maximum rank 3',
    ],
  }

  await Promise.all([
    options.outCsv,
    options.outHeadwords,
    options.outSql,
    options.outManifest,
  ].map((path) => mkdir(dirname(path), { recursive: true })))
  await Promise.all([
    writeFile(options.outCsv, csvForRows(rows), 'utf8'),
    writeFile(options.outHeadwords, `${headwords.join('\n')}\n`, 'utf8'),
    writeFile(options.outSql, sqlForRows(rows, metadata, options.replaceExisting ?? false), 'utf8'),
    writeFile(options.outManifest, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8'),
  ])
  return metadata
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  buildDataset(argsFrom(process.argv.slice(2))).then(
    (metadata) => process.stdout.write(`${JSON.stringify(metadata)}\n`),
    (error) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
      process.exitCode = 1
    }
  )
}
