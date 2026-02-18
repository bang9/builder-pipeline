import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { MACOS_SIZES } from '../constants.js';
import type { PlatformOutput } from '../types.js';

export async function resizeForMacos(
  sourceBuffer: Buffer,
  outputDir: string,
  kernel: 'lanczos3' | 'lanczos2' | 'mitchell' = 'lanczos3',
): Promise<PlatformOutput> {
  const iconsetDir = path.join(outputDir, 'macos', 'AppIcon.iconset');
  await fs.mkdir(iconsetDir, { recursive: true });

  const files = await Promise.all(
    MACOS_SIZES.map(async (entry) => {
      const outputPath = path.join(iconsetDir, entry.name);
      await sharp(sourceBuffer)
        .toColourspace('srgb')
        .resize(entry.size, entry.size, { kernel })
        .png({ compressionLevel: 9 })
        .toFile(outputPath);
      return outputPath;
    }),
  );

  return { files, directory: path.join(outputDir, 'macos') };
}
