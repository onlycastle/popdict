import { assertEquals } from 'jsr:@std/assert@1'
import { validateStudyMaterial } from './materials.ts'

const good = {
  definition: 'great pleasure or satisfaction',
  examples: ['The garden was a delight to visit in spring.'],
  similar: [
    { phrase: 'joy', nuance: 'stronger, more emotional' },
    { phrase: 'pleasure', nuance: 'more general, less intense' },
  ],
  recognition_distractors: ['a sudden fear', 'a type of contract', 'a bright light source'],
  cloze: {
    sentence: 'Watching the sunset was a pure delight after the long hike.',
    distractors: ['burden', 'schedule', 'debate'],
  },
}

Deno.test('accepts a well-formed material', () => {
  assertEquals(validateStudyMaterial('delight', good)?.definition, good.definition)
})

Deno.test('rejects non-objects and missing fields', () => {
  assertEquals(validateStudyMaterial('delight', null), null)
  assertEquals(validateStudyMaterial('delight', { ...good, definition: '' }), null)
  assertEquals(validateStudyMaterial('delight', { ...good, examples: [] }), null)
})

Deno.test('rejects wrong distractor counts', () => {
  assertEquals(validateStudyMaterial('delight', { ...good, recognition_distractors: ['a', 'b'] }), null)
  assertEquals(
    validateStudyMaterial('delight', { ...good, cloze: { ...good.cloze, distractors: ['x'] } }),
    null
  )
})

Deno.test('rejects a cloze sentence that does not contain the word', () => {
  assertEquals(
    validateStudyMaterial('delight', { ...good, cloze: { ...good.cloze, sentence: 'No target here.' } }),
    null
  )
})

Deno.test('rejects a cloze sentence where the word only appears inside a larger word', () => {
  assertEquals(
    validateStudyMaterial('delight', {
      ...good,
      cloze: { ...good.cloze, sentence: 'That was a delightful evening.' },
    }),
    null
  )
})

Deno.test('rejects similar outside 2-3 entries or missing nuance', () => {
  assertEquals(validateStudyMaterial('delight', { ...good, similar: [good.similar[0]] }), null)
  assertEquals(
    validateStudyMaterial('delight', { ...good, similar: [{ phrase: 'joy' }, { phrase: 'x', nuance: 'y' }] }),
    null
  )
})

import { generateStudyMaterial } from './materials.ts'

function fakeGeminiFetch(body: unknown, status = 200): typeof fetch {
  return (() =>
    Promise.resolve(
      new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
    )) as typeof fetch
}

const apiSuccess = {
  candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(good) }] } }],
}

Deno.test('generateStudyMaterial parses and validates a structured response', async () => {
  Deno.env.set('GEMINI_API_KEY', 'test-key')
  const m = await generateStudyMaterial('delight', fakeGeminiFetch(apiSuccess))
  assertEquals(m?.definition, good.definition)
})

Deno.test('generateStudyMaterial returns null on API error / blocked / invalid JSON / missing key', async () => {
  Deno.env.set('GEMINI_API_KEY', 'test-key')
  assertEquals(await generateStudyMaterial('delight', fakeGeminiFetch({}, 500)), null)
  assertEquals(
    await generateStudyMaterial('delight', fakeGeminiFetch({ candidates: [{ finishReason: 'SAFETY' }] })),
    null
  )
  assertEquals(
    await generateStudyMaterial('delight', fakeGeminiFetch({ promptFeedback: { blockReason: 'SAFETY' } })),
    null
  )
  assertEquals(
    await generateStudyMaterial(
      'delight',
      fakeGeminiFetch({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'not json' }] } }] })
    ),
    null
  )
  Deno.env.delete('GEMINI_API_KEY')
  assertEquals(await generateStudyMaterial('delight', fakeGeminiFetch(apiSuccess)), null)
})
