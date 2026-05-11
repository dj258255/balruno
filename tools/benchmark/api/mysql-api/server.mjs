// mysql-api/server.mjs — minimal Express wrapper over MySQL 8 JSON column.
// Two endpoints to match the benchmark scenarios.

import express from 'express';
import mysql from 'mysql2/promise';

const app = express();
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DB,
  connectionLimit: 16,
  waitForConnections: true,
});

app.get('/health', (_req, res) => res.json({ ok: true, db: 'mysql' }));

// scenario 1 — sheet GET by id (returns full ~50KB JSON)
app.get('/sheet/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT data FROM sheets WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'not found' });
    res.json(rows[0].data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// scenario 3 — write: partial patch via JSON_SET. Compare with PG jsonb_set
// (string path expression + reparse vs binary path patch).
app.use(express.json());
app.patch('/sheet/:id/name', async (req, res) => {
  const newName = req.body?.name;
  if (!newName) return res.status(400).json({ error: 'name required' });
  try {
    const [r] = await pool.query(
      `UPDATE sheets SET data = JSON_SET(data, '$.name', ?) WHERE id = ?`,
      [newName, req.params.id],
    );
    if (r.affectedRows === 0) return res.status(404).json({ error: 'not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// scenario 2 — name lookup using the generated column + B-Tree index
app.get('/search', async (req, res) => {
  const name = req.query.name;
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    const [rows] = await pool.query(
      'SELECT id FROM sheets WHERE name_extracted = ? LIMIT 10',
      [name],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

const port = Number(process.env.PORT || 8081);
app.listen(port, () => console.log(`mysql-api listening on :${port}`));
