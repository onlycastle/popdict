import { afterEach, describe, expect, it, vi } from 'vitest'
import { dictionaryService } from './dictionary'
import { translationService } from './TranslationService'
import { savedWords } from './SavedWordsRepository'
import { QuizSessionService } from './QuizSessionService'

afterEach(() => vi.unstubAllGlobals())
describe('offline runtime routing', () => {
  it('routes lookup, translations, save and review to IPC while fetch is forbidden', async () => {
    const fetch = vi.fn(() => { throw new Error('No network') })
    const entries = [{ word: 'hello', meanings: [{ partOfSpeech: 'interjection', definitions: [{ definition: 'A greeting.' }] }] }]
    const bridge = {
      lookupLocalDictionary: vi.fn().mockResolvedValue(entries),
      lookupLocalTranslations: vi.fn().mockResolvedValue([{ text: '안녕하세요', senseLabel: null, rank: 1 }]),
      localLibrary: vi.fn().mockResolvedValue(null),
      localReviewCount: vi.fn().mockResolvedValue(4),
      localReviewStart: vi.fn().mockResolvedValue({ quizId: 'local-test', cards: [] }),
      localReviewAnswer: vi.fn().mockResolvedValue({ correct: true }),
    }
    vi.stubGlobal('fetch', fetch)
    vi.stubGlobal('window', { electronAPI: bridge })
    const response = await dictionaryService.search('hello')
    expect(response.provenance).toBe('local')
    expect(await translationService.lookup('hello', 'ko')).toHaveLength(1)
    await savedWords.save({ word: 'hello', source: response.source })
    const review = new QuizSessionService()
    expect(await review.dueCount()).toBe(4)
    await review.startSession()
    await review.answer('test-question', 0)
    expect(bridge.localLibrary).toHaveBeenCalledWith({ action: 'save', input: { word: 'hello', source: 'local-dictionary', details: undefined } })
    expect(fetch).not.toHaveBeenCalled()
  })
})
