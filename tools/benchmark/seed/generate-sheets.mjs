// generate-sheets.mjs — produce 10,000 sheet objects shaped like Balruno's
// `Sheet` domain (16 column types × ~100–1000 rows). Average target size is
// ~50KB per sheet so totals match the blog post measurement claim (~500MB).
//
// Output: writes NDJSON (one sheet per line) to seed/sheets.ndjson so the
// three DB seeders can stream it without holding 500MB in memory.
//
// Usage:  node seed/generate-sheets.mjs [count]
//   default count = 10000

import { createWriteStream } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, 'sheets.ndjson');

const COUNT = Number(process.argv[2] ?? 10000);
const COLUMN_TYPES = [
  'text', 'number', 'checkbox', 'select', 'multi-select', 'date',
  'url', 'currency', 'rating', 'link', 'lookup', 'rollup',
  'formula', 'stat-snapshot', 'general', 'attachment',
];

// Tiny seeded RNG so re-runs produce the same data (reproducible measurements).
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}
const rng = makeRng(20260511);
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
const randInt = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
const randStr = (len) => {
  let out = '';
  const alpha = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  for (let i = 0; i < len; i++) out += alpha[Math.floor(rng() * alpha.length)];
  return out;
};

const ADJECTIVES = ['arcane', 'brutal', 'crystal', 'dread', 'echo', 'frost', 'gilded', 'hollow', 'iron', 'jade'];
const NOUNS = ['ember', 'fang', 'glyph', 'hammer', 'ire', 'jewel', 'kris', 'lance', 'mantle', 'nexus'];
const sheetName = () => `${pick(ADJECTIVES)}-${pick(NOUNS)}-${randStr(4)}`;

function randomCellValue(type) {
  switch (type) {
    case 'text':         return randStr(randInt(4, 24));
    case 'number':       return Math.round(rng() * 10000) / 100;
    case 'checkbox':     return rng() < 0.5;
    case 'select':       return pick(['low', 'mid', 'high', 'epic']);
    case 'multi-select': return Array.from({ length: randInt(1, 3) }, () => pick(['fire', 'ice', 'lightning', 'wind']));
    case 'date':         return new Date(Date.UTC(2024, randInt(0, 11), randInt(1, 28))).toISOString();
    case 'url':          return `https://example.com/${randStr(12)}`;
    case 'currency':     return Math.round(rng() * 100000) / 100;
    case 'rating':       return randInt(1, 5);
    case 'link':         return `ref:${randStr(12)}`;
    case 'lookup':       return randStr(8);
    case 'rollup':       return Math.round(rng() * 999);
    case 'formula':      return `=DAMAGE(${randInt(50, 200)}, ${randInt(10, 80)})`;
    case 'stat-snapshot': return { hp: randInt(50, 500), atk: randInt(10, 80), def: randInt(0, 40) };
    case 'general':      return randStr(randInt(8, 32));
    case 'attachment':   return { name: `${randStr(6)}.png`, size: randInt(1024, 1048576) };
    default:             return null;
  }
}

function generateSheet(index) {
  const id = randomUUID();
  // ~30 columns per sheet, mixed types
  const columns = Array.from({ length: 30 }, (_, i) => ({
    id: `col_${i}_${randStr(4)}`,
    name: `${pick(COLUMN_TYPES)}_${i}`,
    type: pick(COLUMN_TYPES),
  }));
  // Variable row count (100~1000) so total sheet size lands near 50KB on average
  const rowCount = randInt(80, 220);
  const rows = Array.from({ length: rowCount }, () => {
    const cells = {};
    for (const c of columns) cells[c.id] = randomCellValue(c.type);
    return { id: randomUUID(), cells };
  });
  return {
    id,
    name: sheetName(),
    columns,
    rows,
    // a few searchable top-level fields for the containment scenario
    tags: Array.from({ length: randInt(1, 4) }, () => pick(['boss', 'minion', 'item', 'spell', 'level'])),
    seq: index,
  };
}

const out = createWriteStream(outPath);
let written = 0;
let totalBytes = 0;
const start = Date.now();
for (let i = 0; i < COUNT; i++) {
  const sheet = generateSheet(i);
  const line = JSON.stringify(sheet);
  out.write(line);
  out.write('\n');
  totalBytes += Buffer.byteLength(line, 'utf8') + 1;
  written++;
  if (written % 1000 === 0) {
    const avg = Math.round(totalBytes / written);
    process.stdout.write(`  ${written} sheets, avg ${avg} bytes/sheet\n`);
  }
}
out.end();
const elapsed = ((Date.now() - start) / 1000).toFixed(1);
console.log(`done: ${written} sheets → ${outPath}  (${(totalBytes / 1024 / 1024).toFixed(1)} MB in ${elapsed}s)`);
