# Balruno DB Benchmark — write-only — 2026-05-11T03:12:01Z

Host: prod_app (ARM 12GB), Docker, k6 50 VU × 5min, 50,000 sheets × ~1.5KB.

## Scenario 3 — PATCH /sheet/:id/name (p50 / p95 / p99 ms / rps)

| DB | p50 | p95 | p99 | rps |
| --- | --- | --- | --- | --- |
| mysql | 18 | 63 | 95 | 664.9 |
| pg | 10 | 40 | 94 | 742.6 |
| mongo | 6 | 37 | 63 | 804.4 |

EXPLAIN / index plan and patch path:
- PG:    `UPDATE sheets SET data = jsonb_set(data, '{name}', $2::jsonb) WHERE id = $1`  (GIN reindex on name path)
- MySQL: `UPDATE sheets SET data = JSON_SET(data, '$.name', ?) WHERE id = ?`  (gen col name_extracted B-Tree reindex)
- Mongo: `updateOne({_id}, { $set: { name } })`  (path index on name reindexed)
