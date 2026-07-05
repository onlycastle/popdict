// Country display helpers for the download stats dashboard.
// Codes come from download_events.country (x-vercel-ip-country), keyed
// 'unknown' when the header was absent.

export type CountryRow = { code: string; name: string; flag: string; count: number }

const UNKNOWN_KEY = 'unknown'
const REGION_NAMES = new Intl.DisplayNames(['en'], { type: 'region' })

// Light → deep amber, harmonized with the page accent #d9862f.
const SHADES = ['#f6d9b8', '#efb97f', '#e39a4e', '#d9862f']
const NEUTRAL = '#eee8df'

// 'KR' → 🇰🇷 via Unicode regional-indicator arithmetic; '' for non-alpha-2.
export function flagEmoji(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return ''
  const base = 0x1f1e6
  return String.fromCodePoint(base + code.charCodeAt(0) - 65, base + code.charCodeAt(1) - 65)
}

export function countryDisplayName(code: string): string {
  if (code === UNKNOWN_KEY) return 'Unknown'
  try {
    return REGION_NAMES.of(code) ?? code
  } catch {
    return code // syntactically invalid region code: show it raw (escaped at render)
  }
}

// Sorted for display: count desc, code asc tiebreak, 'unknown' pinned last.
export function rankCountries(byCountry: Record<string, number>): CountryRow[] {
  return Object.entries(byCountry)
    .filter(([, count]) => count > 0)
    .sort((a, b) => {
      if (a[0] === UNKNOWN_KEY) return 1
      if (b[0] === UNKNOWN_KEY) return -1
      return b[1] - a[1] || a[0].localeCompare(b[0])
    })
    .map(([code, count]) => ({
      code,
      name: countryDisplayName(code),
      flag: code === UNKNOWN_KEY ? '—' : flagEmoji(code) || '—',
      count,
    }))
}

// Quantize a count into an amber shade relative to the busiest country.
export function countryShade(count: number, max: number): string {
  if (count <= 0 || max <= 0) return NEUTRAL
  const index = Math.min(SHADES.length - 1, Math.floor((count / max) * SHADES.length))
  return SHADES[index]
}
