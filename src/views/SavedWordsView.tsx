import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSupabaseAuth } from '../hooks/useSupabaseAuth'
import { savedWords, type SavedWord } from '../services/SavedWordsRepository'

export default function SavedWordsView() {
  const auth = useSupabaseAuth()
  const [words, setWords] = useState<SavedWord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('')

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
  }, [load])

  const handleDelete = useCallback(
    async (entry: SavedWord) => {
      if (!auth.user) return
      const previous = words
      setWords((current) => current.filter((w) => w.id !== entry.id)) // optimistic
      try {
        await savedWords.delete(auth.user, entry.normalized_word)
      } catch (deleteError) {
        setWords(previous) // rollback
        setError(deleteError instanceof Error ? deleteError.message : 'Could not delete word')
      }
    },
    [auth.user, words]
  )

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return q ? words.filter((w) => w.normalized_word.includes(q)) : words
  }, [words, filter])

  return (
    <div className="flex h-screen flex-col bg-neutral-900 text-white">
      <header className="flex items-center justify-between border-b border-white/10 p-6 pb-4">
        <h1 className="text-lg font-semibold">Saved Words</h1>
        {auth.user && words.length > 0 && (
          <span className="text-xs text-white/50">{words.length} saved</span>
        )}
      </header>

      {!auth.configured ? (
        <div className="p-6">
          <p className="rounded-md border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-100">
            Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to enable saved words.
          </p>
        </div>
      ) : !auth.user ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-sm text-white/70">Sign in to view the words you’ve saved.</p>
          <button
            onClick={auth.signInWithGoogle}
            disabled={auth.loading}
            className="rounded-md bg-white px-3 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
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
          <div className="px-6 pt-4">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter saved words…"
              className="search-input"
            />
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {error && <p className="mb-3 text-xs text-red-300">{error}</p>}

            {loading ? (
              <p className="text-sm text-white/50">Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-white/50">
                {words.length === 0
                  ? 'No saved words yet. Look up a word and tap Save.'
                  : 'No words match your filter.'}
              </p>
            ) : (
              <ul className="space-y-1">
                {filtered.map((entry) => (
                  <li
                    key={entry.id}
                    className="group flex items-center justify-between rounded-md px-2 py-2 transition hover:bg-white/5"
                  >
                    <button
                      onClick={() => window.electronAPI?.lookupWord(entry.word)}
                      title="Look up this word"
                      className="min-w-0 flex-1 truncate text-left text-sm text-white/90 hover:text-white"
                    >
                      {entry.word}
                    </button>
                    <button
                      onClick={() => void handleDelete(entry)}
                      aria-label={`Remove ${entry.word}`}
                      title="Remove"
                      className="ml-3 shrink-0 rounded-md px-2 py-1 text-xs text-white/40 opacity-0 transition hover:bg-white/10 hover:text-red-300 group-hover:opacity-100"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
