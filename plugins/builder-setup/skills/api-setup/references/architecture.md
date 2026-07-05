# Code Architecture — layering

This is the shape to aim for, not a cage. The point is a one-directional
dependency flow so each layer stays testable and swappable. Deviate where a case
genuinely warrants it — just keep the direction intact.

```
[HTTP] route ── parse(zod DTO) ──▶ service ──▶ repository ──▶ D1
                 └ fail → 4xx        └ domain logic  └ drizzle queries
   container (injected): { db, clock, ext } ── passed through every layer
```

Dependency direction: **route → service → repository → D1**. Upper layers know
only the layer directly below; no reverse dependency.

## The layers

- **route (Hono handler)** — HTTP only. Parse input, map results to status codes.
  No domain logic, no SQL here.
- **service (domain logic)** — one use case per function. Prefer pure functions;
  take external dependencies as arguments (from the container), don't reach for
  globals.
- **repository** — the *only* place drizzle/SQL lives. Services depend on a repo
  interface, so tests can mock it and you can swap the D1 binding.

## Contracts = the single source of truth

- zod schemas in `packages/contracts` **are** the truth. Derive request/response
  DTOs and TypeScript types from them, and share those across api and web (types
  propagate through `hono/client`). **Schema = validation = type, in one place.**
- **Validate once, at the trust boundary.** `safeParse` at route entry; once it
  passes, inner code trusts the type and does not re-validate.

```ts
// packages/contracts/src/user.ts
import { z } from 'zod';
export const CreateUser = z.object({ email: z.string().email() });
export type CreateUser = z.infer<typeof CreateUser>;
```

## Dependency injection via a container

Bundle `db` / `clock` / external API clients into a container and put it on the
context per request — no global singletons (so tests and multiple bindings work).

```ts
// container shape
type Container = { db: DrizzleD1Database; clock: () => Date; ext: ExtClients };

// middleware sets it
app.use('*', async (c, next) => {
  c.set('container', { db: drizzle(c.env.DB), clock: () => new Date(), ext });
  await next();
});

// handler pulls it — never a module-level singleton
app.post('/users', zValidator('json', CreateUser), async (c) => {
  const { db, clock } = c.get('container');
  const user = await createUser({ db, clock }, c.req.valid('json')); // service
  return c.json(user, 201);
});
```

Type the container on Hono's `Variables` so `c.get('container')` is typed:
`new Hono<{ Bindings: Env; Variables: { container: Container } }>()`.

## Error contract — mapped in one place

Define domain error types and map them to HTTP status **once** (a central
`app.onError`, or a single `mapError`). Decide up front whether the codebase
**throws** domain errors or returns a `Result` — and keep it uniform.

```ts
app.onError((err, c) => {
  if (err instanceof NotFoundError) return c.json({ error: err.message }, 404);
  if (err instanceof ConflictError) return c.json({ error: err.message }, 409);
  return c.json({ error: 'internal' }, 500);
});
```

## Folder layout that reflects the layers

```
apps/api/src/
  index.ts                # Hono app: export default app
  http/routes/            # route handlers (HTTP only)
  services/               # domain logic (use cases)
  repositories/           # drizzle queries, isolated
packages/contracts/src/   # zod DTOs (shared truth)
packages/core/src/
  db/schema.ts            # drizzle schema
  domain/                 # domain types / errors
```

The repository is the only place SQL lives; see `data-and-migrations.md` §5 for
the `usersRepo(db)` example and drizzle setup.
