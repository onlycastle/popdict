import { DictionaryResult, IdiomResult, SearchResponse } from '../types/dictionary'

const FREE_DICTIONARY_API = 'https://api.dictionaryapi.dev/api/v2/entries/en'
const PHRASES_API_BASE = 'https://www.stands4.com/services/v2/phrases.php'

export async function fetchFreeDictionary(word: string): Promise<DictionaryResult[]> {
  const response = await fetch(
    `${FREE_DICTIONARY_API}/${encodeURIComponent(word)}`
  )

  if (!response.ok) {
    throw new Error('Not found in dictionary')
  }

  return response.json()
}

export async function fetchPhrasesAPI(phrase: string): Promise<IdiomResult> {
  const uid = import.meta.env.VITE_PHRASES_API_UID
  const token = import.meta.env.VITE_PHRASES_API_TOKEN

  // If credentials are not configured, throw a specific error
  // This will be caught by Promise.allSettled in searchDictionary
  if (!uid || !token) {
    console.warn('Phrases API credentials not configured. Idiom search limited to Free Dictionary API.')
    throw new Error('Phrases API credentials not configured')
  }

  const url = new URL(PHRASES_API_BASE)
  url.searchParams.set('uid', uid)
  url.searchParams.set('tokenid', token)
  url.searchParams.set('phrase', phrase)
  url.searchParams.set('format', 'json')

  const response = await fetch(url.toString())

  if (!response.ok) {
    throw new Error('Not found in phrases API')
  }

  const data = await response.json()

  // Handle API response structure
  if (!data.results?.result) {
    throw new Error('Invalid response from phrases API')
  }

  return data.results.result
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

  // Multi-word - try both APIs in parallel
  const [dictResult, idiomResult] = await Promise.allSettled([
    fetchFreeDictionary(trimmedQuery),
    fetchPhrasesAPI(trimmedQuery)
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
