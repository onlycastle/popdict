import { assert, assertEquals } from 'jsr:@std/assert@1'
import {
  bearerToken,
  blankWord,
  buildDigestEmailHtml,
  buildExercise,
  buildSessionCards,
  revealedMaterialFromStudyMaterial,
  validateRevealedMaterial,
  escapeHtml,
  eligibleStudyEntries,
  leitnerNext,
  masteryBuckets,
  nextStreak,
  selectDueWords,
  studyMaterialFromSnapshot,
} from './lib.ts'

function seededRng(seed = 1): () => number {
  let s = seed
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

const NOW = new Date('2026-07-10T00:00:00Z')

Deno.test('selectDueWords: never-reviewed words are due since save, ordered oldest-due first', () => {
  const saved = [
    { word: 'Apple', normalized_word: 'apple', created_at: '2026-07-01T00:00:00Z' },
    { word: 'Brave', normalized_word: 'brave', created_at: '2026-06-01T00:00:00Z' },
  ]
  const due = selectDueWords(saved, [], NOW)
  assertEquals(due.map((w) => w.normalized_word), ['brave', 'apple'])
})

Deno.test('selectDueWords: reviewed words use next_due_at and future ones are excluded', () => {
  const saved = [
    { word: 'apple', normalized_word: 'apple', created_at: '2026-07-01T00:00:00Z' },
    { word: 'brave', normalized_word: 'brave', created_at: '2026-06-01T00:00:00Z' },
  ]
  const reviews = [
    { normalized_word: 'apple', box: 3, next_due_at: '2026-08-01T00:00:00Z' }, // future
    { normalized_word: 'brave', box: 2, next_due_at: '2026-07-09T00:00:00Z' }, // past
  ]
  assertEquals(selectDueWords(saved, reviews, NOW).map((w) => w.normalized_word), ['brave'])
})

Deno.test('selectDueWords: caps at limit', () => {
  const saved = Array.from({ length: 12 }, (_, i) => ({
    word: `w${i}`, normalized_word: `w${i}`, created_at: '2026-06-01T00:00:00Z',
  }))
  assertEquals(selectDueWords(saved, [], NOW).length, 8)
})

Deno.test('leitnerNext: correct promotes (capped at 5), wrong resets to box 1', () => {
  assertEquals(leitnerNext(1, true), { box: 2, days: 3 })
  assertEquals(leitnerNext(5, true), { box: 5, days: 30 })
  assertEquals(leitnerNext(4, false), { box: 1, days: 1 })
})

Deno.test('nextStreak: continues on answered-previous or first quiz, resets on skipped', () => {
  assertEquals(nextStreak(null, 0), 1)   // first quiz ever
  assertEquals(nextStreak(true, 3), 4)   // previous quiz answered
  assertEquals(nextStreak(false, 3), 1)  // previous quiz ignored
})

Deno.test('revealed material is snapshotted and malformed snapshots fail closed', () => {
  const material = {
    definition: 'A financial institution.',
    examples: ['She visited the bank.'],
    similar: [{ phrase: 'lender', nuance: 'related word' }],
    recognition_distractors: ['a road', 'a meal', 'a fabric'],
    cloze: { sentence: 'She visited the bank.', distractors: ['shop', 'park', 'school'] },
  }
  const snapshot = revealedMaterialFromStudyMaterial(material)
  assertEquals(validateRevealedMaterial(snapshot), snapshot)
  assertEquals(validateRevealedMaterial({ ...snapshot, examples: [null] }), null)
})


Deno.test('box 1-2 builds a recognition question with the definition as the answer', () => {
  const material = {
    definition: 'great pleasure or satisfaction',
    examples: ['The garden was a delight.'],
    similar: [{ phrase: 'joy', nuance: 'stronger' }, { phrase: 'pleasure', nuance: 'broader' }],
    recognition_distractors: ['a sudden fear', 'a type of contract', 'a light source'],
    cloze: { sentence: 'Watching the sunset was a pure Delight for us.', distractors: ['burden', 'schedule', 'debate'] },
  }
  const saved = { word: 'Delight', normalized_word: 'delight', created_at: '2026-07-01T00:00:00Z' }
  const q = buildExercise(saved, material, 1, seededRng())
  assertEquals(q.kind, 'recognition')
  assertEquals(q.options.length, 4)
  assertEquals(q.options[q.correct_index], material.definition)
  assertEquals(q.prompt, 'Delight')
})

Deno.test('box 3+ builds a cloze with the word as the answer and a blanked prompt', () => {
  const material = {
    definition: 'great pleasure or satisfaction',
    examples: ['The garden was a delight.'],
    similar: [{ phrase: 'joy', nuance: 'stronger' }, { phrase: 'pleasure', nuance: 'broader' }],
    recognition_distractors: ['a sudden fear', 'a type of contract', 'a light source'],
    cloze: { sentence: 'Watching the sunset was a pure Delight for us.', distractors: ['burden', 'schedule', 'debate'] },
  }
  const saved = { word: 'Delight', normalized_word: 'delight', created_at: '2026-07-01T00:00:00Z' }
  const q = buildExercise(saved, material, 3, seededRng())
  assertEquals(q.kind, 'cloze')
  assertEquals(q.options[q.correct_index], 'Delight')
  assert(q.prompt.includes('____'))
  assert(!q.prompt.toLowerCase().includes('delight'))
})

Deno.test('snapshot material uses other enriched saved words as deterministic distractors', () => {
  const saved = [
    { word: 'Bank', normalized_word: 'bank', created_at: '2026-07-01T00:00:00Z', definition: 'A financial institution.', example: 'I visited the bank.', synonyms: ['lender'] },
    { word: 'Apple', normalized_word: 'apple', created_at: '', definition: 'A fruit.' },
    { word: 'Bus', normalized_word: 'bus', created_at: '', definition: 'A road vehicle.' },
    { word: 'Cloud', normalized_word: 'cloud', created_at: '', definition: 'Visible water droplets.' },
  ]
  const material = studyMaterialFromSnapshot(saved[0], saved)
  assertEquals(material?.recognition_distractors, ['A fruit.', 'A road vehicle.', 'Visible water droplets.'])
  assertEquals(material?.cloze.distractors, ['Apple', 'Bus', 'Cloud'])
})

Deno.test('box 3+ falls back to recognition when cloze is not whole-word valid', () => {
  const material = {
    definition: 'great pleasure', examples: ['A delightful day.'], similar: [],
    recognition_distractors: ['fear', 'contract', 'light'],
    cloze: { sentence: 'A delightful day.', distractors: ['fear', 'work', 'play'] },
  }
  const saved = { word: 'delight', normalized_word: 'delight', created_at: '' }
  assertEquals(buildExercise(saved, material, 4, seededRng()).kind, 'recognition')
})

Deno.test('count/session eligibility is shared, skips ineligible due words, and caps at eight', () => {
  const saved = Array.from({ length: 12 }, (_, index) => ({
    word: `Word${index}`,
    normalized_word: `word${index}`,
    created_at: '2026-06-01T00:00:00Z',
    definition: index === 0 ? null : `Definition ${index}`,
    example: `This uses Word${index}.`,
  }))
  const entries = eligibleStudyEntries(saved, [], new Map(), NOW)
  assertEquals(entries.length, 8)
  assert(!entries.some((entry) => entry.candidate.normalized_word === 'word0'))
})

Deno.test('blankWord blanks case-insensitively and only whole words', () => {
  assertEquals(blankWord('A Delight, delightful day of delight.', 'delight'), 'A ____, delightful day of ____.')
})

Deno.test('escapeHtml covers the five specials', () => {
  assertEquals(escapeHtml(`<a href="x">&'`), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;')
})

Deno.test('masteryBuckets matches Saved Words: unreviewed / boxes 1-4 / box 5', () => {
  const saved = [0, 1, 2, 3, 5].map((box) => ({
    word: `w${box}`,
    normalized_word: `w${box}`,
    created_at: '2026-07-01T00:00:00Z',
  }))
  const reviews = [1, 2, 3, 5].map((box) => ({
    normalized_word: `w${box}`,
    box,
    next_due_at: '2026-07-01T00:00:00Z',
  }))
  assertEquals(masteryBuckets(saved, reviews), { new: 1, learning: 3, mastered: 1 })
})

Deno.test('digest email renders card, exercise, escaped HTML, and answer links', () => {
  const material = {
    definition: 'great pleasure or satisfaction',
    examples: ['The garden was a delight.'],
    similar: [{ phrase: 'joy', nuance: 'stronger' }, { phrase: 'pleasure', nuance: 'broader' }],
    recognition_distractors: ['a sudden fear', 'a type of contract', 'a light source'],
    cloze: { sentence: 'Watching the sunset was a pure Delight for us.', distractors: ['burden', 'schedule', 'debate'] },
  }
  const saved = { word: 'Delight', normalized_word: 'delight', created_at: '2026-07-01T00:00:00Z' }
  const q = { ...buildExercise(saved, material, 1, seededRng()), id: '00000000-0000-4000-8000-000000000001' }
  const html = buildDigestEmailHtml({
    entries: [{ question: q, material, box: 1 }],
    streak: 3,
    buckets: { new: 1, learning: 0, mastered: 0 },
    linkBase: 'https://popdict.space',
    unsubscribeUrl: 'https://popdict.space/quiz/unsubscribe?u=x',
  })
  assert(html.includes(material.definition))
  assert(html.includes(material.examples[0]))
  assert(html.includes('joy'))
  assert(html.includes('/quiz/answer?q=00000000-0000-4000-8000-000000000001&amp;c=0'))
  assert(html.includes('Unsubscribe'))
  assert(html.includes('streak'))
})

Deno.test('digest email escapes HTML in generated content', () => {
  const material = {
    definition: 'great pleasure or satisfaction',
    examples: ['The garden was a delight.'],
    similar: [{ phrase: 'joy', nuance: 'stronger' }, { phrase: 'pleasure', nuance: 'broader' }],
    recognition_distractors: ['a sudden fear', 'a type of contract', 'a light source'],
    cloze: { sentence: 'Watching the sunset was a pure Delight for us.', distractors: ['burden', 'schedule', 'debate'] },
  }
  const saved = { word: 'Delight', normalized_word: 'delight', created_at: '2026-07-01T00:00:00Z' }
  const evil = { ...material, definition: '<script>alert(1)</script>' }
  const q = { ...buildExercise(saved, evil, 3, seededRng()), id: '00000000-0000-4000-8000-000000000002' }
  const html = buildDigestEmailHtml({
    entries: [{ question: q, material: evil, box: 3 }],
    streak: 0, buckets: { new: 0, learning: 1, mastered: 0 },
    linkBase: 'https://x', unsubscribeUrl: 'https://x/u',
  })
  assert(!html.includes('<script>'))
})

Deno.test('digest email includes the Review-in-app deep-link button', () => {
  const material = {
    definition: 'great pleasure or satisfaction',
    examples: ['The garden was a delight.'],
    similar: [{ phrase: 'joy', nuance: 'stronger' }, { phrase: 'pleasure', nuance: 'broader' }],
    recognition_distractors: ['a sudden fear', 'a type of contract', 'a light source'],
    cloze: { sentence: 'Watching the sunset was a pure Delight for us.', distractors: ['burden', 'schedule', 'debate'] },
  }
  const saved = { word: 'Delight', normalized_word: 'delight', created_at: '2026-07-01T00:00:00Z' }
  const q = { ...buildExercise(saved, material, 1, seededRng()), id: '00000000-0000-4000-8000-000000000003' }
  const html = buildDigestEmailHtml({
    entries: [{ question: q, material, box: 1 }],
    streak: 1, buckets: { new: 1, learning: 0, mastered: 0 },
    linkBase: 'https://popdict.space', unsubscribeUrl: 'https://popdict.space/quiz/unsubscribe?u=x',
  })
  assert(html.includes('popdict://quiz'))
  assert(html.includes('Review in PopDict'))
})

Deno.test('buildSessionCards maps questions and omits the answer index', () => {
  const cards = buildSessionCards([
    {
      question: {
        id: 'q1', word: 'Resilient', normalized_word: 'resilient',
        kind: 'recognition', prompt: 'Resilient',
        options: ['able to recover', 'fragile', 'listless', 'hostile'],
        correct_index: 0,
      },
    },
  ])
  assertEquals(cards, [{
    questionId: 'q1', kind: 'recognition', prompt: 'Resilient',
    options: ['able to recover', 'fragile', 'listless', 'hostile'],
  }])
  assert(!('correct_index' in cards[0]))
  assert(!('correctIndex' in cards[0]))
})

Deno.test('bearerToken extracts the token or returns null', () => {
  assertEquals(bearerToken('Bearer abc.def.ghi'), 'abc.def.ghi')
  assertEquals(bearerToken('bearer xyz'), 'xyz')
  assertEquals(bearerToken(null), null)
  assertEquals(bearerToken('Basic zzz'), null)
  assertEquals(bearerToken('Bearer    '), null)
})
