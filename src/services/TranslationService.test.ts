import { describe, expect, it, vi } from 'vitest'
import { TranslationLookupError, TranslationService } from './TranslationService'

function clientResponse(response: unknown) {
  const limit = vi.fn().mockResolvedValue(response)
  const order = vi.fn(() => ({ limit }))
  const secondEq = vi.fn(() => ({ order }))
  const firstEq = vi.fn(() => ({ eq: secondEq }))
  const select = vi.fn(() => ({ eq: firstEq }))
  const from = vi.fn(() => ({ select }))
  return { client: { from } as never, from, firstEq, secondEq, order, limit }
}

describe('TranslationService', () => {
  it('queries the read-only table by normalized canonical word and language', async () => {
    const mock = clientResponse({
      data: [
        { translation: '둑', sense_label: 'river edge', rank: 1 },
        { translation: '은행', sense_label: 'financial institution', rank: 2 },
      ],
      error: null,
    })

    await expect(new TranslationService(mock.client).lookup(' Bank ', 'ko')).resolves.toEqual([
      { text: '둑', senseLabel: 'river edge', rank: 1 },
      { text: '은행', senseLabel: 'financial institution', rank: 2 },
    ])
    expect(mock.from).toHaveBeenCalledWith('word_translations')
    expect(mock.firstEq).toHaveBeenCalledWith('normalized_word', 'bank')
    expect(mock.secondEq).toHaveBeenCalledWith('language_code', 'ko')
    expect(mock.order).toHaveBeenCalledWith('rank', { ascending: true })
    expect(mock.limit).toHaveBeenCalledWith(3)
  })

  it('uses an empty result as a silent English-only fallback', async () => {
    const mock = clientResponse({ data: [], error: null })
    await expect(new TranslationService(mock.client).lookup('apple', 'ja')).resolves.toEqual([])
  })

  it('does not issue a request for an unconfigured client or a phrase', async () => {
    await expect(new TranslationService(null).lookup('apple', 'ko')).resolves.toEqual([])
    const mock = clientResponse({ data: [], error: null })
    await expect(new TranslationService(mock.client).lookup('break the ice', 'ko')).resolves.toEqual([])
    expect(mock.from).not.toHaveBeenCalled()
  })

  it('turns database and network errors into a retryable lookup error', async () => {
    const mock = clientResponse({ data: null, error: { message: 'offline' } })
    await expect(new TranslationService(mock.client).lookup('apple', 'es'))
      .rejects.toBeInstanceOf(TranslationLookupError)
  })

  it('drops malformed rows instead of rendering unsafe data', async () => {
    const mock = clientResponse({
      data: [
        { translation: '', sense_label: null, rank: 1 },
        { translation: 'banco', sense_label: 3, rank: 2 },
        { translation: 'orilla', sense_label: null, rank: 4 },
      ],
      error: null,
    })
    await expect(new TranslationService(mock.client).lookup('bank', 'es')).resolves.toEqual([])
  })
})
