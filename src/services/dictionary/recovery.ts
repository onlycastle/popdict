export function baseFormSuggestions(value: string): string[] {
  const word = value.trim().toLowerCase()
  if (!/^[a-z]+(?:['-][a-z]+)*$/.test(word)) return []
  const candidates: string[] = []
  const add = (candidate: string) => {
    if (candidate.length > 1 && candidate !== word && !candidates.includes(candidate)) {
      candidates.push(candidate)
    }
  }

  if (word.endsWith('ies') && word.length > 4) add(`${word.slice(0, -3)}y`)
  if (word.endsWith('ied') && word.length > 4) add(`${word.slice(0, -3)}y`)
  if (/(?:ches|shes|sses|xes|zes|oes)$/.test(word)) add(word.slice(0, -2))
  if (word.endsWith('ves') && word.length > 4) {
    add(`${word.slice(0, -3)}f`)
    add(`${word.slice(0, -3)}fe`)
  }
  if (word.endsWith('ing') && word.length > 5) {
    const stem = word.slice(0, -3)
    add(stem)
    add(`${stem}e`)
    if (/([b-df-hj-np-tv-z])\1$/.test(stem)) add(stem.slice(0, -1))
  }
  if (word.endsWith('ed') && word.length > 4) {
    const stem = word.slice(0, -2)
    add(stem)
    add(word.slice(0, -1))
    if (/([b-df-hj-np-tv-z])\1$/.test(stem)) add(stem.slice(0, -1))
  }
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) add(word.slice(0, -1))
  return candidates
}

export function mergeRecoverySuggestions(
  query: string,
  spellingSuggestions: string[],
  limit = 5
): string[] {
  const original = query.trim().toLowerCase()
  const seen = new Set([original])
  const merged: string[] = []
  for (const suggestion of [...spellingSuggestions, ...baseFormSuggestions(query)]) {
    const value = suggestion.normalize('NFKC').trim().toLowerCase()
    if (!value || seen.has(value) || !/^[a-z]+(?:['-][a-z]+)*$/.test(value)) continue
    seen.add(value)
    merged.push(value)
    if (merged.length === limit) break
  }
  return merged
}

export function wiktionarySearchUrl(query: string): string {
  const url = new URL('https://en.wiktionary.org/wiki/Special:Search')
  url.searchParams.set('search', query.trim())
  return url.toString()
}
