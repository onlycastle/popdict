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

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

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
  if (!new RegExp('\\b' + escapeRegExp(word) + '\\b', 'i').test(c.sentence as string)) return null

  return {
    definition: m.definition as string,
    examples,
    similar,
    recognition_distractors: recognition,
    cloze: { sentence: c.sentence as string, distractors: clozeDistractors },
  }
}

declare const Deno: { env: { get: (key: string) => string | undefined } }

export const STUDY_MODEL = 'claude-haiku-4-5'

const STUDY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['definition', 'examples', 'similar', 'recognition_distractors', 'cloze'],
  properties: {
    definition: { type: 'string', description: 'One concise learner-friendly definition (CEFR B1 clarity).' },
    examples: {
      type: 'array', items: { type: 'string' },
      description: '1-2 everyday example sentences using the word naturally.',
    },
    similar: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['phrase', 'nuance'],
        properties: {
          phrase: { type: 'string' },
          nuance: { type: 'string', description: 'One-line contrast with the target word.' },
        },
      },
      description: '2-3 similar words or expressions.',
    },
    recognition_distractors: {
      type: 'array', items: { type: 'string' },
      description: 'Exactly 3 plausible but wrong definitions (same register as the real one).',
    },
    cloze: {
      type: 'object', additionalProperties: false, required: ['sentence', 'distractors'],
      properties: {
        sentence: { type: 'string', description: 'One new example sentence that contains the exact target word.' },
        distractors: {
          type: 'array', items: { type: 'string' },
          description: 'Exactly 3 same-part-of-speech words that are wrong in that sentence.',
        },
      },
    },
  },
}

/**
 * Generate study material for one word via the Anthropic API (structured
 * output). Returns null on ANY failure — the caller skips the word this
 * round and retries next send. Never throws.
 */
export async function generateStudyMaterial(
  word: string,
  fetchFn: typeof fetch = fetch
): Promise<StudyMaterial | null> {
  const key = Deno.env.get('ANTHROPIC_API_KEY')
  if (!key) return null
  try {
    const res = await fetchFn('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: STUDY_MODEL,
        max_tokens: 1500,
        system:
          'You create study material for English learners (monolingual, CEFR-B1 clarity). ' +
          'Everyday register. The cloze sentence must contain the exact target word.',
        messages: [{ role: 'user', content: `Create study material for the word: ${word}` }],
        output_config: { format: { type: 'json_schema', schema: STUDY_SCHEMA } },
      }),
    })
    if (!res.ok) return null
    const body = await res.json()
    if (body.stop_reason !== 'end_turn') return null
    const text = (body.content ?? []).find((b: { type: string }) => b.type === 'text')?.text
    if (typeof text !== 'string') return null
    return validateStudyMaterial(word, JSON.parse(text))
  } catch {
    return null
  }
}
