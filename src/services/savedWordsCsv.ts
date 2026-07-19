import type { SavedWordRecord } from '../types/savedWords'

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function savedWordsCsv(words: SavedWordRecord[]): string {
  const headers = [
    'word', 'part_of_speech', 'definition', 'example', 'translation',
    'translation_language', 'mastery', 'next_due_at', 'tags', 'note',
    'source', 'saved_at',
  ]
  const rows = words.map((word) => [
    word.word,
    word.details?.partOfSpeech,
    word.details?.definition,
    word.details?.example,
    word.details?.translation,
    word.details?.translationLanguage,
    word.mastery,
    word.review?.nextDueAt,
    word.tags.map((tag) => tag.tag).join('; '),
    word.note,
    word.source,
    word.createdAt,
  ])
  return `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`
}
