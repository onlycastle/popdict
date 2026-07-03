# PopDict

[![CI](https://github.com/onlycastle/popdict/actions/workflows/ci.yml/badge.svg)](https://github.com/onlycastle/popdict/actions/workflows/ci.yml)
[![Latest release](https://img.shields.io/github/v/release/onlycastle/popdict)](https://github.com/onlycastle/popdict/releases/latest)
[![License: MIT](https://img.shields.io/github/license/onlycastle/popdict)](LICENSE)
![Platform: macOS (Apple Silicon)](https://img.shields.io/badge/platform-macOS%20%28Apple%20Silicon%29-black)

PopDict is a macOS menu-bar dictionary for English learners. Press one hotkey to
look up a word or idiom, hear pronunciation, and save words for later without
leaving the app you are reading in.

![PopDict demo: press the hotkey, type a word, read the definition](docs/demo.gif)

## Install

[**Download for macOS (Apple Silicon)**](https://popdict.space/download/latest) —
signed, notarized, and auto-updating.

Or with Homebrew:

```bash
brew install --cask onlycastle/tap/popdict
```

## Features

- Global hotkey popup, defaulting to `CommandOrControl+Shift+Space`.
- Optional select-to-lookup for highlighted text on macOS.
- Free Dictionary API definitions with audio playback and text-to-speech fallback.
- Korean ↔ English: Hangul lookups through the National Institute of Korean
  Language's Basic Korean Dictionary (krdict), plus Korean translations alongside
  English definitions.
- Idiom and phrase lookup through a Supabase Edge Function proxy.
- Google sign-in for saved words, backed by Supabase.
- Recent search history, configurable hotkey, launch-at-login, and a menu-bar tray.

## Requirements

- macOS for the desktop app.
- Node.js 20 or newer.
- A Supabase project if you want auth, saved words, or idiom lookups.

## Quick Start

```bash
npm install
cp .env.example .env.local
npm start
```

The app can run without Supabase configured, but saved words and idioms are disabled
until you provide Supabase settings.

## Configuration

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL for auth, saved words, and Edge Functions. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key safe to ship in the renderer bundle. |
| `VITE_SUPABASE_AUTH_REDIRECT_URL` | OAuth callback URL. Defaults to `https://popdict.space/auth/callback`, which forwards into the desktop app. |

## Supabase Setup

1. Enable Google sign-in in Supabase Auth.
2. Add `https://popdict.space/auth/callback` to Supabase Auth redirect URLs.
   If you override `VITE_SUPABASE_AUTH_REDIRECT_URL`, add that exact URL instead.
3. Apply migrations:
   ```bash
   supabase link --project-ref <project-ref>
   supabase db push
   ```
4. Deploy the idiom Edge Function if you want phrase lookup:
   ```bash
   supabase functions deploy idioms
   supabase secrets set STANDS4_UID=your_uid STANDS4_TOKEN=your_tokenid
   ```

More detail is in [IDIOM_SETUP.md](IDIOM_SETUP.md).

## Development

```bash
npm start          # Electron Forge + Vite dev app
npm run lint       # ESLint
npm test           # Vitest
npx tsc --noEmit   # TypeScript check
```

To build your own copy of the app from source for personal use:

```bash
npm run package    # produces an unsigned app under out/
```

> Official signed and notarized releases are published only by the maintainer.
> Builds you produce from a fork are unsigned and intended for personal use, not
> redistribution.

## Project Structure

```text
electron/    Electron main process, preload bridge, local store, updater
src/         React renderer, hooks, services, styles, and shared types
supabase/    Database migrations and the idiom Edge Function
site/        Public Next.js landing and legal pages
scripts/     Build and notarization helpers
```

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Product bugs
and feature requests should go through GitHub Issues.

## Security

Read [SECURITY.md](SECURITY.md) for vulnerability reporting guidance. Do not post
secrets or private account data in public issues.

## License

MIT. See [LICENSE](LICENSE).
