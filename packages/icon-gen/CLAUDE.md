# @builder-pipeline/icon-gen

AI-powered app icon generator. Takes a text prompt, generates a 1024x1024 base icon via Vercel AI SDK, then resizes it into all platform-required sizes for iOS, macOS, and Android (including adaptive icon layers).

## Metadata

| Field   | Value                                        |
| ------- | -------------------------------------------- |
| Runtime | `nodejs` (uses `sharp`, `fs`, Vercel AI SDK) |
| Entry   | `src/index.ts`                               |
| Exports | `"node"` condition only (no `"default"`)     |

### Dependencies

| Dependency                            | Purpose                                                                        |
| ------------------------------------- | ------------------------------------------------------------------------------ |
| `ai` ^6.0                             | Vercel AI SDK -- `generateImage()` and `APICallError` for error classification |
| `@ai-sdk/provider` ^3.0               | Type-only -- `ImageModelV3` interface for model parameter typing               |
| `@builder-pipeline/core` workspace:\* | `getImageModel(quality)` and `getProviderName(model)` for provider resolution  |
| `sharp` ^0.34                         | All image resizing, format conversion, alpha manipulation, sRGB enforcement    |

This package does NOT directly depend on any `@ai-sdk/*` provider package (e.g., `@ai-sdk/openai`, `@ai-sdk/google`). Provider packages are installed by `core` or by the user when passing an explicit model override.

## Project Structure

```
src/
  index.ts                              # Barrel exports: 3 functions, 1 error class, all types
  types.ts                              # All interfaces, type aliases, and IconGenErrorCode union
  errors.ts                             # IconGenError class (extends Error with code + cause)
  constants.ts                          # Platform size tables, adaptive density configs, XML template
  prompt.ts                             # buildIconPrompt() -- wraps user prompt with icon-specific instructions
  generate.ts                           # generateIcon() -- AI image generation with error mapping
  resize.ts                             # resizeForPlatform() -- orchestrates per-platform resize
  generate-and-resize.ts                # generateAndResize() -- end-to-end: generate + resize + adaptive
  platforms/
    ios.ts                              # resizeForIos() -- single 1024x1024 opaque PNG
    macos.ts                            # resizeForMacos() -- 10 PNGs in AppIcon.iconset, alpha preserved
    android.ts                          # resizeForAndroid(), resizeAdaptiveLayers(), generateSolidBackground()
  __tests__/
    prompt.test.ts                      # Unit tests for prompt construction
    errors.test.ts                      # Unit tests for IconGenError class
    constants.test.ts                   # Unit tests for size tables and XML constants
    resize.test.ts                      # Fixture-based tests for resizeForPlatform (all platforms + validation)
    generate.test.ts                    # Mocked AI SDK tests for generateIcon (validation, error mapping)
    android.test.ts                     # Fixture-based tests for Android-specific resize and adaptive layers
    generate-and-resize.test.ts         # Mocked orchestration tests for generateAndResize
```

## Complex Files

### `src/generate.ts`

The core AI generation function with a multi-layer error mapping strategy. Key gotchas:

- **Transparency provider gate**: Before making any API call, checks `getProviderName(model)` and throws `UNSUPPORTED_PROVIDER` if Google + transparent background. This prevents paying for a doomed API call.
- **Dimension normalization**: The AI SDK may return images that are not exactly 1024x1024. After receiving `image.uint8Array`, sharp validates dimensions and re-resizes with lanczos3 if needed. The returned result always reports `width: 1024, height: 1024` regardless.
- **Error mapping cascade**: Three-tier catch block -- (1) re-throw existing `IconGenError`, (2) `APICallError` instanceof check with statusCode matching, (3) generic `Error` message string matching as fallback, (4) catch-all wraps as `API_ERROR`. The string-matching fallback exists because some providers do not return structured errors.
- **Filename path traversal guard**: `path.basename(rawFilename)` is compared to the original. If they differ (e.g., `../evil`), a `TypeError` is thrown. This prevents writing outside the intended output directory.
- **providerOptions**: OpenAI-specific options (`quality`, `background`, `output_format`) are passed via `providerOptions.openai`. Other providers ignore these. The `quality` mapping is inverted: icon-gen's `'draft'` maps to OpenAI's `'low'`.

### `src/resize.ts`

Orchestrator that validates the source image and delegates to per-platform modules.

- **Source buffer is read once** and shared across all platform resize operations via `Promise.all`. Each platform function receives a `Buffer`, not a file path.
- **Largest-required-size calculation** considers all requested platforms when checking `SOURCE_TOO_SMALL`. The check uses the maximum across all requested platforms' size tables (including adaptive densities for Android).
- **Platform validation** happens before any I/O. Invalid platform strings throw `TypeError` immediately.

### `src/generate-and-resize.ts`

End-to-end orchestrator with Android adaptive icon handling. Key complexity:

