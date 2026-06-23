import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLogger, safeStringify } from './logger'

describe('safeStringify', () => {
  it('returns empty string for no details', () => {
    expect(safeStringify()).toBe('')
    expect(safeStringify(undefined)).toBe('')
  })

  it('serializes plain details', () => {
    expect(safeStringify({ a: 1, b: 'x' })).toBe('{"a":1,"b":"x"}')
  })

  it('never throws on circular details', () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular
    expect(safeStringify(circular)).toBe('[unserializable details]')
  })
})

describe('createLogger', () => {
  afterEach(() => vi.restoreAllMocks())

  it('emits a tagged, trimmed line with no details', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    createLogger('Auth').event('signed in')
    expect(spy).toHaveBeenCalledWith('[Auth] signed in')
  })

  it('emits tag + name + serialized details', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    createLogger('SavedWords').event('save', { word: 'hi' })
    expect(spy).toHaveBeenCalledWith('[SavedWords] save {"word":"hi"}')
  })
})
