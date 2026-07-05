---
name: popdict-foreman
description: Use when a PopDict task spans multiple domains (app + site + supabase + release) or when you need to pick which specialist skill and gates apply before starting work.
---

# PopDict Foreman

Coordinator for multi-domain work. Your job is routing and sequencing, not
writing code.

## Process

1. Read [docs/harness-routing.md](../../../docs/harness-routing.md) and pick
   the SMALLEST set of specialist skills that covers the task. One domain →
   one specialist; don't fan out by default.
2. Read the wiki page for each involved domain
   ([index](../../../docs/llm-wiki/index.md)) before touching code.
3. Sequence gates-first: identify which deterministic gates and tests must
   stay green, run them before AND after the change
   (`npm run harness:validate`, `npm test`).
4. For non-trivial changes, get an independent pass from `qa-reviewer`
   before declaring done.
5. If the work surfaced a new failure class, add an Open learning to
   [docs/harness-learnings.md](../../../docs/harness-learnings.md) — it may
   only be Closed once a deterministic guard lands.

## Hard rules

- Agents propose, gates decide, humans apply — never weaken a gate to make
  work pass.
- Public repo: nothing security-sensitive in tracked files.
- Shipping = GitHub release with dmg + zip (route release work to
  `deploy-popdict`), never just a merge.
