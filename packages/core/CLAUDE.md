# @builder-pipeline/core

Shared AI model resolver for the builder-pipeline monorepo. Reads the `IMAGE_PROVIDER` env var and returns a configured Vercel AI SDK image model, allowing downstream packages to generate images without caring about provider details.

## Metadata

| Field   | Value                                                        |
| ------- | ------------------------------------------------------------ |
| Runtime | `nodejs` (Node.js only -- `"node"` condition in exports)     |
| Entry   | `src/index.ts`                                               |
| Exports | `"."` -> `types: ./dist/index.d.ts`, `node: ./dist/index.js` |

### Dependencies

| Dependency                | Purpose                                                       |
| ------------------------- | ------------------------------------------------------------- |
| `ai` (^6.0)               | Vercel AI SDK core -- provides the runtime for AI model calls |
| `@ai-sdk/provider` (^3.0) | Shared types (`ImageModelV3`) used in function signatures     |
| `@ai-sdk/google` (^3.0)   | Google provider -- Imagen 4.0 models                          |
| `@ai-sdk/openai` (^3.0)   | OpenAI provider -- GPT Image 1 / 1-mini models                |

## Project Structure

```
src/
  index.ts              # Public API barrel -- re-exports getImageModel, getProviderName from ai.ts
  ai.ts                 # AI model resolver: provider selection, model mapping, provider detection
  __tests__/
    ai.test.ts          # Unit tests for getImageModel and getProviderName (vitest)
tsconfig.json           # Extends ../../tsconfig.base.json, compiles src/ to dist/, excludes __tests__
package.json            # Package config with bp.runtime, conditional exports, scripts
```

## Complex Files

### `src/ai.ts`

This is the only source file with real logic, but it has several non-obvious behaviors:

**1. Lazy model construction via thunks**

`MODEL_MAP` stores `() => ImageModelV3` factory functions, not model instances. Each call to `getImageModel()` creates a fresh model object. This is intentional -- the `google.image()` and `openai.image()` calls read API keys from `process.env` at call time, so the thunks ensure env changes are picked up between calls. Do not refactor these into eagerly-evaluated constants.

**2. Google has no quality differentiation**

Both `high` and `draft` quality tiers for Google resolve to the same `imagen-4.0-generate-preview-06-06` model. Only OpenAI distinguishes between tiers (`gpt-image-1` vs `gpt-image-1-mini`). This means the `Quality` parameter is a no-op for Google today. If Google adds a lightweight model in the future, update only the `draft` thunk.

**3. Case normalization with type narrowing gap**

`getImageModel()` lowercases `IMAGE_PROVIDER` via `.toLowerCase()` then casts it to `string` (not `ImageProvider`). The lookup uses `as ImageProvider` on the key. This means any casing of `"Google"`, `"OPENAI"`, etc. works, but the type system does not enforce the valid set -- the runtime `if (!mapping)` check is the actual guard. Do not remove that check or rely on TypeScript to catch invalid providers.

**4. API key validation is deferred**

`getImageModel()` validates the provider name but does NOT check for `GOOGLE_API_KEY` or `OPENAI_API_KEY`. Missing API keys only surface when the returned model is actually used to generate an image. Callers should be aware that a successful `getImageModel()` call does not guarantee the model will work.

**5. `getProviderName()` uses heuristic detection**

Provider identification relies on substring matching against `model.provider` and `model.modelId`. This is fragile if AI SDK changes its internal naming. The function returns `'unknown'` as a fallback rather than throwing -- callers must handle this case. The detection order matters: Google is checked first, then OpenAI.

## Conventions

### Error Handling

- Throw early on invalid configuration (`getImageModel` throws on unknown provider).
- Defer errors for conditions that can only be validated at call time (API key presence).
- Functions either throw or return a typed value -- no error codes or `Result` types.

### Testing

- Tests use **vitest** with no custom config (zero-config, inherits from vitest defaults).
- Tests live in `src/__tests__/` co-located with source, but excluded from TypeScript compilation via `tsconfig.json`.
- Environment variable tests manually save/restore `process.env.IMAGE_PROVIDER` in `afterEach` rather than using `vi.stubEnv()`. Follow the same pattern when adding new env-dependent tests.
- Tests validate model instances structurally (checking `modelId` contents) rather than doing identity comparison, since each call produces a new object.

### Function Signatures

- Exported functions use explicit return types referencing `@ai-sdk/provider` types.
- Optional parameters use defaults (e.g., `quality: Quality = 'high'`), not overloads.
- Internal types (`ImageProvider`, `Quality`) are not exported -- only the functions are part of the public API.

### File Organization

- One module file per domain concern (currently just `ai.ts`).
- `index.ts` is strictly a re-export barrel -- no logic.
- Re-exports use `from './ai.js'` (with `.js` extension) as required by Node16 module resolution.

## Commands

```bash
# Build (compile TypeScript to dist/)
pnpm --filter @builder-pipeline/core build

# Type check without emitting
pnpm --filter @builder-pipeline/core typecheck

# Run tests
pnpm --filter @builder-pipeline/core test

# Format (from project root)
pnpm format

# Format check (from project root)
pnpm format:check
```
