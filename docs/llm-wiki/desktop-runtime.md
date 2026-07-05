---
title: Desktop runtime (Electron)
last-verified: 2026-07-03
---

# Desktop runtime

Electron + Vite + React. The main process boots in
[electron/main.ts](../../electron/main.ts): single-instance lock (a second
launch focuses the running app — remember this when driving the app for
screenshots), navigation hardening, then windows, tray, hotkey, updater.

## Windows

- [electron/windows/windowSpecs.ts](../../electron/windows/windowSpecs.ts) —
  declarative specs for the four windows (popup, settings, saved,
  onboarding). All share one hardened `webPreferences` (contextIsolation on,
  nodeIntegration off, preload bridge). Secondary windows use native macOS
  vibrancy — the glass-minimal identity.
- [electron/windows/WindowManager.ts](../../electron/windows/WindowManager.ts) —
  creates/focuses windows. Dev loads the Vite dev server; packaged builds
  load `index.html` plus a `#hash` route. Packaged-only hash-routing bugs are
  learning L-001: always smoke the packaged app for window/routing changes.
- Renderer routing: [src/Router.tsx](../../src/Router.tsx) +
  [src/resolveRoute.ts](../../src/resolveRoute.ts) map the hash to views in
  `src/views/`.

## Input & shell integration

- Global hotkey: [electron/hotkey/HotkeyManager.ts](../../electron/hotkey/HotkeyManager.ts),
  shared config in [shared/hotkey.ts](../../shared/hotkey.ts).
- Tray: [electron/tray/TrayMenu.ts](../../electron/tray/TrayMenu.ts) (icon is
  bundled — regenerate with [scripts/gen-tray-icon.py](../../scripts/gen-tray-icon.py)).
- IPC: [electron/ipc/IpcRouter.ts](../../electron/ipc/IpcRouter.ts) routes to
  [electron/ipc/handlers.ts](../../electron/ipc/handlers.ts); the renderer
  sees only the [electron/preload.ts](../../electron/preload.ts) bridge.
- Persistence: [electron/store.ts](../../electron/store.ts).

## Updater

[electron/updater.ts](../../electron/updater.ts) — Squirrel.Mac via the free
update.electronjs.org feed, keyed by repo/platform-arch/version. Update
checks surface through
[electron/updateNotifications.ts](../../electron/updateNotifications.ts)
(notifications, dialogs, manual check). The feed was silently broken in every
1.1.x release (learning L-004); the URL shape is unit-tested now. Updates
install from the arch-named `.zip` release asset — no zip, no auto-update.

## Auth

OAuth lands via deep link:
[electron/auth/deepLinkProtocol.ts](../../electron/auth/deepLinkProtocol.ts)
registers the scheme,
[electron/auth/AuthCallbackBroker.ts](../../electron/auth/AuthCallbackBroker.ts)
brokers the callback to the renderer. URL building lives in
[shared/authUrl.ts](../../shared/authUrl.ts); the site half is the
`site/app/auth/` handoff page.

## Security invariants

[electron/security.ts](../../electron/security.ts) denies popups and blocks
in-app navigation to anything but the dev server or the packaged index
(policy: [electron/navigationPolicy.ts](../../electron/navigationPolicy.ts),
pure and unit-tested — learning L-005). Fuses are set in
[forge.config.ts](../../forge.config.ts). The `electron-invariants` gate
fails validation if any of this weakens.
