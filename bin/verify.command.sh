#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/api/.env"

pnpm --dir "$ROOT/api" sync:validate
pnpm --dir "$ROOT/api" sync:test
pnpm --dir "$ROOT/app" lint
pnpm --dir "$ROOT/app" typecheck
pnpm --dir "$ROOT/app" test
pnpm --dir "$ROOT/app" build

if [ -f "$ENV_FILE" ]; then
  set -a
  . "$ENV_FILE"
  set +a
  docker compose --env-file "$ENV_FILE" -f "$ROOT/api/docker-compose.yml" config --quiet
  "$ROOT/bin/wait-for-services.command.sh"
  curl --fail --silent "http://localhost:${DIRECTUS_PORT}/items/posts?limit=1" >/dev/null
  curl --fail --silent "http://localhost:${NEXT_PORT}" >/dev/null
  curl --fail --silent "http://localhost:${NEXT_PORT}/api/search?q=parallel%20worktrees" >/dev/null
fi

echo "All available checks passed."
