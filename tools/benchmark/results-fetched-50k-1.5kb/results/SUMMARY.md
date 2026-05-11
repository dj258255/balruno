# Balruno DB Benchmark — 2026-05-11T02:41:18Z

Host: prod_app (ARM 12GB), Docker, k6 50 VU × 5min, 10,000 sheets × ~50KB JSON each.

## Scenario 1 — Sheet GET by id (p50 / p95 / p99 ms)

| DB | p50 | p95 | p99 |
| --- | --- | --- | --- |
| mysql | 0.0 | 25.0 | 46.0 |
