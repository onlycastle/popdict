# PopDict Harness — Operating Model

The harness is a deterministic gate layer plus a learnings ledger. Agents and
humans propose changes; gates decide mechanically; nothing in the harness
mutates the repo on its own. Every gate reads only the git-tracked tree — no
network, no model judgement, no flakiness.

## Commands

| Command | What it runs |
|---|---|
| `npm run harness:validate` | All gates via [scripts/harness/validate.mjs](../scripts/harness/validate.mjs); non-zero exit on any violation |
| `npm run harness:test` | Vitest over the gate implementations (fixture-based) |
| `npm run test:ci` | typecheck + lint + app tests + gates + site typecheck + site tests (what CI runs) |

## Gates

| Gate | Enforces |
|---|---|
| `secret-scan` | No key material in any tracked file (precise patterns; fixtures exempt and fake-only) |
| `doc-links` | Tracked markdown never 404s and never links into local-only paths (`docs/superpowers/`, `.claude/` except skills, `output/`) |
| `wiki-audit` | llm-wiki page contract: frontmatter, ≤120 lines, `last-verified` within 180 days |
| `electron-invariants` | Hardened webPreferences, navigation policy wired, fuses set, updater feed present; forbidden patterns (`contextIsolation: false`, …) nowhere in `electron/`/`src/` |
| `supabase-boundary` | Service-role key exists only inside edge functions via `Deno.env.get`; downloads endpoints stay env-token gated |
| `coverage-ratchet` | Every Closed learning keeps a resolving guard (see below) |
| `harness-drift` | Tracked skills ↔ routing rows ↔ documented commands stay in parity |

## Learnings ledger

[docs/harness-learnings.md](harness-learnings.md) records failure classes
this project has actually hit. Entry contract (machine-parsed):

```md
## L-007: short title
- Status: Open | Closed
- Class: short-slug
- Guard: test:<path>[::needle] | script:<path>[::needle] | gate:<id> | (none — reason)
- Context: one public-safe paragraph.
```

Lifecycle: a learning opens when a failure class is identified. It may be
marked Closed only when a deterministic guard exists; the coverage-ratchet
gate verifies the guard still resolves on every run. Deleting the guarding
test reopens the learning by failing CI. Security-sensitive detail never goes
in this file — the tracked entry carries only the generic invariant and its
guard; specifics stay local.

## Routing

`docs/harness-routing.md` maps task types to the specialist skills under
`.claude/skills/`. The `harness-drift` gate keeps the table and the tracked
skills in parity, so a stale row or an unrouted skill fails validation.

## Deferred (Phase 3 — not implemented)

Run manifests, failure aggregation (`harness:failures`), regression evals
(`harness:evals`), and proposal stubs (`harness:propose`) are deliberately
NOT built. They need a deterministic run-recording mechanism (hooks) and real
run volume to be signal rather than noise. Do not document them as existing;
this section is the only sanctioned mention.
