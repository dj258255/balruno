// pg-api/server.mjs — minimal Express wrapper over PostgreSQL 18 JSONB.
// Two endpoints to match the benchmark scenarios.

import express from 'express';
import pg from 'pg';

const app = express();
const pool = new pg.Pool({
  host: process.env.PGHOST,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  max: 16,
});

app.get('/health', (_req, res) => res.json({ ok: true, db: 'pg' }));

// scenario 1 — sheet GET by id
app.get('/sheet/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT data FROM sheets WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'not found' });
    res.json(rows[0].data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// scenario 2 — containment lookup (jsonb_path_ops GIN matches this exactly)
app.get('/search', async (req, res) => {
  const name = req.query.name;
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    const { rows } = await pool.query(
      `SELECT id FROM sheets WHERE data @> $1::jsonb LIMIT 10`,
      [JSON.stringify({ name })],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

const port = Number(process.env.PORT || 8082);
app.listen(port, () => console.log(`pg-api listening on :${port}`));
