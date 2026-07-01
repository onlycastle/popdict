export type KeyboardEventLike = {
  key: string
  metaKey: boolean
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
}

export type AcceleratorResult =
  | { status: 'ok'; accelerator: string }
  | { status: 'incomplete' }
  | { status: 'invalid'; message: string }

const BARE_MODIFIERS = new Set(['Meta', 'Control', 'Shift', 'Alt'])

const ARROW_TO_TOKEN: Record<string, string> = {
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
}

/** Normalize a DOM `key` to a valid Electron accelerator token. */
function normalizeKey(key: string): string {
  if (key === ' ') return 'Space'
  if (key in ARROW_TO_TOKEN) return ARROW_TO_TOKEN[key]
  if (key.length === 1) return key.toUpperCase()
  return key
}

/**
 * Build an Electron accelerator from a keyboard event, or report why it can't:
 * `incomplete` = a bare modifier (keep waiting), `invalid` = a real error to show.
 */
export function eventToAccelerator(e: KeyboardEventLike): AcceleratorResult {
  if (BARE_MODIFIERS.has(e.key)) return { status: 'incomplete' }
  if (!e.metaKey && !e.ctrlKey && !e.altKey) {
    return { status: 'invalid', message: 'Must include ⌘, ⌃, or ⌥' }
  }
  const parts: string[] = []
  if (e.metaKey || e.ctrlKey) parts.push('CommandOrControl')
  if (e.shiftKey) parts.push('Shift')
  if (e.altKey) parts.push('Alt')
  parts.push(normalizeKey(e.key))
  return { status: 'ok', accelerator: parts.join('+') }
}

const TOKEN_TO_GLYPH: Record<string, string> = {
  CommandOrControl: '⌘',
  Command: '⌘',
  Cmd: '⌘',
  Control: '⌃',
  Ctrl: '⌃',
  Alt: '⌥',
  Option: '⌥',
  Shift: '⇧',
  Up: '↑',
  Down: '↓',
  Left: '←',
  Right: '→',
}

/** Map an accelerator string to display glyphs, one entry per `+`-separated token. */
export function acceleratorToGlyphs(accelerator: string): string[] {
  return accelerator.split('+').map((token) => TOKEN_TO_GLYPH[token] ?? token)
}
