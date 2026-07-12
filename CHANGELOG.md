# Changelog

All notable changes to PopDict are documented here. This project adheres to
[Semantic Versioning](https://semver.org/).

## [1.5.0] - 2026-07-12

### Changed
- Recent searches now start folded, keeping the lookup window compact until
  history is needed.

## [1.4.0] - 2026-07-06

### Added
- Weekly study digest emails: study cards (definition, examples, similar
  expressions) plus spaced-repetition exercises for saved words, with
  one-click answer links.
- In-app Review screen: practice due saved words one card at a time
  (multiple choice with an instant study-card reveal), opened from a
  "Review" chip in the search bar or a deep link in the study email. Spaced
  repetition is shared with the digest; the weekly streak stays tied to the
  email.

## [1.3.0] - 2026-07-05

### Removed
- Korean support: Korean→English lookups (krdict), English→Korean gloss
  augmentation, and Korean text-to-speech. PopDict is an English-medium
  product.

## [1.2.0] - 2026-07-03

### Added
- Korean to English lookup through the krdict Supabase Edge Function.
- English to Korean translations from the bundled dictionary dataset.
- Visible auto-update notifications, manual update checks, and install prompts.

### Changed
- Refreshed the landing page hero and product demo presentation.

### Fixed
- Arm64 auto-update feed configuration now points at the correct update channel.
- Updater tests now run in CI without requiring the Electron binary download.

## [1.1.2] - 2026-07-02

### Added
- Private download tracking through the website download redirect, backed by a
  token-gated Supabase Edge Function and daily GitHub release snapshots.

### Fixed
- macOS menu-bar tray icon now uses the colored PopDict tray asset in packaged
  builds instead of a template icon that macOS flattens to monochrome.

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
