import { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import * as path from 'node:path'
import { normalizeLookup, type LocalLibraryCommand, type LocalLibraryResult, type LocalWordInput } from '../../shared/local'
import type { SavedWordDetails, SavedWordRecord, SavedWordTag } from '../../src/types/savedWords'
import { isReviewDue, masteryForBox } from '../../src/services/savedWordFilters'
import type { AnswerResult, QuizSession } from '../../src/services/QuizSessionService'

const INTERVALS = [1, 3, 7, 14, 30]
const SOURCES = ['local-dictionary', 'free-dictionary', 'kaikki-phrases', 'combined']
function text(value: unknown, max: number, label: string, empty = false): string {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim())) throw new Error(`Invalid ${label}.`)
  return value
}
function details(value: SavedWordDetails | null | undefined): SavedWordDetails | null {
  if (value == null) return null
  if (typeof value !== 'object' || Array.isArray(value) || JSON.stringify(value).length > 100_000) throw new Error('Invalid word details.')
  if (value.definition !== null) text(value.definition, 20_000, 'definition')
  for (const key of ['synonyms', 'antonyms'] as const) {
    if (!Array.isArray(value[key]) || value[key].length > 100 || value[key].some((v) => typeof v !== 'string' || v.length > 300)) throw new Error('Invalid related words.')
  }
  return value
}

