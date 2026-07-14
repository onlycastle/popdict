export const TARGET_LANGUAGES = ['ko', 'ja', 'zh-Hans', 'es', 'pt-BR'] as const
export type TargetLanguage = (typeof TARGET_LANGUAGES)[number]

export type WordTranslation = {
  text: string
  senseLabel: string | null
  rank: number
}

export const TARGET_LANGUAGE_OPTIONS: ReadonlyArray<{ code: TargetLanguage; label: string }> = [
  { code: 'ko', label: 'Korean' },
  { code: 'ja', label: 'Japanese' },
  { code: 'zh-Hans', label: 'Simplified Chinese' },
  { code: 'es', label: 'Spanish' },
  { code: 'pt-BR', label: 'Brazilian Portuguese' },
]

export function isTargetLanguage(value: unknown): value is TargetLanguage {
  return typeof value === 'string' && TARGET_LANGUAGES.includes(value as TargetLanguage)
}

export function targetLanguageLabel(code: TargetLanguage): string {
  return TARGET_LANGUAGE_OPTIONS.find((option) => option.code === code)?.label ?? code
}

const SINGLE_ENGLISH_WORD = /^[a-z]+(?:['-][a-z]+)*$/

/** Canonical key shared by the renderer and the generated dataset. */
export function normalizeEnglishWord(value: string): string | null {
  const normalized = value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replaceAll('’', "'")
  return SINGLE_ENGLISH_WORD.test(normalized) ? normalized : null
}
