import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { TargetLanguage } from '../../shared/language'
import { SavedWordCard } from '../components/SavedWordCard'
import { useSupabaseAuth } from '../hooks/useSupabaseAuth'
import {
  enrichWithConcurrency,
  savedWordEnrichment,
} from '../services/SavedWordEnrichmentService'
import { savedWords, type SavedWord } from '../services/SavedWordsRepository'
import { filterSavedWords, type SavedWordsFilter } from '../services/savedWordFilters'
import { savedWordsCsv } from '../services/savedWordsCsv'
import { productAnalytics } from '../services/ProductAnalytics'

const CORE_FILTERS: { value: SavedWordsFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'due', label: 'Due' },
  { value: 'new', label: 'New' },
  { value: 'learning', label: 'Learning' },
  { value: 'mastered', label: 'Mastered' },
]

export default function SavedWordsView() {
  const auth = useSupabaseAuth()
  const [words, setWords] = useState<SavedWord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<SavedWordsFilter>('all')
  const [translationLanguage, setTranslationLanguage] = useState<TargetLanguage | null>(null)
  const [enrichmentFailures, setEnrichmentFailures] = useState<Set<string>>(new Set())
  const attemptedRef = useRef(new Set<string>())

  const load = useCallback(async () => {
    if (!auth.user) return
    setLoading(true)
    setError('')
    try {
      setWords(await savedWords.list(auth.user))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load saved words')
    } finally {
      setLoading(false)
    }
  }, [auth.user])

  useEffect(() => {
    void load()
    void window.electronAPI.getSettings().then((settings) => {
      setTranslationLanguage(settings.translationLanguage)
    })
  }, [load])

  const handleDelete = useCallback(async (entry: SavedWord) => {
    if (!auth.user) return
    const previous = words
    setWords((current) => current.filter((word) => word.id !== entry.id))
    try {
      await savedWords.delete(auth.user, entry.normalizedWord)
    } catch (deleteError) {
      setWords(previous)
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete word')
    }
  }, [auth.user, words])

  const allTags = useMemo(() => {
    const tags = new Map<string, string>()
    for (const word of words) {
      for (const tag of word.tags) tags.set(tag.normalizedTag, tag.tag)
    }
    return [...tags].sort((a, b) => a[1].localeCompare(b[1]))
  }, [words])
  const filtered = useMemo(
    () => filterSavedWords(words, filter, search),
    [words, filter, search]
  )

  const enrichOne = useCallback(async (entry: SavedWord) => {
    if (!auth.user) return
    setEnrichmentFailures((current) => {
      const next = new Set(current)
      next.delete(entry.id)
      return next
    })
    try {
      const details = await savedWordEnrichment.enrich(auth.user, entry, translationLanguage)
      setWords((current) => current.map((word) => word.id === entry.id
        ? { ...word, details }
        : word))
    } catch {
      setEnrichmentFailures((current) => new Set(current).add(entry.id))
    }
  }, [auth.user, translationLanguage])

  useEffect(() => {
    const candidates = filtered.filter((entry) => {
      if (!savedWordEnrichment.needsEnrichment(entry, translationLanguage)) return false
      const key = `${entry.id}\u0000${translationLanguage ?? 'none'}`
      if (attemptedRef.current.has(key)) return false
      attemptedRef.current.add(key)
      return true
    })
    if (candidates.length === 0) return
    void enrichWithConcurrency(candidates, enrichOne, 2)
  }, [enrichOne, filtered, translationLanguage])

  const updateWord = useCallback((updated: SavedWord) => {
    setWords((current) => current.map((word) => word.id === updated.id ? updated : word))
  }, [])

  const exportCsv = async () => {
    try {
      const exported = await window.electronAPI.exportSavedWordsCsv(savedWordsCsv(words))
      if (exported) void productAnalytics.track('saved_words_exported')
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Could not export saved words')
    }
  }

  return (
    <div className="window flex h-screen flex-col">
      <div className="titlebar-drag" />
      <header className="flex items-center justify-between border-b border-white/10 px-6 pb-4">
        <h1 className="view-title text-lg">Saved Words</h1>
        <div className="flex items-center gap-3">
          {auth.user && words.length > 0 && <span className="dict-label">{words.length} saved</span>}
          {auth.user && words.length > 0 && (
            <button className="btn-ghost text-xs" onClick={() => void exportCsv()}>Export CSV</button>
          )}
        </div>
      </header>

      {!auth.configured ? (
        <div className="p-6"><p className="notice">Add Supabase settings to enable saved words.</p></div>
      ) : !auth.user ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-sm text-white/70">Sign in to view the words you’ve saved.</p>
          <button onClick={auth.signInWithGoogle} disabled={auth.loading} className="btn-primary text-sm">
            Continue with Google
          </button>
          {(auth.message || auth.error) && (
            <p className={`text-xs ${auth.error ? 'text-red-300' : 'text-white/60'}`}>
              {auth.error || auth.message}
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-3 px-6 pt-4">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filter saved words…"
              className="search-input"
            />
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Saved word filters">
              {CORE_FILTERS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={`saved-filter${filter === item.value ? ' saved-filter--active' : ''}`}
                  onClick={() => setFilter(item.value)}
                >
                  {item.label}
                </button>
              ))}
              {allTags.map(([normalized, label]) => (
                <button
                  key={normalized}
                  type="button"
                  className={`saved-filter${filter === `tag:${normalized}` ? ' saved-filter--active' : ''}`}
                  onClick={() => setFilter(`tag:${normalized}`)}
                >
                  #{label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {error && <p className="mb-3 text-xs text-red-300">{error}</p>}
            {loading ? (
              <p className="text-sm text-white/50">Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-white/50">
                {words.length === 0 ? 'No saved words yet. Look up a word and tap Save.' : 'No words match this filter.'}
              </p>
            ) : (
              <ul className="space-y-3">
                {filtered.map((entry) => (
                  <SavedWordCard
                    key={entry.id}
                    entry={entry}
                    user={auth.user!}
                    enrichmentFailed={enrichmentFailures.has(entry.id)}
                    onDelete={handleDelete}
                    onRetry={enrichOne}
                    onUpdate={updateWord}
                  />
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
