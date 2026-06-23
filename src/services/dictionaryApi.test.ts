import { describe, it, expect, vi, beforeEach } from 'vitest'

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('./supabaseClient', () => ({ supabase: { functions: { invoke } } }))

import { fetchIdiom } from './dictionaryApi'

beforeEach(() => {
  invoke.mockReset()
})

describe('fetchIdiom', () => {
  it('returns the idiom result from the edge function', async () => {
    invoke.mockResolvedValue({
      data: { result: { term: 'break the ice', explanation: 'to initiate conversation' } },
      error: null,
    })

    const result = await fetchIdiom('break the ice')

    expect(result.explanation).toBe('to initiate conversation')
    expect(invoke).toHaveBeenCalledWith('idioms', { body: { phrase: 'break the ice' } })
  })

  it('throws when the edge function returns an error', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('boom') })
    await expect(fetchIdiom('break the ice')).rejects.toThrow('boom')
  })

  it('throws when no idiom is found', async () => {
    invoke.mockResolvedValue({ data: { result: null }, error: null })
    await expect(fetchIdiom('not an idiom')).rejects.toThrow('No idiom found')
  })
})
