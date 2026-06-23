# Changelog

All notable changes to PopDict are documented here. This project adheres to
[Semantic Versioning](https://semver.org/).

## [1.0.0] — 2026-06-23

First public release. A macOS menu-bar dictionary for English learners.

### Added
- **Instant lookup** from a global hotkey (default `⌘⇧Space`) in a floating glass popup.
- **Select-to-lookup** — press the hotkey to search the text selected in the frontmost
  app (requires Accessibility permission; toggle in Settings).
- **Audio pronunciation** — play the recorded clip when available, with a built-in
  text-to-speech fallback.
- **Idioms & phrases** for multi-word queries, served through a Supabase Edge Function so
  the upstream token stays server-side.
- **Saved Words** — sign in with Google to save words; review, filter, delete, and
  re-look-up them from the Saved Words window. "Saved" state persists across restarts.
- **Recent searches**, **launch at login**, and a configurable global hotkey.

### Security
- Renderer/navigation hardening: new-window opens denied, in-app navigation to remote
  origins blocked, external links routed to the system browser, and a strict
  Content-Security-Policy in production builds.
- Electron Fuses (no RunAsNode, cookie encryption, ASAR integrity) and a hardened,
  Developer ID–signed, notarized build.

### Developer
- Working static-analysis gate (`tsc --noEmit` + ESLint) wired into the release preflight.
- Auto-update via `update.electronjs.org` (enabled once the repo is public).
