# PopDict Beta Functions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a menu-bar tray, search history, a settings window, and a feedback link to PopDict, and move STANDS4 credentials from build-time to runtime — so a private beta DMG is usable and self-sufficient.

**Architecture:** A small JSON config store in the main process (no new runtime dependency) is the single source of truth for the hotkey, STANDS4 credentials, and recent-search history. The renderer reaches it through an expanded `electronAPI` IPC bridge. The app becomes a menu-bar-only agent (Dock hidden) with a Tray menu; Settings is a separate `#/settings` window so it doesn't collide with the search bar's hide-on-blur behavior.

**Tech Stack:** Electron 39, electron-forge + Vite, React 18 + TypeScript, Tailwind, Vitest (new, for pure-logic tests).

---

## Reference: target `electronAPI` shape

These types are introduced in Task 5 (preload) and consumed across later tasks. Listed here once for reference; repeated in the tasks that need them.

```ts
type AppSettings = {
  hotkey: string         // Electron accelerator, e.g. "CommandOrControl+Shift+Space"
  stands4Uid: string     // "" when unset
  stands4Token: string   // "" when unset
  launchAtLogin: boolean
}

interface ElectronAPI {
  hideWindow: () => void
  setWindowHeight: (height: number) => void
  onFocusSearch: (cb: () => void) => void
  getSettings: () => Promise<AppSettings>
  setSettings: (partial: Partial<AppSettings>) => Promise<AppSettings>
  getHistory: () => Promise<string[]>
  addHistory: (word: string) => Promise<string[]>
  clearHistory: () => Promise<void>
  getStands4Credentials: () => Promise<{ uid: string; token: string }>
  openSettings: () => void
  sendFeedback: () => void
}
```

## File map

- Create `vitest.config.ts` — test runner config.
- Create `electron/store.ts` — JSON config store factory `createStore(filePath)` + `DEFAULT_HOTKEY` + pure `addToHistory`.
- Create `electron/store.test.ts` — unit tests for the store.
- Create `src/services/dictionaryApi.test.ts` — unit tests for the credentials refactor.
- Create `src/components/Settings.tsx` — the settings view.
- Create `src/types/electron.d.ts` — renderer-side global `window.electronAPI` type.
- Create `assets/trayTemplate.png` (+ `@2x`) — menu-bar icon.
- Modify `package.json` — add Vitest devDep + `test` scripts.
- Modify `src/services/dictionaryApi.ts` — credentials via param/IPC instead of `import.meta.env`.
- Modify `electron/preload.ts` — expand the bridge.
- Modify `electron/main.ts` — store wiring, IPC handlers, Tray, Dock-hide, settings window, dynamic shortcut, feedback.
- Modify `src/App.tsx` — hash routing (search vs settings) + history Recent list + write-on-success.

## Testing note

The store logic and the credentials refactor are pure and get real Vitest tests (TDD). The Electron-integration tasks (Tray, Dock-hide, IPC wiring, settings window, dynamic shortcut, feedback) are verified by **manual smoke tests** with `npm start` — unit-testing them would require mocking the Electron runtime, which is disproportionate for a beta. Every such task lists the exact manual check and expected result.

---

## Task 1: Test infrastructure (Vitest)

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `electron/sanity.test.ts` (temporary, deleted in Step 6)

- [ ] **Step 1: Install Vitest**

Run: `npm install -D vitest@^2`
Expected: added to `devDependencies`, exit 0.

- [ ] **Step 2: Add test scripts to `package.json`**

In the `"scripts"` block, add these two lines after `"lint"`:

```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['{src,electron}/**/*.test.ts'],
  },
})
```

- [ ] **Step 4: Write a sanity test at `electron/sanity.test.ts`**

```ts
import { describe, it, expect } from 'vitest'

describe('sanity', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 5: Run the test**

Run: `npm test`
Expected: PASS, 1 test passed.

- [ ] **Step 6: Delete the sanity test**

Run: `rm electron/sanity.test.ts`

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "test: add Vitest runner"
```

---

## Task 2: Config store (TDD)

**Files:**
- Create: `electron/store.ts`
- Test: `electron/store.test.ts`

