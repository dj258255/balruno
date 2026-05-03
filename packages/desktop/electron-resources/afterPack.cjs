/**
 * electron-builder afterPack hook.
 *
 * Strips macOS extended attributes (com.apple.provenance) from the packaged
 * .app BEFORE codesign runs.
 *
 * Why: macOS 14+ (Sonoma/Sequoia) auto-attaches `com.apple.provenance` to any
 * file downloaded or extracted via the Finder/curl/npm. The codesign tool
 * rejects these as "resource fork, Finder information, or similar detritus".
 * Without stripping, signing fails on Helper binaries inside Electron's
 * Frameworks folder.
 *
 * Reference: https://github.com/electron-userland/electron-builder/issues/8197
 */

const { execFileSync } = require('node:child_process');
const { readdirSync, statSync } = require('node:fs');
const { join } = require('node:path');

function walk(dir) {
  const out = [dir];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

/** @type {(context: import('electron-builder').AfterPackContext) => Promise<void>} */
exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;

  const appPath = `${context.appOutDir}/${context.packager.appInfo.productFilename}.app`;
  console.log(`[afterPack] Stripping xattrs from: ${appPath}`);

  // Recursive bulk clear (non-fatal on entries with no xattr).
  try {
    execFileSync('xattr', ['-cr', appPath], { stdio: 'pipe' });
  } catch (err) {
    console.warn('[afterPack] xattr -cr failed (non-fatal):', err.message);
  }

  // Per-file removal of com.apple.provenance specifically — some attrs
  // survive -c on macOS 14+ Sequoia.
  const files = walk(appPath);
  let cleared = 0;
  for (const f of files) {
    try {
      execFileSync('xattr', ['-d', 'com.apple.provenance', f], { stdio: 'pipe' });
      cleared += 1;
    } catch {
      // ignore — file may have no such xattr
    }
  }
  console.log(`[afterPack] Cleared com.apple.provenance from ${cleared} entries`);
};
