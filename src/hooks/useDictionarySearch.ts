import { useState, useEffect, useCallback } from 'react'
import { SearchResponse } from '../types/dictionary'
import { searchDictionary as searchDictionaryAPI } from '../services/dictionaryApi'

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

  const debouncedQuery = useDebounce(query.trim(), 300)

  const searchDictionary = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResponse(null)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await searchDictionaryAPI(searchQuery)
      setResponse(result)
      setSearchedTerm(searchQuery.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setResponse(null)
    } finally {
      setLoading(false)
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
