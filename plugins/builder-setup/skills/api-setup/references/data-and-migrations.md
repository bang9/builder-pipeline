# Data Layer — D1 + drizzle

## 1. Create the D1 database (once, idempotent via `setup.sh`)

```sh
wrangler d1 create <db-name>
```

Prints a `database_id` (UUID). **Paste it into `apps/api/wrangler.jsonc`** under
`d1_databases[0].database_id`. Re-running `d1 create` for an existing name errors,
so `setup.sh` guards with `wrangler d1 list | grep -q <db-name>`.

The binding name (`"binding": "DB"`) is how the DB appears in code as `c.env.DB`.

## 2. Install drizzle

```sh
pnpm add drizzle-orm
pnpm add -D drizzle-kit
```

Put the schema in a shared package so api (and web, later) can import types:
`packages/core/src/db/schema.ts`.

```ts
// packages/core/src/db/schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
```

## 3. drizzle-kit config

```ts
// drizzle.config.ts (repo root or apps/api)
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  driver: 'd1-http',                       // D1 dialect for drizzle-kit
  schema: './packages/core/src/db/schema.ts',
  out: './apps/api/drizzle/migrations',    // must match wrangler.jsonc migrations_dir
});
```

`out` MUST equal `d1_databases[].migrations_dir` in `wrangler.jsonc` — wrangler
applies migrations from that dir.

## 4. Generate + apply migrations

```sh
# Generate SQL from schema changes (commit the generated files)
pnpm drizzle-kit generate

# Local D1 (safe, offline) — used in dev and by setup.sh
wrangler d1 migrations apply <db-name> --local

# Production D1 (part of the deploy procedure, NOT run casually)
wrangler d1 migrations apply <db-name> --remote
```

- `--local` targets the on-disk sqlite under `.wrangler/` that `wrangler dev` uses.
- `--remote` mutates the real production DB — it belongs in the deploy sequence
  (see `deploy-and-domains.md`), gated behind a green build.
- Applying an already-applied migration is a no-op (wrangler tracks applied
  migrations) → idempotent.

## 5. Where drizzle lives

Build the drizzle instance once per request in the DI container middleware
(`drizzle(c.env.DB)`), and keep **all queries in the repository layer** — routes
and services never call drizzle directly. See `architecture.md`.

```ts
// apps/api/src/repositories/users.ts — the only place SQL lives
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { users } from '@builder-pipeline/core/db/schema';

export function usersRepo(db: ReturnType<typeof drizzle>) {
  return {
    list: () => db.select().from(users).all(),
    byEmail: (email: string) =>
      db.select().from(users).where(eq(users.email, email)).get(),
  };
}
```