- **Two AI generation calls for `auto` adaptive strategy**: The first generates the opaque base icon, the second generates a foreground layer with `background: 'transparent'`. This roughly doubles cost and latency. The second call reuses the same prompt but with transparent background and adaptive-safe-zone prompt augmentation.
- **Temp file lifecycle**: Auto strategy writes foreground and solid background to `_tmp/` under the adaptive directory, reads them into buffers, then `rm -rf`s the temp directory. If the process crashes between write and cleanup, orphan files remain.
- **Validation ordering matters**: `backgroundColor` hex validation runs first (fast, no I/O). Manual path validation (`validateManualPaths`) runs second (requires `fs.access` + `sharp.metadata`). Base icon generation runs third (expensive API call). This "fail fast" ordering prevents wasting API credits on invalid inputs.
- **Manual adaptive minimum size**: Both foreground and background must be at least 432x432 (the largest adaptive density bucket, xxxhdpi). This is validated independently from `resizeForPlatform`'s size check.
- **Output merging**: Adaptive layer files are appended to the existing `outputs.android.files` array from `resizeForPlatform`. The `directory` stays the same.

### `src/platforms/android.ts`

Contains three exported functions, making it the most feature-dense platform module.

- **`resizeForAndroid`**: Only produces the Play Store icon (512x512 opaque). Post-write, validates file size against `ANDROID_PLAY_STORE_MAX_BYTES` (1 MB) and throws `FILE_TOO_LARGE` if exceeded.
- **`resizeAdaptiveLayers`**: Uses `flatMap` over densities to create parallel fg+bg resize tasks (5 densities x 2 layers = 10 sharp operations). Directories are created upfront in a separate `Promise.all` before the resize pass. The adaptive icon XML is written last.
- **Background layers are always opaque**: `removeAlpha().flatten()` is applied to background layers but NOT foreground layers (which must preserve transparency for the adaptive icon system).

### `src/platforms/ios.ts` and `src/platforms/macos.ts`

- **iOS strips alpha**: `removeAlpha().flatten({ background: '#FFFFFF' })` ensures no alpha channel. This is an App Store requirement.
- **macOS preserves alpha**: No `removeAlpha()` or `flatten()` call. macOS icons may have transparency. This is a deliberate asymmetry between the two Apple platforms.
- Both enforce sRGB color space via `.toColourspace('srgb')` (British spelling, matching sharp's API).

### `src/constants.ts`

- `MACOS_SIZES` has duplicate pixel sizes with different filenames (e.g., `icon_16x16@2x.png` at 32px and `icon_32x32.png` at 32px). This is correct per Apple's spec -- tests verify the exact count of 10 entries.
- `ADAPTIVE_ICON_XML` is a string constant, not a template. It always references the same drawable names (`ic_launcher_foreground`, `ic_launcher_background`).

## Conventions

### Error Handling

- AI SDK errors are caught and wrapped into `IconGenError` with a typed `code` field (`IconGenErrorCode`).
- Input validation throws native `TypeError` for programming errors (empty prompt, invalid platform, bad hex color, missing required paths).
- File system / image validation throws `IconGenError` with domain-specific codes (`INVALID_SOURCE`, `SOURCE_TOO_SMALL`, `FILE_TOO_LARGE`, `WRITE_ERROR`).
- `IconGenError` instances are re-thrown without double-wrapping (checked first in the catch block).

### Testing

- All tests use vitest. No vitest config file exists in this package; it inherits from the workspace root.
- Tests are purely unit/fixture-based -- no real AI API calls. AI SDK and core are mocked with `vi.mock()`.
- Fixture images are generated at test time using `sharp.create()` in `beforeAll`, written to `os.tmpdir()`, and cleaned up in `afterAll`.
- Each test suite uses a `freshOutputDir()` helper that generates unique temp paths with `Date.now()` + random suffix to avoid conflicts.
- Platform resize tests verify actual image metadata (dimensions, channel count, format) using `sharp(path).metadata()`.

### Function Signatures

- All public async functions return typed `Promise<...Result>` objects.
- `resizeForPlatform` accepts either a single `Platform` or `Platform[]` (normalized internally to array).
- Platform-level resize functions (`resizeForIos`, `resizeForMacos`, `resizeForAndroid`) accept a `Buffer` (not a path) and a sharp kernel string.
- `generateAndResize` takes `options.outputDir` as a required field (not optional like in `generateIcon`).

### File Organization

- `platforms/` directory isolates platform-specific resize logic. Each platform module exports one or more functions consumed by `resize.ts` or `generate-and-resize.ts`.
- `constants.ts` owns all hardcoded size tables and naming conventions. Platform modules import from constants, never define their own sizes.
- `prompt.ts` is intentionally separate from `generate.ts` to keep prompt engineering testable in isolation.

## Commands

```bash
# Build (TypeScript compilation)
pnpm --filter @builder-pipeline/icon-gen build

# Type check without emitting
pnpm --filter @builder-pipeline/icon-gen typecheck

# Run tests
pnpm --filter @builder-pipeline/icon-gen test

# Format (from project root)
pnpm format

# Format check (from project root)
pnpm format:check
```
