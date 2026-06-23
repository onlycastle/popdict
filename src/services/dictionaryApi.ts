import { DictionaryResult, IdiomResult, SearchResponse } from '../types/dictionary'
import { supabase } from './supabaseClient'

const FREE_DICTIONARY_API = 'https://api.dictionaryapi.dev/api/v2/entries/en'

export async function fetchFreeDictionary(word: string): Promise<DictionaryResult[]> {
  const response = await fetch(
    `${FREE_DICTIONARY_API}/${encodeURIComponent(word)}`
  )

  if (!response.ok) {
    throw new Error('Not found in dictionary')
  }

  return response.json()
}

/**
 * Look up an idiom/phrase via the Supabase Edge Function proxy. The STANDS4
 * token lives server-side in the function (never bundled in the app), and the
 * function caches results to protect the shared free-tier quota.
 */
export async function fetchIdiom(phrase: string): Promise<IdiomResult> {
  if (!supabase) {
    throw new Error('Idiom lookup is not configured')
  }

  const { data, error } = await supabase.functions.invoke('idioms', {
    body: { phrase },
  })

  if (error) throw error
  if (!data?.result) {
    throw new Error('No idiom found')
  }

  return data.result as IdiomResult
}

export async function searchDictionary(query: string): Promise<SearchResponse> {
  const trimmedQuery = query.trim()

  if (!trimmedQuery) {
    throw new Error('Empty query')
  }

  const isMultiWord = trimmedQuery.includes(' ')

  if (!isMultiWord) {
    // Single word - just use Free Dictionary
    try {
      const results = await fetchFreeDictionary(trimmedQuery)
      return {
        dictionaryResults: results,
        idiomResult: null,
        source: 'free-dictionary'
      }
    } catch (error) {
      throw new Error('Word not found')
    }
  }

  // Multi-word - try both sources in parallel
  const [dictResult, idiomResult] = await Promise.allSettled([
    fetchFreeDictionary(trimmedQuery),
    fetchIdiom(trimmedQuery),
  ])

  const hasDict = dictResult.status === 'fulfilled'
  const hasIdiom = idiomResult.status === 'fulfilled'

  if (!hasDict && !hasIdiom) {
    throw new Error(`No results found for "${trimmedQuery}"`)
  }

  return {
    dictionaryResults: hasDict ? dictResult.value : null,
    idiomResult: hasIdiom ? idiomResult.value : null,
    source: hasDict && hasIdiom ? 'both' : hasDict ? 'free-dictionary' : 'phrases-api'
  }
}
