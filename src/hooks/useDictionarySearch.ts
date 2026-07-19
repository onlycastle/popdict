import { useState, useEffect, useCallback, useRef } from 'react'
import type { CachedLookup, LookupFailure, SearchResponse } from '../types/dictionary'
import { dictionaryService } from '../services/dictionary'
import { toLookupFailure } from '../services/dictionary/DictionaryError'
import { mergeRecoverySuggestions } from '../services/dictionary/recovery'

// Simple debounce function
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

export function useDictionarySearch(query: string) {
  const [response, setResponse] = useState<SearchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [failure, setFailure] = useState<LookupFailure | null>(null)
  const [recoverySuggestions, setRecoverySuggestions] = useState<string[]>([])
  const [cachedLookup, setCachedLookup] = useState<CachedLookup | null>(null)
  const [searchedTerm, setSearchedTerm] = useState('')
  // Monotonic id so a slow earlier lookup can't overwrite a newer one.
  const requestIdRef = useRef(0)

  const debouncedQuery = useDebounce(query.trim(), 300)

  const searchDictionary = useCallback(async (searchQuery: string) => {
    const trimmed = searchQuery.trim()
    const requestId = ++requestIdRef.current

    if (!trimmed) {
      setResponse(null)
      setFailure(null)
      setRecoverySuggestions([])
      setCachedLookup(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setFailure(null)
    setRecoverySuggestions([])
    setCachedLookup(null)

    try {
      const result = await dictionaryService.search(trimmed)
      if (requestId !== requestIdRef.current) return // a newer search superseded this one
      setResponse(result)
      setSearchedTerm(trimmed)
      void window.electronAPI?.writeLookupCache({ query: trimmed, response: result })
    } catch (err) {
      if (requestId !== requestIdRef.current) return
      const nextFailure = toLookupFailure(err, trimmed)
      if (nextFailure.kind !== 'not-found') {
        const cached = await window.electronAPI?.readLookupCache(trimmed).catch((): null => null)
        if (requestId !== requestIdRef.current) return
        if (cached) {
          setCachedLookup(cached)
          setResponse({
            ...cached.response,
            provenance: 'cache',
            cachedAt: cached.savedAt,
          })
          setSearchedTerm(trimmed)
          return
        }
      }
      if (nextFailure.kind === 'not-found' && !/\s/.test(trimmed)) {
        const spelling = window.electronAPI?.getSpellingSuggestions(trimmed) ?? []
        setRecoverySuggestions(mergeRecoverySuggestions(trimmed, spelling))
      }
      setFailure(nextFailure)
      setResponse(null)
    } finally {
      if (requestId === requestIdRef.current) setLoading(false)
    }
  }, [])

  // Auto search with debounce
  useEffect(() => {
    searchDictionary(debouncedQuery)
  }, [debouncedQuery, searchDictionary])

  // Trigger immediate search (for Enter key)
  const triggerSearch = useCallback(() => {
    searchDictionary(query)
  }, [query, searchDictionary])

  return {
    response,
    loading,
    failure,
    recoverySuggestions,
    cachedLookup,
    triggerSearch,
    searchedTerm,
  }
}
