// seed-mysql.mjs — load sheets.ndjson into MySQL 8 (JSON column + generated col).
// Matches the blog post's "MySQL 8 + JSON" measurement target.

import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const inPath = path.join(__dirname, 'sheets.ndjson');

const conn = await mysql.createConnection({
  host: process.env.MYSQL_HOST ?? '127.0.0.1',
  port: Number(process.env.MYSQL_PORT ?? 3307),
  user: process.env.MYSQL_USER ?? 'bench',
  password: process.env.MYSQL_PASSWORD ?? 'bench',
  database: process.env.MYSQL_DB ?? 'bench',
  multipleStatements: true,
});

console.log('mysql: creating schema');
await conn.query(`DROP TABLE IF EXISTS sheets`);
// Match Balruno's "data JSON" column model — name + a generated column from
// data.name for index-driven name lookups (the standard MySQL JSON pattern
// since you can't put a GIN equivalent on the whole document).
await conn.query(`
  CREATE TABLE sheets (
    id CHAR(36) PRIMARY KEY,
    data JSON NOT NULL,
    name_extracted VARCHAR(255) GENERATED ALWAYS AS
      (JSON_UNQUOTE(JSON_EXTRACT(data, '$.name'))) STORED,
    INDEX idx_name_extracted (name_extracted)
  ) ENGINE=InnoDB
`);

console.log('mysql: streaming rows');
const rl = createInterface({ input: createReadStream(inPath), crlfDelay: Infinity });
let batch = [];
let total = 0;
const flush = async () => {
  if (!batch.length) return;
  // batched INSERT — MySQL accepts JSON literal via parameter binding
  const placeholders = batch.map(() => '(?, ?)').join(',');
  const params = batch.flatMap(([id, json]) => [id, json]);
  await conn.query(`INSERT INTO sheets (id, data) VALUES ${placeholders}`, params);
  total += batch.length;
  batch = [];
  if (total % 1000 === 0) process.stdout.write(`  ${total}\n`);
};
for await (const line of rl) {
  if (!line) continue;
  const sheet = JSON.parse(line);
  batch.push([sheet.id, JSON.stringify(sheet)]);
  if (batch.length >= 100) await flush();
}
await flush();
console.log(`mysql: done, ${total} rows`);
await conn.end();
