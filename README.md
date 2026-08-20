# MACI 2026 Boilerplate

A public, working starter for teams and coding agents that need:

- Next.js 16 with the App Router and Server Components
- Directus 11 on PostgreSQL
- Directus Sync migrations, permissions and seed data
- Qdrant semantic search without a required paid embedding API
- isolated Docker stacks for parallel Git worktrees
- repository-local skills for schema changes, issue planning and worktrees

The included journal is not mock UI. Next.js reads published posts from Directus, and its search endpoint retrieves the same posts from Qdrant.

## Quick start

Requirements: Docker, Node.js 20.9 or newer, and pnpm 10.

```bash
pnpm install
pnpm dev
```

The first run creates a local `api/.env` with generated secrets, builds the containers, applies the Directus Sync schema and seed, and indexes the published posts in Qdrant.

| Service | Default URL |
| --- | --- |
| Next.js | http://localhost:18708 |
| Directus Admin | http://localhost:18707/admin |
| Qdrant Dashboard | http://localhost:18703/dashboard |
| PostgreSQL | localhost:18701 |

The Directus admin email comes from `api/.env.example`. The generated local password is stored only in the ignored `api/.env`.

Stop the stack with:

```bash
pnpm down
```

## Architecture

```text
Browser
  |
  v
Next.js :18708
  |-- published posts ----------> Directus :18707 --> PostgreSQL :18701
  `-- semantic search ----------> Qdrant :18703

Versioned source of truth
  api/directus-config/snapshot   collection and field schema
  api/directus-config/collections policies, permissions and settings
  api/directus-config/seed       starter blog content
```

`app/lib/directus.ts` fetches the blog directly from Directus in Server Components. `app/scripts/index-blog.ts` indexes published content using a deterministic local vector, and `app/app/api/search/route.ts` queries Qdrant. Swap `embedText` for a hosted embedding model when the application requires higher retrieval quality.

## Directus Sync workflow

The project is code first. Directus Admin is useful for inspecting content, but committed JSON is the source of truth for structure and permissions.

Directus 11 represents public access with the built-in policy whose Sync ID is `_sync_default_public_policy`. Add public permissions to that policy; do not attach a second policy with a `null` role, because Directus Sync also uses that shape to discover the reserved public policy. The schema commands validate policy references and permission filter objects before applying changes.

The reference `Editor` role is API-only (`app_access: false`). Its policy can read alerts, update only their `label` field, and read posts; enabling Studio access would also require the corresponding minimum system-collection permissions.

The parking personas follow the same API-only shape, one policy per role and no anonymous access to any `parking_*` collection:

| Role | Policy | Grants |
| --- | --- | --- |
| `Internal User` | Parking read only | read `parking_lots`, `parking_spots`, `parking_sessions`, `parking_transactions`, `directus_files` |
| `Operations Chief` | Parking operations reports | same reads, kept as its own policy so report-specific rules can diverge |
| `Configurator` | Parking layout configuration | same reads plus update `parking_lots.layout_svg`, update `parking_spots.svg_element_id`, create `directus_files` |

The software admin persona reuses the built-in `Administrator` role.

```bash
# Preview drift without changing the database
pnpm schema:diff

# Apply snapshot, system configuration and seed data
pnpm schema:apply

# Capture an intentional local experiment, then review every diff
pnpm schema:pull

# Rebuild the Qdrant index after content changes
pnpm search:index
```

Schema work should use the repository skill at `.agents/skills/directus-schema/SKILL.md`.

## Parallel worktrees

Each worktree owns its Compose project, host ports and bind-mounted data. Never point two active worktrees at the same `api/.env` identity.

From the primary checkout:

```bash
git worktree add ../maci-search -b agent/search main
cd ../maci-search
bin/env.instance.command.sh search --offset 1
pnpm install
pnpm dev
```

Offset `N` adds `N * 100` to every base port. Offset 1 uses Next `18808`, Directus `18807`, PostgreSQL `18801`, and Qdrant `18803/18804`. The script copies the primary worktree's ignored env file, then rewrites only instance identity, ports and local URLs.

Clean up an experimental worktree from inside it, then remove it from the primary checkout:

```bash
pnpm down
cd ../maci-2026-boilerplate
git worktree remove ../maci-search
```

Read `.agents/skills/parallel-worktrees/SKILL.md` before coordinating parallel agents.

## Repository skills

Skills are public project assets:

- `.agents/skills/directus-schema`
- `.agents/skills/github-delivery`
- `.agents/skills/issue-planning`
- `.agents/skills/parallel-worktrees`

Claude-compatible forwarders live in `.claude/skills`. `AGENTS.md` and `CLAUDE.md` carry the same project guidance. Gemini CLI loads `GEMINI.md`, which imports `AGENTS.md`, and discovers the same canonical `.agents/skills` directory without duplicate copies.

## Environment and privacy

Only `api/.env.example` is committed. `.env`, database files, uploads, Qdrant storage, logs and editor configuration are ignored. Never put credentials, local absolute paths, customer data or machine-specific details in docs, skills, issues or commits.

Before publishing changes:

```bash
pnpm verify
git grep -nE '/Users/|/home/|gh[opsu]_|sk-[A-Za-z0-9]|BEGIN (RSA |OPENSSH )?PRIVATE KEY'
```

## Validation

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm verify
```

`pnpm verify` also checks the running Directus, Qdrant, homepage, public posts endpoint and semantic search when a local environment exists.

Validation is local-first: run the relevant checks before each push and use GitHub Actions only as a secondary safety net. CI should confirm an already verified change, not serve as the primary debugging loop.

## License

MIT
