#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/api/.env"

set -a
. "$ENV_FILE"
set +a

wait_for_url() {
  local name="$1"
  local url="$2"
  local attempts=60
  local count=1

  while [ "$count" -le "$attempts" ]; do
    if curl --fail --silent --show-error "$url" >/dev/null 2>&1; then
      echo "$name is ready at $url"
      return 0
    fi
    sleep 2
    count=$((count + 1))
  done

  echo "$name did not become ready: $url" >&2
  return 1
}

wait_for_url Directus "http://localhost:${DIRECTUS_PORT}/server/health"
wait_for_url Qdrant "http://localhost:${QDRANT_TCP_PORT}/readyz"

