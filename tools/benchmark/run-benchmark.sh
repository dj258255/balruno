#!/usr/bin/env bash
# run-benchmark.sh — full DB benchmark cycle on prod_app.
#
# Steps:
#   1. docker compose up -d  (3 DB containers + 3 API wrappers, builds API images)
#   2. generate sheets.ndjson (10K sheets, ~500MB)
#   3. seed MySQL / PG / Mongo (parallel)
#   4. EXPLAIN (or equivalent) capture for both scenarios on each DB
#   5. k6 sheet-get   × 3 DBs (5 min each, 50 VU)
#   6. k6 search      × 3 DBs (5 min each, 50 VU)
#   7. write summary table to results/SUMMARY.md
#
# Total wallclock: ~30~40 min on prod_app (ARM 12GB).
#
# Idempotent — safe to re-run; the volumes get re-seeded.

set -euo pipefail
cd "$(dirname "$0")"

WORK="$(pwd)"
RESULTS="$WORK/results"
mkdir -p "$RESULTS"

log()   { printf '\n\033[1;36m[bench]\033[0m %s\n' "$*"; }
log_ok(){ printf '\033[1;32m[ok]\033[0m   %s\n' "$*"; }

# ─── 1. Spin up containers ────────────────────────────────────────────
log "1/7 docker compose up -d (DB + API)"
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

# ─── 2. Generate sheets ───────────────────────────────────────────────
log "2/7 generate sheets.ndjson (10,000 × 16 cols × ~50KB)"
docker run --rm -v "$WORK/seed:/work" -w /work node:22-alpine sh -c \
  "npm install --omit=dev --silent && node generate-sheets.mjs 10000"

# ─── 3. Seed in parallel ──────────────────────────────────────────────
log "3/7 seed MySQL / PG / Mongo (parallel)"
docker run --rm --network balruno-bench_bench \
  -e MYSQL_HOST=mysql -e MYSQL_USER=bench -e MYSQL_PASSWORD=bench -e MYSQL_DB=bench \
  -v "$WORK/seed:/work" -w /work node:22-alpine sh -c \
  "npm install --omit=dev --silent && node seed-mysql.mjs" > "$RESULTS/seed-mysql.log" 2>&1 &
PID_MY=$!

docker run --rm --network balruno-bench_bench \
  -e PGHOST=pg -e PGUSER=bench -e PGPASSWORD=bench -e PGDATABASE=bench \
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

# ─── 4. Pick a sample of ids + names for k6 to hit ────────────────────
log "4/7 sampling 500 ids + 500 names from seed"
awk 'NR<=500 {print}' < "$WORK/seed/sheets.ndjson" \
  | docker run --rm -i node:22-alpine node -e '
      let data="";
      process.stdin.on("data", c => data += c);
      process.stdin.on("end", () => {
        const lines = data.trim().split("\n");
        const ids = lines.map(l => JSON.parse(l).id).join("\n");
        const names = lines.map(l => JSON.parse(l).name).join("\n");
        process.stdout.write(ids + "\n---SEP---\n" + names);
      });' > "$RESULTS/sample.raw"
awk '/---SEP---/{p=1;next} p{print > "'"$RESULTS/names.txt"'"; next} {print > "'"$RESULTS/ids.txt"'"}' "$RESULTS/sample.raw"
rm "$RESULTS/sample.raw"
log_ok "$(wc -l < $RESULTS/ids.txt) ids / $(wc -l < $RESULTS/names.txt) names sampled"

# ─── 5. EXPLAIN capture ───────────────────────────────────────────────
log "5/7 EXPLAIN / plan capture"
SAMPLE_ID=$(head -1 "$RESULTS/ids.txt")
SAMPLE_NAME=$(head -1 "$RESULTS/names.txt")

docker exec bench-pg psql -U bench -d bench -c \
  "EXPLAIN (ANALYZE, BUFFERS) SELECT data FROM sheets WHERE id = '$SAMPLE_ID';" \
  > "$RESULTS/explain-pg-sheet-get.txt" 2>&1
