import type { DictionaryLicense, DictionaryResult } from '../types/dictionary'

export interface AttributedAudio {
  url: string
  sourceUrl: string
  license: DictionaryLicense
}

/**
 * Returns the first recorded pronunciation with complete attribution metadata,
 * or undefined when none is available (the caller falls back to TTS).
 */
export function getAttributedAudio(result?: DictionaryResult | null): AttributedAudio | undefined {
  const phonetic = result?.phonetics?.find(
    (p) => p.audio && p.sourceUrl && p.license?.name && p.license.url
  )
  if (!phonetic?.audio || !phonetic.sourceUrl || !phonetic.license) return undefined
  return {
    url: phonetic.audio,
    sourceUrl: phonetic.sourceUrl,
    license: phonetic.license,
  }
}

/** Speak a word with the browser's built-in TTS. No-op if unsupported. */
function speak(word: string): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  try {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(word)
    utterance.lang = 'en-US'
    window.speechSynthesis.speak(utterance)
  } catch {
    // ignore TTS failures
  }
}

/**
 * Play a word's pronunciation: prefer the recorded audio clip, and fall back to
 * the browser's speech synthesis when there is no clip or playback fails
 * (404 / network / unsupported codec).
 */
export function pronounce(word: string, audioUrl?: string | null): void {
  if (audioUrl) {
    try {
      const audio = new Audio(audioUrl)
      let fellBack = false
      const fallback = () => {
        if (fellBack) return
        fellBack = true
        speak(word)
      }
      audio.addEventListener('error', fallback)
      void audio.play().catch(fallback)
      return
    } catch {
      // fall through to TTS
    }
  }
  speak(word)
}
