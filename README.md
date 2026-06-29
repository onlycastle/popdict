# PopDict

PopDict is a macOS menu-bar dictionary for English learners. Press one hotkey to
look up a word or idiom, hear pronunciation, and save words for later without
leaving the app you are reading in.

## Features

- Global hotkey popup, defaulting to `CommandOrControl+Shift+Space`.
- Optional select-to-lookup for highlighted text on macOS.
- Free Dictionary API definitions with audio playback and text-to-speech fallback.
- Idiom and phrase lookup through a Supabase Edge Function proxy.
- Google sign-in for saved words, backed by Supabase.
- Recent search history, configurable hotkey, launch-at-login, and a menu-bar tray.
- GitHub release auto-update support for public macOS releases.

## Requirements

- macOS for the desktop app.
- Node.js 20 or newer.
- A Supabase project if you want auth, saved words, or idiom lookups.
- A public GitHub repository if you want release downloads, app feedback links, and
  auto-updates.

## Quick Start

```bash
npm install
cp .env.example .env.local
npm start
```

The app can run without Supabase configured, but saved words and idioms are disabled
until you provide Supabase settings.

## Configuration

Root app environment:

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL for auth, saved words, and Edge Functions. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key safe to ship in the renderer bundle. |
| `VITE_SUPABASE_AUTH_REDIRECT_URL` | OAuth callback URL. Defaults to `https://popdict.space/auth/callback`, which forwards into the desktop app. |
| `POPDICT_GITHUB_REPO` | `owner/repo` used at release build time for auto-updates and GitHub Issues feedback links. |
| `POPDICT_MAC_SIGNING_IDENTITY` | Developer ID signing identity. Required only for signed release builds. |
| `POPDICT_NOTARY_PROFILE` | `notarytool` keychain profile. Required only for signed release builds. |

Site environment:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Public URL for site metadata. |
| `GITHUB_REPO` | `owner/repo` used by `/download/latest` and public GitHub links. |

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

Useful build commands:

```bash
npm run package      # package the app locally
npm run make         # create distributable artifacts; unsigned if signing env is absent
npm run make:local   # local unsigned macOS package + DMG helper
```

## Site

The Next.js site lives in `site/`.

```bash
cd site
npm install
cp .env.example .env.local
npm run dev
```

`/download/latest` redirects to the newest `.dmg` asset in the GitHub repository
configured by `GITHUB_REPO`.

## Release

Public macOS releases require a public GitHub repo, a Developer ID signing identity,
and a configured notary profile:

```bash
POPDICT_GITHUB_REPO=owner/repo \
POPDICT_MAC_SIGNING_IDENTITY="Developer ID Application: Example (TEAMID)" \
POPDICT_NOTARY_PROFILE=notary-profile-name \
npm run release:arm64
```

The release script runs the quality gate, builds signed macOS artifacts, verifies
Gatekeeper/notarization, and prints the `.dmg` and `.zip` paths to upload to the
GitHub release. The `.zip` is required for Squirrel.Mac auto-updates.

## Project Structure

```text
electron/    Electron main process, preload bridge, local store, updater
src/         React renderer, hooks, services, styles, and shared types
supabase/    Database migrations and the idiom Edge Function
site/        Public Next.js landing and legal pages
scripts/     Release and notarization helpers
```

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Product bugs
and feature requests should go through GitHub Issues on the configured public repo.

## Security

Read [SECURITY.md](SECURITY.md) for vulnerability reporting guidance. Do not post
secrets or private account data in public issues.

## License

MIT. See [LICENSE](LICENSE).
