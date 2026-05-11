#!/usr/bin/env bash
# run-write-only.sh — write-only benchmark cycle.
#
# Reuses the same docker-compose stack + seed shape as run-benchmark.sh, but
# runs ONLY the 3 write scenarios (PATCH /sheet/:id/name on each DB). Read
# scenario results from the original full run (results-fetched-50k-1.5kb/)
# already cover Sheet GET + Search.
#
# Total wallclock: ~21 min (compose 1m + seed 4m + sample 1m + 3 × 5m k6).

set -euo pipefail
cd "$(dirname "$0")"

WORK="$(pwd)"
RESULTS="$WORK/results"
mkdir -p "$RESULTS"

log()   { printf '\n\033[1;36m[bench-w]\033[0m %s\n' "$*"; }
log_ok(){ printf '\033[1;32m[ok]\033[0m   %s\n' "$*"; }

# ─── 1. Spin up containers ────────────────────────────────────────────
log "1/4 docker compose up -d (DB + API with new PATCH endpoint)"
docker compose up -d --build
log "waiting for DB health (max 90s)"
for i in {1..18}; do
  s_my=$(docker inspect --format='{{.State.Health.Status}}' bench-mysql 2>/dev/null || echo starting)
  s_pg=$(docker inspect --format='{{.State.Health.Status}}' bench-pg 2>/dev/null || echo starting)
  s_mo=$(docker inspect --format='{{.State.Health.Status}}' bench-mongo 2>/dev/null || echo starting)
  if [[ $s_my == healthy && $s_pg == healthy && $s_mo == healthy ]]; then break; fi
  sleep 5
done
log_ok "DBs healthy"

# ─── 2. Seed (same shape, deterministic RNG) ──────────────────────────
log "2/4 generate sheets.ndjson + seed 3 DBs (same as full run)"
docker run --rm -v "$WORK/seed:/work" -w /work node:22-alpine sh -c \
  "npm install --omit=dev --silent && node generate-sheets.mjs 50000"

docker run --rm --network balruno-bench_bench \
  -e MYSQL_HOST=mysql -e MYSQL_PORT=3306 -e MYSQL_USER=bench -e MYSQL_PASSWORD=bench -e MYSQL_DB=bench \
  -v "$WORK/seed:/work" -w /work node:22-alpine sh -c \
  "npm install --omit=dev --silent && node seed-mysql.mjs" > "$RESULTS/seed-mysql.log" 2>&1 &
PID_MY=$!

docker run --rm --network balruno-bench_bench \
  -e PGHOST=pg -e PGPORT=5432 -e PGUSER=bench -e PGPASSWORD=bench -e PGDATABASE=bench \
  -v "$WORK/seed:/work" -w /work node:22-alpine sh -c \
  "npm install --omit=dev --silent && node seed-pg.mjs" > "$RESULTS/seed-pg.log" 2>&1 &
PID_PG=$!

docker run --rm --network balruno-bench_bench \
  -e MONGO_URI='mongodb://bench:bench@mongo:27017/bench?authSource=admin' \
  -v "$WORK/seed:/work" -w /work node:22-alpine sh -c \
  "npm install --omit=dev --silent && node seed-mongo.mjs" > "$RESULTS/seed-mongo.log" 2>&1 &
PID_MO=$!

wait $PID_MY && log_ok "mysql seed done"
wait $PID_PG && log_ok "pg seed done"
wait $PID_MO && log_ok "mongo seed done"

# ─── 3. Sample ids for k6 ─────────────────────────────────────────────
log "3/4 sampling 500 ids"
awk 'NR<=500 {print}' < "$WORK/seed/sheets.ndjson" \
  | docker run --rm -i node:22-alpine node -e '
      let data="";
      process.stdin.on("data", c => data += c);
      process.stdin.on("end", () => {
        const lines = data.trim().split("\n");
        process.stdout.write(lines.map(l => JSON.parse(l).id).join("\n"));
      });' > "$RESULTS/ids.txt"
log_ok "$(wc -l < $RESULTS/ids.txt) ids sampled"

# ─── 4. k6 write scenario × 3 DBs ─────────────────────────────────────
run_k6() {
  local name=$1 base=$2 script=$3 ids_or_names_var=$4 ids_or_names_path=$5
  log "k6: $name → $base ($script)"
  docker run --rm \
    --network balruno-bench_bench \
    --user "$(id -u):$(id -g)" \
    -v "$WORK/k6:/work/k6" \
    -v "$RESULTS:/work/results" \
    -v "$RESULTS:/results-input" \
    -e BASE="$base" \
    -e "$ids_or_names_var=/results-input/$(basename "$ids_or_names_path")" \
    -e SUMMARY_OUT="/work/results/$name.summary.json" \
    grafana/k6:latest run \
      /work/k6/$(basename "$script") \
    2>&1 | tee "$RESULTS/$name.log" || true
}

log "4/4 k6 scenario 3 — PATCH /sheet/:id/name (50 VU × 5min × 3 DBs)"
run_k6 mysql-name-update http://mysql-api:8081 name-update.js IDS "$RESULTS/ids.txt"
run_k6 pg-name-update    http://pg-api:8082    name-update.js IDS "$RESULTS/ids.txt"
run_k6 mongo-name-update http://mongo-api:8083 name-update.js IDS "$RESULTS/ids.txt"

# ─── 5. Write-only summary ────────────────────────────────────────────
log "writing results/SUMMARY-write.md"
{
  echo "# Balruno DB Benchmark — write-only — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo
  echo "Host: prod_app (ARM 12GB), Docker, k6 50 VU × 5min, 50,000 sheets × ~1.5KB."
  echo
  echo "## Scenario 3 — PATCH /sheet/:id/name (p50 / p95 / p99 ms / rps)"
  echo
  echo "| DB | p50 | p95 | p99 | rps |"
  echo "| --- | --- | --- | --- | --- |"
  for db in mysql pg mongo; do
    f="$RESULTS/$db-name-update.summary.json"
    [[ -f $f ]] || { echo "| $db | n/a | n/a | n/a | n/a |"; continue; }
    p50=$(jq -r '.metrics.name_update_latency_ms.values.med // "n/a"' "$f")
    p95=$(jq -r '.metrics.name_update_latency_ms.values["p(95)"] // "n/a"' "$f")
    p99=$(jq -r '.metrics.name_update_latency_ms.values["p(99)"] // "n/a"' "$f")
    rps=$(jq -r '.metrics.http_reqs.values.rate // "n/a"' "$f")
    printf '| %s | %s | %s | %s | %.1f |\n' "$db" "$p50" "$p95" "$p99" "$rps"
  done
  echo
  echo "EXPLAIN / index plan and patch path:"
  echo "- PG:    \`UPDATE sheets SET data = jsonb_set(data, '{name}', \$2::jsonb) WHERE id = \$1\`  (GIN reindex on name path)"
  echo "- MySQL: \`UPDATE sheets SET data = JSON_SET(data, '\$.name', ?) WHERE id = ?\`  (gen col name_extracted B-Tree reindex)"
  echo "- Mongo: \`updateOne({_id}, { \$set: { name } })\`  (path index on name reindexed)"
} > "$RESULTS/SUMMARY-write.md"

log_ok "wrote results/SUMMARY-write.md"
cat "$RESULTS/SUMMARY-write.md"
