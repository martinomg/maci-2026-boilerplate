#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/api/.env"

[ -f "$ENV_FILE" ] || {
  echo "Missing api/.env. Run bin/env.init.command.sh first." >&2
  exit 1
}

set -a
. "$ENV_FILE"
set +a

export DIRECTUS_INTERNAL_URL="http://localhost:${DIRECTUS_PORT}"
export QDRANT_URL="http://localhost:${QDRANT_TCP_PORT}"

pnpm --dir "$ROOT/app" index:blog

