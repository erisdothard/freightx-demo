# Phase 0 — Repo, CI/CD, Tooling

**Status:** Complete

**Migrations:** None

**Key files added:**

- `package.json` (root) — pnpm monorepo with turbo, commitlint, prettier, husky
- `pnpm-workspace.yaml` — workspace config for `apps/*` and `packages/*`
- `turbo.json` — build pipeline (build, lint, typecheck, test, dev tasks)
- `.github/workflows/ci.yml` — lint, format check, typecheck, test, build on every PR
- `.husky/pre-commit`, `.husky/commit-msg` — lint-staged + commitlint hooks
- `commitlint.config.js` — conventional commit enforcement with scope allowlist
- `.prettierrc` — shared formatting config
- `packages/shared/` — shared TypeScript package scaffold
- `packages/typescript-config/` — strict tsconfig base and web variant
- `apps/web/` — Vite + React 19 scaffold with Tailwind and fx-\* design system

**Features delivered:**

- pnpm + Turborepo monorepo with `apps/web` and `packages/shared`
- GitHub Actions CI pipeline (lint → format → typecheck → test → build)
- Husky pre-commit (lint-staged/prettier) and commit-msg (commitlint) hooks
- Conventional commit enforcement with valid scope allowlist
- Orange + dark grey fx-\* Tailwind design system initialized
- `.env.example` documented
