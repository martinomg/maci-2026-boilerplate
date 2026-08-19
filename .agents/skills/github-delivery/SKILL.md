---
name: github-delivery
description: Commit, push and publish repository changes with selective staging, local-first verification, and aligned GitHub issues, pull requests and milestones. Use when the user explicitly asks to commit, push, open a PR or adjust delivery tracking; use issue-planning instead for drafting issues only.
---

# GitHub delivery

Publish only when the user explicitly requests the external action. A request to prepare or review changes does not authorize a commit, push, PR, issue edit or milestone mutation.

## Prepare locally

1. Inspect `git status`, relevant diffs, the current branch, its upstream and recent commit style.
2. Preserve unrelated or user-owned changes. Stage explicit paths; never use `git add .` or `git add -A`.
3. Run checks proportional to the change locally before committing. Use `pnpm verify` for a full release check when the local stack is available.
4. Review the staged diff and filenames for `.env`, credentials, tokens, local absolute paths, database data, uploads, vector storage and generated build output.

Local results are the integrity gate. GitHub Actions is only a secondary safety net and must not become a push-to-debug loop.

## Commit

Keep each commit logically atomic. Follow the repository history and use Conventional Commits with a concise imperative subject. Prefer these scopes when they fit: `app`, `directus`, `search`, `infra`, `docs`, `skills`, and `ci`.

Do not bypass hooks, amend published commits, rewrite shared history or force-push unless the user explicitly requests that exact operation and the impact is understood.

## Push and pull requests

Before pushing, fetch the remote and inspect ahead/behind state. Push the current branch to its matching upstream unless the user specifies another target. If branch protection or divergence blocks the push, stop and report it rather than bypassing safeguards.

For a PR, use a Conventional Commit title and include:

- `Summary`: what changed and why.
- `Local verification`: commands and observable results already obtained.
- `Issues`: `Closes #N` only when all acceptance criteria are satisfied; otherwise use `Refs #N`.

## Issues and milestones

Commits do not own GitHub milestones; issues and pull requests do. For work tied to tracked delivery:

1. Inspect the linked issue or PR, its state, labels and milestone with `gh` before changing it.
2. Keep the issue or PR in its current milestone when the change is partial.
3. Move it to another milestone only when the user requests the adjustment or the authorized task explicitly includes roadmap maintenance.
4. Create a milestone only when no suitable open milestone exists and creation is authorized.
5. Close an issue only after verifying every acceptance criterion against current code and local checks.

Use repository-derived owner and name instead of hardcoding a personal account:

```bash
gh repo view --json nameWithOwner
gh issue view <number> --json state,labels,milestone,body
gh pr view <number> --json state,headRefName,milestone,body
gh issue edit <number> --milestone "<title>"
gh pr edit <number> --milestone "<title>"
```

Finish by reporting commit SHA, branch, pushed remote, PR or issue links, milestone changes and local verification. Report CI separately as confirmation when available.
