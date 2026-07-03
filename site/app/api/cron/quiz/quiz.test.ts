import { afterEach, describe, expect, it, vi } from 'vitest'
import { triggerQuizSend } from './quiz'

describe('triggerQuizSend', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('throws when not configured', async () => {
    vi.stubEnv('QUIZ_FN_URL', '')
    vi.stubEnv('QUIZ_SEND_TOKEN', '')
    await expect(triggerQuizSend()).rejects.toThrow('quiz cron not configured')
  })

  it('posts the send action with the token header', async () => {
    vi.stubEnv('QUIZ_FN_URL', 'https://fn.example/quiz')
    vi.stubEnv('QUIZ_SEND_TOKEN', 'tok')
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await triggerQuizSend()
    expect(fetchMock).toHaveBeenCalledWith('https://fn.example/quiz', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-quiz-token': 'tok' },
      body: JSON.stringify({ action: 'send' }),
    })
  })
})
