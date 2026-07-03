// Hangul Unicode blocks: Jamo (1100), Compatibility Jamo (3130), Jamo Extended-A
// (A960), Syllables (AC00), Jamo Extended-B (D7B0). Intentionally excludes
// other CJK scripts — those should still fall through to the English pipeline.
const HANGUL_RE = /[ᄀ-ᇿ㄰-㆏ꥠ-꥿가-힣ힰ-퟿]/

/** True when the text contains any Hangul — used to route lookups to the Korean dictionary. */
export function containsHangul(text: string): boolean {
  return HANGUL_RE.test(text)
}
