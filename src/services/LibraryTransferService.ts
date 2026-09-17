import { normalizeLookup } from '../../shared/local'
import type { User } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import type { LocalSavedWordsRepository } from './LocalSavedWordsRepository'
import { savedWords, SavedWordsRepository } from './SavedWordsRepository'

/** Explicit, additive transfers. Neither side deletes or overwrites existing words. */
export class LibraryTransferService {
  constructor(
    private local: Pick<LocalSavedWordsRepository, 'count' | 'list' | 'import'> = savedWords,
    private remote: Pick<SavedWordsRepository, 'list' | 'save' | 'addTag'> = new SavedWordsRepository(supabase),
  ) {}
  async download(user: User): Promise<number> {
    const remote = this.remote
    const before = await this.local.count()
    const rows = await remote.list(user)
    await this.local.import(rows)
    return await this.local.count() - before
  }
  async upload(user: User): Promise<number> {
    const remote = this.remote
    const existing = new Map((await remote.list(user)).map((word) => [normalizeLookup(word.word), word]))
    let copied = 0
    for (const word of await this.local.list()) {
      const key = normalizeLookup(word.word)
      let target = existing.get(key)
      if (!target) {
        // One atomic insert includes the note. A concurrent transfer cannot
        // overwrite an account word created since the initial read.
        await remote.save({ user, word: word.word,
          source: word.source === 'local-dictionary' ? 'free-dictionary' : word.source,
          details: word.details, note: word.note, onlyIfMissing: true })
        target = (await remote.list(user)).find((row) => normalizeLookup(row.word) === key)
        if (!target) throw new Error('Could not confirm the account copy. Your local words are safe.')
        existing.set(key, target)
        copied++
      }
      // Add missing tags even on a retry after a partial transfer. Existing
      // account definitions, notes, tags and review state are never replaced.
      for (const tag of word.tags) {
        if (target.tags.some((t) => t.normalizedTag === tag.normalizedTag)) continue
        if (target.tags.length >= 10) throw new Error('An account word already has 10 tags. Words and notes were kept; remaining tags were not copied.')
        const added = await remote.addTag(user, target.id, tag.tag)
        target.tags.push(added)
      }
    }
    return copied
  }
}
