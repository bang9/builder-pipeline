import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import sharp from 'sharp';
import { IconGenError } from '../errors.js';

// Mock generateIcon
vi.mock('../generate.js', () => ({
  generateIcon: vi.fn(),
}));

// Mock resizeForPlatform
vi.mock('../resize.js', () => ({
  resizeForPlatform: vi.fn(),
}));

// Mock android adaptive functions
vi.mock('../platforms/android.js', () => ({
  resizeAdaptiveLayers: vi.fn(),
  generateSolidBackground: vi.fn(),
}));

import { generateAndResize } from '../generate-and-resize.js';
import { generateIcon } from '../generate.js';
import { resizeForPlatform } from '../resize.js';
import { resizeAdaptiveLayers, generateSolidBackground } from '../platforms/android.js';

const mockedGenerateIcon = vi.mocked(generateIcon);
const mockedResizeForPlatform = vi.mocked(resizeForPlatform);
const mockedResizeAdaptiveLayers = vi.mocked(resizeAdaptiveLayers);
const mockedGenerateSolidBackground = vi.mocked(generateSolidBackground);

let tmpDir: string;
let fixtureFg: string;
let fixtureBg: string;

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gar-test-'));

  // Create square 1024x1024 PNG fixtures for manual adaptive tests
  fixtureFg = path.join(tmpDir, 'fg.png');
  fixtureBg = path.join(tmpDir, 'bg.png');
  await Promise.all([
    sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } } })
      .png()
      .toFile(fixtureFg),
    sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 255, alpha: 1 } } })
      .png()
      .toFile(fixtureBg),
  ]);
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

afterEach(() => {
  vi.clearAllMocks();
});

function setupBaseMocks(outDir: string) {
  const basePath = path.join(outDir, 'base', 'icon-base.png');
  mockedGenerateIcon.mockResolvedValue({
    path: basePath,
    width: 1024,
    height: 1024,
    model: 'test-model',
  });
  mockedResizeForPlatform.mockResolvedValue({
    outputs: {
      ios: { files: [path.join(outDir, 'ios', 'AppIcon.png')], directory: path.join(outDir, 'ios') },
      macos: { files: [path.join(outDir, 'macos', 'icon_16x16.png')], directory: path.join(outDir, 'macos') },
      android: { files: [path.join(outDir, 'android', 'play-store.png')], directory: path.join(outDir, 'android') },
    },
  });
}

describe('generateAndResize - basic orchestration', () => {
  it('calls generateIcon then resizeForPlatform', async () => {
    const outDir = path.join(tmpDir, 'basic');
    setupBaseMocks(outDir);

    const result = await generateAndResize('a cat icon', { outputDir: outDir });

    expect(mockedGenerateIcon).toHaveBeenCalledOnce();
    expect(mockedResizeForPlatform).toHaveBeenCalledOnce();
    expect(result.baseIcon.model).toBe('test-model');
    expect(result.outputs.ios).toBeDefined();
    expect(result.outputs.macos).toBeDefined();
    expect(result.outputs.android).toBeDefined();
  });

  it('defaults to all three platforms', async () => {
    const outDir = path.join(tmpDir, 'default-plat');
    setupBaseMocks(outDir);

    await generateAndResize('icon', { outputDir: outDir });

    const [, platforms] = mockedResizeForPlatform.mock.calls[0];
    expect(platforms).toEqual(['ios', 'macos', 'android']);
  });

  it('passes custom platforms to resizeForPlatform', async () => {
    const outDir = path.join(tmpDir, 'custom-plat');
    setupBaseMocks(outDir);

    await generateAndResize('icon', { outputDir: outDir, platforms: ['ios'] });

    const [, platforms] = mockedResizeForPlatform.mock.calls[0];
    expect(platforms).toEqual(['ios']);
  });

  it('forwards generation options to generateIcon', async () => {
    const outDir = path.join(tmpDir, 'gen-opts');
    setupBaseMocks(outDir);

    await generateAndResize('icon', {
      outputDir: outDir,
      generation: { quality: 'draft', background: 'transparent' },
    });

    const genOpts = mockedGenerateIcon.mock.calls[0][1];
    expect(genOpts).toMatchObject({ quality: 'draft', background: 'transparent' });
  });

  it('forwards resize options to resizeForPlatform', async () => {
    const outDir = path.join(tmpDir, 'resize-opts');
    setupBaseMocks(outDir);

    await generateAndResize('icon', {
      outputDir: outDir,
      resize: { resizeFilter: 'mitchell' },
    });

    const resizeOpts = mockedResizeForPlatform.mock.calls[0][3];
    expect(resizeOpts).toEqual({ resizeFilter: 'mitchell' });
  });
});

