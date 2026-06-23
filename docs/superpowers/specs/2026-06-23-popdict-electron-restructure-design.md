# PopDict — Electron App Restructure (Design Spec)

**Date:** 2026-06-23
**Sub-project:** #1 of 3 (Electron app). Follow-ons: edge function, landing site — each gets its own spec.
**Approach:** Pragmatic OOP — *a class only where mutable state or lifecycle lives; a function everywhere else; declarative data for configuration.*
**Constraint that overrides all others:** simplicity. Patterns are used where they remove duplication or clarify a boundary, never as ceremony.

---

## 1. Motivation

The Electron app works but carries three structural problems that compound as it grows:

1. **A god file.** `electron/main.ts` (675 lines) holds seven unrelated responsibilities: deep-link auth, four window factories, macOS selection capture, the tray menu, hotkey registration, the IPC handler wall, and security hardening. State lives in five module-level `let` variables, which makes the file order-dependent and effectively untestable.
2. **Reinvented micro-patterns.** A "debug logger" (`prefix + JSON.stringify + try/catch`) is independently re-implemented three times (`authDebug` in `main.ts`, `authDebug` in `useSupabaseAuth.ts`, `savedWordsDebug` in `savedWords.ts`). Auth-URL introspection (`describeAuthUrl` ≈ `describeCallbackUrl`) is duplicated across the main/renderer boundary.
3. **Fragile renderer routing.** `App.tsx` selects its view with early `return`s *before* its hooks run; the code comment itself flags the Rules-of-Hooks hazard. `App.tsx` also embeds ~80 lines of save-word/login orchestration mixed into rendering.

**Goal:** reusable, scalable, simple. Split responsibilities so each unit answers one question, dedupe the reinvented patterns, and make the stateful units testable via dependency injection — without adding abstraction the app doesn't need yet.

**Non-goals:** the Supabase edge function and the landing site (separate sub-projects). No feature changes. No behavior changes visible to the user. This lands on the `release-prep` branch, so **every commit must remain shippable.**

---

## 2. Target module map

### Main process — `electron/`
```
electron/
  main.ts                  Composition root: single-instance lock + app lifecycle only (~70 ln)
  app/AppBootstrap.ts      whenReady orchestration: build services, wire them (Facade)
  windows/
    WindowManager.ts       [class] owns ALL window refs; open / focus-if-exists / cleanup
    windowSpecs.ts         data — declarative {id,options,hash,singleton,afterCreate} per window
  auth/
    AuthCallbackBroker.ts  [class] pending/delivered callback state machine + dispatch
    deepLinkProtocol.ts    register popdict://; open-url + second-instance wiring
  ipc/
    IpcRouter.ts           [class] typed channel→handler registry (Command pattern)
    handlers.ts            builds the handler map from injected services (DI seam)
  selection/SelectionCapture.ts   macOS ⌘C capture (moved ~as-is; now isolated + testable)
  tray/TrayMenu.ts         [class] build / rebuild menu from injected deps
  hotkey/HotkeyManager.ts  [class] register / unregister / change
  security/hardenWebContents.ts   navigation + window-open hardening (pure function)
  config/ConfigStore.ts    today's store.ts (already a clean factory — relocated)
  preload.ts               unchanged in shape
```
`[class]` = owns state or lifecycle. Everything else is a function or data.

### Shared — `shared/` (NEW; importable by both processes)
```
shared/
  logger.ts      createLogger(tag): Logger  — replaces authDebug ×2 + savedWordsDebug ×1
  authUrl.ts     describeAuthUrl / readAuthCallbackParams (pure) — dedup main ↔ renderer
```
**Build basis (verified):** both processes build through Vite; the single root `tsconfig.json` already covers `electron/` and `src/` (excludes only `supabase/functions`, `site`). `shared/` is reached with plain relative imports — no alias, no second tsconfig. **Hard rule:** files in `shared/` may use only globals present in *both* runtimes (`console`, `URL`, `URLSearchParams`). No Electron, Node-fs, or DOM-only APIs. A build smoke (`npm start` + a packaged `npm run package`) is part of step 1 to confirm resolution before anything depends on it.

