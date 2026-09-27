import { mkdtempSync, rmSync } from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { LocalLibrary } from './LocalLibrary'
import type { SavedWordDetails, SavedWordRecord, SavedWordTag } from '../../src/types/savedWords'

const dirs: string[] = []
const libraries: LocalLibrary[] = []
function open(file = ':memory:') {
  const library = new LocalLibrary(file, () => new Date('2026-09-17T12:00:00Z'))
  libraries.push(library)
  return library
}
const details = (word: string): SavedWordDetails => ({
  definition: `Definition of ${word}`, partOfSpeech: 'noun', example: null,
  synonyms: [], antonyms: [], translation: null, translationLanguage: null,
  sourceUrl: null, licenseName: null, licenseUrl: null, detailsUpdatedAt: '2026-09-17T12:00:00Z',
})
function save(library: LocalLibrary, word: string) {
  library.execute({ action: 'save', input: { word, source: 'local-dictionary', details: details(word) } })
}
afterEach(() => {
  libraries.splice(0).forEach((l) => l.close())
  dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true }))
})
describe('offline device library', () => {
  it('persists words, notes and tags across processes/reopening without an account', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'popdict-local-')); dirs.push(dir)
    const file = path.join(dir, 'library.sqlite')
    const first = open(file)
    save(first, 'Hello')
    const id = first.list()[0].id
    first.execute({ action: 'note', id, note: 'A documented-fake test note.' })
    const tag = first.execute({ action: 'tag', id, tag: ' Practice ' }) as SavedWordTag
    expect(first.execute({ action: 'tag', id, tag: 'practice' })).toEqual(tag)
    first.close(); libraries.pop()
    const second = open(file)
    expect(second.list()[0]).toMatchObject({ id, note: 'A documented-fake test note.', tags: [{ tag: 'Practice' }] })
    save(second, 'hello')
    expect(second.list()).toHaveLength(1)
    expect(second.list()[0].note).toBe('A documented-fake test note.')
  })
  it('does not advance twice when an answer is retried, including after another session', () => {
    const db = open()
    for (const word of ['hello', 'world', 'apple', 'book']) save(db, word)
    expect(db.dueCount()).toBe(4)
    const session = db.startSession()
    const other = db.startSession()
    const card = session.cards[0]
    const answer = db.answer(card.questionId, card.options.indexOf(`Definition of ${card.prompt}`))
    expect(answer.correct).toBe(true)
    const firstReview = db.list().find((w) => w.word === card.prompt)!.review
    expect(firstReview?.box).toBe(2)
    expect(db.answer(card.questionId, 0)).toMatchObject({ ...answer, alreadyAnswered: true })
    const duplicate = other.cards.find((c) => c.prompt === card.prompt)!
    expect(db.answer(duplicate.questionId, 0).alreadyAnswered).toBe(true)
    expect(db.list().find((w) => w.word === card.prompt)!.review).toEqual(firstReview)
    expect(db.dueCount()).toBe(3)
  })
  it('does not consume tomorrow’s streak increment when an old session is retried', () => {
    let day = '2026-09-17T12:00:00Z'
    const db = new LocalLibrary(':memory:', () => new Date(day))
    libraries.push(db)
    for (const word of ['hello', 'world', 'apple', 'book']) save(db, word)
    const first = db.startSession()
    const second = db.startSession()
    const card = first.cards[0]
    expect(db.answer(card.questionId, 0).streak).toBe(1)
    day = '2026-09-18T12:00:00Z'
    const stale = second.cards.find((c) => c.prompt === card.prompt)!
    expect(db.answer(stale.questionId, 0)).toMatchObject({ alreadyAnswered: true, streak: 1 })
    const fresh = first.cards.find((c) => c.prompt !== card.prompt)!
    expect(db.answer(fresh.questionId, 0).streak).toBe(2)
  })
  it('uses a cloze question for advanced words and keeps its definition for the study card', () => {
    const db = open()
    for (const word of ['world', 'apple', 'hello']) save(db, word)
    const record = { ...db.list()[0], id: 'fake-import', word: 'book', normalizedWord: 'book',
      details: { ...details('book'), example: 'I read a book.' },
      review: { box: 3, nextDueAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' } }
    db.execute({ action: 'import', words: [record] })
    const card = db.startSession().cards.find((c) => c.kind === 'cloze')!
    expect(card.prompt).toBe('I read a ____.')
    const result = db.answer(card.questionId, card.options.indexOf('book'))
    expect(result).toMatchObject({ correct: true, correctAnswer: 'book', material: { definition: 'Definition of book' } })
  })
  it('count and session agree on eligibility and the eight-card cap', () => {
    const db = open()
    save(db, 'one')
    expect(db.dueCount()).toBe(0)
    expect(db.startSession().cards).toHaveLength(0)
    for (let i = 0; i < 12; i++) save(db, `word ${i}`)
    expect(db.dueCount()).toBe(8)
    expect(db.startSession().cards).toHaveLength(8)
  })
  it('deleting a word invalidates outstanding review questions', () => {
    const db = open()
    for (const word of ['hello', 'world', 'apple', 'book']) save(db, word)
    const card = db.startSession().cards[0]
    db.execute({ action: 'delete', word: card.prompt })
    expect(() => db.answer(card.questionId, 0)).toThrow(/expired/)
  })
  it('validates writes and rolls back a partially invalid import', () => {
    const db = open()
    save(db, 'hello')
    const word = db.list()[0]
    expect(() => db.execute({ action: 'import', words: [
      { ...word, word: 'world', normalizedWord: 'world' },
      { ...word, word: '' },
    ] })).toThrow()
    expect(db.list()).toHaveLength(1)
    expect(() => db.execute({ action: 'note', id: word.id, note: 'x'.repeat(4001) })).toThrow()
    expect(() => db.answer('fake-question', -1)).toThrow()
  })
  it('additive import preserves local notes and review state', () => {
    const db = open()
    save(db, 'hello')
    const local = db.list()[0]
    db.execute({ action: 'note', id: local.id, note: 'local note' })
    const imported = db.execute({ action: 'import', words: [{ ...local, note: 'remote note' }, { ...local, word: 'world' }] }) as SavedWordRecord[]
    expect(imported).toHaveLength(2)
    expect(imported.find((w) => w.word === 'hello')!.note).toBe('local note')
  })
})
