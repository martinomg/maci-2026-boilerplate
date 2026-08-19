---
name: directus-schema
description: Change this project's Directus collections, fields, permissions, policies or seed data through versioned Directus Sync files. Use for CMS schema and access-control work; do not use for ordinary editorial content changes.
---

# Directus schema as code

Treat `api/directus-config/` as the source of truth. Structural changes flow from code to a disposable local database, never from an untracked production Admin UI change.

Before editing, inspect the current snapshot, permissions, seed files and consumers in `app/`. For parallel or destructive work, first read `../parallel-worktrees/SKILL.md` and use an isolated worktree stack.

## Files

- `snapshot/collections/<collection>.json`: collection metadata.
- `snapshot/fields/<collection>/<field>.json`: physical and alias fields.
- `snapshot/relations/<collection>/<field>.json`: relationships.
- `collections/permissions.json`, `policies.json`, `roles.json`: access control.
- `seed/*.json`: deterministic starter content. Every record needs a stable `_sync_id`.

Keep seed `delete` false unless the user explicitly wants the seed to own and remove all other records in that collection.

## Workflow

1. Inspect existing schema and application reads. Record the affected files and compatibility risks.
2. Edit the smallest set of JSON files. Preserve Directus-generated shape and metadata.
3. Run `pnpm schema:diff` against the isolated stack.
4. Run `pnpm schema:apply`, then verify the field or permission through the public API and an authenticated API when relevant.
5. Run `pnpm typecheck`, `pnpm test`, `pnpm build` and any focused endpoint checks.
6. Run `pnpm schema:diff` again. It must report no unexplained drift.

Use `pnpm schema:pull` only to capture an intentional local Admin UI experiment. Review every generated file and remove unrelated runtime changes before committing.

For destructive conversions, test against a recoverable copy first. Never reset shared data or use forced cleanup without explicit scope and a backup.

