// Study-material shape for the weekly digest, plus validation of
// LLM-generated JSON before it is cached. Pure module — no I/O.

export type StudyMaterial = {
  definition: string
  examples: string[]
  similar: { phrase: string; nuance: string }[]
  recognition_distractors: string[]
  cloze: { sentence: string; distractors: string[] }
}

const nonEmpty = (s: unknown): s is string => typeof s === 'string' && s.trim().length > 0

function stringArray(u: unknown, min: number, max: number): string[] | null {
  if (!Array.isArray(u) || u.length < min || u.length > max) return null
  return u.every(nonEmpty) ? (u as string[]) : null
}

/** Validate an LLM-generated material for `word`; null on any violation. */
export function validateStudyMaterial(word: string, u: unknown): StudyMaterial | null {
  if (typeof u !== 'object' || u === null) return null
  const m = u as Record<string, unknown>
  if (!nonEmpty(m.definition) || (m.definition as string).length > 400) return null

  const examples = stringArray(m.examples, 1, 2)
  if (!examples) return null

  if (!Array.isArray(m.similar) || m.similar.length < 2 || m.similar.length > 3) return null
  const similar: { phrase: string; nuance: string }[] = []
  for (const s of m.similar) {
    const e = s as Record<string, unknown>
    if (typeof s !== 'object' || s === null || !nonEmpty(e.phrase) || !nonEmpty(e.nuance)) return null
    similar.push({ phrase: e.phrase as string, nuance: e.nuance as string })
  }

  const recognition = stringArray(m.recognition_distractors, 3, 3)
  if (!recognition) return null

  const c = m.cloze as Record<string, unknown> | null
  if (typeof c !== 'object' || c === null || !nonEmpty(c.sentence)) return null
  const clozeDistractors = stringArray(c.distractors, 3, 3)
  if (!clozeDistractors) return null
  if (!(c.sentence as string).toLowerCase().includes(word.toLowerCase())) return null

  return {
    definition: m.definition as string,
    examples,
    similar,
    recognition_distractors: recognition,
    cloze: { sentence: c.sentence as string, distractors: clozeDistractors },
  }
}
