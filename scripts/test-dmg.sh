#!/usr/bin/env bash
#
# test-dmg.sh — guided QA for the PopDict release DMG.
#
# Automates every CLI-typeable step of testing a packaged build the way a real
# user gets it (verify signature/notarization → wipe to a first-run state →
# simulate a quarantined download install → launch), then walks you through the
# GUI-only checks interactively.
#
# See docs/dmg-release-testing.md for the full rationale.
#
# Usage:
#   scripts/test-dmg.sh [all|verify|clean|install|checklist|uninstall] [--dmg PATH]
#
# Default subcommand is `all`. DMG defaults to
# out/make/PopDict-<package.json version>-arm64.dmg.

set -uo pipefail   # NOT -e: Gatekeeper rejection is a finding to report, not a crash.

APP_NAME="PopDict"
ARCH="arm64"
CONFIG_DIR="$HOME/Library/Application Support/$APP_NAME"
INSTALL_PATH="/Applications/$APP_NAME.app"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# --- output helpers --------------------------------------------------------
if [ -t 1 ]; then
  c_reset=$'\033[0m'; c_bold=$'\033[1m'
  c_green=$'\033[32m'; c_red=$'\033[31m'; c_yellow=$'\033[33m'; c_blue=$'\033[34m'
else
  c_reset=''; c_bold=''; c_green=''; c_red=''; c_yellow=''; c_blue=''
fi
step() { printf '\n%s==> %s%s\n' "$c_blue$c_bold" "$*" "$c_reset"; }
ok()   { printf '%s  ✓ %s%s\n' "$c_green" "$*" "$c_reset"; }
warn() { printf '%s  ! %s%s\n' "$c_yellow" "$*" "$c_reset"; }
bad()  { printf '%s  ✗ %s%s\n' "$c_red" "$*" "$c_reset"; }
die()  { bad "$*"; exit 1; }

FAILURES=0
RESULTS=""   # newline-separated "STATUS: label" log (bash 3.2 friendly, no arrays)

record() { RESULTS="${RESULTS}${1}"$'\n'; }

confirm() { # confirm "message" -> 0 if yes
  local reply
  printf '%s%s%s [y/N] ' "$c_yellow" "$1" "$c_reset"
  read -r reply
  [ "$reply" = "y" ] || [ "$reply" = "Y" ]
}

assess() { # assess "label" cmd...  — runs cmd quietly, reports pass/fail
  local label="$1"; shift
  local out
  if out="$("$@" 2>&1)"; then
    ok "$label"; record "PASS: $label"
  else
    bad "$label"; printf '%s\n' "$out" | sed 's/^/        /'
    record "FAIL: $label"; FAILURES=$((FAILURES + 1))
  fi
}

check() { # check "item" — interactive manual pass/fail/skip
  local reply
  printf '   %s?\n     %s[p]ass / [f]ail / [s]kip: %s' "$1" "$c_yellow" "$c_reset"
  read -r reply
  case "$reply" in
    p|P) ok "$1"; record "PASS: $1" ;;
    f|F) bad "$1"; record "FAIL: $1"; FAILURES=$((FAILURES + 1)) ;;
    *)   warn "skipped: $1"; record "SKIP: $1" ;;
  esac
}

# --- arg parsing -----------------------------------------------------------
CMD="all"
DMG=""
while [ $# -gt 0 ]; do
  case "$1" in
    all|verify|clean|install|checklist|uninstall) CMD="$1"; shift ;;
    --dmg) DMG="${2:-}"; shift 2 ;;
    -h|--help)
      sed -n '2,20p' "$0" | sed 's/^#//'; exit 0 ;;
    *) die "unknown argument: $1 (see --help)" ;;
  esac
done

if [ -z "$DMG" ]; then
  VERSION="$(node -p "require('./package.json').version" 2>/dev/null || true)"
  [ -n "$VERSION" ] || die "could not read version from package.json; pass --dmg PATH"
  DMG="out/make/${APP_NAME}-${VERSION}-${ARCH}.dmg"
fi

# --- phases ----------------------------------------------------------------
phase_verify() {
  step "Verifying signature & notarization: $DMG"
  [ -f "$DMG" ] || die "DMG not found: $DMG  (build it: npm run release:arm64)"
  assess "DMG accepted by Gatekeeper" \
    spctl -a -t open --context context:primary-signature "$DMG"
  assess "DMG notarization ticket stapled" xcrun stapler validate "$DMG"
}

phase_clean() {
  step "Resetting to a first-run state (so this is not an upgrade test)"
  osascript -e "tell application \"$APP_NAME\" to quit" >/dev/null 2>&1 && ok "quit running app" || true
  if [ -e "$INSTALL_PATH" ]; then
    if confirm "Delete installed app $INSTALL_PATH ?"; then
      rm -rf "$INSTALL_PATH" && ok "removed installed app"
    else warn "kept installed app"; fi
  fi
  if [ -d "$CONFIG_DIR" ]; then
    if confirm "Delete app state $CONFIG_DIR (config, history, onboarding flag) ?"; then
      rm -rf "$CONFIG_DIR" && ok "removed app state"
    else warn "kept app state"; fi
  fi
  if osascript -e "tell application \"System Events\" to delete login item \"$APP_NAME\"" >/dev/null 2>&1; then
    ok "removed login item"
  else
    warn "no login item removed (none set, or grant Terminal 'Automation' access to System Events)"
  fi
}

