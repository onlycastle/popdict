# DMG Release Testing

How to test a PopDict release DMG the way a real user experiences it — download,
Gatekeeper, install, first run — before publishing. Automated by
[`scripts/test-dmg.sh`](../scripts/test-dmg.sh).

## Why this exists

Dev mode (`npm start`) hides the bugs that only appear in a packaged, signed,
downloaded build: notarization/Gatekeeper rejection, hash-routing in secondary
windows, first-run onboarding, and OS-level shortcut re-registration. The DMG is
the only place those surface, so every release gets smoke-tested from a clean
state before it ships.

## The one principle

**Test from a clean state, as if the app has never run on this machine.** Your
dev Mac already trusts the app, caches its config, and a locally *built* DMG has
no `com.apple.quarantine` bit — so it skips the exact Gatekeeper check a browser
download triggers. Most "works for me, broken for users" bugs live in that gap.

Highest fidelity: download the actual uploaded GitHub release asset in a browser
and test that. `scripts/test-dmg.sh` approximates it for a local pre-release DMG
by applying the quarantine attribute itself.

## Prerequisites

- Apple Silicon Mac (the release is `arm64`; test x64 separately if ever shipped).
- Node 20.19+, 22.12+, or 24.x. If the active Node is unsupported, the script
  will use an installed Homebrew version from that range and rebuild the native
  DMG dependency before continuing.
- Release signing and notarization credentials in `.env.local`. When the
  version-matched DMG is missing, `scripts/test-dmg.sh` runs
  `npm run release:arm64` automatically to sign, notarize, and staple it.
  An unsigned `npm run make:local` DMG is fine for *feature* testing but will **not**
  reproduce the Gatekeeper/notarization install flow.

## Quick start

```bash
# Full guided run: build if missing → verify → clean → install → checklist
scripts/test-dmg.sh

# Or a specific phase:
scripts/test-dmg.sh build       # force a fresh signed/notarized release build
scripts/test-dmg.sh verify      # signature + notarization checks only
scripts/test-dmg.sh clean       # wipe to a first-run state (destructive, confirms)
scripts/test-dmg.sh install     # quarantine + mount + copy to /Applications + launch
scripts/test-dmg.sh checklist   # just the interactive GUI checklist
scripts/test-dmg.sh uninstall   # remove the installed app, config, and login item

# Point at a specific DMG (default: out/make/PopDict-<package.json version>-arm64.dmg)
scripts/test-dmg.sh --dmg out/make/PopDict-1.2.0-arm64.dmg
```

## What the script automates

| Phase | Does |
|-------|------|
| `build` | Runs the signed/notarized arm64 release pipeline; `all` invokes this automatically when the expected DMG is missing |
| `verify` | `spctl` acceptance + `xcrun stapler validate` on the DMG |
| `clean` | Quits the app; removes `/Applications/PopDict.app`, `~/Library/Application Support/PopDict/`, and the login item (each confirmed) |
| `install` | Applies the download quarantine bit, mounts the DMG, copies the app to `/Applications`, ejects, re-checks the installed app's signature/notarization/codesign, then launches it |
| `checklist` | Walks the manual GUI checks below, recording pass/fail |

## Manual GUI checklist (what the script prompts for)

These can't be automated — you watch the app and answer pass/fail:

1. **First run** — onboarding window appears, tray icon shows, **no Dock icon**.
2. **Default hotkey** ⌘⇧Space toggles the search popup.
3. **Hotkey renders as keycaps** (⌘ ⇧ Space) in Settings, not the raw accelerator string.
4. **Rebind works end-to-end** — Settings → **Change** → press a new combo → the
   **new combo actually toggles the popup**. This proves the OS shortcut
   re-registers; unit tests can't cover it.
5. **Invalid combo** (no ⌘/⌃/⌥) shows `⚠ Must include ⌘, ⌃, or ⌥` and stays recording.
6. **Esc/Cancel** clears the message and restores the previous hotkey.
7. **Reset** returns to ⌘ ⇧ Space and disables the Reset button.
8. **Secondary windows open to the correct view** — Settings, Saved Words, onboarding.
   This is the packaged-only routing bug class; dev mode won't reveal a regression.
9. **Persistence** — quit + relaunch; the rebound hotkey survives (stored in
   `popdict-config.json`).
10. **Launch at login** — toggle on, log out/in or reboot, confirm auto-start, then turn off.

## Gatekeeper: what "good" looks like

- `verify`/`install` report **accepted** with **Notarized Developer ID**.
- First launch shows at most macOS's *"downloaded from the internet, are you sure?"*
  prompt — **never** a hard *"unidentified developer / cannot be opened"* block.

## Iterating

Between test rounds, re-run `scripts/test-dmg.sh clean` so each run is a genuine
first-run, not an upgrade.

## Not covered locally

**Auto-update** (Squirrel pulls the ZIP from the GitHub release) can only be
tested end-to-end with a *published* release: install v_current, publish v_next,
confirm the app self-updates.