- [ ] **Step 1: Write the failing tests at `electron/store.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { createStore, DEFAULT_HOTKEY, addToHistory } from './store'

let dir: string
let file: string

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'popdict-'))
  file = path.join(dir, 'config.json')
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('addToHistory', () => {
  it('puts newest first and dedupes case-insensitively', () => {
    let h: string[] = []
    h = addToHistory(h, 'apple')
    h = addToHistory(h, 'Banana')
    h = addToHistory(h, 'APPLE')
    expect(h).toEqual(['APPLE', 'Banana'])
  })
  it('ignores blank words', () => {
    expect(addToHistory(['apple'], '   ')).toEqual(['apple'])
  })
  it('caps the list length', () => {
    let h: string[] = []
    for (let i = 0; i < 20; i++) h = addToHistory(h, `w${i}`, 12)
    expect(h.length).toBe(12)
    expect(h[0]).toBe('w19')
  })
})

describe('createStore', () => {
  it('returns defaults when no file exists', () => {
    const store = createStore(file)
    const cfg = store.getConfig()
    expect(cfg.hotkey).toBe(DEFAULT_HOTKEY)
    expect(cfg.stands4Uid).toBe('')
    expect(cfg.history).toEqual([])
  })
  it('persists patched values across instances', () => {
    createStore(file).patch({ stands4Uid: 'abc', hotkey: 'CommandOrControl+Shift+D' })
    const cfg = createStore(file).getConfig()
    expect(cfg.stands4Uid).toBe('abc')
    expect(cfg.hotkey).toBe('CommandOrControl+Shift+D')
  })
  it('addHistory persists and dedupes', () => {
    const store = createStore(file)
    store.addHistory('apple')
    const list = store.addHistory('apple')
    expect(list).toEqual(['apple'])
  })
  it('clearHistory empties the list', () => {
    const store = createStore(file)
    store.addHistory('apple')
    store.clearHistory()
    expect(store.getConfig().history).toEqual([])
  })
  it('recovers from a corrupt file by returning defaults', () => {
    fs.writeFileSync(file, '{ not json')
    expect(createStore(file).getConfig().hotkey).toBe(DEFAULT_HOTKEY)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot find module `./store`.

- [ ] **Step 3: Implement `electron/store.ts`**

```ts
import * as fs from 'node:fs'

export const DEFAULT_HOTKEY = 'CommandOrControl+Shift+Space'
const HISTORY_CAP = 12

export type StoredConfig = {
  hotkey: string
  stands4Uid: string
  stands4Token: string
  history: string[]
}

const DEFAULT_CONFIG: StoredConfig = {
  hotkey: DEFAULT_HOTKEY,
  stands4Uid: '',
  stands4Token: '',
  history: [],
}

export function addToHistory(list: string[], word: string, cap = HISTORY_CAP): string[] {
  const trimmed = word.trim()
  if (!trimmed) return list
  const withoutDupe = list.filter((w) => w.toLowerCase() !== trimmed.toLowerCase())
  return [trimmed, ...withoutDupe].slice(0, cap)
}

