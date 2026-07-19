#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

APP_NAME="PopDict"
ARCH="arm64"
VERSION="$(node -p "require('./package.json').version")"
APP_PATH="out/${APP_NAME}-darwin-${ARCH}/${APP_NAME}.app"
DMG_PATH="out/make/${APP_NAME}-${VERSION}-${ARCH}.dmg"
SIGNING_IDENTITY="${POPDICT_MAC_SIGNING_IDENTITY:-}"
NOTARY_PROFILE="${POPDICT_NOTARY_PROFILE:-}"

step() {
  printf '\n==> %s\n' "$*"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$1" >&2
    exit 1
  fi
}

require_cmd node
require_cmd npm
require_cmd deno

NODE_SUPPORTED="$(node -p "const [major, minor] = process.versions.node.split('.').map(Number); Number((major === 20 && minor >= 19) || (major === 22 && minor >= 12) || major === 24)")"
if [[ "$NODE_SUPPORTED" != "1" ]]; then
  printf 'Node 20.19+, 22.12+, or 24.x is required for releases (found %s).\n' "$(node --version)" >&2
  exit 1
fi

if [[ -z "$SIGNING_IDENTITY" ]]; then
  printf 'POPDICT_MAC_SIGNING_IDENTITY is required for signed public releases.\n' >&2
  exit 1
fi

if [[ -z "$NOTARY_PROFILE" ]]; then
  printf 'POPDICT_NOTARY_PROFILE is required for signed public releases.\n' >&2
  exit 1
fi

export POPDICT_MAC_SIGNING_IDENTITY="$SIGNING_IDENTITY"
export POPDICT_NOTARY_PROFILE="$NOTARY_PROFILE"

require_cmd security
require_cmd codesign
require_cmd spctl
require_cmd xcrun

step "Checking Developer ID signing identity"
if ! security find-identity -p codesigning -v | grep -F "$SIGNING_IDENTITY" >/dev/null; then
  printf 'Missing valid signing identity: %s\n\n' "$SIGNING_IDENTITY" >&2
  security find-identity -p codesigning -v >&2 || true
  exit 1
fi

step "Checking notarization credentials"
xcrun notarytool history --keychain-profile "$NOTARY_PROFILE" --output-format json >/dev/null

step "Checking native DMG maker dependency"
if ! node -e "require('macos-alias')" >/dev/null 2>&1; then
  printf 'macos-alias is not built for %s; run npm rebuild macos-alias with this Node runtime.\n' "$(node --version)" >&2
  exit 1
fi

if [[ -z "${POPDICT_GITHUB_REPO:-}" ]]; then
  printf 'POPDICT_GITHUB_REPO is required for public releases so auto-update is enabled.\n' >&2
  printf 'Re-run as: POPDICT_GITHUB_REPO=owner/repo %s\n' "$0" >&2
  exit 1
fi

if [[ -z "${VITE_SUPABASE_URL:-}" ]]; then
  printf 'VITE_SUPABASE_URL is required so the packaged app can load public dictionary data.\n' >&2
  exit 1
fi

if [[ -z "${VITE_SUPABASE_PUBLISHABLE_KEY:-}" && -z "${VITE_SUPABASE_ANON_KEY:-}" ]]; then
  printf 'VITE_SUPABASE_PUBLISHABLE_KEY (or legacy VITE_SUPABASE_ANON_KEY) is required.\n' >&2
  exit 1
fi

step "Running the complete app, site, data, and harness gate"
npm run test:ci

step "Running Supabase Edge Function tests"
deno test \
  supabase/functions/_shared/ \
  supabase/functions/downloads/ \
  supabase/functions/events/ \
  supabase/functions/feedback/ \
  supabase/functions/quiz/

step "Building, signing, notarizing, and stapling arm64 DMG"
npm run make:mac:arm64

if [[ ! -f "$DMG_PATH" ]]; then
  printf 'Expected DMG not found: %s\n' "$DMG_PATH" >&2
  find out/make -maxdepth 3 -name '*.dmg' -print >&2 || true
  exit 1
fi

step "Verifying signed app"
codesign --verify --deep --strict --verbose=2 "$APP_PATH"
spctl --assess --type execute --verbose=4 "$APP_PATH"

step "Verifying notarized DMG"
codesign --verify --verbose=2 "$DMG_PATH"
xcrun stapler validate "$DMG_PATH"
spctl -a -vvv -t open --context context:primary-signature "$DMG_PATH"

ZIP_PATH="out/make/zip/darwin/${ARCH}/${APP_NAME}-darwin-${ARCH}-${VERSION}.zip"
if [[ ! -f "$ZIP_PATH" ]]; then
  printf '\nZIP artifact not found at expected path: %s\n' "$ZIP_PATH" >&2
  exit 1
fi

step "Release artifacts ready"
ls -lh "$DMG_PATH" "$ZIP_PATH"
printf '\nUpload BOTH to the GitHub release:\n  DMG (download):     %s\n  ZIP (auto-update):  %s\n' "$DMG_PATH" "$ZIP_PATH"
