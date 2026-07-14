import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { createStore, DEFAULT_HOTKEY, addToHistory, removeFromHistory } from './store'

let dir: string
let file: string

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'popdict-'))
  file = path.join(dir, 'config.json')
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('addToHistory', () => {
  it('puts newest first and dedupes case-insensitively', () => {
    let h: string[] = []
    h = addToHistory(h, 'apple')
    h = addToHistory(h, 'Banana')
    h = addToHistory(h, 'APPLE')
    expect(h).toEqual(['APPLE', 'Banana'])
  })
  it('ignores blank words', () => {
    expect(addToHistory(['apple'], '   ')).toEqual(['apple'])
  })
  it('caps the list length', () => {
    let h: string[] = []
    for (let i = 0; i < 20; i++) h = addToHistory(h, `w${i}`, 12)
    expect(h.length).toBe(12)
    expect(h[0]).toBe('w19')
  })
})

describe('removeFromHistory', () => {
  it('removes a matching word case-insensitively', () => {
    expect(removeFromHistory(['apple', 'Banana', 'cherry'], 'banana')).toEqual(['apple', 'cherry'])
  })
  it('preserves order of the remaining words', () => {
    expect(removeFromHistory(['a', 'b', 'c'], 'b')).toEqual(['a', 'c'])
  })
  it('is a no-op for a blank or absent word', () => {
    expect(removeFromHistory(['apple'], '   ')).toEqual(['apple'])
    expect(removeFromHistory(['apple'], 'pear')).toEqual(['apple'])
  })
})

describe('createStore', () => {
  it('returns defaults when no file exists', () => {
    const store = createStore(file)
    const cfg = store.getConfig()
    expect(cfg.hotkey).toBe(DEFAULT_HOTKEY)
    expect(cfg.history).toEqual([])
    expect(cfg.translationLanguage).toBeNull()
  })
  it('persists patched values across instances', () => {
    createStore(file).patch({ onboardingDone: true, hotkey: 'CommandOrControl+Shift+D' })
    const cfg = createStore(file).getConfig()
    expect(cfg.onboardingDone).toBe(true)
    expect(cfg.hotkey).toBe('CommandOrControl+Shift+D')
  })
  it('addHistory persists and dedupes', () => {
    const store = createStore(file)
    store.addHistory('apple')
    const list = store.addHistory('apple')
    expect(list).toEqual(['apple'])
  })
  it('removeHistory persists removal and returns the new list', () => {
    const store = createStore(file)
    store.addHistory('apple')
    store.addHistory('banana')
    const list = store.removeHistory('APPLE')
    expect(list).toEqual(['banana'])
    expect(createStore(file).getConfig().history).toEqual(['banana'])
  })
  it('clearHistory empties the list', () => {
    const store = createStore(file)
    store.addHistory('apple')
    store.clearHistory()
    expect(store.getConfig().history).toEqual([])
  })
  it('recovers from a corrupt file by returning defaults', () => {
    fs.writeFileSync(file, '{ not json')
    expect(createStore(file).getConfig().hotkey).toBe(DEFAULT_HOTKEY)
  })
})

describe('translationLanguage', () => {
  it('persists every supported language and rejects unknown stored values', () => {
    for (const language of ['ko', 'ja', 'zh-Hans', 'es', 'pt-BR'] as const) {
      createStore(file).patch({ translationLanguage: language })
      expect(createStore(file).getConfig().translationLanguage).toBe(language)
    }
    fs.writeFileSync(file, JSON.stringify({ translationLanguage: 'xx' }))
    expect(createStore(file).getConfig().translationLanguage).toBeNull()
  })

  it('rejects an unsupported value supplied through a settings patch', () => {
    const result = createStore(file).patch({ translationLanguage: 'xx' as never })
    expect(result.translationLanguage).toBeNull()
    expect(createStore(file).getConfig().translationLanguage).toBeNull()
  })
})

describe('signInNudgeDismissedAt', () => {
  it('defaults to null on fresh and legacy config files', () => {
    expect(createStore(file).getConfig().signInNudgeDismissedAt).toBeNull()
    fs.writeFileSync(file, JSON.stringify({ hotkey: 'X', onboardingDone: true, history: ['a'] }))
    expect(createStore(file).getConfig().signInNudgeDismissedAt).toBeNull()
  })
  it('persists a dismissal timestamp across instances', () => {
    createStore(file).patch({ signInNudgeDismissedAt: 1752345600000 })
    expect(createStore(file).getConfig().signInNudgeDismissedAt).toBe(1752345600000)
  })
  it('coerces an invalid stored value to null', () => {
    fs.writeFileSync(file, JSON.stringify({ signInNudgeDismissedAt: 'yesterday' }))
    expect(createStore(file).getConfig().signInNudgeDismissedAt).toBeNull()
  })
})
