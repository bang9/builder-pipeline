import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { IOS_SIZES } from '../constants.js';
import type { PlatformOutput } from '../types.js';

export async function resizeForIos(
  sourceBuffer: Buffer,
  outputDir: string,
  kernel: 'lanczos3' | 'lanczos2' | 'mitchell' = 'lanczos3',
): Promise<PlatformOutput> {
  const iosDir = path.join(outputDir, 'ios');
  await fs.mkdir(iosDir, { recursive: true });

  const files = await Promise.all(
    IOS_SIZES.map(async (entry) => {
      const outputPath = path.join(iosDir, entry.name);
      await sharp(sourceBuffer)
        .toColourspace('srgb')
        .resize(entry.size, entry.size, { kernel })
        .removeAlpha()
        .flatten({ background: '#FFFFFF' })
        .png({ compressionLevel: 9 })
        .toFile(outputPath);
      return outputPath;
    }),
  );

  return { files, directory: iosDir };
}
