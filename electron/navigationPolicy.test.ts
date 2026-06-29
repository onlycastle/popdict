import { describe, expect, it } from 'vitest'
import { shouldAllowNavigation } from './navigationPolicy'

const PACKAGED = 'file:///Applications/PopDict.app/Contents/Resources/app/.vite/renderer/main_window/index.html'

describe('shouldAllowNavigation', () => {
  it('allows the dev server origin in development', () => {
    expect(
      shouldAllowNavigation('http://localhost:5173/#/settings', {
        devServerUrl: 'http://localhost:5173',
        packagedIndexFileUrl: PACKAGED,
      })
    ).toBe(true)
  })

  it('allows the exact packaged renderer file', () => {
    expect(shouldAllowNavigation(PACKAGED, { packagedIndexFileUrl: PACKAGED })).toBe(true)
    expect(
      shouldAllowNavigation(`${PACKAGED}#/settings`, { packagedIndexFileUrl: PACKAGED })
    ).toBe(true)
  })

  it('blocks arbitrary local files and remote origins', () => {
    expect(shouldAllowNavigation('file:///etc/passwd', { packagedIndexFileUrl: PACKAGED })).toBe(false)
    expect(shouldAllowNavigation('https://evil.example.com', { packagedIndexFileUrl: PACKAGED })).toBe(false)
    expect(shouldAllowNavigation('not a url', { packagedIndexFileUrl: PACKAGED })).toBe(false)
  })

  it('blocks a file: URL served from a different host (UNC/SMB vector)', () => {
    expect(
      shouldAllowNavigation('file://evil-host' + new URL(PACKAGED).pathname, {
        packagedIndexFileUrl: PACKAGED,
      })
    ).toBe(false)
  })

  it('blocks a dev-server URL that is a superset of the allowed origin (prefix attack)', () => {
    expect(
      shouldAllowNavigation('http://localhost:5173.evil.com/#/x', {
        devServerUrl: 'http://localhost:5173',
        packagedIndexFileUrl: PACKAGED,
      })
    ).toBe(false)
  })
})
