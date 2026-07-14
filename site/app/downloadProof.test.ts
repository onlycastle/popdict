import { describe, expect, it } from 'vitest'
import { countDmgDownloads, formatDownloadProof } from './downloadProof'

describe('countDmgDownloads', () => {
  it('sums dmg assets across releases without counting zip assets', () => {
    expect(countDmgDownloads([
      {
        assets: [
          { name: 'PopDict-1.0.0.dmg', download_count: 42 },
          { name: 'PopDict-1.0.0-mac.zip', download_count: 9 },
        ],
      },
      { assets: [{ name: 'PopDict-1.1.0.DMG', download_count: 31 }] },
    ])).toBe(73)
  })

  it('ignores malformed payloads and invalid counts', () => {
    expect(countDmgDownloads(null)).toBe(0)
    expect(countDmgDownloads([
      { assets: null },
      { assets: [{ name: 'PopDict.dmg', download_count: -1 }] },
      { assets: [{ name: 'PopDict.dmg', download_count: '12' }] },
    ])).toBe(0)
  })
})

describe('formatDownloadProof', () => {
  it('shows an exact count below the first social-proof milestone', () => {
    expect(formatDownloadProof(74)).toBe('74 macOS downloads')
  })

  it('uses stable hundred-download milestones after 100', () => {
    expect(formatDownloadProof(100)).toBe('100+ macOS downloads')
    expect(formatDownloadProof(278)).toBe('200+ macOS downloads')
    expect(formatDownloadProof(1_278)).toBe('1,200+ macOS downloads')
  })

  it('omits empty or invalid counts', () => {
    expect(formatDownloadProof(0)).toBeNull()
    expect(formatDownloadProof(Number.NaN)).toBeNull()
  })
})
