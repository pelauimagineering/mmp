#!/usr/bin/env node
/**
 * Mirror the repo-root design-system/ folder into public/design-system/
 * so Express's static middleware can serve /design-system/* without
 * a symlink (DigitalOcean App Platform doesn't follow symlinks during
 * upload). Runs as the poker-dealer's `postinstall` step.
 *
 * Skips silently when run outside the monorepo (e.g. if poker-dealer
 * is ever extracted back to its own repo) — it just logs and exits 0.
 */

const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..', '..', 'design-system');
const DEST = path.resolve(__dirname, '..', 'public', 'design-system');

if (!fs.existsSync(SRC)) {
  console.log(`[sync-design-system] No design-system at ${SRC}; skipping (standalone deploy).`);
  process.exit(0);
}

fs.rmSync(DEST, { recursive: true, force: true });
fs.cpSync(SRC, DEST, { recursive: true, dereference: true });
console.log(`[sync-design-system] Mirrored ${SRC} → ${DEST}`);
