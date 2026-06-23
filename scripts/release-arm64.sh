#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

APP_NAME="PopDict"
ARCH="arm64"
VERSION="$(node -p "require('./package.json').version")"
APP_PATH="out/${APP_NAME}-darwin-${ARCH}/${APP_NAME}.app"
DMG_PATH="out/make/${APP_NAME}-${VERSION}-${ARCH}.dmg"
SIGNING_IDENTITY="${POPDICT_MAC_SIGNING_IDENTITY:-Developer ID Application: Sungman Cho (J756539YX6)}"
NOTARY_PROFILE="${POPDICT_NOTARY_PROFILE:-PopDict-notary}"

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

step "Running quality gate (type-check + lint)"
npx tsc --noEmit
npm run lint

step "Running tests"
npm test

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

step "Release artifacts ready"
ls -lh "$DMG_PATH"
ZIP_PATH="$(find out/make/zip -name '*.zip' -print -quit 2>/dev/null || true)"
if [[ -n "${ZIP_PATH:-}" ]]; then
  ls -lh "$ZIP_PATH"
  printf '\nUpload BOTH to the GitHub release:\n  DMG (download):     %s\n  ZIP (auto-update):  %s\n' "$DMG_PATH" "$ZIP_PATH"
else
  printf '\n%s\n' "$DMG_PATH"
fi