docker exec bench-pg psql -U bench -d bench -c \
  "EXPLAIN (ANALYZE, BUFFERS) SELECT id FROM sheets WHERE data @> '{\"name\":\"$SAMPLE_NAME\"}'::jsonb LIMIT 10;" \
  > "$RESULTS/explain-pg-search.txt" 2>&1

docker exec bench-mysql mysql -ubench -pbench bench -e \
  "EXPLAIN ANALYZE SELECT data FROM sheets WHERE id = '$SAMPLE_ID';" \
  > "$RESULTS/explain-mysql-sheet-get.txt" 2>&1
docker exec bench-mysql mysql -ubench -pbench bench -e \
  "EXPLAIN ANALYZE SELECT id FROM sheets WHERE name_extracted = '$SAMPLE_NAME' LIMIT 10;" \
  > "$RESULTS/explain-mysql-search.txt" 2>&1

docker exec bench-mongo mongosh --quiet \
  -u bench -p bench --authenticationDatabase admin bench \
  --eval "JSON.stringify(db.sheets.find({_id:'$SAMPLE_ID'}).explain('executionStats'), null, 2)" \
  > "$RESULTS/explain-mongo-sheet-get.txt" 2>&1
docker exec bench-mongo mongosh --quiet \
  -u bench -p bench --authenticationDatabase admin bench \
  --eval "JSON.stringify(db.sheets.find({name:'$SAMPLE_NAME'}, {_id:1}).limit(10).explain('executionStats'), null, 2)" \
  > "$RESULTS/explain-mongo-search.txt" 2>&1
log_ok "EXPLAIN captures saved"

# ─── 6. k6 sheet-get × 3 DBs ──────────────────────────────────────────
run_k6() {
  local name=$1 base=$2 script=$3 ids_or_names_var=$4 ids_or_names_path=$5
  log "k6: $name → $base ($script)"
  docker run --rm \
    --network balruno-bench_bench \
    -v "$WORK/k6:/work/k6" \
    -v "$RESULTS:/work/results" \
    -v "$RESULTS:/results-input" \
    -e BASE="$base" \
    -e "$ids_or_names_var=/results-input/$(basename "$ids_or_names_path")" \
    -e SUMMARY_OUT="/work/results/$name.summary.json" \
    grafana/k6:latest run \
      --out json=/work/results/$name.json \
      /work/k6/$(basename "$script") \
    | tee "$RESULTS/$name.log"
}

log "6/7 k6 scenario 1 — sheet GET (50 VU × 5min)"
run_k6 mysql-sheet-get http://mysql-api:8081 sheet-get.js IDS "$RESULTS/ids.txt"
run_k6 pg-sheet-get    http://pg-api:8082    sheet-get.js IDS "$RESULTS/ids.txt"
run_k6 mongo-sheet-get http://mongo-api:8083 sheet-get.js IDS "$RESULTS/ids.txt"

log "7/7 k6 scenario 2 — containment / search (50 VU × 5min)"
run_k6 mysql-search http://mysql-api:8081 search.js NAMES "$RESULTS/names.txt"
run_k6 pg-search    http://pg-api:8082    search.js NAMES "$RESULTS/names.txt"
run_k6 mongo-search http://mongo-api:8083 search.js NAMES "$RESULTS/names.txt"