function withDefaults(raw: unknown): StoredConfig {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_CONFIG }
  const r = raw as Partial<StoredConfig>
  return {
    hotkey: typeof r.hotkey === 'string' && r.hotkey ? r.hotkey : DEFAULT_HOTKEY,
    stands4Uid: typeof r.stands4Uid === 'string' ? r.stands4Uid : '',
    stands4Token: typeof r.stands4Token === 'string' ? r.stands4Token : '',
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
    fs.writeFileSync(filePath, JSON.stringify(cfg, null, 2), 'utf-8')
  }
  return {
    getConfig: read,
    patch(partial: Partial<StoredConfig>): StoredConfig {
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
    clearHistory(): void {
      const cfg = read()
      cfg.history = []
      write(cfg)
    },
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS — all store tests green.

- [ ] **Step 5: Commit**

```bash
git add electron/store.ts electron/store.test.ts
git commit -m "feat: add main-process config store"
```

---

## Task 3: STANDS4 credentials refactor (TDD)

**Files:**
- Modify: `src/services/dictionaryApi.ts`
- Test: `src/services/dictionaryApi.test.ts`

- [ ] **Step 1: Write the failing tests at `src/services/dictionaryApi.test.ts`**

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchPhrasesAPI } from './dictionaryApi'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchPhrasesAPI', () => {
  it('throws when credentials are empty', async () => {
    await expect(fetchPhrasesAPI('kick the bucket', { uid: '', token: '' }))
      .rejects.toThrow('Phrases API credentials not configured')
  })

  it('calls STANDS4 with the provided credentials and returns the result', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: { result: { term: 'x', explanation: 'y' } } }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchPhrasesAPI('break the ice', { uid: 'U', token: 'T' })

    expect(result.explanation).toBe('y')
    const calledUrl = fetchMock.mock.calls[0][0] as string
    expect(calledUrl).toContain('uid=U')
    expect(calledUrl).toContain('tokenid=T')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `fetchPhrasesAPI` still requires no credentials arg / reads `import.meta.env`.

- [ ] **Step 3: Refactor `src/services/dictionaryApi.ts`**

Replace the `fetchPhrasesAPI` function (lines 18-49) and add a credentials helper. The new `fetchPhrasesAPI` takes credentials as a parameter:

```ts
export type Stands4Credentials = { uid: string; token: string }

async function getStands4Credentials(): Promise<Stands4Credentials> {
  if (typeof window !== 'undefined' && window.electronAPI?.getStands4Credentials) {
    return window.electronAPI.getStands4Credentials()
  }
  return { uid: '', token: '' }
}

export async function fetchPhrasesAPI(
  phrase: string,
  creds: Stands4Credentials
): Promise<IdiomResult> {
  if (!creds.uid || !creds.token) {
    throw new Error('Phrases API credentials not configured')
  }

  const url = new URL(PHRASES_API_BASE)
  url.searchParams.set('uid', creds.uid)
  url.searchParams.set('tokenid', creds.token)
  url.searchParams.set('phrase', phrase)
  url.searchParams.set('format', 'json')

  const response = await fetch(url.toString())
  if (!response.ok) {
    throw new Error('Not found in phrases API')
  }

  const data = await response.json()
  if (!data.results?.result) {
    throw new Error('Invalid response from phrases API')
  }
  return data.results.result
}
```

Then in `searchDictionary`, fetch credentials once and pass them in. Replace the multi-word branch's `Promise.allSettled` call so the second entry becomes:

```ts
  const creds = await getStands4Credentials()
  const [dictResult, idiomResult] = await Promise.allSettled([
    fetchFreeDictionary(trimmedQuery),
    fetchPhrasesAPI(trimmedQuery, creds),
  ])
```

(Remove the now-unused `import.meta.env` reads.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS — both `fetchPhrasesAPI` tests green, store tests still green.

- [ ] **Step 5: Commit**

```bash
git add src/services/dictionaryApi.ts src/services/dictionaryApi.test.ts
git commit -m "refactor: read STANDS4 credentials at runtime instead of build time"
```

---

## Task 4: Renderer-side electronAPI types

**Files:**
- Create: `src/types/electron.d.ts`

- [ ] **Step 1: Create `src/types/electron.d.ts`**

```ts
export type AppSettings = {
  hotkey: string
  stands4Uid: string
  stands4Token: string
  launchAtLogin: boolean
}

export interface ElectronAPI {
  hideWindow: () => void
  setWindowHeight: (height: number) => void
  onFocusSearch: (cb: () => void) => void
  getSettings: () => Promise<AppSettings>
  setSettings: (partial: Partial<AppSettings>) => Promise<AppSettings>
  getHistory: () => Promise<string[]>
  addHistory: (word: string) => Promise<string[]>
  clearHistory: () => Promise<void>
  getStands4Credentials: () => Promise<{ uid: string; token: string }>
  openSettings: () => void
  sendFeedback: () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npm run lint`
Expected: no new errors referencing `electronAPI`.

- [ ] **Step 3: Commit**

```bash
git add src/types/electron.d.ts
git commit -m "types: add renderer electronAPI global type"
```

---

## Task 5: Expand the preload bridge

**Files:**
- Modify: `electron/preload.ts`

- [ ] **Step 1: Replace `electron/preload.ts` with the expanded bridge**

```ts
import { contextBridge, ipcRenderer } from 'electron'

type AppSettings = {
  hotkey: string
  stands4Uid: string
  stands4Token: string
  launchAtLogin: boolean
}

contextBridge.exposeInMainWorld('electronAPI', {
  hideWindow: () => ipcRenderer.send('hide-window'),
  setWindowHeight: (height: number) => ipcRenderer.send('set-window-height', height),
  onFocusSearch: (callback: () => void) => {
    ipcRenderer.on('focus-search', callback)
  },
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSettings: (partial: Partial<AppSettings>) => ipcRenderer.invoke('set-settings', partial),
  getHistory: () => ipcRenderer.invoke('get-history'),
  addHistory: (word: string) => ipcRenderer.invoke('add-history', word),
  clearHistory: () => ipcRenderer.invoke('clear-history'),
  getStands4Credentials: () => ipcRenderer.invoke('get-stands4-credentials'),
  openSettings: () => ipcRenderer.send('open-settings'),
  sendFeedback: () => ipcRenderer.send('send-feedback'),
})
```

- [ ] **Step 2: Verify the preload still builds**

Run: `npm start`
Expected: app launches, search bar still opens on Cmd+Shift+Space (handlers added next task; renderer calls to new methods will reject until Task 6 — that is expected at this checkpoint). Quit with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add electron/preload.ts
git commit -m "feat: expand preload electronAPI bridge"
```

---

## Task 6: Wire the store + IPC handlers in main

**Files:**
- Modify: `electron/main.ts`

- [ ] **Step 1: Add imports and store init at the top of `electron/main.ts`**

After the existing imports (line 1-2), add:

```ts
import { Tray, Menu, shell, screen } from 'electron'
import { createStore } from './store'

const store = createStore(path.join(app.getPath('userData'), 'popdict-config.json'))
const FEEDBACK_FORM_URL = '' // TODO: paste your Tally/Google Form URL; empty falls back to mailto
const FEEDBACK_MAILTO = 'sungman.cho@latched.ai'
```

> Note: `app`, `BrowserWindow`, `globalShortcut`, `ipcMain` are already imported on line 1. Merge `Tray, Menu, shell, screen` into that existing import line rather than duplicating; `screen` is currently required inline via `require('electron')` — you may leave those inline `require`s or switch them to this import.

- [ ] **Step 2: Register IPC handlers inside `app.whenReady().then(() => { ... })`, after `createWindow()`**

```ts
  ipcMain.handle('get-settings', () => ({
    hotkey: store.getConfig().hotkey,
    stands4Uid: store.getConfig().stands4Uid,
    stands4Token: store.getConfig().stands4Token,
    launchAtLogin: app.getLoginItemSettings().openAtLogin,
  }))

  ipcMain.handle('set-settings', (_e, partial) => {
    const { launchAtLogin, ...storable } = partial ?? {}
    if (typeof launchAtLogin === 'boolean') {
      app.setLoginItemSettings({ openAtLogin: launchAtLogin })
    }
    const cfg = store.patch(storable)
    return {
      hotkey: cfg.hotkey,
      stands4Uid: cfg.stands4Uid,
      stands4Token: cfg.stands4Token,
      launchAtLogin: app.getLoginItemSettings().openAtLogin,
    }
  })

  ipcMain.handle('get-history', () => store.getConfig().history)
  ipcMain.handle('add-history', (_e, word: string) => store.addHistory(word))
  ipcMain.handle('clear-history', () => { store.clearHistory() })
  ipcMain.handle('get-stands4-credentials', () => ({
    uid: store.getConfig().stands4Uid,
    token: store.getConfig().stands4Token,
  }))
```

- [ ] **Step 3: Manual smoke test**

Run: `npm start`, open the bar (Cmd+Shift+Space), open DevTools console, run:
```js
await window.electronAPI.getSettings()
```
Expected: an object with `hotkey: "CommandOrControl+Shift+Space"`, empty creds, `launchAtLogin: false`. Quit with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add electron/main.ts
git commit -m "feat: store-backed IPC handlers in main"
```

---

## Task 7: Tray icon + Dock-hidden menu-bar app

**Files:**
- Create: `assets/trayTemplate.png` and `assets/trayTemplate@2x.png`
- Modify: `electron/main.ts`

- [ ] **Step 1: Create the tray icon assets**

Run:
```bash
mkdir -p assets
sips -z 22 22 icon.png --out assets/trayTemplate.png
sips -z 44 44 icon.png --out assets/trayTemplate@2x.png
```
Expected: two PNGs created. (These are the colored app icon resized; replacing them with a monochrome glyph is a post-beta polish item.)

- [ ] **Step 2: Refactor the show logic into a shared function**

In `electron/main.ts`, extract the window-show block (currently inside the global-shortcut callback, lines ~88-104) into a module-level function:

```ts
function showSearchWindow() {
  if (!mainWindow) return
  const cursorPoint = screen.getCursorScreenPoint()
  const currentDisplay = screen.getDisplayNearestPoint(cursorPoint)
  const { width: screenWidth } = currentDisplay.workAreaSize
  const { x: displayX, y: displayY } = currentDisplay.workArea
  const windowBounds = mainWindow.getBounds()
  mainWindow.setPosition(
    displayX + Math.round((screenWidth - windowBounds.width) / 2),
    displayY + 80
  )
  mainWindow.show()
  mainWindow.focus()
  mainWindow.webContents.send('focus-search')
}

function toggleSearchWindow() {
  if (!mainWindow) return
  if (mainWindow.isVisible()) mainWindow.hide()
  else showSearchWindow()
}
```

Update the global-shortcut callback (Task 8 finalizes registration) to call `toggleSearchWindow()`.

- [ ] **Step 3: Hide the Dock and create the Tray inside `app.whenReady().then(...)`**

```ts
  if (process.platform === 'darwin' && app.dock) {
    app.dock.hide()
  }

  const tray = new Tray(path.join(__dirname, '../../assets/trayTemplate.png'))
  trayRef = tray // keep a module-level ref so it is not garbage-collected
  tray.setToolTip('PopDict')
  rebuildTrayMenu()
```

Add a module-level `let trayRef: Tray | null = null` near `mainWindow`, and a `rebuildTrayMenu()` function:

```ts
function rebuildTrayMenu() {
  if (!trayRef) return
  const menu = Menu.buildFromTemplate([
    { label: 'Search', accelerator: store.getConfig().hotkey, click: () => showSearchWindow() },
    { type: 'separator' },
    {
      label: 'Launch at Login',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
    },
    { label: 'Settings…', click: () => openSettingsWindow() },
    { label: 'Send Feedback', click: () => openFeedback() },
    { type: 'separator' },
    { label: 'Quit PopDict', click: () => app.quit() },
  ])
  trayRef.setContextMenu(menu)
}
```

> `openSettingsWindow()` and `openFeedback()` are defined in Tasks 9 and 10. To keep this task runnable, add temporary stubs now:
> ```ts
> function openSettingsWindow() { /* implemented in Task 9 */ }
> function openFeedback() { /* implemented in Task 10 */ }
> ```

- [ ] **Step 4: Asar path note for the tray icon**

`assets/` must ship inside the package. Confirm `forge.config.ts` `packagerConfig` does not exclude it (it doesn't restrict files, so `assets/` is included by default). The `__dirname/../../assets` path resolves from `.vite/build/` to the app root in both dev and packaged builds.

- [ ] **Step 5: Manual smoke test**

Run: `npm start`
Expected: no Dock icon; a PopDict icon appears in the macOS menu bar; clicking it shows Search / Launch at Login / Settings… / Send Feedback / Quit. "Search" opens the bar; "Quit PopDict" exits. Hotkey still toggles the bar.

- [ ] **Step 6: Commit**

```bash
git add electron/main.ts assets/trayTemplate.png assets/trayTemplate@2x.png
git commit -m "feat: menu-bar tray, dock hidden"
```

---

## Task 8: Dynamic hotkey registration

**Files:**
- Modify: `electron/main.ts`

- [ ] **Step 1: Add a registration helper**

```ts
function registerHotkey(accelerator: string): boolean {
  globalShortcut.unregisterAll()
  try {
    const ok = globalShortcut.register(accelerator, () => toggleSearchWindow())
    return ok && globalShortcut.isRegistered(accelerator)
  } catch {
    return false
  }
}
```

- [ ] **Step 2: Use the stored hotkey at startup**

Replace the existing `globalShortcut.register('CommandOrControl+Shift+Space', ...)` block (lines ~82-114) with:

```ts
  const startupHotkey = store.getConfig().hotkey
  if (!registerHotkey(startupHotkey)) {
    console.log('Global shortcut registration failed for', startupHotkey)
  }
```

- [ ] **Step 3: Add a `change-hotkey` IPC handler (used by Settings) inside `app.whenReady`**

```ts
  ipcMain.handle('change-hotkey', (_e, accelerator: string) => {
    const ok = registerHotkey(accelerator)
    if (ok) {
      store.patch({ hotkey: accelerator })
      rebuildTrayMenu()
    } else {
      registerHotkey(store.getConfig().hotkey) // restore previous working hotkey
    }
    return ok
  })
```

- [ ] **Step 4: Expose `changeHotkey` in preload**

In `electron/preload.ts`, add to the exposed object:
```ts
  changeHotkey: (accelerator: string) => ipcRenderer.invoke('change-hotkey', accelerator),
```
And in `src/types/electron.d.ts`, add to `ElectronAPI`:
```ts
  changeHotkey: (accelerator: string) => Promise<boolean>
```

- [ ] **Step 5: Manual smoke test**

Run: `npm start`, open DevTools console on the bar, run:
```js
await window.electronAPI.changeHotkey('CommandOrControl+Shift+J')
```
Expected: returns `true`; Cmd+Shift+J now toggles the bar; Cmd+Shift+Space no longer does. Restart and confirm Cmd+Shift+J persists. Then run `await window.electronAPI.changeHotkey('CommandOrControl+Shift+Space')` to reset.

- [ ] **Step 6: Commit**

```bash
git add electron/main.ts electron/preload.ts src/types/electron.d.ts
git commit -m "feat: rebindable global hotkey"
```

---

## Task 9: Settings window

**Files:**
- Modify: `electron/main.ts`

- [ ] **Step 1: Replace the `openSettingsWindow` stub with a real implementation**

```ts
let settingsWindow: BrowserWindow | null = null

function openSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus()
    return
  }
  settingsWindow = new BrowserWindow({
    width: 480,
    height: 420,
    resizable: false,
    title: 'PopDict Settings',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    settingsWindow.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}#/settings`)
  } else {
    settingsWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
      { hash: 'settings' }
    )
  }

  settingsWindow.on('closed', () => {
    settingsWindow = null
  })
}
```

- [ ] **Step 2: Manual smoke test**

Run: `npm start`, click the tray → Settings….
Expected: a 480×420 framed window opens loading the renderer at `#/settings`. It currently shows the search UI (the settings React view lands in Task 11). Opening Settings again focuses the same window instead of opening a second.