phase_install() {
  step "Simulating a downloaded install: $DMG"
  [ -f "$DMG" ] || die "DMG not found: $DMG  (build it: npm run release:arm64)"

  # Reproduce the com.apple.quarantine bit a browser adds on download.
  if xattr -w com.apple.quarantine "0181;00000000;Manual;$(uuidgen)" "$DMG" 2>/dev/null; then
    ok "applied quarantine to DMG (approximates a browser download)"
  else
    warn "could not set quarantine on DMG"
  fi

  step "Mounting DMG"
  local mount_point app_src
  mount_point="$(hdiutil attach "$DMG" -nobrowse -readonly | grep -o '/Volumes/.*' | tail -1 || true)"
  [ -n "$mount_point" ] || die "could not determine mount point from hdiutil"
  ok "mounted at $mount_point"

  app_src="$(find "$mount_point" -maxdepth 1 -name '*.app' | head -1)"
  if [ -z "$app_src" ]; then
    hdiutil detach "$mount_point" >/dev/null 2>&1 || true
    die "no .app found inside the DMG"
  fi

  step "Copying $(basename "$app_src") → /Applications"
  rm -rf "$INSTALL_PATH"
  cp -R "$app_src" /Applications/ && ok "installed to $INSTALL_PATH"
  hdiutil detach "$mount_point" >/dev/null 2>&1 && ok "ejected DMG" || warn "could not eject $mount_point"

  # Ensure the installed copy carries quarantine so first-launch reproduces Gatekeeper.
  xattr -w com.apple.quarantine "0181;00000000;Manual;$(uuidgen)" "$INSTALL_PATH" 2>/dev/null || true

  step "Re-checking the installed app"
  assess "installed app accepted (Notarized Developer ID)" spctl -a -vv "$INSTALL_PATH"
  assess "installed app ticket stapled" xcrun stapler validate "$INSTALL_PATH"
  assess "installed app codesign valid" codesign --verify --deep --strict "$INSTALL_PATH"

  step "Launching from /Applications"
  warn "First launch should show at most the 'downloaded from the internet' prompt — never a hard block."
  open "$INSTALL_PATH" && ok "launched $APP_NAME" || bad "failed to launch"
}

phase_checklist() {
  step "Manual GUI checklist — watch the app and answer for each"
  check "First run: onboarding window appears, tray icon shows, NO Dock icon"
  check "Default hotkey ⌘⇧Space toggles the search popup"
  check "Settings shows the hotkey as keycaps (⌘ ⇧ Space), not raw text"
  check "Change → record a NEW combo → that new combo actually toggles the popup"
  check "Invalid combo (no ⌘/⌃/⌥) shows '⚠ Must include ⌘, ⌃, or ⌥' and keeps recording"
  check "Esc/Cancel clears the message and restores the previous hotkey"
  check "Reset returns to ⌘ ⇧ Space and disables the Reset button"
  check "Secondary windows open to the correct view (Settings, Saved Words, onboarding)"
  check "Quit + relaunch: the rebound hotkey persists"
  check "Launch at login: toggle on, re-login/reboot, app auto-starts (then turn off)"
}

phase_uninstall() {
  step "Uninstalling"
  osascript -e "tell application \"$APP_NAME\" to quit" >/dev/null 2>&1 || true
  rm -rf "$INSTALL_PATH" && ok "removed $INSTALL_PATH" || true
  rm -rf "$CONFIG_DIR" && ok "removed $CONFIG_DIR" || true
  osascript -e "tell application \"System Events\" to delete login item \"$APP_NAME\"" >/dev/null 2>&1 \
    && ok "removed login item" || warn "no login item removed"
}

summary() {
  step "Summary"
  [ -n "$RESULTS" ] && printf '%s' "$RESULTS" | sed 's/^/   /'
  if [ "$FAILURES" -eq 0 ]; then
    ok "no failures recorded"
  else
    bad "$FAILURES failure(s) — see above"
  fi
  return "$FAILURES"
}

# --- run -------------------------------------------------------------------
case "$CMD" in
  verify)    phase_verify ;;
  clean)     phase_clean ;;
  install)   phase_install ;;
  checklist) phase_checklist ;;
  uninstall) phase_uninstall ;;
  all)
    phase_verify
    printf '\n'; confirm "Proceed to wipe state and install for a clean-room test?" || { warn "stopping before clean/install"; summary; exit $?; }
    phase_clean
    phase_install
    phase_checklist
    ;;
esac

summary
exit $?
