#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXAMPLE="$ROOT/api/.env.example"
TARGET="$ROOT/api/.env"
FORCE=0

if [ "${1:-}" = "--force" ]; then
  FORCE=1
fi

if [ -f "$TARGET" ] && [ "$FORCE" -ne 1 ]; then
  echo "api/.env already exists. Use --force to replace it."
  exit 0
fi

cp "$EXAMPLE" "$TARGET"

replace_value() {
  local key="$1"
  local value="$2"
  local temporary="${TARGET}.tmp"
  awk -v key="$key" -v value="$value" '
    index($0, key "=") == 1 { print key "=" value; next }
    { print }
  ' "$TARGET" > "$temporary"
  mv "$temporary" "$TARGET"
}

replace_value POSTGRES_PASSWORD "$(openssl rand -hex 18)"
replace_value DIRECTUS_KEY "$(openssl rand -hex 24)"
replace_value DIRECTUS_SECRET "$(openssl rand -hex 32)"
replace_value ADMIN_PASSWORD "$(openssl rand -hex 18)"
replace_value DIRECTUS_SERVICE_TOKEN "$(openssl rand -hex 24)"

chmod 600 "$TARGET"
echo "Created local api/.env from api/.env.example with generated secrets."

