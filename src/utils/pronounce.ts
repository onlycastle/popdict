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
    const localVoice = window.speechSynthesis.getVoices?.().find((voice) => voice.localService && /^en(?:-|_)/i.test(voice.lang))
    if (localVoice) utterance.voice = localVoice
    window.speechSynthesis.speak(utterance)
  } catch {
    // ignore TTS failures
  }
}

/** Pronunciation always uses an installed system voice, never a remote audio URL. */
export function pronounce(word: string, _audioUrl?: string | null): void {
  speak(word)
}
