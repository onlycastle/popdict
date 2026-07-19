import type { MasteryState, SavedWordRecord } from '../types/savedWords'

export type SavedWordsFilter = 'all' | 'due' | MasteryState | `tag:${string}`

export function masteryForBox(box: number | null): MasteryState {
  if (box === null) return 'new'
  return box >= 5 ? 'mastered' : 'learning'
}

export function isReviewDue(nextDueAt: string | null, now = new Date()): boolean {
  if (nextDueAt === null) return true
  const due = Date.parse(nextDueAt)
  return Number.isFinite(due) && due <= now.getTime()
}

export function filterSavedWords(
  words: SavedWordRecord[],
  filter: SavedWordsFilter,
  search: string
): SavedWordRecord[] {
  const query = search.trim().toLowerCase()
  return words.filter((word) => {
    if (query && !word.normalizedWord.includes(query)) return false
    if (filter === 'all') return true
    if (filter === 'due') return word.due
    if (filter.startsWith('tag:')) {
      const tag = filter.slice(4)
      return word.tags.some((item) => item.normalizedTag === tag)
    }
    return word.mastery === filter
  })
}
