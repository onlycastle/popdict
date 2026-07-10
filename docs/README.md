# PopDict Documentation

This folder holds two kinds of docs. Read the ones meant for you.

## For contributors and users

Start with the top-level [README.md](../README.md) (install, run, configure) and
[CONTRIBUTING.md](../CONTRIBUTING.md) (dev setup, checks to run before a PR).

- [dmg-release-testing.md](dmg-release-testing.md) — how to sanity-check a
  packaged `.dmg` build before it ships.
- [download-tracking-runbook.md](download-tracking-runbook.md) — how the
  private download metric is wired end to end.
- [../IDIOM_SETUP.md](../IDIOM_SETUP.md) — deploying the idiom Edge Function.

### Architecture at a glance

```text
electron/    Electron main process — windows, IPC, global hotkey, tray,
             auto-updater, OAuth deep-link handling, navigation security.
src/         React renderer — the lookup UI, hooks, and services that call
             the dictionary sources and Supabase.
shared/      Types and pure helpers shared by main and renderer (auth URL
             parsing, feedback URLs) — unit-tested in isolation.
supabase/    Postgres migrations (RLS-protected user tables) and Edge
             Functions (idioms proxy, downloads metric, weekly quiz digest).
site/        Next.js marketing + legal site (App Router) and the download
             redirect that serves the latest GitHub release.
scripts/     Build, notarization, and the deterministic quality-gate harness.
```

## For the AI/automation harness

The files below are the working memory of the repo's agent harness — a domain
map and a set of deterministic gates. They are safe to read for context, but
they are maintained by the harness workflow, not hand-edited as ordinary docs.

- [harness.md](harness.md) — the quality gates, commands, and learnings ledger.
- [harness-routing.md](harness-routing.md) — task type → specialist skill →
  gates that must stay green.
- [harness-learnings.md](harness-learnings.md) — the learnings ledger.
- [llm-wiki/](llm-wiki/) — a compact, pointer-style domain map
  ([index](llm-wiki/index.md)) with `last-verified` frontmatter, kept in parity
  with the source by the `wiki-audit` gate.

If you are a human contributor, you never need to touch `llm-wiki/` or the
`harness-*` files to land a change — run the checks in
[CONTRIBUTING.md](../CONTRIBUTING.md) and open a PR.
