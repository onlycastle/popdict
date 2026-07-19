/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest'
import { collectPaginatedRows, SavedWordsRepository } from './SavedWordsRepository'

const user = { id: 'user-1234567890' } as any

// A chainable, awaitable stand-in for the supabase query builder: every method
// returns the builder, and awaiting it (or calling maybeSingle) resolves the
// configured result.
function builder(result: any) {
  const b: any = {}
  for (const method of ['upsert', 'select', 'delete', 'eq', 'order', 'limit', 'range']) {
    b[method] = () => b
  }
  b.maybeSingle = () => Promise.resolve(result)
  b.then = (onF: any, onR: any) => Promise.resolve(result).then(onF, onR)
  return b
}

const client = (result: any) => ({ from: () => builder(result) }) as any

describe('SavedWordsRepository', () => {
  it('collects every page instead of stopping at the Data API row ceiling', async () => {
    const rows = Array.from({ length: 1_001 }, (_, id) => ({ id }))
    const loadPage = vi.fn(async (from: number, to: number) => ({
      data: rows.slice(from, to + 1), error: null,
    }))
    const result = await collectPaginatedRows(loadPage)
    expect(result.data).toHaveLength(1_001)
    expect(loadPage).toHaveBeenNthCalledWith(1, 0, 999)
    expect(loadPage).toHaveBeenNthCalledWith(2, 1_000, 1_999)
  })

  it('throws when supabase is not configured', async () => {
    const repo = new SavedWordsRepository(null)
    await expect(repo.save({ source: 'free-dictionary', user, word: 'hi' })).rejects.toThrow(
      /not configured/i
    )
    await expect(repo.list(user)).rejects.toThrow(/not configured/i)
    await expect(repo.delete(user, 'hi')).rejects.toThrow(/not configured/i)
  })

  it('isSaved returns false (not throws) when not configured', async () => {
    expect(await new SavedWordsRepository(null).isSaved(user, 'hi')).toBe(false)
  })

  it('rejects an empty word on save', async () => {
    const repo = new SavedWordsRepository(client({ error: null }))
    await expect(repo.save({ source: 'free-dictionary', user, word: '   ' })).rejects.toThrow(
      /no word/i
    )
  })

  it('save resolves when the upsert succeeds', async () => {
    const repo = new SavedWordsRepository(client({ error: null }))
    await expect(
      repo.save({ source: 'free-dictionary', user, word: 'serendipity' })
    ).resolves.toBeUndefined()
  })

  it('save surfaces the supabase error message', async () => {
    const repo = new SavedWordsRepository(client({ error: { message: 'duplicate key' } }))
    await expect(repo.save({ source: 'free-dictionary', user, word: 'x' })).rejects.toThrow(
      'duplicate key'
    )
  })

  it('list maps rows into Saved Words 2.0 cards', async () => {
    const rows = [
      { id: '1', word: 'a', normalized_word: 'a', source: 'free-dictionary', created_at: '', updated_at: '' },
    ]
    const repo = new SavedWordsRepository(client({ data: rows, error: null }))
    expect(await repo.list(user)).toEqual([{
      id: '1',
      word: 'a',
      normalizedWord: 'a',
      source: 'free-dictionary',
      createdAt: '',
      updatedAt: '',
      note: '',
      details: null,
      tags: [],
      review: null,
      mastery: 'new',
      due: true,
    }])
  })

  it('isSaved returns true when a row exists', async () => {
    const repo = new SavedWordsRepository(client({ data: { id: '1' }, error: null }))
    expect(await repo.isSaved(user, 'hello')).toBe(true)
  })

  it('isSaved returns false for a blank word without querying', async () => {
    const repo = new SavedWordsRepository(client({ data: { id: '1' }, error: null }))
    expect(await repo.isSaved(user, '   ')).toBe(false)
  })
})
