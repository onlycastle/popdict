# Harness Learnings

Failure classes this project has actually hit. Machine-parsed by the
`coverage-ratchet` gate — keep the field format exact (see
[harness.md](harness.md)). Public repo: keep Context generic; specifics and
anything security-sensitive stay local-only.

## L-001: Packaged builds diverge from dev (hash routing, window chrome)
- Status: Open
- Class: packaged-vs-dev
- Guard: (none — manual packaged-build smoke before release, see the release-ops wiki page)
- Context: Dev mode loads the Vite dev server; packaged builds load `index.html` plus a window hash. Bugs in hash routing and window behavior only reproduce in the packaged app, so dev-mode verification alone has shipped broken UX before.

## L-002: Release builds silently unsigned when env vars are missing
- Status: Closed
- Class: release-invariant
- Guard: script:scripts/release-arm64.sh::POPDICT_MAC_SIGNING_IDENTITY
- Context: With signing env unset, forge falls back to an empty config and produces an unsigned DMG that Gatekeeper rejects on user machines. The release script now aborts when the three build vars are missing.

## L-003: Local main can diverge from origin; a sync once dropped merged work
- Status: Open
- Class: branch-hygiene
- Guard: (none — release runbook requires checking git log origin/main..main first)
- Context: Releases build from the local checkout, which has carried unpushed commits. One sync-to-origin discarded already-merged UI work. Check divergence and backup branches before branching or releasing.

## L-004: Auto-update feed was broken in every 1.1.x release
- Status: Closed
- Class: release-invariant
- Guard: test:electron/updater.test.ts::update.electronjs.org
- Context: The Squirrel.Mac feed URL was malformed for arm64, so no 1.1.x install ever auto-updated. The updater is now unit-tested against the exact feed URL shape, and releases must attach the arch-named zip alongside the DMG.

## L-005: Renderer navigation policy had origin and file-host bypasses
- Status: Closed
- Class: electron-security
- Guard: test:electron/navigationPolicy.test.ts::shouldAllowNavigation
- Context: Navigation allow-listing compared raw string prefixes, which spoofed origins could pass. The policy is now a pure function comparing parsed origins and file host+path, with unit tests covering the bypass shapes.

## L-006: Service-role key must never leave the edge functions
- Status: Closed
- Class: secret-boundary
- Guard: gate:supabase-boundary
- Context: The Supabase service-role key bypasses row-level security entirely. It exists only inside edge functions, injected via env at deploy time; app, site, and script code never reference it.

## L-007: Site lint is dead — site gates are typecheck plus Vitest
- Status: Closed
- Class: ci-config
- Guard: script:package.json::cd site && npx tsc
- Context: Next 16 removed `next lint`, so the site lint script errors unconditionally. CI and test:ci gate the site with tsc and Vitest instead; do not re-add lint without installing a real ESLint setup.

## L-008: next build rewrites the tracked site/next-env.d.ts
- Status: Open
- Class: build-artifact
- Guard: (none — revert the file manually after site builds; never commit the rewrite)
- Context: Building the site locally rewrites a tracked type-declaration file. The diff is noise and must not be committed.

## L-009: Worktree node_modules symlink slips past a directory-only ignore
- Status: Closed
- Class: repo-hygiene
- Guard: script:.gitignore::**/node_modules
- Context: Worktree sessions symlink node_modules to the main checkout, and a trailing-slash ignore pattern (`node_modules/`) matches directories only — so `git add -A` staged the symlink, whose target is a machine-local absolute path that must not land in this public repo. The ignore pattern is now slash-free (`**/node_modules`), which matches the symlink too; reverting it reopens this learning.

## L-010: Fail-soft external-API integrations verified only against mocks
- Status: Open
- Class: mocked-integration
- Guard: (none — one-shot live smoke of generateStudyMaterial before first production send; watch sent/skipped counts on first cron runs)
- Context: The study-digest generator returns null on any failure and every test injects a fake fetch, so a bad credential or model-access problem in production is indistinguishable from "no cache misses" — digests silently shrink or skip with no red gate anywhere. Fail-soft plus mock-only testing needs a live smoke at deploy time.
