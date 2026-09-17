import type { SavedWordDetails, SavedWordRecord, SavedWordTag } from '../types/savedWords'
import type { LocalLibraryCommand, LocalWordInput } from '../../shared/local'

/** A device library owner, never an authentication token or cloud account. */
export const LOCAL_OWNER = { id: 'local-device-library' } as const
export type LibraryOwner = { id: string }
const run = (command: LocalLibraryCommand) => window.electronAPI.localLibrary(command)

export class LocalSavedWordsRepository {
  async save(input: LocalWordInput & { user?: LibraryOwner }): Promise<void> {
    await run({ action: 'save', input: { word: input.word, source: input.source, details: input.details } })
  }
  async list(_owner?: LibraryOwner): Promise<SavedWordRecord[]> { return await run({ action: 'list' }) as SavedWordRecord[] }
  async delete(_owner: LibraryOwner, word: string): Promise<void> { await run({ action: 'delete', word }) }
  async updateDetails(_owner: LibraryOwner, id: string, details: SavedWordDetails): Promise<void> { await run({ action: 'details', id, details }) }
  async updateNote(_owner: LibraryOwner, id: string, note: string): Promise<void> { await run({ action: 'note', id, note }) }
  async addTag(_owner: LibraryOwner, id: string, tag: string): Promise<SavedWordTag> { return await run({ action: 'tag', id, tag }) as SavedWordTag }
  async deleteTag(_owner: LibraryOwner, id: string): Promise<void> { await run({ action: 'delete-tag', id }) }
  async isSaved(_owner: LibraryOwner, word: string): Promise<boolean> {
    const { normalizeLookup } = await import('../../shared/local')
    return (await this.list()).some((w) => w.normalizedWord === normalizeLookup(word))
  }
  async count(_owner?: LibraryOwner): Promise<number> { return (await this.list()).length }
  async import(words: SavedWordRecord[]): Promise<SavedWordRecord[]> { return await run({ action: 'import', words }) as SavedWordRecord[] }
}
