import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { QuizSessionService } from './QuizSessionService'

function client(result: { data?: unknown; error?: unknown }) {
  const invoke = vi.fn().mockResolvedValue(result)
  return { client: { functions: { invoke } } as unknown as SupabaseClient, invoke }
}

describe('QuizSessionService', () => {
  it('dueCount returns the due number', async () => {
    const { client: c } = client({ data: { due: 5 }, error: null })
    expect(await new QuizSessionService(c).dueCount()).toBe(5)
  })

  it('dueCount returns 0 on error or missing client', async () => {
    const { client: c } = client({ data: null, error: { message: 'x' } })
    expect(await new QuizSessionService(c).dueCount()).toBe(0)
    expect(await new QuizSessionService(null).dueCount()).toBe(0)
  })

  it('startSession maps quizId + cards', async () => {
    const cards = [{ questionId: 'q1', kind: 'recognition', prompt: 'W', options: ['a', 'b', 'c', 'd'] }]
    const { client: c } = client({ data: { quizId: 'z1', cards }, error: null })
    expect(await new QuizSessionService(c).startSession()).toEqual({ quizId: 'z1', cards })
  })

  it('startSession throws on error', async () => {
    const { client: c } = client({ data: null, error: { message: 'boom' } })
    await expect(new QuizSessionService(c).startSession()).rejects.toThrow('session_failed')
  })

  it('answer posts the right body and returns the result', async () => {
    const result = {
      word: 'W', correct: true, correctAnswer: 'a', streak: 3, alreadyAnswered: false,
      material: { definition: 'def', examples: ['e'], similar: [{ phrase: 'p', nuance: 'n' }] },
    }
    const { client: c, invoke } = client({ data: result, error: null })
    expect(await new QuizSessionService(c).answer('q1', 2)).toEqual(result)
    expect(invoke).toHaveBeenCalledWith('quiz', { body: { action: 'answer', q: 'q1', c: 2 } })
  })
})
