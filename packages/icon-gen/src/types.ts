import type { ImageModelV3 } from '@ai-sdk/provider';

/** Supported target platforms */
export type Platform = 'ios' | 'macos' | 'android';

/** Quality tier for AI generation */
export type GenerationQuality = 'high' | 'draft';

export interface GenerateIconOptions {
  /** Vercel AI SDK image model override. If omitted, uses getImageModel(quality) from core. */
  model?: ImageModelV3;
  /** Quality tier. Passed to getImageModel when no explicit model is provided. */
  quality?: GenerationQuality;
  /**
   * Background style.
   * - "opaque": solid background (default)
   * - "transparent": transparent background (requires provider support)
   */
  background?: 'opaque' | 'transparent';
  /** Directory to save the generated base icon. Defaults to a temporary directory. */
  outputDir?: string;
  /** Filename for the generated icon (without extension). Defaults to "icon-base". */
  filename?: string;
  /** Abort signal for cancellation. */
  signal?: AbortSignal;
}

export interface GenerateIconResult {
  /** Absolute path to the generated 1024x1024 PNG */
  path: string;
  /** Width in pixels (always 1024) */
  width: number;
  /** Height in pixels (always 1024) */
  height: number;
  /** Model ID used for generation */
  model: string;
}

export interface ResizeOptions {
  /** Resampling filter for downscaling. Defaults to "lanczos3". */
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
   */
  androidAdaptive?: AndroidAdaptiveOptions;
}

export interface AndroidAdaptiveOptions {
  /**
   * Strategy for generating adaptive icon layers.
   * - "auto": generates foreground with transparent bg, uses solid color background layer
   * - "manual": user provides separate foreground/background source images
   */
  strategy: 'auto' | 'manual';
  /** Background color hex (e.g., "#FFFFFF"). Used when strategy is "auto". Defaults to "#FFFFFF". */
  backgroundColor?: string;
  /** Path to foreground layer source. Required when strategy is "manual". */
  foregroundPath?: string;
  /** Path to background layer source. Required when strategy is "manual". */
  backgroundPath?: string;
}

export interface GenerateAndResizeResult {
  /** The generated base icon */
  baseIcon: GenerateIconResult;
  /** Platform resize results. Only requested platforms are present. */
  outputs: Partial<Record<Platform, PlatformOutput>>;
}

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
