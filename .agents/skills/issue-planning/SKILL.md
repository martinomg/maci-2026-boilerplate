---
name: issue-planning
description: Plan, write, split, review or close GitHub issues for this repository using verified code evidence, testable acceptance criteria and complete classification. Use for issue lifecycle work, not for implementing an already clear task.
---

# Evidence-led issue planning

Inspect the repository and existing GitHub issues before drafting. An issue must describe current code, not memory or an assumed architecture.

## Before writing

1. Search implementations, migrations, routes, tests and docs related to the request.
2. Record evidence as repository-relative `file:line` references. Never include local absolute paths or secrets.
3. Distinguish a named module from working end-to-end behavior.
4. Inspect existing labels, milestones and issue language with `gh`.

## Issue shape

Use a scoped imperative title. Write these sections when applicable:

- `Context`: user or operator problem and why it matters.
- `Verified current state`: dated `file:line` evidence for what exists and what is missing.
- `Scope`: concrete deliverables a reviewer can identify in a diff.
- `Non-goals`: boundaries that prevent accidental expansion.
- `Acceptance criteria`: observable behavior, including negative cases and exact test evidence.
- `Dependencies`: blocked-by and related issues.

Acceptance criteria must map to tests or a precise observable check. Do not restate implementation tasks as outcomes.

Classify with area, priority and size labels plus a milestone. Split work larger than roughly three focused days into independently closable issues. An epic lists children but does not duplicate their scopes.

Before closing, verify every criterion against current code and passing checks. If only part is complete, comment a `PARTIAL` verdict that separates done and missing behavior with evidence. Never close because a matching file or symbol exists.

