import { useState, useEffect, useCallback, useRef } from 'react'
import { SearchResponse } from '../types/dictionary'
import { dictionaryService } from '../services/dictionary'

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
  const [error, setError] = useState<string | null>(null)
  const [searchedTerm, setSearchedTerm] = useState('')
  // Monotonic id so a slow earlier lookup can't overwrite a newer one.
  const requestIdRef = useRef(0)

  const debouncedQuery = useDebounce(query.trim(), 300)

  const searchDictionary = useCallback(async (searchQuery: string) => {
    const trimmed = searchQuery.trim()
    const requestId = ++requestIdRef.current

    if (!trimmed) {
      setResponse(null)
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await dictionaryService.search(trimmed)
      if (requestId !== requestIdRef.current) return // a newer search superseded this one
      setResponse(result)
      setSearchedTerm(trimmed)
    } catch (err) {
      if (requestId !== requestIdRef.current) return
      setError(err instanceof Error ? err.message : 'An error occurred')
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

  return { response, loading, error, triggerSearch, searchedTerm }
}
