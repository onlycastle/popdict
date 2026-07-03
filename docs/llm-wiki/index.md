---
title: PopDict llm-wiki index
last-verified: 2026-07-03
---

# llm-wiki

Compact, current-state pointer layer. Each page maps one domain and outlinks
to the authoritative source files instead of copying rationale. Contract
(enforced by the `wiki-audit` gate): frontmatter with `title` and
`last-verified`, at most 120 lines, links must resolve. When you verify a
page against the code, bump its `last-verified` date; pages older than 180
days fail validation.

## Domains

| Page | Covers |
|---|---|
| [desktop-runtime](desktop-runtime.md) | Electron main process: windows, hotkey, tray, IPC, updater, auth callback, security |
| [dictionary-data](dictionary-data.md) | Lookup routing, dictionary sources, Supabase functions, migrations, ETL |
| [site-downloads](site-downloads.md) | Next.js site, download redirect, tracking, cron, admin dashboard |
| [release-ops](release-ops.md) | Cutting a release: build, sign, notarize, publish, update feed |
| [harness](harness.md) | Quality gates, learnings ledger, routing |

## Ground rules

- Current state only — history lives in git, rationale lives in the linked
  source files and their comments.
- Public repo: no security findings, no internal URLs, no secrets.
- If a page contradicts the code, the code wins; fix the page and bump
  `last-verified`.
