import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import sharp from 'sharp';
import { resizeForPlatform } from '../resize.js';
import { IconGenError } from '../errors.js';

let fixtureDir: string;
let fixturePath: string;

beforeAll(async () => {
  // Generate a 1024x1024 solid-color PNG fixture
  fixtureDir = await fs.mkdtemp(path.join(os.tmpdir(), 'icon-gen-fixtures-'));
  fixturePath = path.join(fixtureDir, 'test-icon.png');
  await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: 66, g: 133, b: 244, alpha: 1 },
    },
  })
    .png()
    .toFile(fixturePath);
});

afterAll(async () => {
  await fs.rm(fixtureDir, { recursive: true, force: true });
});

function freshOutputDir(): string {
  return path.join(fixtureDir, `output-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

describe('resizeForPlatform - iOS', () => {
  it('produces 1 file', async () => {
    const out = freshOutputDir();
    const result = await resizeForPlatform(fixturePath, 'ios', out);
    expect(result.outputs.ios).toBeDefined();
    expect(result.outputs.ios!.files).toHaveLength(1);
  });

  it('produces 1024x1024 opaque PNG', async () => {
    const out = freshOutputDir();
    const result = await resizeForPlatform(fixturePath, 'ios', out);
    const meta = await sharp(result.outputs.ios!.files[0]).metadata();
    expect(meta.width).toBe(1024);
    expect(meta.height).toBe(1024);
    expect(meta.channels).toBe(3); // no alpha
    expect(meta.format).toBe('png');
  });
});

describe('resizeForPlatform - macOS', () => {
  it('produces 10 files', async () => {
    const out = freshOutputDir();
    const result = await resizeForPlatform(fixturePath, 'macos', out);
    expect(result.outputs.macos).toBeDefined();
    expect(result.outputs.macos!.files).toHaveLength(10);
  });

  it('preserves alpha channel', async () => {
    const out = freshOutputDir();
    const result = await resizeForPlatform(fixturePath, 'macos', out);
    const meta = await sharp(result.outputs.macos!.files[0]).metadata();
    expect(meta.channels).toBe(4); // alpha preserved
  });

  it('has correct file names in AppIcon.iconset', async () => {
    const out = freshOutputDir();
    const result = await resizeForPlatform(fixturePath, 'macos', out);
    const names = result.outputs.macos!.files.map((f) => path.basename(f));
    expect(names).toContain('icon_16x16.png');
    expect(names).toContain('icon_512x512@2x.png');
  });

  it('has correct dimensions for each output file', async () => {
    const out = freshOutputDir();
    const result = await resizeForPlatform(fixturePath, 'macos', out);
    const expectedSizes = [16, 32, 32, 64, 128, 256, 256, 512, 512, 1024];
    const files = result.outputs.macos!.files;
    expect(files).toHaveLength(expectedSizes.length);
    for (let i = 0; i < files.length; i++) {
      const meta = await sharp(files[i]).metadata();
      expect(meta.width).toBe(expectedSizes[i]);
      expect(meta.height).toBe(expectedSizes[i]);
    }
  });
});

describe('resizeForPlatform - Android', () => {
  it('produces Play Store icon', async () => {
    const out = freshOutputDir();
    const result = await resizeForPlatform(fixturePath, 'android', out);
    expect(result.outputs.android).toBeDefined();
    expect(result.outputs.android!.files).toHaveLength(1);
  });

  it('Play Store icon is 512x512 opaque', async () => {
    const out = freshOutputDir();
    const result = await resizeForPlatform(fixturePath, 'android', out);
    const meta = await sharp(result.outputs.android!.files[0]).metadata();
    expect(meta.width).toBe(512);
    expect(meta.height).toBe(512);
    expect(meta.channels).toBe(3); // no alpha
  });

  it('Play Store icon is under 1024 KB', async () => {
    const out = freshOutputDir();
    const result = await resizeForPlatform(fixturePath, 'android', out);
    const stat = await fs.stat(result.outputs.android!.files[0]);
    expect(stat.size).toBeLessThan(1024 * 1024);
  });
});

describe('resizeForPlatform - combined', () => {
  it('supports multiple platforms at once', async () => {
    const out = freshOutputDir();
    const result = await resizeForPlatform(fixturePath, ['ios', 'macos', 'android'], out);
    expect(result.outputs.ios).toBeDefined();
    expect(result.outputs.macos).toBeDefined();
    expect(result.outputs.android).toBeDefined();
  });
});

describe('resizeForPlatform - validation', () => {
  it('throws INVALID_SOURCE for nonexistent file', async () => {
    const out = freshOutputDir();
    await expect(resizeForPlatform('/nonexistent.png', 'ios', out)).rejects.toMatchObject({
      code: 'INVALID_SOURCE',
    });
  });

  it('throws INVALID_SOURCE for non-PNG source', async () => {
    const jpegPath = path.join(fixtureDir, 'test.jpg');
    await sharp({
      create: { width: 1024, height: 1024, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .jpeg()
      .toFile(jpegPath);

    const out = freshOutputDir();
    await expect(resizeForPlatform(jpegPath, 'ios', out)).rejects.toMatchObject({
      code: 'INVALID_SOURCE',
    });
  });

  it('throws INVALID_SOURCE for non-square source', async () => {
    const rectPath = path.join(fixtureDir, 'rect.png');
    await sharp({
      create: { width: 1024, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } },
    })
      .png()
      .toFile(rectPath);

    const out = freshOutputDir();
    await expect(resizeForPlatform(rectPath, 'ios', out)).rejects.toMatchObject({
      code: 'INVALID_SOURCE',
    });
  });

  it('throws SOURCE_TOO_SMALL for undersized source', async () => {
    const smallPath = path.join(fixtureDir, 'small.png');
    await sharp({
      create: { width: 64, height: 64, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } },
    })
      .png()
      .toFile(smallPath);

    const out = freshOutputDir();
    await expect(resizeForPlatform(smallPath, 'ios', out)).rejects.toMatchObject({
      code: 'SOURCE_TOO_SMALL',
    });
  });

  it('throws TypeError for invalid platform', async () => {
    const out = freshOutputDir();
    await expect(resizeForPlatform(fixturePath, 'windows' as any, out)).rejects.toThrow(TypeError);
  });
});
