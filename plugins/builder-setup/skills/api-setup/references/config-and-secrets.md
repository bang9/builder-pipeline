# Config Files & Secrets — what's committed vs what's not

The single most important discipline in this stack: **instance config and secrets
are gitignored; only `.example` templates are committed.** Get this boundary wrong
and you either leak secrets or push one dev's `database_id`/route to everyone.

## The commit boundary

| File | Committed? | Why |
| --- | --- | --- |
| `apps/api/wrangler.jsonc.example` | ✅ yes | Shared template — structure, binding names, no instance IDs |
| `apps/api/wrangler.jsonc` | ❌ **gitignore** | Per-instance: real `database_id`, routes, account-specific values |
| `apps/api/.dev.vars.example` | ✅ yes | Lists which local secrets exist (keys only, dummy values) |
| `apps/api/.dev.vars` | ❌ **gitignore** | Real local secrets |
| `.env*` | ❌ gitignore | — |

`.gitignore` must include: `node_modules`, `dist`, `.wrangler`, `wrangler.jsonc`,
`.dev.vars`, `.env*`.

> The `.example` files are the source of truth for *shape*; the live files are
> filled per machine. `setup.sh` copies example → live only when live is missing
> (idempotent — never clobbers a filled-in file).

## Local secrets — `.dev.vars`

`wrangler dev` auto-loads `apps/api/.dev.vars` (dotenv format) and exposes each as
`c.env.<KEY>`. Keep a committed `.dev.vars.example`:

```sh
# .dev.vars.example — copy to .dev.vars and fill real values
JWT_SECRET="dev-only-change-me"
SOME_API_KEY=""
```

## Production secrets — `wrangler secret put` (write-only)

```sh
wrangler secret put JWT_SECRET      # prompts for the value; stored encrypted
wrangler secret list                # names only — values are NOT retrievable
```

- Secrets are **write-only**: you cannot read them back after setting. **Keep the
  values in your own password manager / vault** — Cloudflare won't show them again.
- Setting the same key again overwrites (idempotent from the caller's view).
- Production secrets are separate from `.dev.vars` (which is local-only).

## typecheck / bundler settings

- `tsconfig` base with `"moduleResolution": "bundler"`, per-package `tsconfig`
  extending it. Workers is bundled by wrangler/esbuild, so `bundler` resolution
  matches runtime.
- Add `@cloudflare/workers-types` to the api package and reference it in its
  `tsconfig` `types` (or via `/// <reference types="..." />`) so `c.env` bindings
  and the Workers globals type-check.
