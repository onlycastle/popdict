import { assert, assertEquals } from 'jsr:@std/assert@1'
import {
  blankWord,
  buildExercise,
  escapeHtml,
  leitnerNext,
  nextStreak,
  selectDueWords,
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

Deno.test('blankWord blanks case-insensitively and only whole words', () => {
  assertEquals(blankWord('A Delight, delightful day of delight.', 'delight'), 'A ____, delightful day of ____.')
})

Deno.test('escapeHtml covers the five specials', () => {
  assertEquals(escapeHtml(`<a href="x">&'`), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;')
})
