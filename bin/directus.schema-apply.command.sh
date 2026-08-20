#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

[ -f "$ROOT/api/.env" ] || {
  echo "Missing api/.env. Run bin/env.init.command.sh first." >&2
  exit 1
}

"$ROOT/bin/wait-for-services.command.sh"
pnpm --dir "$ROOT/api" sync:validate
pnpm --dir "$ROOT/api" sync:push
pnpm --dir "$ROOT/api" seed:push
node "$ROOT/api/scripts/ensure-service-user.mjs"
echo "Directus schema and blog seed are synchronized from versioned files."
