---
name: deploy-popdict
description: Use when shipping or releasing a new PopDict version, cutting a release, publishing a new build to users, or when the website's downloaded DMG is stale / still shows an old version after changes were merged to main.
---

# Deploy PopDict

## Overview

Shipping PopDict is a **manual release, not a git push**. The website's Download button (`site/app/download/latest/route.ts`) redirects to the **latest GitHub release** `.dmg`, and existing installs auto-update from that release's `.zip` (Squirrel.Mac via `electron/updater.ts`). Code merged to `main` is invisible to users until a GitHub release is cut. If someone reports "the downloaded app doesn't have my changes / still shows the old version," the cause is almost always a missing release.

## Prerequisites (one-time, already set up on the maintainer's machine)

- `.env.local` (gitignored) holds the three build vars: `POPDICT_GITHUB_REPO=onlycastle/popdict`, `POPDICT_MAC_SIGNING_IDENTITY="Developer ID Application: Sungman Cho (J756539YX6)"`, `POPDICT_NOTARY_PROFILE=popdict-notary`.
- The `popdict-notary` notarytool keychain profile exists (`xcrun notarytool history --keychain-profile popdict-notary` should succeed). Apple secrets live in the keychain, not in env.
- `gh` authed as `onlycastle` (the repo owner).

## Runbook

Run from the repo root on macOS (Apple Silicon):

```bash
# 1. Bump the version in the ROOT package.json (e.g. 1.0.0 -> 1.1.0).
#    Feature -> minor bump; fix-only -> patch. Do NOT bump site/package.json.

# 2. Load creds — the release script does NOT auto-load .env.
set -a; source .env.local; set +a

# 3. Gate + build + sign + notarize + staple + verify (~several min).
#    Runs tsc + lint + vitest first, then builds. Stops on any gate failure.
npm run release:arm64

# 4. Commit + push the version bump so the release tag points at the right commit.
git add package.json && git commit -m "chore(release): v<version>"
git push origin main

# 5. Publish the release with BOTH assets (the script prints the exact paths).
gh release create v<version> \
  out/make/PopDict-<version>-arm64.dmg \
  out/make/zip/darwin/arm64/PopDict-darwin-arm64-<version>.zip \
  --repo onlycastle/popdict \
  --title "PopDict <version>" \
  --notes "<what changed>"
```

The website serves the new DMG within ~5 minutes (route `revalidate: 300`). No site redeploy needed.

## Verify

- Release page lists **both** the `.dmg` and the `.zip`.
- `curl -sIL https://<site>/download/latest` (or the live site) redirects to the `<version>` DMG.
- `release:arm64` already ran `spctl` + `stapler validate` — confirm it printed "Release artifacts ready" with no errors.

## Common Mistakes

| Mistake | Consequence | Fix |
|---|---|---|
| Skip `source .env.local` (or vars unset) | Build **silently** produces an UNSIGNED dmg (`forge.config.ts:14` → `{}`; `scripts/notarize-dmg.js:68` skips) → Gatekeeper "app is damaged" | Always load the 3 vars; the script aborts if they're missing |
| Upload only the DMG, no ZIP | Existing users never auto-update (Squirrel pulls the arch-named `.zip`) | Always attach both assets |
| Create the release before pushing the bump | `v<version>` tag points at a commit without the version bump | Commit + push, then `gh release create` |
| Upload the ZIP path the script *prints* | Old-version ZIPs linger in `out/make/zip/`; the script's `find ... -quit` may print a STALE `<oldver>.zip` | Upload the version-matched `PopDict-darwin-arm64-<version>.zip`; verify the version in the filename (or `rm -rf out/make/zip` before building) |
| Bump `site/package.json` instead of / as well | No effect; the site shows no hardcoded version | Bump only the root `package.json` |

## Notes

- Fixing an already-published release instead of cutting a new one: `gh release upload v<version> <asset> --clobber`.
- If `codesign` throws a GUI keychain-password prompt, that needs a human click; on this machine the key is already authorized so it usually doesn't fire.