### Renderer — `src/`
```
src/
  Router.tsx                  NEW — maps window hash → view (replaces early-return-before-hooks)
  views/SearchView.tsx        today's App.tsx search UI, minus orchestration
  views/SettingsView.tsx      today's components/Settings.tsx (relocated)
  views/SavedWordsView.tsx    today's components/SavedWords.tsx (relocated)
  views/OnboardingView.tsx    today's components/Onboarding.tsx (relocated)
  components/                  presentational only: SearchInput, SearchResults, LoginModal, WindowControls
  hooks/
    useDictionarySearch.ts     keep
    useSupabaseAuth.ts         slimmed — pure parsing moves to shared/authUrl
    useSaveWord.ts             NEW — the save/login orchestration extracted from App.tsx
  services/
    dictionary/
      DictionarySource.ts      interface (Strategy)
      FreeDictionarySource.ts  implements DictionarySource
      IdiomSource.ts           implements DictionarySource
      DictionaryService.ts     coordinates sources; single-word vs multi-word logic
    SavedWordsRepository.ts    [class] today's savedWords.ts → Repository (guard written once)
    supabaseClient.ts          keep
  types/
```

### Patterns, mapped to where they earn their place
| Pattern | Where | Why it's justified (not ceremony) |
|---|---|---|
| Factory | `WindowManager.open(spec)` | Collapses 4 near-identical window factories into one config-driven path |
| Repository | `SavedWordsRepository` | Centralizes the 4× `if (!supabase) throw` guard; one DI seam for the table |
| Strategy | `DictionaryService` + sources | Pluggable lookup sources; scalable to thesaurus/Wiktionary without touching the coordinator |
| Command / Router | `IpcRouter` + `handlers.ts` | Replaces the 80-line inline handler wall; one named function per channel; central error logging |
| Facade / Composition root + DI | `AppBootstrap` / `main.ts` | One place builds the objects and hands each its dependencies; the rest is order-independent and testable |

---

## 3. Core contracts

**`shared/logger.ts`**
```ts
export type Logger = { event(name: string, details?: Record<string, unknown>): void }
export function createLogger(tag: string): Logger   // `[${tag}] ${name} ${safeJSON(details)}`
```

**`windows/WindowManager.ts`** — Factory + ref ownership (replaces 4 factories + 5 module `let`s)
```ts
type WindowId = 'search' | 'settings' | 'saved' | 'onboarding'
interface WindowSpec {
  id: WindowId
  options: BrowserWindowConstructorOptions     // size / frame / vibrancy as DATA
  hash: string                                 // '', 'settings', 'saved', 'onboarding'
  singleton: boolean                           // focus-if-already-open
  afterCreate?: (win: BrowserWindow) => void   // bespoke wiring (search positioning, blur-hide)
}
class WindowManager {
  constructor(specs: Record<WindowId, WindowSpec>, resolveUrl: UrlResolver, log: Logger)
  open(id: WindowId): BrowserWindow            // dedup → build → load(dev URL | file+hash) → track 'closed'
  get(id: WindowId): BrowserWindow | null
  showSearch(): void                           // center on cursor display + show + focus + 'focus-search'
}
```
`afterCreate` is a deliberate Template-Method seam: `WindowManager` stays generic; the search window keeps its bespoke behavior (cursor-display centering, blur→hide, `setVisibleOnAllWorkspaces`, dev-tools, renderer console logging) as its spec's `afterCreate`.