- [ ] **Step 3: Commit**

```bash
git add electron/main.ts
git commit -m "feat: settings window shell"
```

---

## Task 10: Send Feedback

**Files:**
- Modify: `electron/main.ts`

- [ ] **Step 1: Replace the `openFeedback` stub with a real implementation**

```ts
function openFeedback() {
  const version = app.getVersion()
  if (FEEDBACK_FORM_URL) {
    shell.openExternal(`${FEEDBACK_FORM_URL}?v=${encodeURIComponent(version)}`)
  } else {
    const subject = encodeURIComponent(`PopDict beta feedback (v${version})`)
    shell.openExternal(`mailto:${FEEDBACK_MAILTO}?subject=${subject}`)
  }
}
```

- [ ] **Step 2: Add the `send-feedback` IPC handler inside `app.whenReady`**

```ts
  ipcMain.on('send-feedback', () => openFeedback())
  ipcMain.on('open-settings', () => openSettingsWindow())
```

- [ ] **Step 3: Manual smoke test**

Run: `npm start`, click tray → Send Feedback.
Expected: with `FEEDBACK_FORM_URL` empty, the default mail client opens a new message to the fallback address with a versioned subject. (Set `FEEDBACK_FORM_URL` to a real form before distributing.)

- [ ] **Step 4: Commit**

