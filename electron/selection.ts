/**
 * Normalize and validate text captured from another app's selection before
 * using it as a dictionary query. Returns null for selections that aren't a
 * sensible lookup target (empty, too long, or containing no letters), so the
 * caller falls back to manual typing.
 */
export function sanitizeSelection(text: string): string | null {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (!cleaned) return null
  if (cleaned.length > 80) return null // a word or short phrase, not a paragraph
  if (!/[a-zA-Z]/.test(cleaned)) return null // must contain letters
  return cleaned
}
