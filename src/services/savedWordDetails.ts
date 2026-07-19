import type { TargetLanguage, WordTranslation } from '../../shared/language'
import type { SearchResponse } from '../types/dictionary'
import type { SavedWordDetails } from '../types/savedWords'

function unique(values: (string | undefined)[], limit = 20): string[] {
  const seen = new Set<string>()
  const output: string[] = []
  for (const raw of values) {
    const value = raw?.trim()
    const key = value?.toLocaleLowerCase('und')
    if (!value || !key || seen.has(key)) continue
    seen.add(key)
    output.push(value)
    if (output.length === limit) break
  }
  return output
}

export function savedWordDetailsFromLookup(input: {
  response: SearchResponse
  language: TargetLanguage | null
  translations: WordTranslation[]
  translationComplete?: boolean
  now?: Date
}): SavedWordDetails | null {
  const result = input.response.dictionaryResults?.[0]
  const firstMeaning = result?.meanings[0]
  const firstDefinition = firstMeaning?.definitions[0]
  if (!result || !firstMeaning || !firstDefinition?.definition?.trim()) return null
  const definitions = result.meanings.flatMap((meaning) => meaning.definitions)
  const translation = input.translations[0]?.text ?? null
  return {
    partOfSpeech: firstMeaning.partOfSpeech?.trim() || null,
    definition: firstDefinition.definition.trim(),
    example: definitions.find((definition) => definition.example?.trim())?.example?.trim() ?? null,
    synonyms: unique(definitions.flatMap((definition) => definition.synonyms ?? [])),
    antonyms: unique(definitions.flatMap((definition) => definition.antonyms ?? [])),
    translation,
    translationLanguage: input.language && input.translationComplete !== false
      ? input.language
      : null,
    sourceUrl: result.sourceUrls?.find(Boolean) ?? null,
    licenseName: result.license?.name ?? null,
    licenseUrl: result.license?.url ?? null,
    detailsUpdatedAt: (input.now ?? new Date()).toISOString(),
  }
}
