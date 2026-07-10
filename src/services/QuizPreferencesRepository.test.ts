import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { QuizPreferencesRepository } from './QuizPreferencesRepository'

const user = { id: 'user-1' } as User

function clientReturning(result: { data?: unknown; error?: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result)
  const upsert = vi.fn().mockResolvedValue(result)
  const eq = vi.fn(() => ({ maybeSingle }))
  const select = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ select, upsert }))
  return { client: { from } as unknown as SupabaseClient, from, select, eq, upsert, maybeSingle }
}

describe('QuizPreferencesRepository', () => {
  it('get returns the row for the user, null when absent', async () => {
    const row = { user_id: 'user-1', enabled: true, cadence: 'weekly', streak: 2 }
    const { client, eq } = clientReturning({ data: row, error: null })
    const repo = new QuizPreferencesRepository(client)
    expect(await repo.get(user)).toEqual(row)
    expect(eq).toHaveBeenCalledWith('user_id', 'user-1')

    const absent = new QuizPreferencesRepository(clientReturning({ data: null, error: null }).client)
    expect(await absent.get(user)).toBeNull()
  })

  it('setEnabled upserts on user_id', async () => {
    const { client, upsert } = clientReturning({ error: null })
    await new QuizPreferencesRepository(client).setEnabled(user, true)
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', enabled: true }),
      { onConflict: 'user_id' }
    )
  })

  it('surfaces supabase errors', async () => {
    const { client } = clientReturning({ data: null, error: { message: 'boom' } })
    await expect(new QuizPreferencesRepository(client).get(user)).rejects.toThrow('boom')
  })

  it('get returns null when supabase is not configured', async () => {
    expect(await new QuizPreferencesRepository(null).get(user)).toBeNull()
  })
})