```bash
git add electron/main.ts
git commit -m "feat: send feedback via external form/mailto"
```

---

## Task 11: Settings React view

**Files:**
- Create: `src/components/Settings.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create `src/components/Settings.tsx`**

```tsx
import { useEffect, useState } from 'react'
import type { AppSettings } from '../types/electron'

export default function Settings() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [status, setStatus] = useState('')

  useEffect(() => {
    window.electronAPI.getSettings().then(setSettings)
  }, [])

  if (!settings) return <div className="p-6 text-white/80">Loading…</div>

  const update = (patch: Partial<AppSettings>) =>
    window.electronAPI.setSettings(patch).then(setSettings)

  const recordHotkey = (e: React.KeyboardEvent) => {
    e.preventDefault()
    const parts: string[] = []
    if (e.metaKey || e.ctrlKey) parts.push('CommandOrControl')
    if (e.shiftKey) parts.push('Shift')
    if (e.altKey) parts.push('Alt')
    const key = e.key.length === 1 ? e.key.toUpperCase() : e.key
    if (['Meta', 'Control', 'Shift', 'Alt'].includes(e.key)) return
    parts.push(key === ' ' ? 'Space' : key)
    const accelerator = parts.join('+')
    window.electronAPI.changeHotkey(accelerator).then((ok) => {
      if (ok) {
        setSettings({ ...settings, hotkey: accelerator })
        setStatus('Hotkey updated')
      } else {
        setStatus('That shortcut is unavailable — try another')
      }
    })
  }

  return (
    <div className="p-6 space-y-5 text-white">
      <h1 className="text-lg font-semibold">PopDict Settings</h1>

      <label className="block space-y-1">
        <span className="text-sm text-white/80">Global hotkey</span>
        <input
          readOnly
          value={settings.hotkey}
          onKeyDown={recordHotkey}
          className="search-input"
          placeholder="Click and press a shortcut"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm text-white/80">STANDS4 UID</span>
        <input
          value={settings.stands4Uid}
          onChange={(e) => update({ stands4Uid: e.target.value })}
          className="search-input"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm text-white/80">STANDS4 Token</span>
        <input
          value={settings.stands4Token}
          onChange={(e) => update({ stands4Token: e.target.value })}
          className="search-input"
        />
      </label>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={settings.launchAtLogin}
          onChange={(e) => update({ launchAtLogin: e.target.checked })}
        />
        <span className="text-sm text-white/80">Launch at login</span>
      </label>

      <div className="flex items-center justify-between pt-2">
        <button
          onClick={() => window.electronAPI.clearHistory().then(() => setStatus('History cleared'))}
          className="text-sm text-white/70 underline"
        >
          Clear search history
        </button>
        <button
          onClick={() => window.electronAPI.sendFeedback()}
          className="text-sm text-white/70 underline"
        >
          Send feedback
        </button>
      </div>

      {status && <p className="text-xs text-white/60">{status}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Add hash routing to `src/App.tsx`**

Add the import at the top of `src/App.tsx`:

```tsx
import Settings from './components/Settings'
```

Then make the hash check the **very first statement** in the `App` function body — before any hooks (`useState`, `useDictionarySearch`, `useRef`, `useEffect`). This is required by the Rules of Hooks: the settings window must never call the search hooks, and the search window must always call them. Because a window's hash is constant for its lifetime, this early return is consistent across renders:

```tsx
function App() {
  if (window.location.hash === '#/settings') {
    return <Settings />
  }
  // ...all existing search-bar hooks and JSX follow unchanged...
```

- [ ] **Step 3: Manual smoke test**

Run: `npm start`, tray → Settings….
Expected: the settings form renders. Press into the hotkey field and press a new combo → "Hotkey updated"; type a STANDS4 UID/Token → persisted (reopen Settings to confirm). Toggle Launch at login → tray checkbox reflects it. Clear search history → "History cleared".

- [ ] **Step 4: Commit**

```bash
git add src/components/Settings.tsx src/App.tsx
git commit -m "feat: settings view"
```

---

## Task 12: Search history UI

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Load history and write on successful search**

In `src/App.tsx`, add state and effects. After the existing `const { response, loading, error, triggerSearch } = useDictionarySearch(query)`:

```tsx
  const [history, setHistory] = useState<string[]>([])

  useEffect(() => {
    window.electronAPI?.getHistory().then(setHistory)
  }, [])

  // Record a successful lookup in history
  useEffect(() => {
    if (query.trim() && response && !error) {
      window.electronAPI?.addHistory(query.trim()).then(setHistory)
    }
  }, [response, error, query])
```

- [ ] **Step 2: Replace the empty-state block with a Recent list**

Replace the `{!query && (...)}` empty-state `motion.div` (lines ~77-95) with:

```tsx
        <AnimatePresence mode="wait">
          {!query && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="empty-state"
            >
              {history.length > 0 ? (
                <div className="recent-list">
                  <p className="text-white/50 text-xs mb-2">Recent</p>
                  {history.map((word) => (
                    <button
                      key={word}
                      onClick={() => setQuery(word)}
                      className="block w-full text-left text-white/80 text-sm py-1 hover:text-white"
                    >
                      {word}
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  <p className="text-white/80 text-sm">Start typing to search dictionary...</p>
                  <p className="text-white/70 text-xs mt-2">Press ESC to close</p>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
```

- [ ] **Step 3: Expand the window when showing the Recent list**

In the height-adjustment effect, change the condition so a non-empty history also expands the window:

```tsx
    if ((query && (response || loading)) || (!query && history.length > 0)) {
      window.electronAPI.setWindowHeight(query ? 400 : 240)
    } else {
      window.electronAPI.setWindowHeight(80)
    }
```

Add `history` to that effect's dependency array.

- [ ] **Step 4: Manual smoke test**

Run: `npm start`. Search "serendipity" (let results load), then clear the input.
Expected: the empty bar now shows a "Recent" list containing "serendipity"; clicking it re-runs the search. Search a few more words and confirm newest-first ordering and no duplicates.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: recent-search history list"
```

---

## Task 13: Build, re-sign, and verify the beta DMG

**Files:** none (uses the `create-dmg.js` deep-resign fix already in place).

- [ ] **Step 1: Set the feedback URL (optional but recommended)**

If you have created a Tally/Google Form, set `FEEDBACK_FORM_URL` in `electron/main.ts` to its URL and commit. Otherwise the mailto fallback ships.

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: PASS — store + dictionaryApi tests green.

- [ ] **Step 3: Build the DMG**

Run: `rm -rf out/popdict-test-darwin-arm64 out/PopDict.dmg && npm run make`
Expected: `✅ DMG created successfully at: out/PopDict.dmg`.

- [ ] **Step 4: Verify the packaged app is valid and launches**

Run:
```bash
codesign --verify --verbose=1 out/popdict-test-darwin-arm64/popdict-test.app
open out/popdict-test-darwin-arm64/popdict-test.app
```
Expected: "valid on disk / satisfies its Designated Requirement"; the app launches as a menu-bar icon (no Dock icon), the hotkey opens the bar, and tray → Settings/Feedback/Quit all work. Quit via the tray.

- [ ] **Step 5: Commit any final changes**

```bash
git add -A
git commit -m "chore: beta build config"
```

---

## Self-review notes (already applied)

- **Spec coverage:** tray (T7), launch-at-login (T7/T11), search history (T2 logic, T12 UI), settings window (T9), settings view incl. hotkey rebind + STANDS4 fields + clear history (T8/T11), runtime credentials (T3/T6), send feedback (T10), menu-bar-only (T7). All spec sections map to a task.
- **Type consistency:** `AppSettings`/`ElectronAPI` defined in T4, mirrored in preload (T5), extended with `changeHotkey` in T8; `createStore`/`addToHistory`/`DEFAULT_HOTKEY` names consistent across T2 and consumers.
- **Non-goals** from the spec (auto-update, licensing, offline, translation, AI) are intentionally absent.
</content>
