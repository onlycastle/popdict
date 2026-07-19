// Pure logic for the quiz edge function: due-word selection, Leitner
// transitions, question building, streaks, and the email template. No I/O so
// everything is testable with `deno test`.

import type { StudyMaterial } from './materials.ts'

export const LEITNER_INTERVAL_DAYS = [1, 3, 7, 14, 30]

export type SavedWordRow = {
  word: string
  normalized_word: string
  created_at: string
  definition?: string | null
  example?: string | null
  synonyms?: string[] | null
  antonyms?: string[] | null
}
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

export type SessionCard = {
  questionId: string
  kind: 'recognition' | 'cloze'
  prompt: string
  options: string[]
}

export type RevealedMaterial = {
  definition: string
  examples: string[]
  similar: { phrase: string; nuance: string }[]
}

export function revealedMaterialFromStudyMaterial(material: StudyMaterial): RevealedMaterial {
  return {
    definition: material.definition,
    examples: [...material.examples],
    similar: material.similar.map((item) => ({ ...item })),
  }
}

export function validateRevealedMaterial(value: unknown): RevealedMaterial | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const material = value as Partial<RevealedMaterial>
  if (typeof material.definition !== 'string' || !material.definition.trim()) return null
  if (!Array.isArray(material.examples) || !material.examples.every((item) => typeof item === 'string')) {
    return null
  }
  if (!Array.isArray(material.similar) || !material.similar.every((item) =>
    item && typeof item === 'object' &&
    typeof item.phrase === 'string' && typeof item.nuance === 'string'
  )) return null
  return {
    definition: material.definition,
    examples: [...material.examples],
    similar: material.similar.map((item) => ({ phrase: item.phrase, nuance: item.nuance })),
  }
}

/**
 * Client payload for an in-app quiz session. The correct index is deliberately
 * omitted: the app must not know the answer until it submits (same trust model
 * as the email capability links).
 */
export function buildSessionCards(entries: { question: QuestionWithId }[]): SessionCard[] {
  return entries.map((e) => ({
    questionId: e.question.id,
    kind: e.question.kind,
    prompt: e.question.prompt,
    options: e.question.options,
  }))
}

/** Extract a bearer token from an Authorization header; null if absent/blank/malformed. */
export function bearerToken(header: string | null): string | null {
  if (!header) return null
  const m = header.match(/^Bearer\s+(.+)$/i)
  if (!m) return null
  const token = m[1].trim()
  return token.length > 0 ? token : null
}

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

export type EligibleStudyEntry = {
  candidate: SavedWordRow
  material: StudyMaterial
  box: number
}

function distinctStrings(values: (string | null | undefined)[], exclude: string): string[] {
  const seen = new Set([exclude.trim().toLocaleLowerCase('en')])
  const result: string[] = []
  for (const raw of values) {
    const value = raw?.trim()
    const key = value?.toLocaleLowerCase('en')
    if (!value || !key || seen.has(key)) continue
    seen.add(key)
    result.push(value)
  }
  return result
}

/** Build deterministic study material from a saved snapshot and peer distractors. */
export function studyMaterialFromSnapshot(
  candidate: SavedWordRow,
  allSaved: SavedWordRow[]
): StudyMaterial | null {
  const definition = candidate.definition?.trim()
  if (!definition) return null
  const peers = [...allSaved]
    .filter((word) => word.normalized_word !== candidate.normalized_word)
    .sort((a, b) => a.normalized_word.localeCompare(b.normalized_word, 'en'))
  const recognition = distinctStrings(peers.map((word) => word.definition), definition).slice(0, 3)
  if (recognition.length < 3) return null
  const wordDistractors = distinctStrings(peers.map((word) => word.word), candidate.word).slice(0, 3)
  const example = candidate.example?.trim() ?? ''
  const related = [
    ...(candidate.synonyms ?? []).map((phrase) => ({ phrase, nuance: 'related word' })),
    ...(candidate.antonyms ?? []).map((phrase) => ({ phrase, nuance: 'opposite' })),
  ].filter((item, index, items) =>
    item.phrase.trim().length > 0 &&
    items.findIndex((other) => other.phrase.toLowerCase() === item.phrase.toLowerCase()) === index
  ).slice(0, 3)
  return {
    definition,
    examples: example ? [example] : [],
    similar: related,
    recognition_distractors: recognition,
    cloze: { sentence: example, distractors: wordDistractors },
  }
}

/**
 * Single source of truth for both `count` and `session`: select due words,
 * resolve snapshot material with the legacy cache as fallback, then cap at 8.
 */