**`auth/AuthCallbackBroker.ts`** — the deep-link state machine (today: 5 module vars + 4 loose functions)
```ts
class AuthCallbackBroker {
  constructor(windows: WindowManager, log: Logger)
  receive(url: string): void          // validate popdict://auth → store pending → dispatch
  dispatch(): void                    // deliver to target/settings/main once the window is ready
  setTarget(win: BrowserWindow): void // remember who opened the external browser
  consume(): string | null            // renderer pulls the pending URL (clears state)
}
```
`isAuthCallbackUrl(url)` becomes a pure helper (in `shared/authUrl.ts` or alongside the broker). `deepLinkProtocol.ts` owns `registerAuthProtocol()` and the `open-url` / `second-instance` / initial-argv wiring, calling `broker.receive()`.

**`ipc/IpcRouter.ts` + `ipc/handlers.ts`** — Command/Router + the DI seam
```ts
class IpcRouter {
  handle<R>(channel: string, fn: (...a: unknown[]) => R | Promise<R>): this  // central error log
  on(channel: string, fn: (...a: unknown[]) => void): this
}
function registerHandlers(router: IpcRouter, deps: {
  store: ConfigStore; windows: WindowManager; broker: AuthCallbackBroker;
  hotkey: HotkeyManager; tray: TrayMenu; selection: SelectionCapture; feedback: FeedbackService
}): void
```
Every current `ipcMain.handle/on` becomes a named function in `handlers.ts` reading from `deps`. `main.ts` no longer contains handler bodies.

**`services/dictionary/` — Strategy**
```ts
interface DictionarySource {
  readonly name: SearchSource
  lookup(query: string): Promise<DictionaryResult[] | IdiomResult | null>
}
class FreeDictionarySource implements DictionarySource { /* fetch + DictionaryError mapping */ }
class IdiomSource implements DictionarySource { /* Supabase Edge Function invoke */ }
class DictionaryService {
  constructor(private free: DictionarySource, private idiom: DictionarySource)
  search(query: string): Promise<SearchResponse>   // single-word → free; multi-word → both (allSettled)
}
```
The existing typed `DictionaryError` (`network` | `not-found` | `service`) and the multi-word `Promise.allSettled` orchestration are preserved exactly — only relocated behind the coordinator.

**`services/SavedWordsRepository.ts`** — Repository; centralizes the 4× guard
```ts
class SavedWordsRepository {
  constructor(client: SupabaseClient | null, log?: Logger)
  save(input: SaveWordInput): Promise<void>
  list(user: User): Promise<SavedWord[]>
  delete(user: User, normalizedWord: string): Promise<void>
  isSaved(user: User, word: string): Promise<boolean>
  // private requireClient(): SupabaseClient   ← the guard, written ONCE
}
export const savedWords = new SavedWordsRepository(supabase)
```
Call sites change mechanically: `saveWord({...})` → `savedWords.save({...})`, `getSavedWords(u)` → `savedWords.list(u)`, `deleteSavedWord(u,w)` → `savedWords.delete(u,w)`, `isWordSaved(u,w)` → `savedWords.isSaved(u,w)`. Affected files: `App.tsx`/`SearchView.tsx`, `SavedWords.tsx`/`SavedWordsView.tsx`.

**Composition root** — `main.ts` `whenReady` shrinks to wiring
```ts
const store   = createConfigStore(configPath)
const windows = new WindowManager(windowSpecs, resolveUrl, createLogger('Win'))
const broker  = new AuthCallbackBroker(windows, createLogger('Auth'))
const selection = new SelectionCapture()
const hotkey  = new HotkeyManager(() => onHotkey(store, windows, selection))
const tray    = new TrayMenu({ store, windows, onFeedback })
registerHandlers(new IpcRouter(), { store, windows, broker, hotkey, tray, selection, feedback })
```

---

## 4. Data flow: before → after

**Auth deep-link.** Before: an OS event (`open-url` / `second-instance` / initial argv) calls a loose `handleAuthCallback()` that mutates three module-level vars and reads `settingsWindow`/`mainWindow` globals. After: `OS event → deepLinkProtocol → AuthCallbackBroker.receive() → broker owns state → broker.dispatch() asks WindowManager for the target window`. The global tangle becomes one encapsulated object tested by feeding it URLs.

