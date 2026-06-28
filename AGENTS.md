# lrt-virtualtour Repository Guide

## Scope

- This repository owns virtual tour work for the Divisi LRT platform.
- Keep repository-specific product behavior, contracts, deployment notes, and troubleshooting here rather than in the workspace-level guide.

## Working Model

- Follow the workspace `AGENTS.md` first, then this repository guide for local decisions.
- Keep changes scoped to this repository unless a cross-repo contract is explicitly required.
- Do not commit real secrets. Use ignored local environment files for runtime configuration.
- Document build, test, and runtime commands here once the application stack is selected.

## Validation

- For documentation-only changes, validate with `git status` before committing.
- Once a stack exists, add and use the repository's own lint, test, build, and compose validation commands.

