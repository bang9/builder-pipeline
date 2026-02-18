import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import sharp from 'sharp';
import { resizeForAndroid, resizeAdaptiveLayers, generateSolidBackground } from '../platforms/android.js';
import { ANDROID_ADAPTIVE_DENSITIES, ADAPTIVE_ICON_XML } from '../constants.js';

let fixtureDir: string;
let fixturePath: string;
let fgBuffer: Buffer;
let bgBuffer: Buffer;

beforeAll(async () => {
  fixtureDir = await fs.mkdtemp(path.join(os.tmpdir(), 'android-test-'));
  fixturePath = path.join(fixtureDir, 'source.png');

  // Create a 1024x1024 fixture
  const buf = await sharp({
    create: { width: 1024, height: 1024, channels: 4, background: { r: 66, g: 133, b: 244, alpha: 1 } },
  })
    .png()
    .toBuffer();

  await fs.writeFile(fixturePath, buf);

  fgBuffer = await sharp({
    create: { width: 1024, height: 1024, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 0.5 } },
  })
    .png()
    .toBuffer();

  bgBuffer = await sharp({
    create: { width: 1024, height: 1024, channels: 3, background: { r: 0, g: 0, b: 255 } },
  })
    .png()
    .toBuffer();
});

afterAll(async () => {
  await fs.rm(fixtureDir, { recursive: true, force: true });
});

function freshOutputDir(): string {
  return path.join(fixtureDir, `out-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

describe('resizeForAndroid', () => {
  it('produces a single play-store.png file', async () => {
    const out = freshOutputDir();
    const sourceBuffer = await fs.readFile(fixturePath);
    const result = await resizeForAndroid(sourceBuffer, out);
    expect(result.files).toHaveLength(1);
    expect(path.basename(result.files[0])).toBe('play-store.png');
  });

  it('play-store icon is 512x512 opaque', async () => {
    const out = freshOutputDir();
    const sourceBuffer = await fs.readFile(fixturePath);
    const result = await resizeForAndroid(sourceBuffer, out);
    const meta = await sharp(result.files[0]).metadata();
    expect(meta.width).toBe(512);
    expect(meta.height).toBe(512);
    expect(meta.channels).toBe(3); // no alpha
  });

  it('play-store icon is under 1024 KB', async () => {
    const out = freshOutputDir();
    const sourceBuffer = await fs.readFile(fixturePath);
    const result = await resizeForAndroid(sourceBuffer, out);
    const stat = await fs.stat(result.files[0]);
    expect(stat.size).toBeLessThan(1024 * 1024);
  });

  it('directory points to android subdirectory', async () => {
    const out = freshOutputDir();
    const sourceBuffer = await fs.readFile(fixturePath);
    const result = await resizeForAndroid(sourceBuffer, out);
    expect(result.directory).toBe(path.join(out, 'android'));
  });
});

describe('resizeAdaptiveLayers', () => {
  it('produces foreground + background for each density plus XML', async () => {
    const out = freshOutputDir();
    const files = await resizeAdaptiveLayers(fgBuffer, bgBuffer, out);
    // 5 densities * 2 layers + 1 XML = 11 files
    expect(files).toHaveLength(11);
  });

  it('creates correct density directories', async () => {
    const out = freshOutputDir();
    await resizeAdaptiveLayers(fgBuffer, bgBuffer, out);

    for (const density of ANDROID_ADAPTIVE_DENSITIES) {
      const dir = path.join(out, 'android', 'adaptive', density.directory);
      const stat = await fs.stat(dir);
      expect(stat.isDirectory()).toBe(true);
    }
  });

  it('produces correctly sized foreground layers', async () => {
    const out = freshOutputDir();
    const files = await resizeAdaptiveLayers(fgBuffer, bgBuffer, out);

    for (const density of ANDROID_ADAPTIVE_DENSITIES) {
      const fgPath = path.join(out, 'android', 'adaptive', density.directory, 'ic_launcher_foreground.png');
      expect(files).toContain(fgPath);
      const meta = await sharp(fgPath).metadata();
      expect(meta.width).toBe(density.size);
      expect(meta.height).toBe(density.size);
      expect(meta.format).toBe('png');
    }
  });

  it('produces correctly sized background layers', async () => {
    const out = freshOutputDir();
    const files = await resizeAdaptiveLayers(fgBuffer, bgBuffer, out);

    for (const density of ANDROID_ADAPTIVE_DENSITIES) {
      const bgPath = path.join(out, 'android', 'adaptive', density.directory, 'ic_launcher_background.png');
      expect(files).toContain(bgPath);
      const meta = await sharp(bgPath).metadata();
      expect(meta.width).toBe(density.size);
      expect(meta.height).toBe(density.size);
      expect(meta.channels).toBe(3); // background is opaque
    }
  });

  it('writes adaptive icon XML', async () => {
    const out = freshOutputDir();
    const files = await resizeAdaptiveLayers(fgBuffer, bgBuffer, out);

    const xmlPath = path.join(out, 'android', 'adaptive', 'mipmap-anydpi-v26', 'ic_launcher.xml');
    expect(files).toContain(xmlPath);
    const content = await fs.readFile(xmlPath, 'utf-8');
    expect(content).toBe(ADAPTIVE_ICON_XML);
  });

  it('supports custom kernel', async () => {
    const out = freshOutputDir();
    const files = await resizeAdaptiveLayers(fgBuffer, bgBuffer, out, 'mitchell');
    // Just verify it completed successfully with correct count
    expect(files).toHaveLength(11);
  });
});

describe('generateSolidBackground', () => {
  it('creates a 1024x1024 opaque PNG', async () => {
    const out = path.join(freshOutputDir(), 'solid.png');
    await fs.mkdir(path.dirname(out), { recursive: true });
    await generateSolidBackground(out, '#FF0000');

    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(1024);
    expect(meta.height).toBe(1024);
    expect(meta.format).toBe('png');
    expect(meta.channels).toBe(3); // opaque, no alpha
  });

  it('uses the specified color', async () => {
    const out = path.join(freshOutputDir(), 'blue.png');
    await fs.mkdir(path.dirname(out), { recursive: true });
    await generateSolidBackground(out, '#0000FF');

    // Sample a pixel to verify color
    const { data } = await sharp(out).raw().toBuffer({ resolveWithObject: true });
    // First pixel: R=0, G=0, B=255
    expect(data[0]).toBe(0); // R
    expect(data[1]).toBe(0); // G
    expect(data[2]).toBe(255); // B
  });
});
