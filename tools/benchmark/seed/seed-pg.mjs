// seed-pg.mjs — load sheets.ndjson into PostgreSQL 18 (JSONB + jsonb_path_ops GIN).
// Matches the blog post's "PostgreSQL 18 + JSONB" measurement target.

import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const inPath = path.join(__dirname, 'sheets.ndjson');

const pool = new pg.Pool({
  host: process.env.PGHOST ?? '127.0.0.1',
  port: Number(process.env.PGPORT ?? 5433),
  user: process.env.PGUSER ?? 'bench',
  password: process.env.PGPASSWORD ?? 'bench',
  database: process.env.PGDATABASE ?? 'bench',
  max: 4,
});

console.log('pg: creating schema');
await pool.query(`DROP TABLE IF EXISTS sheets`);
await pool.query(`
  CREATE TABLE sheets (
    id UUID PRIMARY KEY,
    data JSONB NOT NULL
  )
`);

console.log('pg: streaming rows');
const rl = createInterface({ input: createReadStream(inPath), crlfDelay: Infinity });
let batch = [];
let total = 0;
const flush = async () => {
  if (!batch.length) return;
  // multi-row INSERT — use UNNEST with parallel arrays for clean parameter binding
  const ids = batch.map(([id]) => id);
  const docs = batch.map(([, doc]) => doc);
  await pool.query(
    `INSERT INTO sheets (id, data)
       SELECT * FROM UNNEST($1::uuid[], $2::jsonb[])`,
    [ids, docs],
  );
  total += batch.length;
  batch = [];
  if (total % 1000 === 0) process.stdout.write(`  ${total}\n`);
};
for await (const line of rl) {
  if (!line) continue;
  const sheet = JSON.parse(line);
  batch.push([sheet.id, line]);
  if (batch.length >= 100) await flush();
}
await flush();

console.log('pg: creating GIN index (jsonb_path_ops) — matches blog claim');
await pool.query(`CREATE INDEX idx_sheets_data_gin ON sheets USING GIN (data jsonb_path_ops)`);

console.log(`pg: done, ${total} rows`);
await pool.end();
