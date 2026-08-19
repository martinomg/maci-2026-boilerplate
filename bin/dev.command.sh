#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [ ! -f "$ROOT/api/.env" ]; then
  "$ROOT/bin/env.init.command.sh"
fi

if [ ! -d "$ROOT/node_modules" ]; then
  pnpm --dir "$ROOT" install
fi

docker compose --env-file "$ROOT/api/.env" -f "$ROOT/api/docker-compose.yml" up -d --build
"$ROOT/bin/directus.schema-apply.command.sh"
"$ROOT/bin/qdrant.index.command.sh"

set -a
. "$ROOT/api/.env"
set +a

echo "Stack is running."
echo "Next:          http://localhost:${NEXT_PORT}"
echo "Directus:      http://localhost:${DIRECTUS_PORT}/admin"
echo "Qdrant:        http://localhost:${QDRANT_TCP_PORT}/dashboard"

