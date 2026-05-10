#!/usr/bin/env bash
# cleanup.sh — tear down the benchmark stack and remove on-disk artifacts.
#
# Safe to run multiple times. Idempotent.
# Touches *only* balruno-bench compose resources; does NOT affect prod
# Spring / Hocuspocus / nginx / monitoring containers.

set -euo pipefail
cd "$(dirname "$0")"

log() { printf '\n\033[1;36m[cleanup]\033[0m %s\n' "$*"; }

log "1/4 docker compose down -v (removes containers + volumes + named network)"
docker compose down -v --remove-orphans

log "2/4 prune any dangling bench images (built API wrappers)"
docker image ls --filter "reference=balruno-bench*" -q | xargs -r docker rmi -f || true

log "3/4 remove seed data + node_modules under seed/"
rm -f seed/sheets.ndjson
rm -rf seed/node_modules
rm -f seed/package-lock.json

log "4/4 RESULTS preserved in ./results/ — copy with scp before deleting the directory"
ls -la results/ 2>/dev/null || true
echo
echo "If you also want to remove the work directory itself, run:"
echo "  cd .. && rm -rf $(basename "$(pwd)")"
