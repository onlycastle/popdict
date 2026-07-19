import type { SavedWordRecord } from '../types/savedWords'

function csvCell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value)
  // Spreadsheet apps may execute cells that begin with formula sigils, even
  // after whitespace. An apostrophe preserves the visible text as plain data.
  const text = /^\s*[=+\-@]/u.test(raw) ? `'${raw}` : raw
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
