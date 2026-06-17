# PopDict Beta Functions — Design Spec

**Date:** 2026-06-17
**Status:** Approved (design), pending spec review
**Goal of release:** Private beta for feedback — share a DMG with testers to validate the idea before investing in the full `planning.md` roadmap.

---

## 1. Objective

Turn PopDict from "a working hotkey demo" into a utility that a tester can install, use daily without friction, and give feedback on. Add the smallest set of functions that achieves that, and remove the two distribution blockers that only surface once a stranger runs the packaged app.

### In scope (this spec)
1. Menu-bar (tray) presence — the app's home and control surface.
2. Search history — recent lookups, shown when the search bar is empty.
3. Settings window — rebind hotkey, enter STANDS4 credentials, launch-at-login, clear history.
4. Send Feedback — open a hosted form in the browser.

### Explicit non-goals (deferred past beta)
Auto-update (Sparkle/electron-updater), licensing/payments, offline WordNet, translation, AI definitions, cloud sync, App Store packaging, accessibility-permission onboarding (not needed — `globalShortcut` does not require it).

---

## 2. Distribution blockers this fixes

- **STANDS4 key baked at build time.** Today `dictionaryApi.ts` reads `import.meta.env.VITE_PHRASES_API_UID/TOKEN`, which Vite inlines into the renderer bundle at build. A shipped DMG therefore either carries the author's key (shared 100/day quota, extractable from the bundle) or nothing (idiom search silently fails, unconfigurable). → Moved to runtime config (Settings → store → read via IPC).
- **Hardcoded hotkey.** `CommandOrControl+Shift+Space` is registered with no rebind path; a collision makes the app look dead. → Rebindable in Settings, with conflict feedback.

---

## 3. Architecture

Two new foundations carry all four features.

### 3.1 Persistence layer (main process)

A small JSON store module (`electron/store.ts`, ~30 lines) backed by a single file in `app.getPath('userData')/popdict-config.json`. Get/set on a typed config object. No new runtime dependency.

> Decision: a hand-rolled JSON store rather than `electron-store`. Recent `electron-store` is ESM-only and conflicts with the Vite-bundled CommonJS main process; our needs (get/set a small object) don't justify that friction.

Shape:

```ts
type Config = {
  settings: {
    hotkey: string            // e.g. "CommandOrControl+Shift+Space"
    stands4Uid: string        // "" if unset
    stands4Token: string      // "" if unset
    launchAtLogin: boolean
  }
  history: string[]           // most-recent-first, deduped, capped at 12
}
```

Defaults applied on first read (hotkey = current default, empty credentials, launchAtLogin = false, history = []).

### 3.2 IPC surface (preload bridge)

Extend the existing `window.electronAPI` (preload) with:

- `getSettings(): Promise<Settings>` / `setSettings(partial): Promise<Settings>`
- `getHistory(): Promise<string[]>` / `addHistory(word): Promise<string[]>` / `clearHistory(): Promise<void>`
- `getStands4Credentials(): Promise<{uid, token}>` (used by the dictionary service)
- `openSettings(): void` / `sendFeedback(): void`
- Existing `hideWindow`, `setWindowHeight`, `onFocusSearch` stay.

All handlers live in `electron/main.ts` (or a small `electron/ipc.ts`) and read/write through the store module.

### 3.3 App presence: menu-bar only

- Add a `Tray` with a monochrome **template** icon (menu-bar-appropriate; new asset derived from `icon.png`).
- Hide the Dock icon (`app.dock.hide()` on macOS) so PopDict is a pure menu-bar agent. The global shortcut is unaffected by Dock-less mode.
- Tray menu: **Search** (show + focus the bar) · **Launch at Login** (checkbox) · **Settings…** · **Send Feedback** · **Quit**.

---

## 4. Feature designs

### 4.1 Menu-bar tray icon
- Created after `app.whenReady()`, alongside the existing window + shortcut registration.
- "Search" runs the same show/focus path the hotkey uses (refactor that block into a shared `showSearchWindow()`).
- "Launch at Login" reflects and toggles `app.setLoginItemSettings({ openAtLogin })`, persisted in store.
- "Quit" calls `app.quit()` (since `window-all-closed` no longer quits a menu-bar app, Quit is the explicit exit).

