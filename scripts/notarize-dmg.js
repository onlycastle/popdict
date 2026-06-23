#!/usr/bin/env node

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const signingIdentity =
  process.env.POPDICT_MAC_SIGNING_IDENTITY ||
  'Developer ID Application: Sungman Cho (J756539YX6)';
const notaryProfile = process.env.POPDICT_NOTARY_PROFILE || 'PopDict-notary';
const makeDir = path.join(__dirname, '..', 'out', 'make');
const explicitPaths = process.argv.slice(2);

function findDmgs(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const dmgs = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      dmgs.push(...findDmgs(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.dmg')) {
      dmgs.push(fullPath);
    }
  }

  return dmgs;
}

function run(command, args) {
  execFileSync(command, args, { stdio: 'inherit' });
}

function hasCodeSignature(dmgPath) {
  try {
    execFileSync('codesign', ['--verify', '--verbose=2', dmgPath], {
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

function hasStapledTicket(dmgPath) {
  try {
    execFileSync('xcrun', ['stapler', 'validate', '-q', dmgPath], {
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

const dmgs = (explicitPaths.length > 0 ? explicitPaths : findDmgs(makeDir))
  .map((dmgPath) => path.resolve(dmgPath))
  .filter((dmgPath) => fs.existsSync(dmgPath));

if (dmgs.length === 0) {
  console.log('No DMG files found to notarize.');
  process.exit(0);
}

for (const dmgPath of dmgs) {
  const isSigned = hasCodeSignature(dmgPath);

  if (isSigned && hasStapledTicket(dmgPath)) {
    console.log(`Skipping already stapled DMG: ${dmgPath}`);
    continue;
  }

  if (!isSigned) {
    console.log(`Signing DMG: ${dmgPath}`);
    run('codesign', [
      '--force',
      '--sign',
      signingIdentity,
      '--timestamp',
      dmgPath,
    ]);
  }

  console.log(`Submitting DMG for notarization: ${dmgPath}`);
  run('xcrun', [
    'notarytool',
    'submit',
    dmgPath,
    '--keychain-profile',
    notaryProfile,
    '--wait',
  ]);

  console.log(`Stapling notarization ticket: ${dmgPath}`);
  run('xcrun', ['stapler', 'staple', dmgPath]);
  run('xcrun', ['stapler', 'validate', dmgPath]);
}
