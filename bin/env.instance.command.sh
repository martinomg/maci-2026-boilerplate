#!/usr/bin/env bash
# Create an isolated api/.env for this worktree.
# Usage: bin/env.instance.command.sh <name> --offset <N> [--from PATH] [--force]
set -euo pipefail

usage() {
  echo "Usage: bin/env.instance.command.sh <name> --offset <N> [--from PATH] [--force]"
}

NAME=""
OFFSET=""
SOURCE=""
FORCE=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --offset) OFFSET="${2:?--offset requires a number}"; shift 2 ;;
    --from) SOURCE="${2:?--from requires a path}"; shift 2 ;;
    --force) FORCE=1; shift ;;
    -h|--help) usage; exit 0 ;;
    -*) echo "Unknown option: $1" >&2; usage >&2; exit 1 ;;
    *) NAME="$1"; shift ;;
  esac
done

[ -n "$NAME" ] || { usage >&2; exit 1; }
[ -n "$OFFSET" ] || { echo "--offset is required" >&2; exit 1; }
[[ "$NAME" =~ ^[a-z][a-z0-9-]{1,29}$ ]] || {
  echo "name must be a lowercase slug with 2-30 characters" >&2
  exit 1
}
[[ "$OFFSET" =~ ^[0-9]{1,2}$ ]] || {
  echo "offset must be an integer from 0 to 99" >&2
  exit 1
}

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="$ROOT/api/.env"

if [ -z "$SOURCE" ]; then
  PRIMARY="$(git -C "$ROOT" worktree list --porcelain | sed -n 's/^worktree //p' | head -1)"
  SOURCE="$PRIMARY/api/.env"
fi

[ -f "$SOURCE" ] || {
  echo "Source env not found: $SOURCE. Initialize the primary worktree first or use --from." >&2
  exit 1
}

GENERATED="$(mktemp)"
trap 'rm -f "$GENERATED"' EXIT
cp "$SOURCE" "$GENERATED"
DELTA=$((OFFSET * 100))

base_port() {
  case "$1" in
    POSTGRES_PORT) echo 18701 ;;
    QDRANT_TCP_PORT) echo 18703 ;;
    QDRANT_GRPC_PORT) echo 18704 ;;
    DIRECTUS_PORT) echo 18707 ;;
    NEXT_PORT) echo 18708 ;;
  esac
}

replace_value() {
  local key="$1"
  local value="$2"
  local temporary="${GENERATED}.tmp"
  awk -v key="$key" -v value="$value" '
    index($0, key "=") == 1 { print key "=" value; next }
    { print }
  ' "$GENERATED" > "$temporary"
  mv "$temporary" "$GENERATED"
}

replace_value COMPOSE_PROJECT_NAME "$NAME"

for variable in POSTGRES_PORT QDRANT_TCP_PORT QDRANT_GRPC_PORT DIRECTUS_PORT NEXT_PORT; do
  replace_value "$variable" "$(( $(base_port "$variable") + DELTA ))"
done

DIRECTUS_PORT_VALUE=$((18707 + DELTA))
NEXT_PORT_VALUE=$((18708 + DELTA))
replace_value DIRECTUS_PUBLIC_URL "http://localhost:${DIRECTUS_PORT_VALUE}"
replace_value NEXT_PUBLIC_DIRECTUS_URL "http://localhost:${DIRECTUS_PORT_VALUE}"
replace_value NEXT_PUBLIC_SITE_URL "http://localhost:${NEXT_PORT_VALUE}"

if [ -f "$TARGET" ]; then
  if cmp -s "$GENERATED" "$TARGET"; then
    echo "api/.env is already configured for '$NAME' with offset $OFFSET."
    exit 0
  fi
  if [ "$FORCE" -ne 1 ]; then
    echo "api/.env differs from the requested instance. Review it or use --force." >&2
    exit 1
  fi
fi

mv "$GENERATED" "$TARGET"
trap - EXIT
chmod 600 "$TARGET"
cat <<EOF
Created isolated environment '$NAME' with offset $OFFSET.
Next:     http://localhost:${NEXT_PORT_VALUE}
Directus: http://localhost:${DIRECTUS_PORT_VALUE}
Qdrant:   http://localhost:$((18703 + DELTA))
EOF
