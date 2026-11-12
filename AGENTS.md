# lrt-virtualtour Repository Guide

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Scope

- This repository owns virtual tour work for the Divisi LRT platform.
- Keep repository-specific product behavior, contracts, deployment notes, and troubleshooting here rather than in the workspace-level guide.
- The current application stack is Next.js with Prisma-backed CMS and virtual tour features.

## Working Model

- Follow the workspace `AGENTS.md` first, then this repository guide for local decisions.
- Keep changes scoped to this repository unless a cross-repo contract is explicitly required.
- Do not commit real secrets. Use ignored local environment files for runtime configuration.
- Preserve app behavior from the repository branch being merged unless a change is explicitly requested.

## Validation

- Use MCP Responsively for visual and responsive UI checks, as requested by the user. Do not substitute another browser tool for these checks without a user request.
- For documentation-only changes, validate with `git status` before committing.
- For code changes, prefer `npm run lint` and `npm run build` when dependencies and environment are available.
- Use Prisma commands from `package.json` for schema generation, migrations, seed data, and database inspection.
- Validate Docker deployment config with `docker compose --env-file .env.dev.example -f docker-compose.dev.yml config` and `docker compose --env-file .env.prod.example -f docker-compose.prod.yml config`.
- Production HTTP exposure must stay on host port `80`; development Jenkins deploy uses app port `5011` and Postgres port `6010`.
