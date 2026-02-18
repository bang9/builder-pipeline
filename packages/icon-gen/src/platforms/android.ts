import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {
  ANDROID_PLAY_STORE,
  ANDROID_ADAPTIVE_DENSITIES,
  ANDROID_PLAY_STORE_MAX_BYTES,
  ADAPTIVE_ICON_XML,
} from '../constants.js';
import { IconGenError } from '../errors.js';
import type { PlatformOutput } from '../types.js';

export async function resizeForAndroid(
  sourceBuffer: Buffer,
  outputDir: string,
  kernel: 'lanczos3' | 'lanczos2' | 'mitchell' = 'lanczos3',
): Promise<PlatformOutput> {
  const androidDir = path.join(outputDir, 'android');
  await fs.mkdir(androidDir, { recursive: true });

  // Play Store icon (512x512 opaque)
  const playStorePath = path.join(androidDir, ANDROID_PLAY_STORE.name);
  await sharp(sourceBuffer)
    .toColourspace('srgb')
    .resize(ANDROID_PLAY_STORE.size, ANDROID_PLAY_STORE.size, { kernel })
    .removeAlpha()
    .flatten({ background: '#FFFFFF' })
    .png({ compressionLevel: 9 })
    .toFile(playStorePath);

  // Validate Play Store icon size
  const stat = await fs.stat(playStorePath);
  if (stat.size > ANDROID_PLAY_STORE_MAX_BYTES) {
    throw new IconGenError(`Play Store icon exceeds 1024 KB (${Math.round(stat.size / 1024)} KB)`, 'FILE_TOO_LARGE');
  }

  return { files: [playStorePath], directory: androidDir };
}

export async function resizeAdaptiveLayers(
  foregroundBuffer: Buffer,
  backgroundBuffer: Buffer,
  outputDir: string,
  kernel: 'lanczos3' | 'lanczos2' | 'mitchell' = 'lanczos3',
): Promise<string[]> {
  const adaptiveDir = path.join(outputDir, 'android', 'adaptive');

  // Create all density directories upfront
  await Promise.all(
    ANDROID_ADAPTIVE_DENSITIES.map((d) => fs.mkdir(path.join(adaptiveDir, d.directory), { recursive: true })),
  );

  // Resize all density buckets in parallel
  const layerFiles = await Promise.all(
    ANDROID_ADAPTIVE_DENSITIES.flatMap((density) => {
      const densityDir = path.join(adaptiveDir, density.directory);

      const fgTask = (async () => {
        const fgPath = path.join(densityDir, 'ic_launcher_foreground.png');
        await sharp(foregroundBuffer)
          .toColourspace('srgb')
          .resize(density.size, density.size, { kernel })
          .png({ compressionLevel: 9 })
          .toFile(fgPath);
        return fgPath;
      })();

      const bgTask = (async () => {
        const bgPath = path.join(densityDir, 'ic_launcher_background.png');
        await sharp(backgroundBuffer)
          .toColourspace('srgb')
          .resize(density.size, density.size, { kernel })
          .removeAlpha()
          .flatten({ background: '#FFFFFF' })
          .png({ compressionLevel: 9 })
          .toFile(bgPath);
        return bgPath;
      })();

      return [fgTask, bgTask];
    }),
  );

  // Write adaptive icon XML
  const xmlDir = path.join(adaptiveDir, 'mipmap-anydpi-v26');
  await fs.mkdir(xmlDir, { recursive: true });
  const xmlPath = path.join(xmlDir, 'ic_launcher.xml');
  await fs.writeFile(xmlPath, ADAPTIVE_ICON_XML, 'utf-8');

  return [...layerFiles, xmlPath];
}

export async function generateSolidBackground(outputPath: string, color: string): Promise<void> {
  await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 3,
      background: color,
    },
  })
    .png()
    .toFile(outputPath);
}