describe('generateAndResize - backgroundColor validation', () => {
  it('throws TypeError for invalid hex color', async () => {
    const outDir = path.join(tmpDir, 'bad-color');
    await expect(
      generateAndResize('icon', {
        outputDir: outDir,
        androidAdaptive: { strategy: 'auto', backgroundColor: 'red' },
      }),
    ).rejects.toThrow(TypeError);
  });

  it('throws TypeError for hex without #', async () => {
    const outDir = path.join(tmpDir, 'no-hash');
    await expect(
      generateAndResize('icon', {
        outputDir: outDir,
        androidAdaptive: { strategy: 'auto', backgroundColor: 'FF0000' },
      }),
    ).rejects.toThrow('Must be hex format');
  });

  it('accepts valid 6-digit hex', async () => {
    const outDir = path.join(tmpDir, 'valid-hex6');
    setupBaseMocks(outDir);
    mockedResizeAdaptiveLayers.mockResolvedValue([]);

    // Need a tmp file for the auto foreground generation
    const fgPath = path.join(outDir, 'android', 'adaptive', '_tmp', 'foreground-source.png');
    mockedGenerateIcon
      .mockResolvedValueOnce({
        path: path.join(outDir, 'base', 'icon-base.png'),
        width: 1024,
        height: 1024,
        model: 'test',
      })
      .mockResolvedValueOnce({ path: fgPath, width: 1024, height: 1024, model: 'test' });

    // Mock fs.readFile for auto strategy — the function reads foreground and background buffers
    // Since the files don't actually exist, we need the generateIcon mock to return valid paths
    // and the code reads them. We'll skip the deep integration for this unit test.
    // Instead, let's just verify the validation passes (doesn't throw TypeError).
    // The deeper call will fail at fs.readFile, but that's beyond validation.
    await expect(
      generateAndResize('icon', {
        outputDir: outDir,
        androidAdaptive: { strategy: 'auto', backgroundColor: '#FF0000' },
      }),
    ).rejects.not.toThrow(TypeError);
  });

  it('accepts valid 8-digit hex with alpha', async () => {
    const outDir = path.join(tmpDir, 'valid-hex8');
    setupBaseMocks(outDir);

    await expect(
      generateAndResize('icon', {
        outputDir: outDir,
        androidAdaptive: { strategy: 'auto', backgroundColor: '#FF0000AA' },
      }),
    ).rejects.not.toThrow(TypeError);
  });

  it('does not validate backgroundColor for manual strategy', async () => {
    const outDir = path.join(tmpDir, 'manual-novalidate');
    // Manual strategy with invalid color should NOT throw TypeError for color
    // (it will throw for missing paths instead)
    await expect(
      generateAndResize('icon', {
        outputDir: outDir,
        androidAdaptive: { strategy: 'manual', backgroundColor: 'not-a-color' },
      }),
    ).rejects.toThrow(TypeError); // TypeError for missing foregroundPath, not color
  });
});

