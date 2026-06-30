import * as fs from 'node:fs'
import * as path from 'node:path'

export const DEFAULT_HOTKEY = 'CommandOrControl+Shift+Space'
const HISTORY_CAP = 12

export type StoredConfig = {
  hotkey: string
  onboardingDone: boolean
  history: string[]
}

const DEFAULT_CONFIG: StoredConfig = {
  hotkey: DEFAULT_HOTKEY,
  onboardingDone: false,
  history: [],
}

export function addToHistory(list: string[], word: string, cap = HISTORY_CAP): string[] {
  const trimmed = word.trim()
  if (!trimmed) return list
  const withoutDupe = list.filter((w) => w.toLowerCase() !== trimmed.toLowerCase())
  return [trimmed, ...withoutDupe].slice(0, cap)
}

export function removeFromHistory(list: string[], word: string): string[] {
  const target = word.trim().toLowerCase()
  if (!target) return list
  return list.filter((w) => w.toLowerCase() !== target)
}

function withDefaults(raw: unknown): StoredConfig {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_CONFIG }
  const r = raw as Partial<StoredConfig>
  // hotkey falls back to the default if missing/empty.
  return {
    hotkey: typeof r.hotkey === 'string' && r.hotkey ? r.hotkey : DEFAULT_HOTKEY,
    onboardingDone: typeof r.onboardingDone === 'boolean' ? r.onboardingDone : false,
    history: Array.isArray(r.history) ? r.history.filter((w) => typeof w === 'string') : [],
  }
}

export function createStore(filePath: string) {
  function read(): StoredConfig {
    try {
      return withDefaults(JSON.parse(fs.readFileSync(filePath, 'utf-8')))
    } catch {
      return { ...DEFAULT_CONFIG }
    }
  }
  function write(cfg: StoredConfig): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, JSON.stringify(cfg, null, 2), 'utf-8')
  }
  return {
    getConfig: read,
    patch(partial: Partial<Omit<StoredConfig, 'history'>>): StoredConfig {
      const next = { ...read(), ...partial }
      write(next)
      return next
    },
    addHistory(word: string): string[] {
      const cfg = read()
      cfg.history = addToHistory(cfg.history, word)
      write(cfg)
      return cfg.history
    },
    removeHistory(word: string): string[] {
      const cfg = read()
      cfg.history = removeFromHistory(cfg.history, word)
      write(cfg)
      return cfg.history
    },
    clearHistory(): void {
      const cfg = read()
      cfg.history = []
      write(cfg)
    },
  }
}

export type Store = ReturnType<typeof createStore>