export function eligibleStudyEntries(
  saved: SavedWordRow[],
  reviews: ReviewRow[],
  legacyMaterials: ReadonlyMap<string, StudyMaterial>,
  now: Date,
  limit = 8
): EligibleStudyEntry[] {
  const reviewByWord = new Map(reviews.map((review) => [review.normalized_word, review]))
  const due = selectDueWords(saved, reviews, now, Number.MAX_SAFE_INTEGER)
  const eligible: EligibleStudyEntry[] = []
  for (const candidate of due) {
    const material = studyMaterialFromSnapshot(candidate, saved)
      ?? legacyMaterials.get(candidate.normalized_word)
    if (!material) continue
    eligible.push({
      candidate,
      material,
      box: reviewByWord.get(candidate.normalized_word)?.box ?? 1,
    })
    if (eligible.length === limit) break
  }
  return eligible
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
  const recognitionDistractors = distinctStrings(
    material.recognition_distractors,
    material.definition
  ).slice(0, 3)
  if (recognitionDistractors.length < 3) {
    throw new Error('study material requires three distinct recognition distractors')
  }
  const clozeDistractors = distinctStrings(
    material.cloze.distractors,
    candidate.word
  ).slice(0, 3)
  const canCloze = clozeDistractors.length === 3 &&
    new RegExp(`\\b${escapeRegExp(candidate.word)}\\b`, 'i').test(material.cloze.sentence)
  if (box <= 2 || !canCloze) {
    const options = shuffle([material.definition, ...recognitionDistractors], rng)
    return {
      word: candidate.word,
      normalized_word: candidate.normalized_word,
      kind: 'recognition',
      prompt: candidate.word,
      options,
      correct_index: options.indexOf(material.definition),
    }
  }
  const options = shuffle([candidate.word, ...clozeDistractors], rng)
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

export function masteryBuckets(
  saved: SavedWordRow[],
  reviews: ReviewRow[]
): { new: number; learning: number; mastered: number } {
  const b = { new: 0, learning: 0, mastered: 0 }
  const reviewByWord = new Map(reviews.map((review) => [review.normalized_word, review]))
  for (const word of saved) {
    const review = reviewByWord.get(word.normalized_word)
    if (!review) b.new++
    else if (review.box <= 4) b.learning++
    else b.mastered++
  }
  return b
}

/** Brand-true digest email: study card then exercise per word. */
export function buildDigestEmailHtml(input: {
  entries: { question: QuestionWithId; material: StudyMaterial; box: number }[]
  streak: number
  buckets: { new: number; learning: number; mastered: number }
  linkBase: string
  unsubscribeUrl: string
}): string {
  const optionLink = (q: QuestionWithId, i: number) =>
    `<a href="${input.linkBase}/quiz/answer?q=${q.id}&amp;c=${i}" ` +
    `style="display:block;margin:6px 0;padding:10px 14px;border:1px solid #ece7de;` +
    `border-radius:8px;color:#1a1714;text-decoration:none;background:#ffffff;">` +
    `${escapeHtml(q.options[i])}</a>`

  const card = (m: StudyMaterial, q: QuestionWithId) =>
    `<p style="margin:0 0 8px;font-size:15px;color:#1a1714;">${escapeHtml(m.definition)}</p>` +
    m.examples
      .map((e) => `<p style="margin:0 0 6px;font-size:13px;font-style:italic;color:#6b6358;">${escapeHtml(e)}</p>`)
      .join('') +
    `<p style="margin:8px 0 0;font-size:12px;color:#6b6358;">` +
    m.similar.map((s) => `<strong>${escapeHtml(s.phrase)}</strong> — ${escapeHtml(s.nuance)}`).join(' · ') +
    `</p>`

  const exercise = (q: QuestionWithId) =>
    `<p style="margin:14px 0 6px;font-size:13px;color:#a85d0c;">` +
    (q.kind === 'cloze' ? `Fill the blank: ${escapeHtml(q.prompt)}` : `Which meaning matches <strong>${escapeHtml(q.prompt)}</strong>?`) +
    `</p>` +
    q.options.map((_, i) => optionLink(q, i)).join('')

  const wordBlock = (e: { question: QuestionWithId; material: StudyMaterial }, n: number) =>
    `<tr><td style="padding:18px 0;border-top:1px solid #ece7de;">` +
    `<p style="margin:0 0 2px;font-size:12px;color:#a85d0c;">Word ${n}</p>` +
    `<p style="margin:0 0 10px;font-size:20px;font-weight:600;color:#1a1714;">${escapeHtml(e.question.word)}</p>` +
    card(e.material, e.question) +
    exercise(e.question) +
    `</td></tr>`

  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" ` +
    `style="max-width:520px;margin:0 auto;background:#fcfbf9;padding:24px;` +
    `font-family:Georgia,'Times New Roman',serif;">` +
    `<tr><td style="padding-bottom:14px;">` +
    `<p style="margin:0;font-size:22px;color:#1a1714;">Pop<span style="color:#a85d0c;">Dict</span> study digest</p>` +
    `<p style="margin:4px 0 0;font-size:13px;color:#6b6358;">` +
    `streak ${input.streak} · ${input.buckets.new} new · ${input.buckets.learning} getting there · ${input.buckets.mastered} mastered</p>` +
    `</td></tr>` +
    input.entries.map((e, i) => wordBlock(e, i + 1)).join('') +
    `<tr><td style="padding-top:20px;">` +
    `<a href="popdict://quiz" style="display:inline-block;padding:11px 20px;background:#a85d0c;` +
    `color:#ffffff;border-radius:8px;text-decoration:none;font-size:14px;">Review in PopDict &rarr;</a>` +
    `</td></tr>` +
    `<tr><td style="padding-top:18px;border-top:1px solid #ece7de;">` +
    `<p style="margin:0;font-size:11px;color:#7a7160;">` +
    `You get this because study emails are on in PopDict. ` +
    `<a href="${input.unsubscribeUrl}" style="color:#a85d0c;">Unsubscribe</a></p>` +
    `</td></tr></table>`
  )
}
