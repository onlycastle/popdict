import { assert, assertEquals } from 'jsr:@std/assert@1'
import {
  buildQuestions,
  buildQuizEmailHtml,
  escapeHtml,
  leitnerNext,
  nextStreak,
  pickDistinct,
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

Deno.test('pickDistinct returns unique values even from a pool with duplicates', () => {
  const picked = pickDistinct(['a', 'a', 'b', 'c', 'b', 'd'], 3, seededRng())
  assertEquals(new Set(picked).size, 3)
})

Deno.test('buildQuestions: 4 shuffled options containing the first ko translation, correct_index accurate', () => {
  const candidates = [{ word: 'Apple', normalized_word: 'apple', created_at: '2026-06-01T00:00:00Z' }]
  const translations = new Map([['apple', ['사과', '애플']]])
  const pool = ['바나나', '포도', '수박', '사과', '애플'] // own translations must be excluded as distractors
  const [q] = buildQuestions(candidates, translations, pool, seededRng())
  assertEquals(q.options.length, 4)
  assertEquals(q.options[q.correct_index], '사과')
  assert(!q.options.filter((_, i) => i !== q.correct_index).includes('사과'))
  assert(!q.options.includes('애플') || q.options[q.correct_index] === '애플')
})

Deno.test('buildQuestions: skips words without translations or with too few distractors', () => {
  const candidates = [
    { word: 'apple', normalized_word: 'apple', created_at: '2026-06-01T00:00:00Z' },
    { word: 'zzz', normalized_word: 'zzz', created_at: '2026-06-01T00:00:00Z' },
  ]
  const translations = new Map([['apple', ['사과']]])
  assertEquals(buildQuestions(candidates, translations, ['바나나', '포도', '수박'], seededRng()).length, 1)
  assertEquals(buildQuestions(candidates, translations, ['바나나'], seededRng()).length, 0)
})

Deno.test('escapeHtml covers the five specials', () => {
  assertEquals(escapeHtml(`<a href="x">&'`), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;')
})

Deno.test('buildQuizEmailHtml: one answer link per option plus unsubscribe, content escaped', () => {
  const html = buildQuizEmailHtml({
    questions: [{
      id: 'q-1', word: '<b>tricky</b>', normalized_word: 'tricky',
      options: ['하나', '둘', '셋', '넷'], correct_index: 0,
    }],
    linkBase: 'https://popdict.space',
    unsubscribeUrl: 'https://popdict.space/quiz/unsubscribe?u=tok',
  })
  for (const c of [0, 1, 2, 3]) assert(html.includes(`https://popdict.space/quiz/answer?q=q-1&amp;c=${c}`))
  assert(html.includes('https://popdict.space/quiz/unsubscribe?u=tok'))
  assert(html.includes('&lt;b&gt;tricky&lt;/b&gt;'))
  assert(!html.includes('<b>tricky</b>'))
})
