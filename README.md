# PopDict

[![CI](https://github.com/onlycastle/popdict/actions/workflows/ci.yml/badge.svg)](https://github.com/onlycastle/popdict/actions/workflows/ci.yml)
[![Latest release](https://img.shields.io/github/v/release/onlycastle/popdict)](https://github.com/onlycastle/popdict/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![Platform: macOS](https://img.shields.io/badge/platform-macOS-lightgrey)

PopDict is a macOS menu-bar dictionary for English learners. Press one hotkey to
look up an English word, hear its pronunciation, see an optional translation,
and save it for later without leaving the app you are reading in.

![PopDict demo: press the hotkey, type a word, read the definition](docs/demo.gif)

## Install

[**Download for macOS (Apple Silicon)**](https://popdict.space/download/latest?source=github&cta=readme) —
signed, notarized, and auto-updating.

## Features

- Global hotkey popup, defaulting to `CommandOrControl+Shift+Space`.
- Bundled offline definitions, examples and installed system speech.
- Licensed English phrase and idiom definitions from Wiktionary via Kaikki.
- Local saved words and review without sign-in; optional account copies through Supabase.
- Free translations without sign-in in Korean, Japanese, Simplified Chinese,
  Spanish, and Brazilian Portuguese, built from Wiktionary via Kaikki.
- Offline search for bundled entries, clickable synonyms and antonyms, and
  spelling/base-form recovery when a word is not found.
- Saved Words cards with definitions, examples, translations, tags, private
  notes, CSV export, deterministic reviews, and local reminders.
- Recent search history, configurable hotkey, launch-at-login, and a menu-bar tray.
- Private in-app feedback with no account required.

## Requirements

- macOS 11 (Big Sur) or newer for the desktop app (Apple Silicon or Intel).
- Node.js 22.13+ or 24.x (matches `engines` in package.json) to build from source.

## Quick Start

```bash
npm install
cp .env.example .env.local
npm start
```

Basic English dictionary lookup works without cloud configuration. Phrase
lookup, translations, saving and review use the bundled dictionary and device library;
optional account transfers and email digests require a compatible Supabase backend;
only those optional account features require sign-in.
`.env.example` lists the local variables consumed by development builds.

## Development

```bash
npm start                 # Electron Forge + Vite dev app
npm run lint              # ESLint
npm test                  # Vitest
npx tsc --noEmit          # TypeScript check
npm run harness:validate  # deterministic quality gates (also run in CI)
```

To build your own copy of the app from source:

```bash
npm run package    # produces an unsigned app under out/
```

> Official builds are signed and notarized by the maintainer; apps you build
> from a fork are unsigned. The MIT license lets you use, modify, and
> redistribute the **code** freely — see the [Trademark](#trademark) note below
> about the PopDict **name and logo**.

## Project Structure

```text
electron/    Electron main process, preload bridge, local store, updater
src/         React renderer, hooks, services, styles, and shared types
shared/      Types and validation shared across app processes
data/        Generated multilingual dictionary dataset and notices
supabase/    Database migrations and operational Edge Functions
site/        Public Next.js landing and legal pages
scripts/     Build, dataset, harness, and notarization helpers
```

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. App users can
send private feedback from PopDict’s menu bar or Settings; public, reproducible bug
reports and contributor proposals can still use GitHub Issues.

## Security

Read [SECURITY.md](SECURITY.md) for vulnerability reporting guidance. Do not post
secrets or private account data in public issues.

## Acknowledgements

PopDict bundles the open-source fonts Fraunces and JetBrains Mono under the SIL
Open Font License. Bundled definitions come from Simple English Wiktionary / Kaikki and WordNet 3.1;
translations come from English Wiktionary via Kaikki and use the NGSL-GR
learner headword list. Full attributions and transformation details are in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Trademark

The MIT license covers PopDict's source code. The name "PopDict" and the PopDict
logo are **not** part of the MIT grant. Please don't use them in a way that
implies endorsement by or affiliation with the project, and rebrand forks you
redistribute under your own name.

## License

PopDict application code is MIT licensed; see [LICENSE](LICENSE). The generated
translation dataset and normalized 5,049-word NGSL-GR list in
[`data/translations/`](data/translations/README.md), plus the phrase dataset in
[`data/phrases/`](data/phrases/README.md), are separately licensed under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
