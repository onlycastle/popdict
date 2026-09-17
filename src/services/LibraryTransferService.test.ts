import { describe, expect, it, vi } from 'vitest'
import type { User } from '@supabase/supabase-js'
import type { SavedWordRecord } from '../types/savedWords'
import { LibraryTransferService } from './LibraryTransferService'

// Documented-fake account and vocabulary; never real user data.
const user = { id: '00000000-0000-4000-8000-000000000001' } as User
const word: SavedWordRecord = {
  id: 'local-fake', word: 'it’s   fine', normalizedWord: "it's fine", source: 'local-dictionary',
  createdAt: '2026-01-01', updatedAt: '2026-01-01', note: 'fake note', details: null,
  tags: [{ id: 'fake-tag', savedWordId: 'local-fake', tag: 'practice', normalizedTag: 'practice', createdAt: '2026-01-01' }],
  review: null, mastery: 'new', due: true,
}
it('resumes tags after an interrupted copy and matches normalized punctuation variants', async () => {
  const remoteWords: SavedWordRecord[] = []
  const local = { list: vi.fn(async () => [word]), count: vi.fn(async () => 1), import: vi.fn() }
  const remote = {
    list: vi.fn(async () => structuredClone(remoteWords)),
    save: vi.fn(async (input) => { remoteWords.push({ ...word, id: 'remote-fake', normalizedWord: word.word.toLowerCase(), note: input.note, tags: [] }) }),
    addTag: vi.fn().mockRejectedValueOnce(new Error('offline')).mockImplementation(async () => {
      const tag = { ...word.tags[0], id: 'remote-tag', savedWordId: 'remote-fake' }
      remoteWords[0].tags.push(tag)
      return tag
    }),
  }
  const transfer = new LibraryTransferService(local, remote)
  await expect(transfer.upload(user)).rejects.toThrow('offline')
  expect(remoteWords[0].note).toBe('fake note')
  await expect(transfer.upload(user)).resolves.toBe(0)
  expect(remote.save).toHaveBeenCalledOnce()
  expect(remote.save).toHaveBeenCalledWith(expect.objectContaining({ note: 'fake note', onlyIfMissing: true }))
  expect(remoteWords[0].tags).toHaveLength(1)
  await transfer.upload(user)
  expect(remote.addTag).toHaveBeenCalledTimes(2)
})

describe('account download', () => {
  it('imports through the local transaction and reports only new words', async () => {
    const local = { list: vi.fn(), count: vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2), import: vi.fn() }
    const remote = { list: vi.fn(async () => [word]), save: vi.fn(), addTag: vi.fn() }
    expect(await new LibraryTransferService(local, remote).download(user)).toBe(1)
    expect(local.import).toHaveBeenCalledWith([word])
  })
})
