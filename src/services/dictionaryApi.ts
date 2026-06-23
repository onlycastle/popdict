import { DictionaryResult, IdiomResult, SearchResponse } from '../types/dictionary'
import { supabase } from './supabaseClient'

const FREE_DICTIONARY_API = 'https://api.dictionaryapi.dev/api/v2/entries/en'

export type DictionaryErrorKind = 'network' | 'not-found' | 'service'

/** Typed lookup failure so the UI can tell "offline" apart from "no such word". */
export class DictionaryError extends Error {
  constructor(public kind: DictionaryErrorKind, message?: string) {
    super(message ?? kind)
    this.name = 'DictionaryError'
  }
}

/** Map a thrown error to a user-facing message; `notFoundMessage` is the default. */
function toUserError(error: unknown, notFoundMessage: string): Error {
  if (error instanceof DictionaryError) {
    if (error.kind === 'network') {
      return new Error('No connection — check your internet and try again.')
    }
    if (error.kind === 'service') {
      return new Error('Dictionary service is unavailable. Try again shortly.')
    }
  }
  return new Error(notFoundMessage)
}

export async function fetchFreeDictionary(word: string): Promise<DictionaryResult[]> {
  let response: Response
  try {
    response = await fetch(`${FREE_DICTIONARY_API}/${encodeURIComponent(word)}`)
  } catch {
    // fetch only rejects on network-level failures (offline, DNS, CORS).
    throw new DictionaryError('network')
  }

  if (response.status === 404) throw new DictionaryError('not-found')
  if (!response.ok) throw new DictionaryError('service')

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
      throw toUserError(error, `"${trimmedQuery}" not found`)
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
    // If the dictionary call failed on the network, say so rather than
    // pretending the word doesn't exist.
    if (dictResult.status === 'rejected') {
      throw toUserError(dictResult.reason, `No results found for "${trimmedQuery}"`)
    }
    throw new Error(`No results found for "${trimmedQuery}"`)
  }

  return {
    dictionaryResults: hasDict ? dictResult.value : null,
    idiomResult: hasIdiom ? idiomResult.value : null,
    source: hasDict && hasIdiom ? 'both' : hasDict ? 'free-dictionary' : 'phrases-api'
  }
}
