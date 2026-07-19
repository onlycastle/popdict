export function baseFormSuggestions(value: string): string[] {
  const word = value.trim().toLowerCase()
  if (!/^[a-z]+(?:['-][a-z]+)*$/.test(word)) return []
  const candidates: string[] = []
  const add = (candidate: string) => {
    if (candidate.length > 1 && candidate !== word && !candidates.includes(candidate)) {
      candidates.push(candidate)
    }
  }

  const likelySilentEStem = (stem: string) =>
    /(?:ak|ik|op|typ|at|iz|iv|ov|us|ur|os|ag|ud|rit|clos|creat|giv|tak|mak|mov|driv)$/.test(stem)

  if (word.endsWith('ies') && word.length > 4) {
    add(`${word.slice(0, -3)}y`)
  } else if (word.endsWith('ied') && word.length > 4) {
    add(`${word.slice(0, -3)}y`)
  } else if (/(?:ches|shes|sses|xes|zes|oes)$/.test(word)) {
    add(word.slice(0, -2))
  } else if (word.endsWith('ves') && word.length > 4) {
    add(`${word.slice(0, -3)}f`)
    add(`${word.slice(0, -3)}fe`)
  } else if (word.endsWith('ing') && word.length > 5) {
    const stem = word.slice(0, -3)
    if (/([b-df-hj-np-tv-z])\1$/.test(stem)) add(stem.slice(0, -1))
    else if (likelySilentEStem(stem)) add(`${stem}e`)
    else add(stem)
  } else if (word.endsWith('ed') && word.length > 4) {
    const stem = word.slice(0, -2)
    if (/([b-df-hj-np-tv-z])\1$/.test(stem)) add(stem.slice(0, -1))
    else if (likelySilentEStem(stem)) add(`${stem}e`)
    else add(stem)
  } else if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) {
    add(word.slice(0, -1))
  }
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
