import { DictionaryResult, IdiomResult, SearchResponse } from '../types/dictionary'

const FREE_DICTIONARY_API = 'https://api.dictionaryapi.dev/api/v2/entries/en'
const PHRASES_API_BASE = 'https://www.stands4.com/services/v2/phrases.php'

export type Stands4Credentials = { uid: string; token: string }

async function getStands4Credentials(): Promise<Stands4Credentials> {
  if (typeof window !== 'undefined' && (window as any).electronAPI?.getStands4Credentials) {
    return (window as any).electronAPI.getStands4Credentials()
  }
  return { uid: '', token: '' }
}

export async function fetchFreeDictionary(word: string): Promise<DictionaryResult[]> {
  const response = await fetch(
    `${FREE_DICTIONARY_API}/${encodeURIComponent(word)}`
  )

  if (!response.ok) {
    throw new Error('Not found in dictionary')
  }

  return response.json()
}

export async function fetchPhrasesAPI(
  phrase: string,
  creds: Stands4Credentials
): Promise<IdiomResult> {
  if (!creds.uid || !creds.token) {
    throw new Error('Phrases API credentials not configured')
  }

  const url = new URL(PHRASES_API_BASE)
  url.searchParams.set('uid', creds.uid)
  url.searchParams.set('tokenid', creds.token)
  url.searchParams.set('phrase', phrase)
  url.searchParams.set('format', 'json')

  const response = await fetch(url.toString())

  if (!response.ok) {
    throw new Error('Not found in phrases API')
  }

  const data = await response.json()

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
  const creds = await getStands4Credentials()
  const [dictResult, idiomResult] = await Promise.allSettled([
    fetchFreeDictionary(trimmedQuery),
    fetchPhrasesAPI(trimmedQuery, creds),
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
