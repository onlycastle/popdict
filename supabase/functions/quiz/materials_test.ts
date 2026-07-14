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

Deno.test('rejects fewer than 2 similar entries or a missing nuance', () => {
  assertEquals(validateStudyMaterial('delight', { ...good, similar: [good.similar[0]] }), null)
  assertEquals(
    validateStudyMaterial('delight', { ...good, similar: [{ phrase: 'joy' }, { phrase: 'x', nuance: 'y' }] }),
    null
  )
})

// The LLM does not reliably honor exact counts, so the validator accepts a
// generous number and normalizes down rather than dropping the whole card.
Deno.test('normalizes over-long arrays down to canonical counts', () => {
  const over = {
    ...good,
    examples: ['one.', 'two.', 'three.'],
    similar: [...good.similar, { phrase: 'bliss', nuance: 'euphoric' }, { phrase: 'glee', nuance: 'childlike' }],
    recognition_distractors: ['a', 'b', 'c', 'd'],
    cloze: { ...good.cloze, distractors: ['w', 'x', 'y', 'z'] },
  }
  const m = validateStudyMaterial('delight', over)
  assertEquals(m?.examples.length, 2)
  assertEquals(m?.similar.length, 3)
  assertEquals(m?.recognition_distractors.length, 3)
  assertEquals(m?.cloze.distractors.length, 3)
  // Kept items are the FIRST n, in order.
  assertEquals(m?.examples, ['one.', 'two.'])
  assertEquals(m?.recognition_distractors, ['a', 'b', 'c'])
})