**Save-word.** Before: `App.tsx` juggles five state vars (`pendingSaveWord`, `saving`, `saveError`, `savedWord`, `loginPromptOpen`) across three effects that mix auth, IO, and rendering. After: `useSaveWord(auth, response, searchedTerm, query)` owns the orchestration and returns `{ saveLabel, handleSaveClick, loginPromptOpen, ... }`; `SavedWordsRepository.save()` owns the IO; `SearchView` only renders.

**Dictionary search.** Before: `searchDictionary()` free function branches single- vs multi-word and calls two fetch helpers. After: `DictionaryService.search()` does the same branching but delegates to injected `DictionarySource`s — identical behavior, pluggable sources.

---

## 5. Testing strategy

Today only leaf utilities are tested (`store`, `selection`, `dictionaryApi`, `pronounce`). DI roughly doubles the testable surface — each `[class]` becomes unit-testable with injected fakes, no Electron runtime required:

| Unit | What the test feeds / asserts |
|---|---|
| `shared/logger` | tag + event formatting; unserializable details don't throw |
| `shared/authUrl` | code / token / error extraction from query + hash variants; malformed URLs |
| `WindowManager` | singleton dedup focuses instead of re-creating; `'closed'` clears the ref (fake BrowserWindow) |
| `AuthCallbackBroker` | non-auth URLs ignored; duplicate delivery suppressed; `consume()` clears state |
| `IpcRouter` | channel registration; handler errors are caught + logged |
| `SavedWordsRepository` | `requireClient()` throws when client is null; upsert/delete payload shape |
| `DictionaryService` | single-word → free only; multi-word → both via `allSettled`; network vs not-found error mapping |

Existing tests must stay green throughout; relocated modules keep their tests (paths updated).

---

## 6. Migration sequencing (every commit shippable)

1. **`shared/` first** — add `logger.ts` + `authUrl.ts`; replace the three loggers and the duplicated URL parsing in place. Smallest change, and it **de-risks the one open build question** (does `shared/` resolve from both sides) before anything depends on it. Includes a build smoke.
2. **Main process, one unit at a time** — `ConfigStore` (relocate) → `SelectionCapture` → `hardenWebContents` → `HotkeyManager` → `TrayMenu` → `WindowManager` + `windowSpecs` → `AuthCallbackBroker` + `deepLinkProtocol` → `IpcRouter` + `handlers` → finally slim `main.ts` to the composition root. The app launches at every step.
3. **Renderer** — `SavedWordsRepository` (call-site swap) → `DictionaryService` Strategy → `useSaveWord` extraction → `Router` + view relocation → slim `useSupabaseAuth`.
4. **Verification gate after each major step** — `npx tsc --noEmit` + `npm run lint` + `npm test` + actually launch the app. The gate is not satisfied until the app runs.

---

## 7. Decisions captured (from brainstorming)

- **Scope:** ambitious restructure (full re-layering with OOP service classes + DI), tempered by an explicit simplicity guardrail.
- **Surface (this spec):** Electron app only. Edge function + landing site are follow-on sub-projects (light consistency passes).
- **Approach:** Pragmatic OOP (classes where state lives) — not full hexagonal, not modules-only.
- **Views:** relocate `components/{Settings,SavedWords,Onboarding}.tsx` into `views/`.
- **Shared dir:** add top-level `shared/`.
- **DictionaryService:** formalize as Strategy.
- **SavedWords:** convert to a Repository class.

---

## 8. Risks

- **Build resolution of `shared/`** — mitigated by sequencing it first with a build smoke; fallback is `src/shared/` re-exported into the main build via a Vite alias.
- **Release-branch churn** — mitigated by one-unit-at-a-time sequencing and a full verification gate after each step; any step can stop and ship.
- **Call-site churn (Repository)** — mechanical and type-checked; `tsc` catches a missed site.
- **Over-abstraction** — guarded by the "class only where state lives" rule; the `DictionaryService` Strategy is the single speculative-generality concession, accepted deliberately for scalability.
