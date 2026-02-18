import fs from 'node:fs/promises';
import sharp from 'sharp';
import { IconGenError } from './errors.js';
import { IOS_SIZES, MACOS_SIZES, ANDROID_PLAY_STORE, ANDROID_ADAPTIVE_DENSITIES } from './constants.js';
import { resizeForIos } from './platforms/ios.js';
import { resizeForMacos } from './platforms/macos.js';
import { resizeForAndroid } from './platforms/android.js';
import type { Platform, PlatformOutput, ResizeOptions, ResizeResult } from './types.js';

const VALID_PLATFORMS: Platform[] = ['ios', 'macos', 'android'];

function getLargestRequiredSize(platforms: Platform[]): number {
  let max = 0;
  for (const p of platforms) {
    if (p === 'ios') max = Math.max(max, ...IOS_SIZES.map((s) => s.size));
    if (p === 'macos') max = Math.max(max, ...MACOS_SIZES.map((s) => s.size));
    if (p === 'android') max = Math.max(max, ANDROID_PLAY_STORE.size, ...ANDROID_ADAPTIVE_DENSITIES.map((d) => d.size));
  }
  return max;
}

export async function resizeForPlatform(
  sourcePath: string,
  platform: Platform | Platform[],
  outputDir: string,
  options?: ResizeOptions,
): Promise<ResizeResult> {
  const platforms = Array.isArray(platform) ? platform : [platform];

  // Validate platforms
  for (const p of platforms) {
    if (!VALID_PLATFORMS.includes(p)) {
      throw new TypeError(`Invalid platform "${p}". Supported: ${VALID_PLATFORMS.join(', ')}`);
    }
  }

  // Validate source file exists
  try {
    await fs.access(sourcePath);
  } catch {
    throw new IconGenError(`Source file not found: ${sourcePath}`, 'INVALID_SOURCE');
  }

  // Validate source is PNG and is square
  const metadata = await sharp(sourcePath).metadata();
  if (metadata.format !== 'png') {
    throw new IconGenError(`Source must be a PNG file, got ${metadata.format}`, 'INVALID_SOURCE');
  }
  if (!metadata.width || !metadata.height || metadata.width !== metadata.height) {
    throw new IconGenError(`Source must be square, got ${metadata.width}x${metadata.height}`, 'INVALID_SOURCE');
  }

  // Validate source >= largest required size
  const largestRequired = getLargestRequiredSize(platforms);
  if (metadata.width < largestRequired) {
    throw new IconGenError(
      `Source image is ${metadata.width}x${metadata.width} but largest required size is ${largestRequired}x${largestRequired}`,
      'SOURCE_TOO_SMALL',
    );
  }

  // Validate outputDir is writable
  try {
    await fs.mkdir(outputDir, { recursive: true });
    await fs.access(outputDir, fs.constants.W_OK);
  } catch (err) {
    throw new IconGenError(`Output directory is not writable: ${outputDir}`, 'WRITE_ERROR', err);
  }

  // Read source buffer once — shared across all platform resize operations
  const sourceBuffer = await fs.readFile(sourcePath);

  const kernel = options?.resizeFilter ?? 'lanczos3';
  const outputs: Partial<Record<Platform, PlatformOutput>> = {};

  // Run all platform resizes in parallel
  const tasks: Promise<void>[] = [];

  for (const p of platforms) {
    if (p === 'ios') {
      tasks.push(resizeForIos(sourceBuffer, outputDir, kernel).then((r) => void (outputs.ios = r)));
    } else if (p === 'macos') {
      tasks.push(resizeForMacos(sourceBuffer, outputDir, kernel).then((r) => void (outputs.macos = r)));
    } else if (p === 'android') {
      tasks.push(resizeForAndroid(sourceBuffer, outputDir, kernel).then((r) => void (outputs.android = r)));
    }
  }

  await Promise.all(tasks);

  return { outputs };
}
