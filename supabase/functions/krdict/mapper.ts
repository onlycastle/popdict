// Pure XML→entries mapping for the krdict proxy. No Deno APIs and no URL
// imports here: this module is imported by the edge function (Deno, via the
// sibling deno.json import map) AND by the app's Vitest suite (Node), which is
// what keeps it type-checked despite supabase/functions being tsconfig-excluded.
import { XMLParser } from 'fast-xml-parser'

export interface KrdictDefinition {
  definition: string
}

export interface KrdictMeaning {
  partOfSpeech: string
  definitions: KrdictDefinition[]
}

/** Structurally assignable to the app's DictionaryResult. */
export interface KrdictEntry {
  word: string
  phonetic?: string
  meanings: KrdictMeaning[]
}

const POS_EN: Record<string, string> = {
  명사: 'noun',
  대명사: 'pronoun',
  수사: 'numeral',
  조사: 'particle',
  동사: 'verb',
  형용사: 'adjective',
  관형사: 'determiner',
  부사: 'adverb',
  감탄사: 'interjection',
  접사: 'affix',
  '의존 명사': 'dependent noun',
  '보조 동사': 'auxiliary verb',
  '보조 형용사': 'auxiliary adjective',
  어미: 'ending',
  '품사 없음': 'phrase',
}

/** fast-xml-parser yields an object for one child and an array for many. */
function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

function text(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : ''
}

/**
 * Map a krdict /api/search XML response (translated=y&trans_lang=1) to entries.
 * Homonyms (사과¹ apple / 사과² apology) arrive as separate <item>s with the
 * same <word> — they merge into one entry so the single-result UI shows both.
 */
export function parseKrdictXml(xml: string): KrdictEntry[] {
  let parsed: Record<string, unknown>
  try {
    parsed = new XMLParser({ ignoreAttributes: true, parseTagValue: false }).parse(xml)
  } catch {
    return []
  }

  const channel = parsed?.channel as Record<string, unknown> | undefined
  const items = asArray(channel?.item) as Array<Record<string, unknown>>

  const byWord = new Map<string, KrdictEntry>()

  for (const item of items) {
    const word = text(item.word)
    if (!word) continue

    const rawPos = text(item.pos)
    const partOfSpeech = POS_EN[rawPos] ?? rawPos

    const definitions = asArray(item.sense)
      .map((sense) => {
        const s = sense as Record<string, unknown>
        const translation = asArray(s.translation)
          .map((t) => t as Record<string, unknown>)
          .find((t) => text(t.trans_word) || text(t.trans_dfn))
        const transWord = text(translation?.trans_word)
        const transDfn = text(translation?.trans_dfn)
        const definition =
          transWord && transDfn ? `${transWord} — ${transDfn}` : transWord || transDfn || text(s.definition)
        return { definition }
      })
      .filter((d) => d.definition)

    if (definitions.length === 0) continue

    let entry = byWord.get(word)
    if (!entry) {
      entry = { word, meanings: [] }
      byWord.set(word, entry)
    }

    const pronunciation = text(item.pronunciation)
    if (pronunciation && !entry.phonetic) entry.phonetic = `[${pronunciation}]`

    const meaning = entry.meanings.find((m) => m.partOfSpeech === partOfSpeech)
    if (meaning) meaning.definitions.push(...definitions)
    else entry.meanings.push({ partOfSpeech, definitions })
  }

  return [...byWord.values()]
}
