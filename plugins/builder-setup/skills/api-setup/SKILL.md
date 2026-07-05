---
name: api-setup
description: >-
  Use when a solo builder wants to stand up a Cloudflare Workers API server from
  an empty folder through local dev to production — pnpm monorepo, Hono, D1 +
  drizzle, zod contracts, oxc (oxlint/oxfmt), vitest, wrangler-only (no extra IaC).
  Triggers: "Cloudflare Workers API 셋업", "Hono + D1 백엔드 만들기", "wrangler
  프로젝트 셋업", "D1 drizzle 마이그레이션 세팅", "worker API 배포까지".
---

# Cloudflare Workers API Setup

Stand up a production-ready Worker API: empty folder → `setup.sh` → local dev →
deploy. Stack: **pnpm monorepo · Hono · D1 + drizzle · zod · oxc · vitest ·
wrangler-only**. Each step is meant to be **idempotent** (safe to re-run).

**This is guidance, not a rigid pipeline.** It says *what to reach for* and *what
to watch out for* at each layer. Follow the order loosely, adapt to the project,
and skip what doesn't apply. The one thing worth being strict about is the
**config/secrets commit boundary** (§3) — that's where mistakes leak or break
other people's setups.

## Recommended stack

| Concern | Use |
| --- | --- |
| Runtime / routing | Hono (`export default app`) on Workers |
| Data | D1 + drizzle-orm, drizzle-kit for migrations |
| Contracts / validation | zod schemas in `packages/contracts` (shared truth) |
| Types across api/web | `hono/client` (hc) |
| Lint / format | oxc — `oxlint` + `oxfmt` (or eslint/prettier to taste) |
| Test | vitest (+ `@cloudflare/vitest-pool-workers` for worker-runtime tests) |
| Infra | wrangler CLI only — no Terraform/Pulumi |

---

## Architecture first (decide the layering before scattering files)

Aim for a one-directional flow so each layer stays testable and swappable:

```
route ── parse(zod DTO) ──▶ service ──▶ repository ──▶ D1
          └ fail → 4xx        └ domain    └ drizzle
   container { db, clock, ext } injected through every layer
```

Key ideas — **read `references/architecture.md` before scaffolding `src/`**:
- **route** = HTTP only (parse + status codes). **service** = domain logic.
  **repository** = the only place drizzle/SQL lives.
- **zod in `packages/contracts` is the truth** — DTOs and types derive from it,
  shared api↔web. Schema = validation = type, one place.
- **Validate once at the boundary** (`safeParse` at route entry); inner code trusts
  the type afterward.
- **Inject dependencies via a container** on the context (`c.set/c.get`), never
  module-level singletons — so tests and multiple bindings work.
- **Map domain errors → HTTP status in one place** (`app.onError` or a single
  `mapError`); pick throw-vs-Result and keep it uniform.

Folder shape (mirrors the layers): `apps/api/src/{http/routes, services,
repositories}`, `packages/contracts/src` (DTOs), `packages/core/src/{db/schema,
domain}`.

---

## Build order (loose)

### 1. Repo skeleton
- `pnpm init` + `pnpm-workspace.yaml` (`packages/*`, `apps/*`); pin versions once
  with a `catalog:`.
- Create `apps/api`, `packages/contracts`, `packages/core` following the layering
  above.
- `.gitignore`: `node_modules`, `dist`, `.wrangler`, **`wrangler.jsonc`**,
  **`.dev.vars`**, `.env*`.
- `tsconfig` base + per-package extends; `"moduleResolution": "bundler"`.

### 2. Runtime + routing
- `pnpm add hono`; `pnpm add -D wrangler @cloudflare/workers-types typescript`.
- `apps/api/src/index.ts` = the Hono app, `export default app`.
- For a type-safe client, export the route types and consume with `hono/client`.

### 3. Config & secrets — mind the commit boundary
The important discipline. Full detail in `references/config-and-secrets.md`.
- Commit **`wrangler.jsonc.example`** (template in `assets/`); **gitignore the real
  `wrangler.jsonc`** (holds instance `database_id`, routes).