/** Main-process-only SQLite owner: transactions serialize writes across windows. */
export class LocalLibrary {
  private db: DatabaseSync
  constructor(file: string, private now: () => Date = () => new Date()) {
    if (file !== ':memory:') mkdirSync(path.dirname(file), { recursive: true })
    this.db = new DatabaseSync(file)
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS words (key TEXT PRIMARY KEY, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS questions (id TEXT PRIMARY KEY, word_key TEXT NOT NULL, payload TEXT NOT NULL, result TEXT);
      CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      PRAGMA user_version=1;`)
  }
  close(): void { this.db.close() }
  private transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE')
    try { const value = fn(); this.db.exec('COMMIT'); return value } catch (error) { this.db.exec('ROLLBACK'); throw error }
  }
  list(): SavedWordRecord[] {
    return (this.db.prepare('SELECT payload FROM words ORDER BY key').all() as { payload: string }[])
      .map(({ payload }) => {
        const row = JSON.parse(payload) as SavedWordRecord
        return { ...row, mastery: masteryForBox(row.review?.box ?? null), due: isReviewDue(row.review?.nextDueAt ?? null, this.now()) }
      }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.normalizedWord.localeCompare(b.normalizedWord))
  }
  private byKey(key: string): SavedWordRecord | undefined {
    const row = this.db.prepare('SELECT payload FROM words WHERE key=?').get(key) as { payload: string } | undefined
    return row ? JSON.parse(row.payload) : undefined
  }
  private write(row: SavedWordRecord): void {
    this.db.prepare('INSERT INTO words VALUES (?,?) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload')
      .run(row.normalizedWord, JSON.stringify(row))
  }
  private byId(id: string): SavedWordRecord {
    text(id, 100, 'word ID')
    const row = this.list().find((w) => w.id === id)
    if (!row) throw new Error('This word is no longer saved.')
    return row
  }
  private save(input: LocalWordInput): void {
    const word = text(input.word, 160, 'word').trim()
    if (!SOURCES.includes(input.source)) throw new Error('Invalid dictionary source.')
    const key = normalizeLookup(word)
    const current = this.byKey(key)
    const timestamp = this.now().toISOString()
    this.write({
      id: current?.id ?? randomUUID(), word, normalizedWord: key, source: input.source,
      createdAt: current?.createdAt ?? timestamp, updatedAt: timestamp,
      details: details(input.details) ?? current?.details ?? null,
      note: current?.note ?? '', tags: current?.tags ?? [], review: current?.review ?? null,
      mastery: current?.mastery ?? 'new', due: current?.due ?? true,
    })
  }
  execute(command: LocalLibraryCommand): LocalLibraryResult {
    if (!command || typeof command !== 'object') throw new Error('Invalid library request.')
    return this.transaction(() => {
      switch (command.action) {
        case 'list': return this.list()
        case 'save': this.save(command.input); return null
        case 'delete': {
          const key = normalizeLookup(text(command.word, 160, 'word'))
          this.db.prepare('DELETE FROM words WHERE key=?').run(key)
          this.db.prepare('DELETE FROM questions WHERE word_key=?').run(key)
          return null
        }
        case 'note': {
          const row = this.byId(command.id)
          row.note = text(command.note, 4000, 'note', true)
          row.updatedAt = this.now().toISOString()
          this.write(row); return null
        }
        case 'details': {
          const row = this.byId(command.id)
          row.details = details(command.details)
          row.updatedAt = this.now().toISOString()
          this.write(row); return null
        }
        case 'tag': {
          const row = this.byId(command.id)
          const tag = text(command.tag, 200, 'tag').replace(/\s+/g, ' ').trim()
          text(tag, 40, 'tag')
          const existing = row.tags.find((t) => t.normalizedTag === tag.toLowerCase())
          if (existing) return existing
          const value: SavedWordTag = { id: randomUUID(), savedWordId: row.id, tag, normalizedTag: tag.toLowerCase(), createdAt: this.now().toISOString() }
          row.tags.push(value); row.updatedAt = this.now().toISOString(); this.write(row)
          return value
        }
        case 'delete-tag': {
          const id = text(command.id, 100, 'tag ID')
          for (const row of this.list()) if (row.tags.some((t) => t.id === id)) {
            row.tags = row.tags.filter((t) => t.id !== id)
            row.updatedAt = this.now().toISOString(); this.write(row)
          }
          return null
        }
        case 'import': {
          if (!Array.isArray(command.words) || command.words.length > 100_000) throw new Error('Too many imported words.')
          for (const incoming of command.words) {
            const key = normalizeLookup(text(incoming.word, 160, 'word'))
            const current = this.byKey(key)
            // Import is additive. Existing local edits and review progress always win.
            if (current) continue
            this.save(incoming)
            const row = this.byKey(key)!
            row.note = text(incoming.note ?? '', 4000, 'note', true)
            row.tags = (incoming.tags ?? []).slice(0, 100).map((tag) => ({
              id: randomUUID(), savedWordId: row.id, tag: text(tag.tag, 40, 'tag'),
              normalizedTag: tag.tag.trim().toLowerCase(), createdAt: this.now().toISOString(),
            }))
            if (incoming.review && Number.isInteger(incoming.review.box) && incoming.review.box >= 1 && incoming.review.box <= 5 && Number.isFinite(Date.parse(incoming.review.nextDueAt))) row.review = incoming.review
            this.write(row)
          }
          return this.list()
        }
        default: throw new Error('Unknown library request.')
      }
    })
  }
  private eligible(): SavedWordRecord[] {
    const all = this.list().filter((w) => w.details?.definition?.trim())
    if (new Set(all.map((word) => word.details!.definition)).size < 4) return []
    return all.filter((w) => w.due)
      .sort((a, b) => (a.review?.nextDueAt ?? a.createdAt).localeCompare(b.review?.nextDueAt ?? b.createdAt)).slice(0, 8)
  }
  dueCount(): number { return this.eligible().length }
  startSession(): QuizSession {
    return this.transaction(() => {
      const all = this.list()
      const cards = this.eligible().map((word) => {
        const definition = word.details!.definition!
        const distractors = [...new Set(all.filter((p) => p.id !== word.id).map((p) => p.details?.definition).filter((d): d is string => !!d && d !== definition))].slice(0, 3)
        const wordAlternatives = [...new Set(all.filter((p) => p.id !== word.id).map((p) => p.word))].slice(0, 3)
        const escaped = word.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const pattern = new RegExp(`\\b${escaped}\\b`, 'gi')
        const example = word.details?.example ?? ''
        const cloze = (word.review?.box ?? 1) >= 3 && wordAlternatives.length === 3 && pattern.test(example)
        const answerText = cloze ? word.word : definition
        const options = [answerText, ...(cloze ? wordAlternatives : distractors)]
        for (let i = options.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1)); [options[i], options[j]] = [options[j], options[i]]
        }
        const questionId = randomUUID()
        const card = { questionId, kind: cloze ? 'cloze' as const : 'recognition' as const, prompt: cloze ? example.replace(pattern, '____') : word.word, options }
        this.db.prepare('INSERT INTO questions VALUES (?,?,?,NULL)').run(questionId, word.normalizedWord, JSON.stringify({ card, definition, answerText, details: word.details, reviewUpdatedAt: word.review?.updatedAt ?? null }))
        return card
      })
      // Retain recent answers for idempotent retries without an unbounded history.
      this.db.exec('DELETE FROM questions WHERE rowid NOT IN (SELECT rowid FROM questions ORDER BY rowid DESC LIMIT 1000)')
      return { quizId: cards.length ? randomUUID() : null, cards }
    })
  }
  answer(id: string, choice: number): AnswerResult {
    text(id, 100, 'question ID')
    if (!Number.isInteger(choice) || choice < 0 || choice > 3) throw new Error('Invalid answer.')
    return this.transaction(() => {
      const row = this.db.prepare('SELECT word_key, payload, result FROM questions WHERE id=?').get(id) as { word_key: string; payload: string; result: string | null } | undefined
      if (!row) throw new Error('This review has expired. Start a new review.')
      if (row.result) return { ...JSON.parse(row.result), alreadyAnswered: true }
      const question = JSON.parse(row.payload)
      const word = this.list().find((w) => w.normalizedWord === row.word_key)
      if (!word) throw new Error('This word is no longer saved.')
      const correct = question.card.options[choice] === question.answerText
      const box = correct ? Math.min((word.review?.box ?? 1) + 1, 5) : 1
      const now = this.now()
      const superseded = (word.review?.updatedAt ?? null) !== question.reviewUpdatedAt
      if (!superseded) word.review = { box, nextDueAt: new Date(now.getTime() + INTERVALS[box - 1] * 86_400_000).toISOString(), updatedAt: now.toISOString() }
      this.write(word)
      const previous = this.db.prepare("SELECT value FROM state WHERE key='review-days'").get() as { value: string } | undefined
      const today = now.toISOString().slice(0, 10)
      const history = previous ? JSON.parse(previous.value) : { day: '', streak: 0 }
      const yesterday = new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10)
      const streak = superseded || history.day === today ? history.streak : history.day === yesterday ? history.streak + 1 : 1
      if (!superseded) this.db.prepare("INSERT INTO state VALUES ('review-days',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify({ day: today, streak }))
      const result: AnswerResult = { word: word.word, correct, correctAnswer: question.answerText, streak, alreadyAnswered: superseded,
        material: { definition: question.definition, examples: question.details.example ? [question.details.example] : [], similar: (question.details.synonyms ?? []).slice(0, 3).map((phrase: string) => ({ phrase, nuance: 'related word' })) } }
      this.db.prepare('UPDATE questions SET result=? WHERE id=?').run(JSON.stringify(result), id)
      return result
    })
  }
}
