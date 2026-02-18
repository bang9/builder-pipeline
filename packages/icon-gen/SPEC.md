# @builder-pipeline/icon-gen — Spec v1

## 1. Package Overview

`@builder-pipeline/icon-gen` generates app icons from a text prompt using AI image generation, then resizes the output into all platform-required sizes for iOS, macOS, and Android.

**Scope (v1):**

- Generate a single base icon (1024x1024 PNG) via Vercel AI SDK (`ai` package) with pluggable provider models
- Resize to iOS, macOS, and Android platform specs
- Produce Android adaptive icon layers (foreground + background)
- Output organized directory structure ready for each platform

**Out of scope (v1):**

- iOS 26 Liquid Glass / layered icons (Icon Composer)
- Dark mode / tinted icon variants
- Web favicons / PWA icons
- Interactive preview or editor UI

**Runtime:** `nodejs` (uses `sharp`, filesystem, Vercel AI SDK for image generation, `@builder-pipeline/core` for model resolution)

---

## 2. TypeScript API

### 2.1 `generateIcon`

Generates a base icon image from a text prompt via Vercel AI SDK's `generateImage()`.

```ts
export async function generateIcon(prompt: string, options?: GenerateIconOptions): Promise<GenerateIconResult>;
```

### 2.2 `resizeForPlatform`

Takes an existing square PNG and resizes it to all required sizes for the specified platform(s).

```ts
export async function resizeForPlatform(
  sourcePath: string,
  platform: Platform | Platform[],
  outputDir: string,
  options?: ResizeOptions,
): Promise<ResizeResult>;
```

### 2.3 `generateAndResize`

Convenience function that calls `generateIcon` then `resizeForPlatform`.

```ts
export async function generateAndResize(
  prompt: string,
  options?: GenerateAndResizeOptions,
): Promise<GenerateAndResizeResult>;
```

---

## 3. Interfaces

```ts
import type { ImageModelV3 } from 'ai';

/** Supported target platforms */
export type Platform = 'ios' | 'macos' | 'android';

/** Quality tier for AI generation */
export type GenerationQuality = 'high' | 'draft';

export interface GenerateIconOptions {
  /**
   * Vercel AI SDK image model override. Accepts any `@ai-sdk/*` image model.
   * If omitted, calls `getImageModel(quality)` from `@builder-pipeline/core`,
   * which reads `IMAGE_PROVIDER` env var and returns the appropriate model.
   *
   * This is an advanced escape hatch for users who want full control over
   * the model instance.
   *
   * @example
   *   import { openai } from "@ai-sdk/openai";
   *   generateIcon("a cute cat", { model: openai.image("gpt-image-1.5") });
   *
   * @example
   *   import { google } from "@ai-sdk/google";
   *   generateIcon("a cute cat", { model: google.image("imagen-4.0-generate-preview-06-06") });
   */
  model?: ImageModelV3;

  /**
   * Quality tier. Passed to `getImageModel(quality)` from core when no
   * explicit `model` is provided. Core maps this to the appropriate model
   * for the configured provider.
   * - "high": e.g., openai.image('gpt-image-1.5'), ~$0.16/image (default)
   * - "draft": e.g., openai.image('gpt-image-1-mini'), ~$0.02/image
   *
   * When a custom `model` is provided, this field is ignored.
   */
  quality?: GenerationQuality;

  /**
   * Background style.
   * - "opaque": solid background (default, required for iOS/Android store)
   * - "transparent": transparent background (useful for foreground layers)
   *
   * NOTE: Google Imagen does NOT support transparent backgrounds natively.
   * If `background: "transparent"` is requested and the resolved model is
   * a Google provider, an `IconGenError` with code `"UNSUPPORTED_PROVIDER"`
   * is thrown BEFORE making the API call. Use OpenAI or pass a custom model
   * that supports transparency.
   */
  background?: 'opaque' | 'transparent';

  /**
   * Directory to save the generated base icon.
   * Defaults to a temporary directory.
   */
  outputDir?: string;

  /**
   * Filename for the generated icon (without extension).
   * Defaults to "icon-base".
   */
  filename?: string;

  /**
   * Abort signal for cancellation. Passed through to the AI SDK's
   * `generateImage()`. Use this to cancel long-running generation
   * requests (e.g., on Ctrl+C in CLI).
   */
  signal?: AbortSignal;
}

