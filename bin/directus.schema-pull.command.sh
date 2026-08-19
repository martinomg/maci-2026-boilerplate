#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
"$ROOT/bin/wait-for-services.command.sh"
pnpm --dir "$ROOT/api" sync:pull
echo "Review every generated schema and system-data diff before committing."

