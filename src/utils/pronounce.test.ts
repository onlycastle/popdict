import { afterEach, describe, expect, it, vi } from 'vitest'
import { getAudioUrl, pronounce } from './pronounce'

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getAudioUrl', () => {
  it('returns the first non-empty audio url', () => {
    const url = getAudioUrl({
      word: 'kick',
      phonetics: [{ audio: '' }, { audio: 'https://cdn/kick.mp3' }],
      meanings: [],
    })
    expect(url).toBe('https://cdn/kick.mp3')
  })

  it('returns undefined when there is no audio', () => {
    expect(getAudioUrl({ word: 'kick', phonetics: [{ text: '/kɪk/' }], meanings: [] })).toBeUndefined()
    expect(getAudioUrl(null)).toBeUndefined()
    expect(getAudioUrl(undefined)).toBeUndefined()
  })
})

describe('pronounce', () => {
  function stubSpeech() {
    const speak = vi.fn()
    const cancel = vi.fn()
    vi.stubGlobal('window', { speechSynthesis: { speak, cancel } })
    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      class {
        lang = ''
        constructor(public text: string) {}
      }
    )
    return { speak }
  }

  it('plays the audio clip and does not fall back when playback succeeds', async () => {
    const { speak } = stubSpeech()
    const play = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('Audio', vi.fn(() => ({ addEventListener: vi.fn(), play })))

    pronounce('kick', 'https://cdn/kick.mp3')
    await flush()

    expect(play).toHaveBeenCalledOnce()
    expect(speak).not.toHaveBeenCalled()
  })

  it('falls back to TTS when audio playback fails', async () => {
    const { speak } = stubSpeech()
    const play = vi.fn().mockRejectedValue(new Error('404'))
    vi.stubGlobal('Audio', vi.fn(() => ({ addEventListener: vi.fn(), play })))

    pronounce('kick', 'https://cdn/kick.mp3')
    await flush()

    expect(speak).toHaveBeenCalledOnce()
  })

  it('uses TTS directly when there is no audio url', () => {
    const { speak } = stubSpeech()
    pronounce('kick')
    expect(speak).toHaveBeenCalledOnce()
  })

  describe('TTS language selection', () => {
    it('speaks Korean words with a ko-KR voice', () => {
      const spoken: SpeechSynthesisUtterance[] = []
      vi.stubGlobal('window', {
        speechSynthesis: {
          cancel: vi.fn(),
          speak: (u: SpeechSynthesisUtterance) => spoken.push(u),
        },
      })
      vi.stubGlobal(
        'SpeechSynthesisUtterance',
        class {
          lang = ''
          constructor(public text: string) {}
        }
      )

      pronounce('사과')

      expect(spoken).toHaveLength(1)
      expect(spoken[0].lang).toBe('ko-KR')
    })

    it('keeps en-US for Latin words', () => {
      const spoken: SpeechSynthesisUtterance[] = []
      vi.stubGlobal('window', {
        speechSynthesis: {
          cancel: vi.fn(),
          speak: (u: SpeechSynthesisUtterance) => spoken.push(u),
        },
      })
      vi.stubGlobal(
        'SpeechSynthesisUtterance',
        class {
          lang = ''
          constructor(public text: string) {}
        }
      )

      pronounce('apple')

      expect(spoken[0].lang).toBe('en-US')
    })
  })
})
