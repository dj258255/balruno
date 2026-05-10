#!/usr/bin/env bash
# cleanup.sh — tear down the benchmark stack and remove on-disk artifacts.
#
# Usage:
#   ./cleanup.sh              # default — keep pulled DB images, keep results/
#   ./cleanup.sh --full       # also remove mysql/postgres/mongo base images
#   ./cleanup.sh --wipe       # --full + remove results/ too (truly zero trace)
#
# Safe to run multiple times. Idempotent.
# Touches *only* balruno-bench compose resources; does NOT affect prod
# Spring / Hocuspocus / nginx / monitoring containers.

set -euo pipefail
cd "$(dirname "$0")"

MODE="default"
case "${1:-}" in
  --full) MODE="full" ;;
  --wipe) MODE="wipe" ;;
  "") ;;
  *) echo "unknown option: $1 (use --full or --wipe)"; exit 1 ;;
esac

log() { printf '\n\033[1;36m[cleanup]\033[0m %s\n' "$*"; }

log "1/5 docker compose down -v (removes containers + volumes + named network)"
docker compose down -v --remove-orphans

log "2/5 prune dangling bench images (built API wrappers)"
docker image ls --filter "reference=balruno-bench*" -q | xargs -r docker rmi -f || true

log "3/5 remove seed data + node_modules under seed/"
rm -f seed/sheets.ndjson
rm -rf seed/node_modules
rm -f seed/package-lock.json

if [[ "$MODE" == "full" || "$MODE" == "wipe" ]]; then
  log "4/5 [--full / --wipe] remove pulled DB base images (mysql/postgres/mongo)"
  docker rmi -f mysql:8.4 postgres:18 mongo:7 2>/dev/null || true
else
  log "4/5 keeping pulled DB images (mysql:8.4 / postgres:18 / mongo:7) — next run starts fast"
  echo "      → run with --full to remove them"
fi

if [[ "$MODE" == "wipe" ]]; then
  log "5/5 [--wipe] removing results/ directory — make sure you scp'd it first"
  rm -rf results/
else
  log "5/5 RESULTS preserved in ./results/ — copy with scp before deleting the directory"
  ls -la results/ 2>/dev/null || true
fi

echo
echo "Verify zero trace (containers / volumes / network / dir):"
echo "  docker ps -a --filter name=bench- --format '{{.Names}}: {{.Status}}'"
echo "  docker volume ls | grep balruno-bench"
echo "  docker network ls | grep balruno-bench"
echo
echo "If you also want to remove the work directory itself, run:"
echo "  cd .. && rm -rf $(basename "$(pwd)")"
