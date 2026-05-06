/**
 * One-shot export of STARTER_CATALOG to backend resources/starter/catalog.json.
 *
 * Usage (from packages/web):
 *   npx vite-node scripts/exportStarterCatalog.ts
 *
 * Re-run when STARTER_CATALOG changes; commit the resulting JSON.
 * Backend reads it on startup (StarterPackSeeder, ADR 0020 Stage B)
 * to seed neo-user's default project with the full Notion-like
 * sheet_tree of 12 starter groups.
 *
 * Lucide icon objects are stripped — they're React components, not
 * serialisable, and the backend doesn't need icon visuals (the
 * frontend re-attaches them by id when rendering the sheet_tree).
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { STARTER_CATALOG } from '../src/lib/starterPack';

const __dirname = dirname(fileURLToPath(import.meta.url));

const out = STARTER_CATALOG.map((entry) => ({
  id: entry.id,
  i18nKey: entry.i18nKey,
  color: entry.color,
  // entry.build() returns a Project shaped like the local-mode store
  // expects — id / name / sheets[] / docs[] etc. The backend treats
  // this as the raw seed for sheet_tree / data hydration.
  project: entry.build(),
  stepCount: entry.stepCount,
  stepsI18nKey: entry.stepsI18nKey ?? null,
}));

const outPath = resolve(
  __dirname,
  '../../backend/src/main/resources/starter/catalog.json',
);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify({ starters: out }, null, 2));

// eslint-disable-next-line no-console
console.log(`Wrote ${out.length} starters to ${outPath}`);
