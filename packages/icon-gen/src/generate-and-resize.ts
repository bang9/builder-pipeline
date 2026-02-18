import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { IconGenError } from './errors.js';
import { generateIcon } from './generate.js';
import { resizeForPlatform } from './resize.js';
import { resizeAdaptiveLayers, generateSolidBackground } from './platforms/android.js';
import type {
  GenerateAndResizeOptions,
  GenerateAndResizeResult,
  Platform,
  PlatformOutput,
  AndroidAdaptiveOptions,
} from './types.js';

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;

async function validateManualPaths(adaptive: AndroidAdaptiveOptions): Promise<void> {
  if (!adaptive.foregroundPath) {
    throw new TypeError('foregroundPath is required when strategy is "manual"');
  }
  if (!adaptive.backgroundPath) {
    throw new TypeError('backgroundPath is required when strategy is "manual"');
  }

  for (const p of [adaptive.foregroundPath, adaptive.backgroundPath]) {
    try {
      await fs.access(p);
    } catch {
      throw new IconGenError(`Adaptive source not found: ${p}`, 'INVALID_SOURCE');
    }

    const meta = await sharp(p).metadata();
    if (meta.format !== 'png') {
      throw new IconGenError(`Adaptive source must be PNG, got ${meta.format}: ${p}`, 'INVALID_SOURCE');
    }
    if (!meta.width || !meta.height || meta.width !== meta.height) {
      throw new IconGenError(`Adaptive source must be square: ${p}`, 'INVALID_SOURCE');
    }
    if (meta.width < 432) {
      throw new IconGenError(
        `Adaptive source must be at least 432x432, got ${meta.width}x${meta.width}: ${p}`,
        'SOURCE_TOO_SMALL',
      );
    }
  }
}

export async function generateAndResize(
  prompt: string,
  options: GenerateAndResizeOptions,
): Promise<GenerateAndResizeResult> {
  const platforms = options.platforms ?? (['ios', 'macos', 'android'] as Platform[]);
  const { outputDir, androidAdaptive } = options;

  // Validate backgroundColor if provided
  if (androidAdaptive?.strategy === 'auto' && androidAdaptive.backgroundColor) {
    if (!HEX_COLOR_RE.test(androidAdaptive.backgroundColor)) {
      throw new TypeError(
        `Invalid backgroundColor "${androidAdaptive.backgroundColor}". Must be hex format (e.g., "#FFFFFF")`,
      );
    }
  }

  // Validate manual adaptive paths upfront
  if (androidAdaptive?.strategy === 'manual') {
    await validateManualPaths(androidAdaptive);
  }

  // Generate base icon
  const baseDir = path.join(outputDir, 'base');
  const baseIcon = await generateIcon(prompt, {
    ...options.generation,
    outputDir: baseDir,
  });

  // Resize for all platforms
  const resizeResult = await resizeForPlatform(baseIcon.path, platforms, outputDir, options.resize);

  const outputs: Partial<Record<Platform, PlatformOutput>> = { ...resizeResult.outputs };

  // Handle Android adaptive icons
  if (androidAdaptive && platforms.includes('android')) {
    const kernel = options.resize?.resizeFilter ?? 'lanczos3';
    let foregroundBuffer: Buffer;
    let backgroundBuffer: Buffer;

    if (androidAdaptive.strategy === 'auto') {
      // Generate foreground with transparent background
      const tmpDir = path.join(outputDir, 'android', 'adaptive', '_tmp');
      const fgResult = await generateIcon(prompt, {
        ...options.generation,
        background: 'transparent',
        outputDir: tmpDir,
        filename: 'foreground-source',
      });

      // Generate solid color background
      const bgColor = androidAdaptive.backgroundColor ?? '#FFFFFF';
      const bgPath = path.join(tmpDir, 'background-source.png');
      await generateSolidBackground(bgPath, bgColor);

      // Read both into buffers
      [foregroundBuffer, backgroundBuffer] = await Promise.all([fs.readFile(fgResult.path), fs.readFile(bgPath)]);

      // Clean up temp files
      await fs.rm(tmpDir, { recursive: true, force: true });
    } else {
      // Manual strategy — paths already validated above
      [foregroundBuffer, backgroundBuffer] = await Promise.all([
        fs.readFile(androidAdaptive.foregroundPath!),
        fs.readFile(androidAdaptive.backgroundPath!),
      ]);
    }

    const adaptiveFiles = await resizeAdaptiveLayers(foregroundBuffer, backgroundBuffer, outputDir, kernel);

    // Merge adaptive files into android output
    if (outputs.android) {
      outputs.android = {
        files: [...outputs.android.files, ...adaptiveFiles],
        directory: outputs.android.directory,
      };
    }
  }

  return { baseIcon, outputs };
}
