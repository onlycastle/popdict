---
title: Release ops
last-verified: 2026-07-14
---

# Release ops

Shipping is a MANUAL GitHub release, not a git push — code merged to `main`
is invisible to users until a release carries both a `.dmg` (new installs via
the site redirect) and an arch-named `.zip` (auto-updates via Squirrel.Mac).
The step-by-step runbook lives in the `deploy-popdict` skill
(`.claude/skills/`); this page maps the machinery.

## Pipeline

1. Bump the ROOT `package.json` version (never `site/package.json`).
2. Use Node 20.19+, 22.12+, or 24.x. The release script rejects unsupported runtimes;
   Electron Forge 7 can exit during package finalization without producing an
   app under Node 26 (learning L-012). After switching Node versions, run
   `npm rebuild macos-alias`; the preflight rejects a stale native ABI before
   signing begins (learning L-013).
3. `set -a; source .env.local; set +a` — loads the three build vars
   (`POPDICT_GITHUB_REPO`, `POPDICT_MAC_SIGNING_IDENTITY`,
   `POPDICT_NOTARY_PROFILE`). Without them the build silently produces an
   UNSIGNED dmg (learning L-002) — the release script aborts if they're
   missing.
4. `npm run release:arm64` →
   [scripts/release-arm64.sh](../../scripts/release-arm64.sh): quality gates,
   forge build ([forge.config.ts](../../forge.config.ts)), DMG assembly
   ([create-dmg.js](../../create-dmg.js)), notarization + stapling
   ([scripts/notarize-dmg.js](../../scripts/notarize-dmg.js)), spctl verify.
5. Commit + push the version bump, THEN `gh release create v<version>` with
   BOTH assets. Zip paths in `out/make/zip/` can be stale — verify the
   version in the filename.

## Invariants & traps

- Check `git log origin/main..main` before branching or releasing — local
  main has diverged before and a sync once dropped merged work (L-003).
- The update feed (update.electronjs.org) names releases by tag; the feed URL
  shape is unit-tested ([electron/updater.ts](../../electron/updater.ts),
  L-004). No zip asset ⇒ existing users never update.
- Packaged builds behave differently from dev (hash routing, window chrome) —
  smoke the packaged app before publishing (L-001). Manual DMG test notes:
  [docs/dmg-release-testing.md](../dmg-release-testing.md).
- Site picks up the new release automatically within ~5 minutes (see
  [site-downloads](site-downloads.md)).
