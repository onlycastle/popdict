import { describe, it, expect } from 'vitest'
import { resolveRoute } from './resolveRoute'

describe('resolveRoute', () => {
  it('routes the packaged loadFile hash form (no leading slash)', () => {
    // Regression: packaged builds load `loadFile(path, { hash: 'settings' })`,
    // which yields `#settings`. This must still reach the right view.
    expect(resolveRoute('#settings')).toBe('settings')
    expect(resolveRoute('#saved')).toBe('saved')
    expect(resolveRoute('#onboarding')).toBe('onboarding')
  })

  it('routes the dev-server hash form (leading slash)', () => {
    expect(resolveRoute('#/settings')).toBe('settings')
    expect(resolveRoute('#/saved')).toBe('saved')
    expect(resolveRoute('#/onboarding')).toBe('onboarding')
  })

  it('falls back to search for the empty hash and unknown routes', () => {
    expect(resolveRoute('')).toBe('search')
    expect(resolveRoute('#')).toBe('search')
    expect(resolveRoute('#/')).toBe('search')
    expect(resolveRoute('#nope')).toBe('search')
  })
})