export interface GenerateIconResult {
  /** Absolute path to the generated 1024x1024 PNG */
  path: string;
  /** Width in pixels (always 1024) */
  width: number;
  /** Height in pixels (always 1024) */
  height: number;
  /** Model ID used for generation. Sourced from `responses[0].modelId` in the AI SDK result. */
  model: string;
}

export interface ResizeOptions {
  /**
   * Resampling filter for downscaling.
   * Defaults to "lanczos3" (sharp default, best quality for icons).
   */
  resizeFilter?: 'lanczos3' | 'lanczos2' | 'mitchell';
}

export interface ResizeResult {
  /** Platform -> list of generated files. Only requested platforms are present. */
  outputs: Partial<Record<Platform, PlatformOutput>>;
}

export interface PlatformOutput {
  /** Absolute paths to all generated icon files */
  files: string[];
  /** Root directory for this platform's output */
  directory: string;
}

export interface GenerateAndResizeOptions {
  /** Options forwarded to generateIcon (model, quality, background, filename, signal) */
  generation?: Omit<GenerateIconOptions, 'outputDir'>;

  /** Target platforms. Defaults to all: ["ios", "macos", "android"] */
  platforms?: Platform[];

  /** Output root directory. Required. */
  outputDir: string;

  /** Options forwarded to resizeForPlatform */
  resize?: ResizeOptions;

  /**
   * Android adaptive icon config.
   * If provided, generates separate foreground/background layers.
   * If omitted, only the standard Play Store icon is generated.
   *
   * NOTE: When omitted, Android output only includes the Play Store listing
   * icon (512x512). To generate launcher icons for device home screens,
   * provide this option with at least `{ strategy: "auto" }`.
   *
   * NOTE: strategy "auto" requires a provider that supports transparent
   * backgrounds (e.g., OpenAI). Google Imagen does NOT support this.
   */
  androidAdaptive?: AndroidAdaptiveOptions;
}

export interface AndroidAdaptiveOptions {
  /**
   * Strategy for generating adaptive icon layers.
   * - "auto": generates foreground with transparent bg from the same prompt,
   *           uses a solid color background layer (default)
   * - "manual": user provides separate foreground/background source images
   */
  strategy: 'auto' | 'manual';

  /**
   * Background color hex (e.g., "#FFFFFF"). Used when strategy is "auto".
   * Defaults to "#FFFFFF". Must match /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.
   */
  backgroundColor?: string;

  /**
   * Path to foreground layer source. Required when strategy is "manual".
   */
  foregroundPath?: string;

  /**
   * Path to background layer source. Required when strategy is "manual".
   */
  backgroundPath?: string;
}