- Commit **`.dev.vars.example`**; gitignore `.dev.vars` (local secrets, auto-loaded
  by `wrangler dev`).
- Production secrets: `wrangler secret put <KEY>` — **write-only, not retrievable;
  keep the value in your own vault.**

### 4. Data layer (D1 + drizzle)
See `references/data-and-migrations.md`.
- `wrangler d1 create <db>` → paste the printed `database_id` into `wrangler.jsonc`.
- `pnpm add drizzle-orm`; `pnpm add -D drizzle-kit`. Schema in
  `packages/core/src/db/schema.ts`; `drizzle.config.ts` `out` must match
  `wrangler.jsonc` `migrations_dir`.
- `drizzle-kit generate` → `wrangler d1 migrations apply <db> --local` for dev;
  `--remote` belongs in the deploy step. Keep queries in the repository layer.

### 5. Validation
- `pnpm add zod @hono/zod-validator`; schemas live in `packages/contracts` (see
  architecture — truth = DTO = type). Validate at route entry, 4xx on failure,
  once — `zValidator('json', Schema)` (the idiomatic Hono wrapper around zod's
  `safeParse`), then read the typed body via `c.req.valid('json')`.

### 6. Local dev + test
- `wrangler dev` binds local D1/queues automatically → `package.json` `"dev"`.
- `pnpm add -D vitest`; start from one smoke test. Reach for
  `@cloudflare/vitest-pool-workers` only when you need the real worker runtime.
- Scripts: `"test": "vitest run"`, `"typecheck": "tsc -b"`.

### 7. Lint / format / pre-commit
- `pnpm add -D oxlint oxfmt` (or eslint/prettier).
- A pre-commit hook (husky / simple-git-hooks) running `oxfmt --check` + `oxlint` +
  `typecheck` is your first gate against shipping a mistake.

### 8. Deploy
See `references/deploy-and-domains.md`.
- Auth: `CLOUDFLARE_API_TOKEN` env var (CI/local) or `wrangler login`.
- `wrangler deploy` → hit the `*.workers.dev` URL to confirm.
- A clean release runs: checkout → inject `wrangler.jsonc` → `pnpm install
  --frozen-lockfile` → build web (if any) → `d1 migrations apply --remote` →
  `wrangler deploy`.

### 9. Domain connection
See `references/deploy-and-domains.md` for the CLI-vs-dashboard split.
- CLI: `routes: [{ pattern: "api.example.com", custom_domain: true }]` in
  `wrangler.jsonc`, then deploy.
- Dashboard (Chrome) only: add the zone + set nameservers at the registrar, create
  the API token, verify DNS is proxied (orange cloud) + SSL active.

### 10. Observability
- `wrangler tail` for live logs.
- ⚠️ **Free plan Workers Logs sampling is aggressive — events drop often.** Don't
  trust `tail` for anything critical; put important diagnostics in the response
  payload or structured logs with explicit categories. (Details in
  `deploy-and-domains.md`.)

---

## The `setup.sh` artifact

Generate `setup.sh` from `assets/setup.sh` into the repo root, filling `__DB_NAME__`
(and `apps/api` paths if different). It's the idempotent bootstrap: `pnpm install`
→ copy `.example` configs only if missing → create D1 only if absent → apply local
migrations. Re-running never clobbers a filled-in config.

Also copy `assets/wrangler.jsonc.example` into `apps/api/` and fill the placeholders
(`__WORKER_NAME__`, `__DB_NAME__`, `__TODAY_YYYY_MM_DD__` for `compatibility_date`,
`database_id` after `d1 create`).

## Done when (signs it works — a checklist, not gates)

1. `pnpm dev` → a route responds locally
2. `pnpm test && pnpm typecheck && oxlint` all pass
3. `wrangler d1 migrations apply --remote` applied
4. production secrets set via `wrangler secret put`
5. `wrangler deploy` → the `*.workers.dev` URL responds
6. custom domain: DNS propagated + SSL active
