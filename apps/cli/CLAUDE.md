# @builder-pipeline/cli

CLI entry point for the builder-pipeline toolkit. Provides the `bp` command that wraps workspace packages into user-facing subcommands, starting with `bp icon` for AI-powered app icon generation.

## Metadata

| Field   | Value                                                          |
| ------- | -------------------------------------------------------------- |
| Runtime | `nodejs`                                                       |
| Entry   | `src/main.ts` (bin entrypoint), `src/index.ts` (barrel export) |
| Binary  | `bp` → `./dist/main.js`                                        |

### Dependencies

| Dependency                                | Purpose                                            |
| ----------------------------------------- | -------------------------------------------------- |
| `@builder-pipeline/icon-gen` workspace:\* | Icon generation and platform resize functions      |
| `@builder-pipeline/core` workspace:\*     | `getImageModel()` for AI model resolution from env |
| `commander` ^13.0                         | CLI framework -- subcommands, option parsing, help |
| `dotenv` ^16.5                            | Loads `.env` file from cwd at startup              |

## Project Structure

```
src/
  main.ts                 # #!/usr/bin/env node entrypoint — dotenv load, commander setup, parseAsync
  index.ts                # Barrel export — re-exports iconCommand for programmatic use
  commands/
    icon.ts               # `bp icon` subcommand — option mapping, error formatting, result display
  utils/
    logger.ts             # ANSI-only terminal output: info(), success(), error(), dim(), spinner()
```

## Complex Files

### `src/commands/icon.ts`

The main command handler with several non-obvious design decisions:

- **Model is resolved eagerly**: `getImageModel(quality)` is called during option construction (before spinner starts), not lazily inside `generateAndResize`. This means an invalid `IMAGE_PROVIDER` env var throws before any spinner output. However, missing API keys only surface during the actual API call (deferred validation in core).
- **`androidAdaptive` is conditionally built**: The `androidAdaptive` object is only added to options when `--adaptive` is explicitly specified. Without it, `generateAndResize` skips all adaptive logic. This is intentional — `--adaptive-bg-color` has a default value (`#FFFFFF`) but should NOT trigger adaptive generation on its own.
- **Error message mapping**: `IconGenError.code` is mapped to user-friendly messages via `ERROR_MESSAGES` record, then the original `err.message` is appended for extra detail. `TypeError` (input validation from icon-gen) is shown as-is. All other errors get a generic wrapper.
- **Spinner writes to stderr, results to stdout**: `spinner()` uses `process.stderr.write` so progress output doesn't pollute piped stdout. `info()`/`success()` use `console.log` (stdout). This separation matters if someone pipes `bp icon` output.
- **macOS directory display**: macOS output shows the iconset directory path instead of listing all 10 individual files, since the directory is what Xcode consumes.

### `src/main.ts`

- **`parseAsync()` not `parse()`**: Commander's `parse()` does not properly await async actions, which can cause unhandled promise rejections. `parseAsync()` ensures the process waits for the async icon command handler to complete before exiting.
- **dotenv runs before commander**: `config()` is called at module top-level so `.env` values are available when `getImageModel()` reads `IMAGE_PROVIDER` during option construction.

### `src/utils/logger.ts`

- **No external dependencies**: Uses raw ANSI escape codes instead of chalk/ora to keep the CLI lightweight.
- **Spinner uses braille characters**: The `SPINNER_FRAMES` array uses Unicode braille patterns (`⠋⠙⠸⠰⠦⠎`) which render well in most modern terminals.
- **`dim()` returns a string** (for inline use in template literals), while `info()`/`success()`/`error()` print directly. Don't mix these up — `dim()` is a formatter, not a printer.

## Conventions

### Error Handling

- All errors from `generateAndResize` are caught in a single try/catch in the icon command handler.
- `IconGenError` instances get user-friendly message mapping via `ERROR_MESSAGES` + original detail.
- `TypeError` (programming/validation errors) surfaces the raw message.
- Unknown errors are wrapped with "Unexpected error:" prefix.
- Non-zero exit is set via `process.exitCode = 1` (not `process.exit(1)`) to allow graceful cleanup.

### Adding a New Command

1. Create `src/commands/{name}.ts`
2. Export a `Command` instance (e.g., `export const fooCommand = new Command('foo')...`)
3. Register it in `src/main.ts` via `program.addCommand(fooCommand)`
4. Re-export from `src/index.ts` if it should be available programmatically

### Output Formatting

- Use `logger.info()` for informational lines (cyan `i` prefix)
- Use `logger.success()` for completion messages (green `✓` prefix)
- Use `logger.error()` for errors (red `✗` prefix, writes to stderr)
- Use `logger.dim()` inline for de-emphasized text (file counts, metadata)
- Use `logger.spinner()` for long-running operations — always call `.stop()` in both success and error paths

## Commands

```bash
# Build
pnpm --filter @builder-pipeline/cli build

# Typecheck
pnpm --filter @builder-pipeline/cli typecheck

# Help
node apps/cli/dist/main.js --help
node apps/cli/dist/main.js icon --help

# Dry run (will fail without API key — useful for testing error path)
node apps/cli/dist/main.js icon "test" -o /tmp/test-icons

# Format (from project root)
pnpm format
```
