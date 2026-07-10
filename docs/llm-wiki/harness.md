---
title: Harness
last-verified: 2026-07-03
---

# Harness

Deterministic gate layer + learnings ledger. Operating model, commands, and
the gate table live in [docs/harness.md](../harness.md) — read that first.

## Quick map

- Gate implementations: `scripts/harness/*.mjs`, one module per gate, shared
  contract in [scripts/harness/lib.mjs](../../scripts/harness/lib.mjs),
  runner [scripts/harness/validate.mjs](../../scripts/harness/validate.mjs).
- Gate unit tests + fixtures: `scripts/harness/*.test.mjs`,
  `scripts/harness/fixtures/` (fixtures carry documented-fake secrets only).
- Learnings ledger: [docs/harness-learnings.md](../harness-learnings.md) —
  machine-parsed; Closed entries must keep a resolving guard
  (coverage-ratchet gate).
- Task routing: `docs/harness-routing.md` — kept in parity with
  `.claude/skills/` by the harness-drift gate.

## Principles

- Agents propose, gates decide, humans apply.
- Every gate must be green on every commit; a gate that blocks you is
  telling you to either fix the change or move the invariant deliberately in
  the same commit.
- Phase 3 (run manifests, failure aggregation, proposals) is deferred — see
  the "Deferred" section of [docs/harness.md](../harness.md). Don't build it
  ad hoc.
