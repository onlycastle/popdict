import { describe, it, expect } from 'vitest'
import { eventToAccelerator, acceleratorToGlyphs, type KeyboardEventLike } from './accelerator'

function ev(over: Partial<KeyboardEventLike>): KeyboardEventLike {
  return { key: '', metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...over }
}

describe('eventToAccelerator', () => {
  it('builds CommandOrControl+Shift+<key> from cmd+shift', () => {
    expect(eventToAccelerator(ev({ key: 'd', metaKey: true, shiftKey: true }))).toEqual({
      status: 'ok',
      accelerator: 'CommandOrControl+Shift+D',
    })
  })

  it('treats ctrl the same as cmd (CommandOrControl)', () => {
    expect(eventToAccelerator(ev({ key: 'k', ctrlKey: true }))).toEqual({
      status: 'ok',
      accelerator: 'CommandOrControl+K',
    })
  })

  it('maps space to the Space token', () => {
    expect(eventToAccelerator(ev({ key: ' ', metaKey: true, shiftKey: true }))).toEqual({
      status: 'ok',
      accelerator: 'CommandOrControl+Shift+Space',
    })
  })

  it('normalizes arrow keys to Electron tokens (bug fix)', () => {
    expect(eventToAccelerator(ev({ key: 'ArrowUp', altKey: true }))).toEqual({
      status: 'ok',
      accelerator: 'Alt+Up',
    })
  })

  it('includes Alt when option is held', () => {
    expect(eventToAccelerator(ev({ key: 'e', altKey: true }))).toEqual({
      status: 'ok',
      accelerator: 'Alt+E',
    })
  })

  it('reports incomplete for a bare modifier', () => {
    expect(eventToAccelerator(ev({ key: 'Shift', shiftKey: true }))).toEqual({ status: 'incomplete' })
  })

  it('reports invalid when no cmd/ctrl/alt is present', () => {
    expect(eventToAccelerator(ev({ key: 'd', shiftKey: true }))).toEqual({
      status: 'invalid',
      message: 'Must include ⌘, ⌃, or ⌥',
    })
  })
})

describe('acceleratorToGlyphs', () => {
  it('renders the default hotkey as glyphs', () => {
    expect(acceleratorToGlyphs('CommandOrControl+Shift+Space')).toEqual(['⌘', '⇧', 'Space'])
  })

  it('renders arrow tokens as arrow glyphs', () => {
    expect(acceleratorToGlyphs('Alt+Up')).toEqual(['⌥', '↑'])
  })

  it('passes through unknown tokens unchanged', () => {
    expect(acceleratorToGlyphs('CommandOrControl+F5')).toEqual(['⌘', 'F5'])
  })
})
