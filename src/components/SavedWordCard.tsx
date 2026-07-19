import { useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { savedWords, type SavedWord } from '../services/SavedWordsRepository'

interface SavedWordCardProps {
  entry: SavedWord
  user: User
  enrichmentFailed: boolean
  onDelete: (entry: SavedWord) => Promise<void>
  onRetry: (entry: SavedWord) => Promise<void>
  onUpdate: (entry: SavedWord) => void
}

export function SavedWordCard({
  entry,
  user,
  enrichmentFailed,
  onDelete,
  onRetry,
  onUpdate,
}: SavedWordCardProps) {
  const [tag, setTag] = useState('')
  const [note, setNote] = useState(entry.note)
  const [cardError, setCardError] = useState('')

  const addTag = async () => {
    if (!tag.trim() || entry.tags.length >= 10) return
    setCardError('')
    try {
      const created = await savedWords.addTag(user, entry.id, tag)
      onUpdate({ ...entry, tags: [...entry.tags, created] })
      setTag('')
    } catch (error) {
      setCardError(error instanceof Error ? error.message : 'Could not add tag')
    }
  }

  const deleteTag = async (tagId: string) => {
    setCardError('')
    try {
      await savedWords.deleteTag(user, tagId)
      onUpdate({ ...entry, tags: entry.tags.filter((item) => item.id !== tagId) })
    } catch (error) {
      setCardError(error instanceof Error ? error.message : 'Could not remove tag')
    }
  }

  const saveNote = async () => {
    if (note === entry.note) return
    setCardError('')
    try {
      await savedWords.updateNote(user, entry.id, note)
      onUpdate({ ...entry, note })
    } catch (error) {
      setCardError(error instanceof Error ? error.message : 'Could not save note')
    }
  }

  return (
    <li className="saved-word-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <button
            onClick={() => window.electronAPI.lookupWord(entry.word)}
            title="Look up this word"
            className="dict-headword truncate text-left text-lg hover:text-white/80"
          >
            {entry.word}
          </button>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {entry.details?.partOfSpeech && <span className="dict-pos">{entry.details.partOfSpeech}</span>}
            <span className={`mastery-chip mastery-chip--${entry.mastery}`}>{entry.mastery}</span>
            {entry.due && <span className="due-chip">Due</span>}
            {entry.review && <span className="dict-label">box {entry.review.box}</span>}
          </div>
        </div>
        <button
          onClick={() => void onDelete(entry)}
          aria-label={`Remove ${entry.word}`}
          className="text-xs text-white/40 hover:text-red-300"
        >
          Remove
        </button>
      </div>

      {entry.details ? (
        <div className="mt-3 space-y-2">
          {entry.details.definition && (
            <p className="text-sm leading-relaxed text-white/85">{entry.details.definition}</p>
          )}
          {entry.details.example && (
            <p className="dict-example text-xs leading-relaxed">{entry.details.example}</p>
          )}
          {entry.details.translation && (
            <p className="text-sm text-amber-200/90">
              {entry.details.translation}
              {entry.details.translationLanguage && (
                <span className="ml-2 text-[10px] uppercase text-white/35">
                  {entry.details.translationLanguage}
                </span>
              )}
            </p>
          )}
        </div>
      ) : (
        <p className="mt-3 text-xs text-white/45">Loading saved details…</p>
      )}

      {enrichmentFailed && (
        <button className="btn-ghost mt-3 text-xs" onClick={() => void onRetry(entry)}>
          Retry details
        </button>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {entry.tags.map((item) => (
          <span key={item.id} className="saved-tag">
            {item.tag}
            <button
              type="button"
              aria-label={`Remove tag ${item.tag}`}
              onClick={() => void deleteTag(item.id)}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      {entry.tags.length < 10 && (
        <div className="mt-2 flex gap-2">
          <input
            value={tag}
            maxLength={40}
            onChange={(event) => setTag(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void addTag()
              }
            }}
            placeholder="Add tag"
            aria-label={`Add a tag to ${entry.word}`}
            className="saved-inline-input"
          />
          <button type="button" className="btn-ghost text-xs" onClick={() => void addTag()}>
            Add
          </button>
        </div>
      )}

      <details className="mt-3">
        <summary className="dict-label cursor-pointer select-none">Private note</summary>
        <textarea
          value={note}
          maxLength={4000}
          onChange={(event) => setNote(event.target.value)}
          onBlur={() => void saveNote()}
          placeholder="Add a note only you can see…"
          className="saved-note"
        />
      </details>
      {cardError && <p className="mt-2 text-xs text-red-300">{cardError}</p>}
    </li>
  )
}
