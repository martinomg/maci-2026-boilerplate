---
name: parallel-worktrees
description: Create, run and clean isolated Git worktrees for parallel agents or risky experiments in this project, including unique Compose identities, ports and local data. Use whenever multiple branches or agents need a running stack at the same time.
---

# Parallel worktree stacks

One active agent or branch owns one Git worktree and one isolated Compose stack. Never share the primary stack, ports or bind-mounted data with parallel work.

## Create an instance

From the primary checkout:

```bash
git worktree add ../maci-<task> -b agent/<task> main
cd ../maci-<task>
bin/env.instance.command.sh <task> --offset <N>
pnpm install
pnpm dev
```

Use a unique positive offset for every active instance. Ports are base plus `N * 100`:

| Service | Base |
| --- | ---: |
| PostgreSQL | 18701 |
| Qdrant HTTP | 18703 |
| Qdrant gRPC | 18704 |
| Directus | 18707 |
| Next.js | 18708 |

The env script copies the primary worktree's ignored `api/.env`, then rewrites identity, ports and localhost URLs. It refuses to overwrite an existing target unless `--force` is explicit. Never commit either env file.

Fresh worktrees have empty service data. `pnpm dev` creates containers, applies the versioned Directus schema and seed, then rebuilds the Qdrant index.

## Agent ownership

Assign exact files or directories, expected output and verification to each agent. Do not give two agents overlapping ownership. Merge or cherry-pick only after reviewing both the diff and checks from the isolated worktree.

## Cleanup

Inside the experimental worktree run `pnpm down`. From the primary checkout, confirm the target path and run `git worktree remove ../maci-<task>`. Worktree-relative database and Qdrant data are removed with that checkout; do not target a shared or unresolved directory.

