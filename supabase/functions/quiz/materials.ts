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

// Accept an array with at least `min` non-empty strings, then normalize down
// to the first `max`. The LLM doesn't reliably honor exact counts, so we take
// what it gives (as long as there's enough) rather than dropping the card.
function stringArraySlice(u: unknown, min: number, max: number): string[] | null {
  if (!Array.isArray(u)) return null
  const items = u.filter(nonEmpty)
  return items.length >= min ? items.slice(0, max) : null
}

/** Validate an LLM-generated material for `word`; null on any violation. */
export function validateStudyMaterial(word: string, u: unknown): StudyMaterial | null {
  if (typeof u !== 'object' || u === null) return null
  const m = u as Record<string, unknown>
  if (!nonEmpty(m.definition) || (m.definition as string).length > 400) return null

  const examples = stringArraySlice(m.examples, 1, 2)
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

  const recognition = stringArraySlice(m.recognition_distractors, 3, 3)
  if (!recognition) return null

  const c = m.cloze as Record<string, unknown> | null
  if (typeof c !== 'object' || c === null || !nonEmpty(c.sentence)) return null
  const clozeDistractors = stringArraySlice(c.distractors, 3, 3)
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

declare const Deno: { env: { get: (key: string) => string | undefined } }

export const STUDY_MODEL = 'gemini-2.5-flash-lite'

// OpenAPI-subset Schema for Gemini's generationConfig.responseSchema.
const STUDY_SCHEMA = {
  type: 'object',
  required: ['definition', 'examples', 'similar', 'recognition_distractors', 'cloze'],
  properties: {
    definition: { type: 'string', description: 'One concise learner-friendly definition (CEFR B1 clarity).' },
    examples: {
      type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 2,
      description: '1-2 everyday example sentences using the word naturally.',
    },
    similar: {
      type: 'array', minItems: 2, maxItems: 3,
      items: {
        type: 'object', required: ['phrase', 'nuance'],
        properties: {
          phrase: { type: 'string' },
          nuance: { type: 'string', description: 'One-line contrast with the target word.' },
        },
      },
      description: '2-3 similar words or expressions.',
    },
    recognition_distractors: {
      type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 3,
      description: 'Exactly 3 plausible but wrong definitions (same register as the real one).',
    },
    cloze: {
      type: 'object', required: ['sentence', 'distractors'],
      properties: {
        sentence: {
          type: 'string',
          description:
            'One new example sentence containing the target word written out in full. ' +
            'Do NOT blank it out or use underscores — the app removes the word itself.',
        },
        distractors: {
          type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 3,
          description: 'Exactly 3 same-part-of-speech words that are wrong in that sentence.',
        },
      },
    },
  },
}

/**
 * Generate study material for one word via the Gemini API (JSON mode with a
 * response schema). Returns null on ANY failure — the caller skips the word
 * this round and retries next send. Never throws.
 */
export async function generateStudyMaterial(
  word: string,
  fetchFn: typeof fetch = fetch
): Promise<StudyMaterial | null> {
  const key = Deno.env.get('GEMINI_API_KEY')
  if (!key) return null
  try {
    const res = await fetchFn(
      `https://generativelanguage.googleapis.com/v1beta/models/${STUDY_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text:
                'You create study material for English learners (monolingual, CEFR-B1 clarity). ' +
                'Everyday register. The cloze sentence must be a complete, natural sentence that ' +
                'uses the target word itself — never insert a blank, underscores, or a placeholder; ' +
                'the app removes the word automatically.',
            }],
          },
          contents: [{ parts: [{ text: `Create study material for the word: ${word}` }] }],
          generationConfig: { responseMimeType: 'application/json', responseSchema: STUDY_SCHEMA },
        }),
      }
    )
    if (!res.ok) return null
    const body = await res.json()
    const candidate = body.candidates?.[0]
    if (candidate?.finishReason !== 'STOP') return null
    const text = (candidate.content?.parts ?? []).find(
      (p: { text?: unknown }) => typeof p.text === 'string'
    )?.text
    if (typeof text !== 'string') return null
    return validateStudyMaterial(word, JSON.parse(text))
  } catch {
    return null
  }
}
