// seed-mongo.mjs — load sheets.ndjson into MongoDB 7 (single collection, index on name).
// Matches the blog post's "MongoDB 7" measurement target.

import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoClient } from 'mongodb';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const inPath = path.join(__dirname, 'sheets.ndjson');

const uri = process.env.MONGO_URI ?? 'mongodb://bench:bench@127.0.0.1:27018/bench?authSource=admin';
const client = new MongoClient(uri);
await client.connect();
const db = client.db('bench');
const col = db.collection('sheets');

console.log('mongo: dropping + recreating collection');
await col.drop().catch(() => {}); // ignore if not exists

console.log('mongo: streaming rows');
const rl = createInterface({ input: createReadStream(inPath), crlfDelay: Infinity });
let batch = [];
let total = 0;
const flush = async () => {
  if (!batch.length) return;
  await col.insertMany(batch, { ordered: false });
  total += batch.length;
  batch = [];
  if (total % 1000 === 0) process.stdout.write(`  ${total}\n`);
};
for await (const line of rl) {
  if (!line) continue;
  const sheet = JSON.parse(line);
  // Use the generated UUID as _id for direct primary-key lookups (matching
  // the PG/MySQL pattern). Mongo defaults to ObjectId, but pinning _id lets
  // the three APIs share the same /sheet/:id contract.
  sheet._id = sheet.id;
  delete sheet.id;
  batch.push(sheet);
  if (batch.length >= 100) await flush();
}
await flush();

console.log('mongo: building index on name');
await col.createIndex({ name: 1 });

console.log(`mongo: done, ${total} rows`);
await client.close();