# ─── 8. Summary table ─────────────────────────────────────────────────
log "writing results/SUMMARY.md"
{
  echo "# Balruno DB Benchmark — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo
  echo "Host: prod_app (ARM 12GB), Docker, k6 50 VU × 5min, 10,000 sheets × ~50KB JSON each."
  echo
  echo "## Scenario 1 — Sheet GET by id (p50 / p95 / p99 ms)"
  echo
  echo "| DB | p50 | p95 | p99 |"
  echo "| --- | --- | --- | --- |"
  for db in mysql pg mongo; do
    f="$RESULTS/$db-sheet-get.summary.json"
    [[ -f $f ]] || { echo "| $db | n/a | n/a | n/a |"; continue; }
    p50=$(jq -r '.metrics.sheet_get_latency_ms.values["p(50)"] // "n/a"' "$f")
    p95=$(jq -r '.metrics.sheet_get_latency_ms.values["p(95)"] // "n/a"' "$f")
    p99=$(jq -r '.metrics.sheet_get_latency_ms.values["p(99)"] // "n/a"' "$f")
    printf '| %s | %.1f | %.1f | %.1f |\n' "$db" "$p50" "$p95" "$p99"
  done
  echo
  echo "## Scenario 2 — Name / containment lookup (p50 / p95 / p99 ms)"
  echo
  echo "| DB | p50 | p95 | p99 |"
  echo "| --- | --- | --- | --- |"
  for db in mysql pg mongo; do
    f="$RESULTS/$db-search.summary.json"
    [[ -f $f ]] || { echo "| $db | n/a | n/a | n/a |"; continue; }
    p50=$(jq -r '.metrics.search_latency_ms.values["p(50)"] // "n/a"' "$f")
    p95=$(jq -r '.metrics.search_latency_ms.values["p(95)"] // "n/a"' "$f")
    p99=$(jq -r '.metrics.search_latency_ms.values["p(99)"] // "n/a"' "$f")
    printf '| %s | %.1f | %.1f | %.1f |\n' "$db" "$p50" "$p95" "$p99"
  done
  echo
  echo "Raw k6 JSON, EXPLAIN captures, seed logs all in this directory."
} > "$RESULTS/SUMMARY.md"

log_ok "wrote results/SUMMARY.md"

# ─── 9. combined.json — single-file truth source ─────────────────────
# All result tables, all six k6 summaries, all six EXPLAIN captures, plus
# host/data/commit metadata. This is the file to commit to git and quote
# from the blog/resume.
log "writing results/combined.json"

# Helpers — read each summary's metric values, fall back to null on miss.
metric() {
  local file="$RESULTS/$1.summary.json" key="$2"
  [[ -f $file ]] || { echo null; return; }
  jq -r ".metrics.\"${key}\".values | (.\"p(50)\" // null), (.\"p(95)\" // null), (.\"p(99)\" // null), (.count // null), (.rate // null), (.fails // null)" "$file" 2>/dev/null \
    | paste -sd, - || echo null
}

