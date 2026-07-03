---
name: privacy-security
description: Use when work touches secrets, auth flows, renderer/navigation security, Supabase keys or tokens, or anything that could leak into this PUBLIC repository.
---

# Privacy & Security Specialist

This repo is PUBLIC. The blast radius of a mistake is permanent (forks,
caches, archives) — treat every tracked byte as published.

## Boundaries (gate-enforced)

- No key material in tracked files — `secret-scan` gate. Fixtures use
  documented-fake values only.
- Service-role key lives exclusively in edge functions via `Deno.env.get` —
  `supabase-boundary` gate (learning L-006).
- Electron hardening (context isolation, navigation policy, fuses) —
  `electron-invariants` gate (learning L-005).

## Working rules

- Security findings, audit reports, and remediation plans stay LOCAL
  (gitignored) — never commit them. Tracked learnings carry only the
  generic invariant + guard, no exploit detail.
- Auth changes touch both halves: deep-link broker in `electron/auth/` and
  the site handoff in `site/app/auth/` — review them together.
- Apple/notary secrets live in the macOS keychain; build vars in
  `.env.local`. Neither is ever echoed into logs, docs, or fixtures.
- If a real secret ever lands in history: rotate it FIRST, then clean up.

## Verification

`npm run harness:validate` plus a manual read of the full diff asking one
question: "what does this reveal to a stranger cloning the repo?"
