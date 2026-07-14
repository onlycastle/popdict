import { afterEach, describe, expect, it, vi } from 'vitest'
import { getAttributedAudio, pronounce } from './pronounce'

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getAttributedAudio', () => {
  it('returns the first audio clip with its own source and license', () => {
    const audio = getAttributedAudio({
      word: 'kick',
      phonetics: [
        { audio: '' },
        {
          audio: 'https://cdn/kick.mp3',
          sourceUrl: 'https://commons.wikimedia.org/wiki/File:kick.ogg',
          license: { name: 'CC BY-SA 3.0', url: 'https://creativecommons.org/licenses/by-sa/3.0/' },
        },
      ],
      meanings: [],
    })
    expect(audio).toEqual({
      url: 'https://cdn/kick.mp3',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:kick.ogg',
      license: {
        name: 'CC BY-SA 3.0',
        url: 'https://creativecommons.org/licenses/by-sa/3.0/',
      },
    })
  })

  it('returns undefined when there is no audio', () => {
    expect(getAttributedAudio({ word: 'kick', phonetics: [{ text: '/kɪk/' }], meanings: [] })).toBeUndefined()
    expect(getAttributedAudio(null)).toBeUndefined()
    expect(getAttributedAudio(undefined)).toBeUndefined()
  })

  it('rejects recorded audio without source and license attribution metadata', () => {
    expect(getAttributedAudio({
      word: 'kick',
      phonetics: [{ audio: 'https://cdn/kick.mp3' }],
      meanings: [],
    })).toBeUndefined()
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

  function stubAudio(play: ReturnType<typeof vi.fn>) {
    vi.stubGlobal(
      'Audio',
      class {
        addEventListener = vi.fn()
        play = play
      }
    )
  }

  it('plays the audio clip and does not fall back when playback succeeds', async () => {
    const { speak } = stubSpeech()
    const play = vi.fn().mockResolvedValue(undefined)
    stubAudio(play)

    pronounce('kick', 'https://cdn/kick.mp3')
    await flush()

    expect(play).toHaveBeenCalledOnce()
    expect(speak).not.toHaveBeenCalled()
  })

  it('falls back to TTS when audio playback fails', async () => {
    const { speak } = stubSpeech()
    const play = vi.fn().mockRejectedValue(new Error('404'))
    stubAudio(play)

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
    it('tags utterances as en-US', () => {
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