### 4.2 Search history
- **Write:** on each *successful* lookup, the renderer calls `electronAPI.addHistory(word)`. Main dedupes (case-insensitive), unshifts, caps at 12, persists.
- **Read/Display:** when the query is empty, replace today's "Start typing…" empty state with a **Recent** list (clickable rows). Selecting a row sets the query and re-runs the search.
- **Keyboard:** ↑/↓ moves selection within the Recent list, Enter searches the selected word, Esc still hides the window.
- **Clear:** "Clear history" button in Settings → `clearHistory()`.

### 4.3 Settings window
- A small dedicated `BrowserWindow` — standard framed, non-resizable, ~480×420 — opened from the tray "Settings…". Separate from the search bar specifically because that bar hides on blur, so an inline panel would dismiss mid-edit.
- Reuses the existing Vite renderer build: the settings window loads the same `index.html` with a `#/settings` hash; `App` renders the search UI by default and the Settings view when the hash is `#/settings`.
- Fields:
  - **Hotkey recorder** — captures a key combo; on save, main unregisters the old shortcut and registers the new one. If registration fails (conflict), revert and show an inline error.
  - **STANDS4 uid + token** — text fields persisted to store; consumed at runtime by the dictionary service.
  - **Launch at login** — toggle (mirrors tray checkbox).
  - **Clear history** — button.
  - Footer: app version + "Send Feedback" link.

### 4.4 Send Feedback
- `shell.openExternal(FEEDBACK_FORM_URL + '?v=' + app.getVersion())` from tray and Settings footer.
- `FEEDBACK_FORM_URL` is user-provided config (a Tally/Google Form the author creates). **Until provided, fall back to a `mailto:` to the author's address** so the feature is never dead.

---

## 5. Data-flow change: STANDS4 credentials

```
BEFORE
  renderer: dictionaryApi.ts → import.meta.env.VITE_PHRASES_API_UID/TOKEN  (build-time inline)

AFTER
  Settings window → setSettings({stands4Uid, stands4Token}) → store (userData JSON)
  dictionaryApi.ts → electronAPI.getStands4Credentials() → IPC → store → returns {uid, token}
```

The dictionary service fetches credentials at call time (cached per session). If credentials are empty, idiom (STANDS4) lookups are skipped gracefully and single/multi-word Free Dictionary results still render — matching today's "works without a key" behavior.

---

## 6. Affected layers (macro)

- **Main process** (`electron/main.ts`, new `electron/store.ts`): store module, IPC handlers, Tray, Dock-hide, settings window, dynamic shortcut (re)registration, login-item.
- **Preload** (`electron/preload.ts`): expanded `electronAPI` bridge + types.
- **Renderer** (`src/`): Recent-list empty state in `App.tsx`/`SearchInput`, history write on success, new Settings view, dictionary service reads credentials via IPC instead of `import.meta.env`.
- **Assets/config**: tray template icon; feedback form URL constant.

---

## 7. Error handling

- **Hotkey conflict on rebind:** detect `globalShortcut.register` returning false / `isRegistered` false → keep the previous working hotkey, surface an inline error in Settings.
- **Missing STANDS4 credentials:** skip idiom query, no error shown (graceful, as today).
- **Corrupt/missing config file:** store module catches parse errors and returns defaults (never throws into startup).
- **Settings window already open:** focus the existing one instead of opening a second.

---

## 8. Testing approach

- **Store module:** unit-test get/set/defaults/cap/dedup and corrupt-file recovery (pure logic, no Electron).
- **History logic:** unit-test dedup + cap ordering.
- **Manual smoke (beta-critical paths):** hotkey toggle still works; tray Search/Quit/Launch-at-login; rebind a hotkey + conflict path; enter STANDS4 key and confirm idiom lookup starts working; Recent list shows + click re-searches; Send Feedback opens the form; packaged DMG launches on a second Mac with the re-signed app.

---

## 9. Open configuration (author-provided)

- **Feedback form URL** — author creates a Tally/Google Form; until then, `mailto:` fallback is used.
- **Tray icon asset** — monochrome template PNG derived from the existing icon.
</content>
</invoke>
