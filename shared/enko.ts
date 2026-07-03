// Pure transform for the one-time en→ko ETL (scripts/build-en-ko-dataset.ts).
// Input shape: one kaikki.org English-extract JSONL entry (wiktextract JSON).

const MAX_WORD_LEN = 40

interface TranslationLike {
  code?: unknown
  word?: unknown
}

function koWordsFrom(list: unknown): string[] {
  if (!Array.isArray(list)) return []
  return list
    .filter((t): t is TranslationLike => typeof t === 'object' && t !== null)
    .filter((t) => t.code === 'ko' && typeof t.word === 'string' && (t.word as string).trim())
    .map((t) => (t.word as string).trim())
}

/** Pull (headword, Korean translations) out of one Wiktionary entry, or null. */
export function extractKoTranslations(entry: unknown): { word: string; ko: string[] } | null {
  if (typeof entry !== 'object' || entry === null) return null
  const e = entry as Record<string, unknown>
  if (e.lang_code !== 'en') return null
  const word = typeof e.word === 'string' ? e.word.trim().toLowerCase() : ''
  if (!word || word.length > MAX_WORD_LEN) return null

  const senses = Array.isArray(e.senses) ? e.senses : []
  const ko = [
    ...koWordsFrom(e.translations),
    ...senses.flatMap((s) =>
      typeof s === 'object' && s !== null ? koWordsFrom((s as Record<string, unknown>).translations) : []
    ),
  ]

  const deduped = [...new Set(ko)]
  return deduped.length > 0 ? { word, ko: deduped } : null
}

/** Accumulate per-word translations across entries (Wiktionary repeats headwords per POS). */
export function mergeTranslations(
  map: Map<string, string[]>,
  extracted: { word: string; ko: string[] },
  cap = 8
): void {
  const existing = map.get(extracted.word) ?? []
  for (const ko of extracted.ko) {
    if (existing.length >= cap) break
    if (!existing.includes(ko)) existing.push(ko)
  }
  map.set(extracted.word, existing)
}

function pgArrayLiteral(items: string[]): string {
  const escaped = items.map((s) => '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"')
  return '{' + escaped.join(',') + '}'
}

/** One `\copy … with (format csv)`-compatible row: word,text[] literal. */
export function toCsvLine(word: string, ko: string[]): string {
  const csv = (s: string) => '"' + s.replace(/"/g, '""') + '"'
  return `${csv(word)},${csv(pgArrayLiteral(ko))}`
}
