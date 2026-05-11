// mongo-api/server.mjs — minimal Express wrapper over MongoDB 7.
// Two endpoints to match the benchmark scenarios.

import express from 'express';
import { MongoClient } from 'mongodb';

const client = new MongoClient(process.env.MONGO_URI, {
  maxPoolSize: 16,
});
await client.connect();
const col = client.db('bench').collection('sheets');

const app = express();

app.get('/health', (_req, res) => res.json({ ok: true, db: 'mongo' }));

// scenario 1 — sheet GET by id (Mongo _id pinned to the sheet's UUID at seed time)
app.get('/sheet/:id', async (req, res) => {
  try {
    const doc = await col.findOne({ _id: req.params.id });
    if (!doc) return res.status(404).json({ error: 'not found' });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// scenario 3 — write: partial patch via $set. Mongo's native partial update,
// path index gets reindexed.
app.use(express.json());
app.patch('/sheet/:id/name', async (req, res) => {
  const newName = req.body?.name;
  if (!newName) return res.status(400).json({ error: 'name required' });
  try {
    const r = await col.updateOne({ _id: req.params.id }, { $set: { name: newName } });
    if (r.matchedCount === 0) return res.status(404).json({ error: 'not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// scenario 2 — name lookup using the path index built at seed time
app.get('/search', async (req, res) => {
  const name = req.query.name;
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    const docs = await col.find({ name }, { projection: { _id: 1 } }).limit(10).toArray();
    res.json(docs.map((d) => ({ id: d._id })));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

const port = Number(process.env.PORT || 8083);
app.listen(port, () => console.log(`mongo-api listening on :${port}`));
