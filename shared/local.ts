import type { SavedWordDetails, SavedWordRecord, SavedWordTag } from '../src/types/savedWords'
import type { SearchSource } from '../src/types/dictionary'

export type LocalWordInput = { word: string; source: SearchSource; details?: SavedWordDetails | null }
export type LocalLibraryCommand =
  | { action: 'list' }
  | { action: 'save'; input: LocalWordInput }
  | { action: 'delete'; word: string }
  | { action: 'details'; id: string; details: SavedWordDetails }
  | { action: 'note'; id: string; note: string }
  | { action: 'tag'; id: string; tag: string }
  | { action: 'delete-tag'; id: string }
  | { action: 'import'; words: SavedWordRecord[] }
export type LocalLibraryResult = SavedWordRecord[] | SavedWordTag | null

export function normalizeLookup(value: string): string {
  return value.normalize('NFKC').replaceAll('’', "'")
    .replace(/[‐‑‒–—]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase()
}
