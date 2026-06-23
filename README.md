# PopDict

**A macOS menu-bar dictionary for English learners.** Press one hotkey, look up any
word or idiom, hear how it's pronounced, and save it to review later — without leaving
whatever you're reading.

## Features

- **Instant lookup** — a global hotkey (default `⌘⇧Space`) opens a floating glass popup.
- **Select-to-lookup** — highlight a word in any app, press the hotkey, and PopDict
  searches it automatically (requires Accessibility permission; toggle in Settings).
- **Audio pronunciation** — plays the recorded clip when available, with a text-to-speech
  fallback so every word can be heard.
- **Idioms & phrases** — multi-word queries also return idiomatic meanings.
- **Saved words** — sign in with Google to save words and review, filter, or delete them
  from the Saved Words window. Saved state persists across restarts.
- **Recent searches**, **launch at login**, and a configurable hotkey.

> Requires macOS (Apple Silicon). Free.

## Tech stack

Electron · React · TypeScript · Vite · Tailwind CSS · Framer Motion · Supabase
(auth + saved words + idiom proxy).

## Development

Requires Node.js ≥ 20.

```bash
npm install
cp .env.example .env.local   # add your Supabase URL + publishable key
npm start                    # run in development (Electron Forge + Vite)
```

Quality gate (also run in the release preflight):

```bash
npx tsc --noEmit && npm run lint && npm test
```

### Supabase setup (auth, saved words, idioms)

1. **Google sign-in** — enable the Google provider in Supabase Auth, add
   `popdict://auth/callback` to *Additional Redirect URLs*, and configure your Google
   OAuth client's authorized origins/redirect URIs to match the Supabase callback. After
   Google sign-in, the app receives the `popdict://auth/callback` deep link and exchanges
   it for a Supabase session.
2. **Saved words table** — apply the migration:
   ```bash
   supabase link --project-ref <project-id>
   supabase db push   # migrations/20260623074337_create_saved_words.sql
   ```
3. **Idioms** — deploy the Edge Function and set the STANDS4 token as a secret (it never
   ships in the app). See [IDIOM_SETUP.md](IDIOM_SETUP.md).

## Building & releasing

```bash
npm run release:arm64   # preflight (tsc, lint, tests, Gatekeeper) → signed, notarized DMG + zip
```

This produces a notarized `.dmg` (the download) and a `.zip` (the Squirrel.Mac
auto-update artifact). Upload **both** to the GitHub release. Auto-update activates once
the repo is public and `GITHUB_REPO` is set in `electron/updater.ts`.

Other scripts: `npm run package`, `npm run make`, `npm run lint`, `npm test`.

## Project structure

```
PopDict/
├── electron/            # Electron main process, preload, store, updater, selection
├── src/
│   ├── components/       # React components (search, results, settings, saved words…)
│   ├── hooks/            # useDictionarySearch, useSupabaseAuth
│   ├── services/         # dictionaryApi, savedWords, supabaseClient
│   ├── utils/            # pronounce (audio + TTS)
│   └── types/            # shared types
├── supabase/            # migrations + functions/idioms (Edge Function)
└── forge.config.ts      # build, signing, makers
```

## License

MIT — see [LICENSE](LICENSE).

## Author

Sungman Cho (sungman.cho@originlayer.net)
