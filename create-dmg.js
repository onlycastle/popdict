#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function createDMG() {
  // Find the .app file in out directory
  const outDir = path.join(__dirname, 'out');

  // Look for the packaged app
  let appPath;
  let appDirName;
  const possiblePaths = [
    { path: path.join(outDir, 'popdict-test-darwin-x64', 'popdict-test.app'), dir: 'popdict-test-darwin-x64' },
    { path: path.join(outDir, 'popdict-test-darwin-arm64', 'popdict-test.app'), dir: 'popdict-test-darwin-arm64' },
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p.path)) {
      appPath = p.path;
      appDirName = p.dir;
      break;
    }
  }

  if (!appPath) {
    console.error('Could not find .app file. Please run "npm run package" first.');
    process.exit(1);
  }

  console.log(`Found app at: ${appPath}`);

  // The FusesPlugin mutates the Electron binary AFTER electron-packager
  // ad-hoc signs it, which invalidates the signature. On Apple Silicon an
  // invalid signature makes macOS kill the app / flag it as "damaged" — and
  // the EnableEmbeddedAsarIntegrityValidation fuse turns that into a hard
  // launch failure. Re-seal the whole bundle with a deep ad-hoc signature
  // before shipping it inside the DMG.
  console.log('Re-signing app (deep ad-hoc) to repair the post-fuses signature...');
  execSync(`codesign --force --deep --sign - "${appPath}"`, { stdio: 'inherit' });
  execSync(`codesign --verify --verbose=1 "${appPath}"`, { stdio: 'inherit' });

  const dmgPath = path.join(outDir, 'PopDict.dmg');
  const tempDmgDir = path.join(outDir, 'dmg-temp');

  try {
    // Create temporary directory for DMG contents
    if (fs.existsSync(tempDmgDir)) {
      execSync(`rm -rf "${tempDmgDir}"`, { stdio: 'inherit' });
    }
    fs.mkdirSync(tempDmgDir, { recursive: true });

    console.log('Creating DMG structure with drag-and-drop interface...');

    // Copy .app to temp directory
    console.log('  - Copying app...');
    execSync(`cp -R "${appPath}" "${tempDmgDir}/"`, { stdio: 'inherit' });

    // Create Applications symlink
    console.log('  - Creating Applications symlink...');
    fs.symlinkSync('/Applications', path.join(tempDmgDir, 'Applications'));

    // Remove old DMG if exists
    if (fs.existsSync(dmgPath)) {
      console.log('  - Removing old DMG...');
      fs.unlinkSync(dmgPath);
    }

    // Create DMG using hdiutil
    console.log('  - Creating DMG file...');
    execSync(
      `hdiutil create -volname "PopDict" -srcfolder "${tempDmgDir}" -ov -format UDZO "${dmgPath}"`,
      { stdio: 'inherit' }
    );

    // Verify temp directory contents before cleanup
    console.log('  - Verifying DMG contents...');
    const tempContents = fs.readdirSync(tempDmgDir);
    console.log(`    Contents: ${tempContents.join(', ')}`);

    // Clean up temp directory
    console.log('  - Cleaning up...');
    execSync(`rm -rf "${tempDmgDir}"`, { stdio: 'inherit' });

    console.log('');
    console.log(`✅ DMG created successfully at: ${dmgPath}`);
    console.log('📦 The DMG includes drag-and-drop to Applications folder');
    console.log('');
    console.log('When users open the DMG:');
    console.log('  - They will see the PopDict app icon');
    console.log('  - They will see the Applications folder');
    console.log('  - They can drag PopDict to Applications to install');

  } catch (err) {
    // Clean up on error
    if (fs.existsSync(tempDmgDir)) {
      execSync(`rm -rf "${tempDmgDir}"`);
    }
    console.error('❌ Error creating DMG:', err.message);
    process.exit(1);
  }
}

createDMG();
