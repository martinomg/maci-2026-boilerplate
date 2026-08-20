#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
"$ROOT/bin/wait-for-services.command.sh"
pnpm --dir "$ROOT/api" sync:validate
pnpm --dir "$ROOT/api" sync:diff
pnpm --dir "$ROOT/api" seed:diff
