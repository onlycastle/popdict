# PopDict — Agent Entrypoint

PopDict is a macOS menu-bar dictionary: a global hotkey pops a glass-minimal
lookup window (English definitions, plus idioms via Supabase).
Electron + Vite + React desktop app, Next.js site in `site/`, Supabase edge
functions in `supabase/functions/`.

**This repo is PUBLIC.** Never commit secrets, security findings, internal
URLs, or real user data. Fixture credentials must be documented-fake values.

## Start here

1. [docs/llm-wiki/index.md](docs/llm-wiki/index.md) — compact domain map with
   outlinks to authoritative source files. Read the page for your domain
   before grepping around.
2. [docs/harness.md](docs/harness.md) — quality gates, commands, and the
   learnings ledger. `docs/harness-routing.md` maps task types to specialist
   skills.

## Commands

| Command | What it does |
|---|---|
| `npm test` | Vitest (app + shared + electron + harness gate units) |
| `npm run lint` | ESLint over the app (site lint is dead — Next 16 removed it) |
| `npx tsc --noEmit` | App typecheck |
| `npm run harness:validate` | All deterministic gates against the tracked tree |
| `npm run test:ci` | Everything CI runs, including site typecheck + tests |

## Hard rules

- Gates are deterministic and must stay green; weakening an invariant is a
  deliberate act done in the same commit as the refactor that moves it.
- Agents propose, gates decide, humans apply: never auto-mutate the harness
  to make a gate pass.
- A shipped release is a GitHub release with BOTH `.dmg` and `.zip` assets —
  merging to `main` ships nothing (see the release-ops wiki page).
- Local `main` can diverge from `origin/main`; check `git log origin/main..main`
  before branching or releasing.
