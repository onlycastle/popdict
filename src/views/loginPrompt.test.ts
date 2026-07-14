import { describe, expect, it } from 'vitest'
import { shouldCloseTranslationLoginPrompt } from './loginPrompt'

describe('translation login prompt', () => {
  it('closes when OAuth completes for a translation request', () => {
    expect(shouldCloseTranslationLoginPrompt({
      open: true,
      purpose: 'translate',
      signedIn: true,
    })).toBe(true)
  })

  it('stays open before auth completes and leaves save orchestration alone', () => {
    expect(shouldCloseTranslationLoginPrompt({
      open: true,
      purpose: 'translate',
      signedIn: false,
    })).toBe(false)
    expect(shouldCloseTranslationLoginPrompt({
      open: true,
      purpose: 'save',
      signedIn: true,
    })).toBe(false)
  })
})