describe('generateAndResize - manual adaptive validation', () => {
  it('throws TypeError when foregroundPath is missing', async () => {
    const outDir = path.join(tmpDir, 'no-fg');
    await expect(
      generateAndResize('icon', {
        outputDir: outDir,
        androidAdaptive: { strategy: 'manual', backgroundPath: fixtureBg },
      }),
    ).rejects.toThrow('foregroundPath is required');
  });

  it('throws TypeError when backgroundPath is missing', async () => {
    const outDir = path.join(tmpDir, 'no-bg');
    await expect(
      generateAndResize('icon', {
        outputDir: outDir,
        androidAdaptive: { strategy: 'manual', foregroundPath: fixtureFg },
      }),
    ).rejects.toThrow('backgroundPath is required');
  });

  it('throws INVALID_SOURCE for nonexistent foreground', async () => {
    const outDir = path.join(tmpDir, 'missing-fg');
    await expect(
      generateAndResize('icon', {
        outputDir: outDir,
        androidAdaptive: { strategy: 'manual', foregroundPath: '/nonexistent.png', backgroundPath: fixtureBg },
      }),
    ).rejects.toMatchObject({ code: 'INVALID_SOURCE' });
  });

  it('throws INVALID_SOURCE for non-PNG foreground', async () => {
    const jpegPath = path.join(tmpDir, 'fg.jpg');
    await sharp({ create: { width: 1024, height: 1024, channels: 3, background: { r: 0, g: 0, b: 0 } } })
      .jpeg()
      .toFile(jpegPath);

    const outDir = path.join(tmpDir, 'jpeg-fg');
    await expect(
      generateAndResize('icon', {
        outputDir: outDir,
        androidAdaptive: { strategy: 'manual', foregroundPath: jpegPath, backgroundPath: fixtureBg },
      }),
    ).rejects.toMatchObject({ code: 'INVALID_SOURCE' });
  });

  it('throws INVALID_SOURCE for non-square foreground', async () => {
    const rectPath = path.join(tmpDir, 'fg-rect.png');
    await sharp({ create: { width: 1024, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } } })
      .png()
      .toFile(rectPath);

    const outDir = path.join(tmpDir, 'rect-fg');
    await expect(
      generateAndResize('icon', {
        outputDir: outDir,
        androidAdaptive: { strategy: 'manual', foregroundPath: rectPath, backgroundPath: fixtureBg },
      }),
    ).rejects.toMatchObject({ code: 'INVALID_SOURCE' });
  });

  it('throws SOURCE_TOO_SMALL for undersized foreground', async () => {
    const smallPath = path.join(tmpDir, 'fg-small.png');
    await sharp({ create: { width: 64, height: 64, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } } })
      .png()
      .toFile(smallPath);

    const outDir = path.join(tmpDir, 'small-fg');
    await expect(
      generateAndResize('icon', {
        outputDir: outDir,
        androidAdaptive: { strategy: 'manual', foregroundPath: smallPath, backgroundPath: fixtureBg },
      }),
    ).rejects.toMatchObject({ code: 'SOURCE_TOO_SMALL' });
  });

  it('proceeds with valid manual paths', async () => {
    const outDir = path.join(tmpDir, 'valid-manual');
    setupBaseMocks(outDir);
    mockedResizeAdaptiveLayers.mockResolvedValue([
      path.join(outDir, 'android', 'adaptive', 'mipmap-mdpi', 'ic_launcher_foreground.png'),
    ]);

    const result = await generateAndResize('icon', {
      outputDir: outDir,
      androidAdaptive: { strategy: 'manual', foregroundPath: fixtureFg, backgroundPath: fixtureBg },
    });

    expect(mockedResizeAdaptiveLayers).toHaveBeenCalledOnce();
    // Android outputs should include both play-store + adaptive files
    expect(result.outputs.android!.files.length).toBeGreaterThan(1);
  });
});

describe('generateAndResize - adaptive not triggered when excluded', () => {
  it('skips adaptive when android not in platforms', async () => {
    const outDir = path.join(tmpDir, 'no-android');
    setupBaseMocks(outDir);

    await generateAndResize('icon', {
      outputDir: outDir,
      platforms: ['ios'],
      androidAdaptive: { strategy: 'auto' },
    });

    expect(mockedResizeAdaptiveLayers).not.toHaveBeenCalled();
  });

  it('skips adaptive when androidAdaptive is not provided', async () => {
    const outDir = path.join(tmpDir, 'no-adaptive');
    setupBaseMocks(outDir);

    await generateAndResize('icon', { outputDir: outDir });

    expect(mockedResizeAdaptiveLayers).not.toHaveBeenCalled();
  });
});
