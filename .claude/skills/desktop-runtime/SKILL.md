---
name: desktop-runtime
description: Use when changing Electron main-process code — windows, IPC, global hotkey, tray, auto-updater, auth deep links, navigation/security policy, or anything under electron/.
---

# Desktop Runtime Specialist

Domain map: [docs/llm-wiki/desktop-runtime.md](../../../docs/llm-wiki/desktop-runtime.md)
— read it first; it links the authoritative files.

## Non-negotiables (gate-enforced)

- All windows share the hardened `webPreferences` in
  [windowSpecs.ts](../../../electron/windows/windowSpecs.ts); never set
  `contextIsolation: false` / `nodeIntegration: true` anywhere — the
  `electron-invariants` gate fails the build.
- Navigation policy stays a pure, unit-tested function
  ([navigationPolicy.ts](../../../electron/navigationPolicy.ts)); renderer
  gets capabilities only via [preload.ts](../../../electron/preload.ts).
- Updater feed shape is load-bearing (learning L-004) — touch
  [updater.ts](../../../electron/updater.ts) only with its tests.

## Verification

1. `npm test` + `npx tsc --noEmit` + `npm run harness:validate`.
2. Dev smoke is NOT enough for window/routing/UX changes: packaged builds
   load `index.html#hash` and behave differently (learning L-001). Launch
   the packaged app before calling it done. The installed app holds a
   single-instance lock — quit it before driving a local build.