export interface GenerateAndResizeResult {
  /** The generated base icon */
  baseIcon: GenerateIconResult;
  /** Platform resize results. Only requested platforms are present. */
  outputs: Partial<Record<Platform, PlatformOutput>>;
}
```

---

## 4. AI Integration via Vercel AI SDK

`icon-gen` uses the Vercel AI SDK (`ai` package) for image generation. This provides a unified `generateImage()` function that supports 12+ providers out of the box via pluggable `@ai-sdk/*` model packages.

Model resolution is delegated to `@builder-pipeline/core`, which reads user configuration and returns the correct Vercel AI SDK model instance.

### AI Model Resolution

```
1. If `options.model` is provided → use it directly (advanced override)
2. Otherwise → call `getImageModel(quality)` from @builder-pipeline/core
3. Core reads IMAGE_PROVIDER env var and returns the appropriate Vercel AI SDK model
```

```ts
import { generateImage } from 'ai';
import { getImageModel } from '@builder-pipeline/core';

// Inside generateIcon()
const model = options.model ?? getImageModel(options.quality ?? 'high');
```

`getImageModel()` is defined in `@builder-pipeline/core`:

```ts
// @builder-pipeline/core/src/ai.ts
import type { ImageModelV3 } from 'ai';

export function getImageModel(quality?: 'high' | 'draft'): ImageModelV3;
```

- Reads `IMAGE_PROVIDER` env var (default: `"google"`)
- Returns the appropriate `@ai-sdk/*` model based on provider + quality
- API keys are handled automatically by each `@ai-sdk/*` provider via env vars (e.g., `OPENAI_API_KEY`, `GOOGLE_API_KEY`)

### Core Contract Assumptions

`icon-gen` depends on `@builder-pipeline/core` fulfilling these behaviors:

- `getImageModel(quality)` always returns a valid `ImageModelV3` instance (never `undefined`)
- If `IMAGE_PROVIDER` is set to an unrecognized value, core throws immediately with a descriptive error
- Core does NOT validate API keys — that happens at call time when the AI SDK contacts the provider
- Core exposes `getProviderName(model): string` to identify the active provider (for transparency checks)
- When `IMAGE_PROVIDER` is unset, defaults to `"google"`

### Transparency Provider Check

Before making an API call with `background: "transparent"`, validate that the resolved model supports it. Google Imagen does NOT support transparent backgrounds.

```ts
// Check BEFORE calling generateImage — avoid paying for a doomed API call
if (background === 'transparent') {
  const providerName = getProviderName(model); // from core, or infer from model.modelId
  if (providerName === 'google') {
    throw new IconGenError(
      'Google Imagen does not support transparent backgrounds. ' +
        'Set IMAGE_PROVIDER=openai or pass a custom model that supports transparency.',
      'UNSUPPORTED_PROVIDER',
    );
  }
}
```

### Core Generation Call

```ts
const { image, responses } = await generateImage({
  model,
  prompt: buildIconPrompt(userPrompt, { background }),
  size: '1024x1024',
  abortSignal: options.signal,
  providerOptions: {
    openai: {
      quality: options.quality === 'draft' ? 'low' : 'high',
      background: background === 'transparent' ? 'transparent' : 'opaque',
      output_format: 'png',
    },
  },
});

// image.uint8Array is the raw PNG bytes — no manual base64 decode needed
const buffer = Buffer.from(image.uint8Array);

// Validate returned image dimensions
const metadata = await sharp(buffer).metadata();
let finalBuffer = buffer;
if (metadata.width !== 1024 || metadata.height !== 1024) {
  finalBuffer = await sharp(buffer).resize(1024, 1024, { kernel: 'lanczos3' }).png().toBuffer();
}

await fs.writeFile(outputPath, finalBuffer);

// Model ID from AI SDK response
const modelId = responses[0]?.modelId ?? 'unknown';
```

### Provider Swapping

There are two ways to use a different provider:

**1. Via environment variable (recommended):** Set `IMAGE_PROVIDER` and the corresponding API key. Core handles the rest.

```sh
IMAGE_PROVIDER=google
GOOGLE_API_KEY=...
```

**2. Via explicit model override (advanced):** Pass any `@ai-sdk/*` image model directly.

```ts
import { google } from '@ai-sdk/google';
await generateIcon('a rocket ship', { model: google.image('imagen-4.0-generate-preview-06-06') });
```

### Icon-Specific Defaults via Middleware

Use `wrapImageModel` from the AI SDK to set icon-specific defaults that apply regardless of which provider is used:

```ts
import { wrapImageModel } from 'ai';

function createIconModel(baseModel: ImageModelV3): ImageModelV3 {
  return wrapImageModel({
    model: baseModel,
    middleware: {
      // Enforce 1024x1024 size for all icon generation calls
      transformParams: async ({ params }) => ({
        ...params,
        size: '1024x1024',
      }),
    },
  });
}
```

---

## 5. Platform Output Specs

### 5.1 iOS (Single Size — Xcode 15+)

A single 1024x1024 opaque PNG is sufficient. Xcode generates all device sizes automatically.

| File          | Size (px) | Notes                    |
| ------------- | --------- | ------------------------ |
| `AppIcon.png` | 1024x1024 | Opaque (no alpha). sRGB. |

**Validation rules:**

- Must be exactly 1024x1024
- Must NOT have an alpha channel (strip alpha before writing)
- Must be sRGB PNG

### 5.2 macOS

macOS requires a separate `.iconset` directory with 10 PNGs:

| File                  | Size (px) |
| --------------------- | --------- |
| `icon_16x16.png`      | 16x16     |
| `icon_16x16@2x.png`   | 32x32     |
| `icon_32x32.png`      | 32x32     |
| `icon_32x32@2x.png`   | 64x64     |
| `icon_128x128.png`    | 128x128   |
| `icon_128x128@2x.png` | 256x256   |
| `icon_256x256.png`    | 256x256   |
| `icon_256x256@2x.png` | 512x512   |
| `icon_512x512.png`    | 512x512   |
| `icon_512x512@2x.png` | 1024x1024 |

**Validation rules:**

- All files sRGB PNG
- Alpha channel is allowed (unlike iOS, macOS icons may have transparency)
- Directory named `AppIcon.iconset`

### 5.3 Android

#### Play Store Icon

| File             | Size (px) | Notes                               |
| ---------------- | --------- | ----------------------------------- |
| `play-store.png` | 512x512   | 32-bit PNG, opaque, sRGB, < 1024 KB |

#### Adaptive Icon Layers (optional, when `androidAdaptive` is provided)

Each layer at every density:

| Density | Size (px) | Directory         |
| ------- | --------- | ----------------- |
| mdpi    | 108x108   | `mipmap-mdpi/`    |
| hdpi    | 162x162   | `mipmap-hdpi/`    |
| xhdpi   | 216x216   | `mipmap-xhdpi/`   |
| xxhdpi  | 324x324   | `mipmap-xxhdpi/`  |
| xxxhdpi | 432x432   | `mipmap-xxxhdpi/` |

- Foreground files: `ic_launcher_foreground.png` (transparency allowed)
- Background files: `ic_launcher_background.png` (opaque)
- Safe zone: center 66dp of the 108dp full canvas (~61%), which maps to 264x264 at xxxhdpi. The AI prompt should instruct the main content to stay within this zone.

#### Adaptive Icon XML (required)

`mipmap-anydpi-v26/ic_launcher.xml` ties the foreground and background layers together. Without this file, the adaptive icon PNGs are unusable by the Android build system:

```xml
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
```

---

## 6. Output Directory Structure

```
<outputDir>/
  base/
    icon-base.png              # 1024x1024 original from AI

  ios/
    AppIcon.png                # 1024x1024 opaque

  macos/
    AppIcon.iconset/
      icon_16x16.png
      icon_16x16@2x.png
      icon_32x32.png
      icon_32x32@2x.png
      icon_128x128.png
      icon_128x128@2x.png
      icon_256x256.png
      icon_256x256@2x.png
      icon_512x512.png
      icon_512x512@2x.png

  android/
    play-store.png             # 512x512 opaque
    adaptive/                  # Only if androidAdaptive is provided
      mipmap-anydpi-v26/
        ic_launcher.xml        # Adaptive icon XML (ties layers together)
      mipmap-mdpi/
        ic_launcher_foreground.png
        ic_launcher_background.png
      mipmap-hdpi/
        ic_launcher_foreground.png
        ic_launcher_background.png
      mipmap-xhdpi/
        ic_launcher_foreground.png
        ic_launcher_background.png
      mipmap-xxhdpi/
        ic_launcher_foreground.png
        ic_launcher_background.png
      mipmap-xxxhdpi/
        ic_launcher_foreground.png
        ic_launcher_background.png
```

---

## 7. Image Resizing Strategy

Use **`sharp`** for all image processing:

- **Downscale algorithm:** `lanczos3` (default in sharp — highest quality for icon-scale images)
- **Alpha removal (iOS and Android store only):** `sharp.removeAlpha().flatten({ background: "#FFFFFF" })` to ensure no alpha channel. Use white as the default flatten color unless the image is already opaque. **macOS icons preserve the alpha channel** — do NOT flatten macOS outputs.
- **PNG output:** Always use `sharp.png({ compressionLevel: 9 })` for smallest output size. Verify Android Play Store icon is under 1024 KB after compression.
- **sRGB enforcement:** Use `sharp.toColourspace("srgb")` to ensure correct color space.
- **No upscaling:** If a source image is smaller than a required size, throw an error rather than upscaling. The base icon is 1024x1024, which covers all required sizes.

### Resize Pipeline (per file)

```
source PNG
  -> sharp(input)
  -> .toColourspace("srgb")
  -> .resize(targetSize, targetSize, { kernel: "lanczos3" })
  -> .removeAlpha().flatten()    // iOS and Android store only (skip for macOS)
  -> .png({ compressionLevel: 9 })
  -> .toFile(outputPath)
```

---

## 8. Android Adaptive Icon Handling

### Strategy: `"auto"` (default)

**IMPORTANT:** This strategy requires a provider that supports transparent backgrounds (e.g., OpenAI). Google Imagen does NOT support this — an `UNSUPPORTED_PROVIDER` error is thrown before the API call. The second generation call roughly doubles cost and latency.

1. Call `generateIcon` with the user's prompt, `background: "transparent"` (using the same model), to produce a foreground layer source (1024x1024 PNG with transparency).
2. Generate a solid-color background layer programmatically using `sharp.create()`:
   ```ts
   sharp({
     create: {
       width: 1024,
       height: 1024,
       channels: 3,
       background: backgroundColor, // default "#FFFFFF"
     },
   });
   ```
3. Resize both layers to each density bucket (108, 162, 216, 324, 432).
4. Generate `mipmap-anydpi-v26/ic_launcher.xml` to tie the layers together.
5. The AI prompt is automatically augmented to instruct: _"Place the main subject within the center 61% of the canvas (66dp safe zone of the 108dp icon), leaving generous margins on all sides."_

### Strategy: `"manual"`

1. User provides `foregroundPath` and `backgroundPath` (both must be square PNGs >= 432x432).
2. Validate dimensions, then resize both to each density bucket.
3. Generate `mipmap-anydpi-v26/ic_launcher.xml` to tie the layers together.

---

## 9. AI Prompt Engineering

The `generateIcon` function wraps the user's prompt with a system template to improve icon quality:

```ts
function buildIconPrompt(userPrompt: string, options: { background: 'opaque' | 'transparent' }): string {
  const bgInstruction =
    options.background === 'transparent' ? 'Use a transparent background.' : 'Use a solid, clean background.';

  return [
    'Generate a mobile app icon with the following description:',
    userPrompt,
    '',
    'Requirements:',
    '- Simple, clean vector/flat illustration style',
    '- No text, no letters, no words, no watermarks',
    '- No rounded corners (the OS applies masking automatically)',
    '- Centered composition with balanced margins',
    `- ${bgInstruction}`,
    '- High contrast, vibrant colors suitable for small display sizes',
    '- Square 1:1 aspect ratio',
  ].join('\n');
}
```

For adaptive icon foreground, append:

```
"- Place the main subject within the center 61% of the canvas (66dp safe zone of the 108dp adaptive icon)"
"- Leave generous empty margins on all sides for OS-level masking"
```

---

## 10. Error Handling for AI Generation

Vercel AI SDK errors are caught and wrapped into `IconGenError`. Use structured error checks (instanceof, statusCode) as the primary strategy. String matching is a last-resort fallback only.

- **Missing API key / auth errors (401/403):** Wrap as `IconGenError` with code `"MISSING_API_KEY"`.
- **Rate limit (429):** Wrap as `IconGenError` with code `"RATE_LIMITED"`. Do not retry automatically.
- **Content policy rejection (400 + safety):** Wrap as `IconGenError` with code `"CONTENT_POLICY"`.
- **Unsupported provider capability:** Wrap as `IconGenError` with code `"UNSUPPORTED_PROVIDER"`.
- **Network / other errors:** Wrap as `IconGenError` with code `"API_ERROR"`.

```ts
import { APICallError } from "ai";

try {
  const { image } = await generateImage({ model, prompt, ... });
  // ...
} catch (err) {
  // 1. Structured check: Vercel AI SDK typed errors (preferred)
  if (err instanceof APICallError) {
    if (err.statusCode === 401 || err.statusCode === 403) {
      throw new IconGenError("API key not configured or invalid", "MISSING_API_KEY", err);
    }
    if (err.statusCode === 429) {
      throw new IconGenError("Rate limited by provider", "RATE_LIMITED", err);
    }
    if (err.statusCode === 400 && err.responseBody?.includes("safety")) {
      throw new IconGenError("Prompt rejected by content policy", "CONTENT_POLICY", err);
    }
  }

  // 2. Fallback: string matching for providers that don't return structured errors
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes("api key") || msg.includes("unauthorized")) {
      throw new IconGenError("API key not configured", "MISSING_API_KEY", err);
    }
    if (msg.includes("rate limit")) {
      throw new IconGenError("Rate limited by provider", "RATE_LIMITED", err);
    }
    if (msg.includes("content policy") || msg.includes("safety")) {
      throw new IconGenError("Prompt rejected by content policy", "CONTENT_POLICY", err);
    }
  }

  // 3. Catch-all
  throw new IconGenError("Image generation failed", "API_ERROR", err);
}
```

---

## 11. Error Types

```ts
export type IconGenErrorCode =
  | 'MISSING_API_KEY'
  | 'UNSUPPORTED_PROVIDER'
  | 'RATE_LIMITED'
  | 'CONTENT_POLICY'
  | 'API_ERROR'
  | 'INVALID_SOURCE'
  | 'SOURCE_TOO_SMALL'
  | 'FILE_TOO_LARGE'
  | 'WRITE_ERROR';

export class IconGenError extends Error {
  constructor(
    message: string,
    public readonly code: IconGenErrorCode,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'IconGenError';
  }
}
```

---

## 12. Input Validation

| Check                             | When                            | Error code             |
| --------------------------------- | ------------------------------- | ---------------------- |
| Prompt is non-empty string        | `generateIcon`                  | Throw `TypeError`      |
| Provider supports transparency    | `generateIcon` (bg=transparent) | `UNSUPPORTED_PROVIDER` |
| backgroundColor is valid hex      | `generateAndResize` (auto)      | Throw `TypeError`      |
| Source file exists and is PNG     | `resizeForPlatform`             | `INVALID_SOURCE`       |
| Source is square                  | `resizeForPlatform`             | `INVALID_SOURCE`       |
| Source >= largest required size   | `resizeForPlatform`             | `SOURCE_TOO_SMALL`     |
| outputDir is writable             | `resizeForPlatform`             | `WRITE_ERROR`          |
| Platform is valid value           | `resizeForPlatform`             | Throw `TypeError`      |
| Manual adaptive paths exist       | `generateAndResize` (manual)    | `INVALID_SOURCE`       |
| Android Play Store icon < 1024 KB | `resizeForPlatform` (android)   | `FILE_TOO_LARGE`       |

---

## 13. Environment Variables

`icon-gen` delegates model resolution to `@builder-pipeline/core`, which reads the following env vars. The `@ai-sdk/*` provider packages read their respective API keys automatically.

| Variable         | Required | Description                                                                         |
| ---------------- | -------- | ----------------------------------------------------------------------------------- |
| `IMAGE_PROVIDER` | No       | AI provider for image generation: `"google"` (default), `"openai"`. Read by `core`. |
| `GOOGLE_API_KEY` | Yes\*    | Google API key. Read automatically by `@ai-sdk/google`.                             |
| `OPENAI_API_KEY` | No       | OpenAI API key. Read automatically by `@ai-sdk/openai`.                             |

\*Required when using the default Google provider. The API key for the active provider must be set.

Update `.env.sample` (already updated in root):

```
IMAGE_PROVIDER=google              # "google" (default) | "openai"
GOOGLE_API_KEY=                    # Required when IMAGE_PROVIDER=google
OPENAI_API_KEY=                    # Required when IMAGE_PROVIDER=openai
```

---

## 14. Dependencies

### Runtime

| Package                  | Version       | Purpose                                         |
| ------------------------ | ------------- | ----------------------------------------------- |
| `@builder-pipeline/core` | `workspace:*` | Config-based model resolver (`getImageModel()`) |
| `ai`                     | `^6.0`        | Vercel AI SDK — unified `generateImage()` API   |
| `sharp`                  | `^0.34`       | Image resizing, format conversion               |

`icon-gen` does **not** depend on any `@ai-sdk/*` provider package directly — `core` handles provider packages (e.g., `@ai-sdk/openai`, `@ai-sdk/google`). When a user passes an explicit `model` override, they install the relevant `@ai-sdk/*` package themselves.

### Dev

Standard monorepo dev deps (TypeScript, vitest for testing).

---

## 15. Package Metadata

```jsonc
{
  "name": "@builder-pipeline/icon-gen",
  "version": "0.0.1",
  "type": "module",
  "bp": {
    "runtime": "nodejs",
  },
  "dependencies": {
    "@builder-pipeline/core": "workspace:*",
    "ai": "^6.0",
    "sharp": "^0.34",
  },
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "node": "./dist/index.js",
    },
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
  },
}
```

---

## 16. Exported Surface

The package exports from a single entry point (`src/index.ts`):

```ts
// Functions
export { generateIcon } from './generate.js';
export { resizeForPlatform } from './resize.js';
export { generateAndResize } from './generate-and-resize.js';

// Types
export type {
  Platform,
  GenerationQuality,
  GenerateIconOptions,
  GenerateIconResult,
  ResizeOptions,
  ResizeResult,
  PlatformOutput,
  GenerateAndResizeOptions,
  GenerateAndResizeResult,
  AndroidAdaptiveOptions,
  IconGenErrorCode,
} from './types.js';

// Error class
export { IconGenError } from './errors.js';
```

---

## 17. Suggested File Structure

```
packages/icon-gen/
  package.json
  tsconfig.json
  SPEC.md                          # This file
  src/
    index.ts                       # Barrel exports
    types.ts                       # All interfaces and type definitions
    errors.ts                      # IconGenError class
    generate.ts                    # generateIcon implementation
    resize.ts                      # resizeForPlatform implementation
    generate-and-resize.ts         # generateAndResize implementation
    prompt.ts                      # buildIconPrompt helper
    platforms/
      ios.ts                       # iOS-specific resize config
      macos.ts                     # macOS-specific resize config
      android.ts                   # Android-specific resize config + adaptive
    constants.ts                   # Platform size tables, file naming conventions
```

---

## 18. Test Strategy

Use **vitest** as the test runner.

### Unit Tests (no API calls)

- `buildIconPrompt()` — verify prompt construction for opaque/transparent/adaptive modes
- `platforms/*.ts` — verify size tables, file naming conventions
- `errors.ts` — verify `IconGenError` construction and codes
- Input validation — verify all validation rules in Section 12 throw correct errors
- `backgroundColor` hex validation

### Resize Tests (fixture-based, no API calls)

- Use a fixture 1024x1024 PNG image
- Test `resizeForPlatform()` for each platform individually and combined
- Verify output file count, dimensions (via `sharp.metadata()`), and naming
- Verify iOS/Android outputs have no alpha channel, macOS preserves alpha
- Verify Android Play Store icon is under 1024KB
- Verify `SOURCE_TOO_SMALL` error for undersized source images

### Integration Tests (requires API key, gated by env var)

- Gated behind `TEST_INTEGRATION=true` env var — skipped by default in CI
- Test `generateIcon()` with a simple prompt, verify output is 1024x1024 PNG
- Test `generateAndResize()` end-to-end, verify full directory structure
- Test error handling: empty prompt, content policy violation

---

## 19. Future Considerations (Out of Scope for v1)

- **iOS 26 Liquid Glass icons:** Layered icons via Icon Composer (foreground, background, glass effect). Would require generating separate layers similar to Android adaptive icons. Monitor Apple's tooling for programmatic `.icon` bundle creation.
- **Dark mode / tinted variants:** iOS 18+ supports dark and tinted icon variants. Would need additional AI generation passes with altered color instructions.
- **Web icons:** Favicon (`.ico`), PWA manifest icons (192x192, 512x512).
- **Generation iteration:** Allow users to generate multiple candidates and pick the best one before committing to resize.
- **Custom prompt templates:** Let users override the system prompt template for different icon styles.
- **SVG intermediate:** Generate SVG from AI (when supported) and rasterize at each size for maximum quality.
- **Android 13+ monochrome/themed icons:** Android 13 introduced a `<monochrome>` layer in adaptive icons that enables Material You themed icons. Would require generating an additional single-color silhouette layer.
- **`resizeAdaptiveLayers()` standalone function:** A 4th exported function for resizing existing foreground/background PNGs to all adaptive icon densities, without going through `generateAndResize`. Addresses the API gap where `resizeForPlatform` only accepts a single source image.
- **macOS `.icns` generation:** Optionally run `iconutil --convert icns` on macOS to produce the binary `.icns` file from the `.iconset` directory.