extract() {
  # $1 = scenario name (e.g. mysql-sheet-get), $2 = k6 metric prefix
  local file="$RESULTS/$1.summary.json" prefix="$2"
  [[ -f $file ]] || { echo "{}"; return; }
  jq --arg lat "${prefix}_latency_ms" --arg err "${prefix}_errors" '
    {
      p50:        (.metrics[$lat].values["p(50)"]      // null),
      p95:        (.metrics[$lat].values["p(95)"]      // null),
      p99:        (.metrics[$lat].values["p(99)"]      // null),
      latency_avg: (.metrics[$lat].values.avg          // null),
      latency_max: (.metrics[$lat].values.max          // null),
      req_total:  (.metrics.http_reqs.values.count     // null),
      req_rate:   (.metrics.http_reqs.values.rate      // null),
      error_rate: (.metrics[$err].values.rate          // null),
      iterations: (.metrics.iterations.values.count    // null),
      data_received_bytes: (.metrics.data_received.values.count // null)
    }
  ' "$file"
}

explain_capture() {
  local file="$RESULTS/$1"
  [[ -f $file ]] || { echo null; return; }
  jq -Rs '.' < "$file"
}

ENV_HOST="$(hostname -f 2>/dev/null || hostname)"
ENV_KERNEL="$(uname -srm)"
ENV_OS="$(grep -E '^PRETTY_NAME' /etc/os-release 2>/dev/null | cut -d= -f2 | tr -d '\"' || echo unknown)"
ENV_DOCKER="$(docker --version 2>/dev/null || echo unknown)"
ENV_K6="$(docker run --rm grafana/k6:latest version 2>/dev/null | head -1 || echo unknown)"
ENV_COMMIT="$(git -C "$WORK/.." rev-parse HEAD 2>/dev/null || echo unknown)"
ENV_BRANCH="$(git -C "$WORK/.." rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
ENV_TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

jq -n \
  --arg host "$ENV_HOST" \
  --arg kernel "$ENV_KERNEL" \
  --arg os "$ENV_OS" \
  --arg docker "$ENV_DOCKER" \
  --arg k6 "$ENV_K6" \
  --arg commit "$ENV_COMMIT" \
  --arg branch "$ENV_BRANCH" \
  --arg ts "$ENV_TS" \
  --argjson mysql_sg "$(extract mysql-sheet-get sheet_get)" \
  --argjson pg_sg    "$(extract pg-sheet-get sheet_get)" \
  --argjson mongo_sg "$(extract mongo-sheet-get sheet_get)" \
  --argjson mysql_se "$(extract mysql-search search)" \
  --argjson pg_se    "$(extract pg-search search)" \
  --argjson mongo_se "$(extract mongo-search search)" \
  --arg explain_pg_sg    "$([[ -f $RESULTS/explain-pg-sheet-get.txt ]]    && cat "$RESULTS/explain-pg-sheet-get.txt"    || echo '')" \
  --arg explain_pg_se    "$([[ -f $RESULTS/explain-pg-search.txt ]]       && cat "$RESULTS/explain-pg-search.txt"       || echo '')" \
  --arg explain_mysql_sg "$([[ -f $RESULTS/explain-mysql-sheet-get.txt ]] && cat "$RESULTS/explain-mysql-sheet-get.txt" || echo '')" \
  --arg explain_mysql_se "$([[ -f $RESULTS/explain-mysql-search.txt ]]    && cat "$RESULTS/explain-mysql-search.txt"    || echo '')" \
  --arg explain_mongo_sg "$([[ -f $RESULTS/explain-mongo-sheet-get.txt ]] && cat "$RESULTS/explain-mongo-sheet-get.txt" || echo '')" \
  --arg explain_mongo_se "$([[ -f $RESULTS/explain-mongo-search.txt ]]    && cat "$RESULTS/explain-mongo-search.txt"    || echo '')" \
  '{
     env: {
       host: $host, kernel: $kernel, os: $os,
       docker: $docker, k6: $k6,
       git_commit: $commit, git_branch: $branch,
       timestamp_utc: $ts
     },
     config: {
       data: "10000 sheets x ~50KB JSONB (avg ~16 columns)",
       vu: 50,
       duration_per_scenario: "5m",
       scenarios: ["sheet-get (id-based ~50KB blob)", "search (name lookup via containment / generated-col / path index)"]
     },
     results: {
       mysql: { sheet_get: $mysql_sg, search: $mysql_se },
       pg:    { sheet_get: $pg_sg,    search: $pg_se },
       mongo: { sheet_get: $mongo_sg, search: $mongo_se }
     },
     explain: {
       pg:    { sheet_get: $explain_pg_sg,    search: $explain_pg_se },
       mysql: { sheet_get: $explain_mysql_sg, search: $explain_mysql_se },
       mongo: { sheet_get: $explain_mongo_sg, search: $explain_mongo_se }
     }
   }' > "$RESULTS/combined.json"

log_ok "wrote results/combined.json ($(wc -c < "$RESULTS/combined.json" | tr -d ' ') bytes)"

# ─── 10. Final dump ──────────────────────────────────────────────────
log_ok "ALL DONE"
echo
echo "Truth source: results/combined.json (single file with env + 6 scenarios + 6 EXPLAINs)"
echo "Human-read:   results/SUMMARY.md"
echo "Raw k6:       results/*.json + results/*.summary.json"
echo "EXPLAIN raw:  results/explain-*.txt"
echo
cat "$RESULTS/SUMMARY.md"
