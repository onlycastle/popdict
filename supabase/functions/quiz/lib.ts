// Pure logic for the quiz edge function: due-word selection, Leitner
// transitions, question building, streaks, and the email template. No I/O so
// everything is testable with `deno test`.

import type { StudyMaterial } from './materials.ts'

export const LEITNER_INTERVAL_DAYS = [1, 3, 7, 14, 30]

export type SavedWordRow = { word: string; normalized_word: string; created_at: string }
export type ReviewRow = { normalized_word: string; box: number; next_due_at: string }
export type Question = {
  word: string
  normalized_word: string
  kind: 'recognition' | 'cloze'
  prompt: string
  options: string[]
  correct_index: number
}
export type QuestionWithId = Question & { id: string }

/** Words due for review: no review row means due since the word was saved. */
export function selectDueWords(
  saved: SavedWordRow[],
  reviews: ReviewRow[],
  now: Date,
  limit = 8
): SavedWordRow[] {
  const reviewByWord = new Map(reviews.map((r) => [r.normalized_word, r]))
  return saved
    .map((s) => ({
      s,
      dueAt: new Date(reviewByWord.get(s.normalized_word)?.next_due_at ?? s.created_at).getTime(),
    }))
    .filter((x) => x.dueAt <= now.getTime())
    .sort((a, b) => a.dueAt - b.dueAt)
    .slice(0, limit)
    .map((x) => x.s)
}

export function leitnerNext(box: number, correct: boolean): { box: number; days: number } {
  const next = correct ? Math.min(box + 1, LEITNER_INTERVAL_DAYS.length) : 1
  return { box: next, days: LEITNER_INTERVAL_DAYS[next - 1] }
}

/** prevQuizAnswered is null when this is the user's first quiz. */
export function nextStreak(prevQuizAnswered: boolean | null, currentStreak: number): number {
  return prevQuizAnswered === false ? 1 : currentStreak + 1
}

export function shuffle<T>(items: T[], rng: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Blank whole-word, case-insensitive occurrences of `word` in a sentence. */
export function blankWord(sentence: string, word: string): string {
  return sentence.replace(new RegExp(`\\b${escapeRegExp(word)}\\b`, 'gi'), '____')
}

/**
 * The Leitner ladder: new-ish words (box 1-2) get recognition (pick the
 * meaning); words in box 3+ get cloze (pick the word for the blank).
 */
export function buildExercise(
  candidate: SavedWordRow,
  material: StudyMaterial,
  box: number,
  rng: () => number
): Question {
  if (box <= 2) {
    const options = shuffle([material.definition, ...material.recognition_distractors], rng)
    return {
      word: candidate.word,
      normalized_word: candidate.normalized_word,
      kind: 'recognition',
      prompt: candidate.word,
      options,
      correct_index: options.indexOf(material.definition),
    }
  }
  const options = shuffle([candidate.word, ...material.cloze.distractors], rng)
  return {
    word: candidate.word,
    normalized_word: candidate.normalized_word,
    kind: 'cloze',
    prompt: blankWord(material.cloze.sentence, candidate.word),
    options,
    correct_index: options.indexOf(candidate.word),
  }
}

export function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/** Minimal, brand-true email: paper background, ink text, amber accents. */
export function buildQuizEmailHtml(input: {
  questions: QuestionWithId[]
  linkBase: string
  unsubscribeUrl: string
}): string {
  const optionLink = (q: QuestionWithId, i: number) =>
    `<a href="${input.linkBase}/quiz/answer?q=${q.id}&amp;c=${i}" ` +
    `style="display:block;margin:6px 0;padding:10px 14px;border:1px solid #ece7de;` +
    `border-radius:8px;color:#1a1714;text-decoration:none;background:#ffffff;">` +
    `${escapeHtml(q.options[i])}</a>`

  const questionBlock = (q: QuestionWithId, n: number) =>
    `<tr><td style="padding:18px 0;border-top:1px solid #ece7de;">` +
    `<p style="margin:0 0 2px;font-size:12px;color:#a85d0c;">Question ${n}</p>` +
    `<p style="margin:0 0 10px;font-size:20px;font-weight:600;color:#1a1714;">` +
    `${escapeHtml(q.word)}</p>` +
    q.options.map((_, i) => optionLink(q, i)).join('') +
    `</td></tr>`

  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" ` +
    `style="max-width:520px;margin:0 auto;background:#fcfbf9;padding:24px;` +
    `font-family:Georgia,'Times New Roman',serif;">` +
    `<tr><td style="padding-bottom:14px;">` +
    `<p style="margin:0;font-size:22px;color:#1a1714;">Pop<span style="color:#a85d0c;">Dict</span> weekly quiz</p>` +
    `<p style="margin:4px 0 0;font-size:13px;color:#6b6358;">Pick the meaning of each word you saved.</p>` +
    `</td></tr>` +
    input.questions.map((q, i) => questionBlock(q, i + 1)).join('') +
    `<tr><td style="padding-top:18px;border-top:1px solid #ece7de;">` +
    `<p style="margin:0;font-size:11px;color:#7a7160;">` +
    `You get this because quiz emails are on in PopDict. ` +
    `<a href="${input.unsubscribeUrl}" style="color:#a85d0c;">Unsubscribe</a></p>` +
    `</td></tr></table>`
  )
}
