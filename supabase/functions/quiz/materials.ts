// Study-material shape for the weekly digest, plus validation of cached rows.
// Pure module — no I/O or model/vendor dependency.

export type StudyMaterial = {
  definition: string
  examples: string[]
  similar: { phrase: string; nuance: string }[]
  recognition_distractors: string[]
  cloze: { sentence: string; distractors: string[] }
}

const nonEmpty = (s: unknown): s is string => typeof s === 'string' && s.trim().length > 0

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Accept an array with at least `min` non-empty strings, then normalize down
// to the first `max`. The LLM doesn't reliably honor exact counts, so we take
// what it gives (as long as there's enough) rather than dropping the card.
function distinctStringArray(
  u: unknown,
  min: number,
  max: number,
  excluded: string[] = []
): string[] | null {
  if (!Array.isArray(u)) return null
  const seen = new Set(excluded.map((value) => value.trim().toLocaleLowerCase('en')))
  const items: string[] = []
  for (const raw of u) {
    if (!nonEmpty(raw)) continue
    const value = raw.trim()
    const key = value.toLocaleLowerCase('en')
    if (seen.has(key)) continue
    seen.add(key)
    items.push(value)
  }
  return items.length >= min ? items.slice(0, max) : null
}

/** Validate cached material for `word`; null on any violation. */
export function validateStudyMaterial(word: string, u: unknown): StudyMaterial | null {
  if (typeof u !== 'object' || u === null) return null
  const m = u as Record<string, unknown>
  if (!nonEmpty(m.definition) || (m.definition as string).length > 400) return null

  const examples = distinctStringArray(m.examples, 1, 2)
  if (!examples) return null

  if (!Array.isArray(m.similar)) return null
  const similar: { phrase: string; nuance: string }[] = []
  for (const s of m.similar) {
    const e = s as Record<string, unknown>
    if (typeof s !== 'object' || s === null || !nonEmpty(e.phrase) || !nonEmpty(e.nuance)) continue
    similar.push({ phrase: e.phrase as string, nuance: e.nuance as string })
  }
  if (similar.length < 2) return null
  const similarTrimmed = similar.slice(0, 3)

  const recognition = distinctStringArray(
    m.recognition_distractors,
    3,
    3,
    [m.definition as string]
  )
  if (!recognition) return null

  const c = m.cloze as Record<string, unknown> | null
  if (typeof c !== 'object' || c === null || !nonEmpty(c.sentence)) return null
  const clozeDistractors = distinctStringArray(c.distractors, 3, 3, [word])
  if (!clozeDistractors) return null
  if (!new RegExp('\\b' + escapeRegExp(word) + '\\b', 'i').test(c.sentence as string)) return null

  return {
    definition: m.definition as string,
    examples,
    similar: similarTrimmed,
    recognition_distractors: recognition,
    cloze: { sentence: c.sentence as string, distractors: clozeDistractors },
  }
}
