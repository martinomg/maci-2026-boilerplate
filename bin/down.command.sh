#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
[ -f "$ROOT/api/.env" ] || { echo "Nothing to stop: api/.env is missing."; exit 0; }
docker compose --env-file "$ROOT/api/.env" -f "$ROOT/api/docker-compose.yml" down

