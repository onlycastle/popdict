import { describe, expect, it } from 'vitest'
import {
  beginSavedWordsLoad,
  completeSavedWordsLoad,
  failSavedWordsLoad,
  visibleSavedWords,
} from './savedWordsLoadState'

describe('saved words identity binding', () => {
  it('never exposes account A rows during a failed account B load', () => {
    const accountARows = [{ id: 'a-word', note: 'private note from A' }]
    const loadingA = beginSavedWordsLoad<typeof accountARows[number]>('account-a', 1)
    const loadedA = completeSavedWordsLoad(loadingA, {
      userId: 'account-a', requestId: 1, rows: accountARows,
    })
    expect(visibleSavedWords(loadedA, 'account-a')).toEqual(accountARows)
    expect(visibleSavedWords(loadedA, 'account-b')).toEqual([])

    const loadingB = beginSavedWordsLoad<typeof accountARows[number]>('account-b', 2)
    expect(visibleSavedWords(loadingB, 'account-b')).toEqual([])
    const failedB = failSavedWordsLoad(loadingB, {
      userId: 'account-b', requestId: 2, error: 'network failed',
    })
    expect(visibleSavedWords(failedB, 'account-b')).toEqual([])
    expect(failedB.error).toBe('network failed')

    // A late response from the previous identity cannot replace B's state.
    expect(completeSavedWordsLoad(failedB, {
      userId: 'account-a', requestId: 1, rows: accountARows,
    })).toBe(failedB)
  })
})
