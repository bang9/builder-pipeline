import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import sharp from 'sharp';
import type { ImageModelV3 } from '@ai-sdk/provider';
import { generateIcon } from '../generate.js';
import { resizeForPlatform } from '../resize.js';
import { generateAndResize } from '../generate-and-resize.js';
import { IconGenError } from '../errors.js';
import { ANDROID_ADAPTIVE_DENSITIES, ADAPTIVE_ICON_XML } from '../constants.js';
import type { GenerateAndResizeResult } from '../types.js';

// ---------------------------------------------------------------------------
// Mock model factory
// ---------------------------------------------------------------------------

let mockPngBuffer: Buffer;

function createMockModel(): ImageModelV3 {
  return {
    specificationVersion: 'v3',
    provider: 'mock-provider',
    modelId: 'mock-model-e2e',
    maxImagesPerCall: 1,
    doGenerate: async () => ({
      images: [new Uint8Array(mockPngBuffer)],
      warnings: [],
      providerMetadata: {},
      response: {
        timestamp: new Date(),
        modelId: 'mock-model-e2e',
        headers: undefined,
      },
    }),
  };
}

function createFailingModel(error: Error): ImageModelV3 {
  return {
    specificationVersion: 'v3',
    provider: 'mock-provider',
    modelId: 'mock-model-fail',
    maxImagesPerCall: 1,
    doGenerate: async () => {
      throw error;
    },
  };
}

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'icon-gen-e2e-'));

  // Pre-build a 1024x1024 RGBA PNG for mock model responses
  mockPngBuffer = await sharp({
    create: { width: 1024, height: 1024, channels: 4, background: { r: 66, g: 133, b: 244, alpha: 1 } },
  })
    .png()
    .toBuffer();
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

function freshOutputDir(prefix = 'e2e'): string {
  return path.join(tmpDir, `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

// ---------------------------------------------------------------------------
// Suite 1: generateIcon + mock model
// ---------------------------------------------------------------------------

describe('E2E: generateIcon with mock model', () => {
  it('outputs a 1024x1024 PNG', async () => {
    const outDir = freshOutputDir('gen');
    const result = await generateIcon('a cute cat', { model: createMockModel(), outputDir: outDir });

    expect(result.width).toBe(1024);
    expect(result.height).toBe(1024);
    expect(result.model).toBe('mock-model-e2e');

    const meta = await sharp(result.path).metadata();
    expect(meta.format).toBe('png');
    expect(meta.width).toBe(1024);
    expect(meta.height).toBe(1024);
  });

  it('normalizes a 512x512 response to 1024x1024', async () => {
    const smallPng = await sharp({
      create: { width: 512, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } },
    })
      .png()
      .toBuffer();

    const model: ImageModelV3 = {
      specificationVersion: 'v3',
      provider: 'mock-provider',
      modelId: 'mock-model-small',
      maxImagesPerCall: 1,
      doGenerate: async () => ({
        images: [new Uint8Array(smallPng)],
        warnings: [],
        response: { timestamp: new Date(), modelId: 'mock-model-small', headers: undefined },
      }),
    };

    const outDir = freshOutputDir('normalize');
    const result = await generateIcon('test', { model, outputDir: outDir });
    const meta = await sharp(result.path).metadata();
    expect(meta.width).toBe(1024);
    expect(meta.height).toBe(1024);
  });

  it('preserves RGBA channels with transparent background', async () => {
    const outDir = freshOutputDir('transparent');
    const result = await generateIcon('test', {
      model: createMockModel(),
      outputDir: outDir,
      background: 'transparent',
    });

    const meta = await sharp(result.path).metadata();
    expect(meta.format).toBe('png');
    expect(meta.channels).toBe(4); // alpha channel preserved
  });
});

// ---------------------------------------------------------------------------
// Suite 2: resizeForPlatform from generated output
// ---------------------------------------------------------------------------

describe('E2E: resizeForPlatform from generated output', () => {
  let basePath: string;

  beforeAll(async () => {
    const outDir = freshOutputDir('resize-base');
    const result = await generateIcon('resize test', { model: createMockModel(), outputDir: outDir });
    basePath = result.path;
  });

  it('iOS: 1 file, opaque', async () => {
    const outDir = freshOutputDir('resize-ios');
    const result = await resizeForPlatform(basePath, 'ios', outDir);

    expect(result.outputs.ios).toBeDefined();
    expect(result.outputs.ios!.files).toHaveLength(1);

    const meta = await sharp(result.outputs.ios!.files[0]).metadata();
    expect(meta.width).toBe(1024);
    expect(meta.height).toBe(1024);
    expect(meta.channels).toBe(3); // no alpha
  });

  it('macOS: 10 files, alpha preserved', async () => {
    const outDir = freshOutputDir('resize-macos');
    const result = await resizeForPlatform(basePath, 'macos', outDir);

    expect(result.outputs.macos).toBeDefined();
    expect(result.outputs.macos!.files).toHaveLength(10);

    const meta = await sharp(result.outputs.macos!.files[0]).metadata();
    expect(meta.channels).toBe(4); // alpha preserved
  });

  it('Android: 512x512 play store icon', async () => {
    const outDir = freshOutputDir('resize-android');
    const result = await resizeForPlatform(basePath, 'android', outDir);

    expect(result.outputs.android).toBeDefined();
    expect(result.outputs.android!.files).toHaveLength(1);

    const meta = await sharp(result.outputs.android!.files[0]).metadata();
    expect(meta.width).toBe(512);
    expect(meta.height).toBe(512);
  });

  it('all platforms at once', async () => {
    const outDir = freshOutputDir('resize-all');
    const result = await resizeForPlatform(basePath, ['ios', 'macos', 'android'], outDir);

    expect(result.outputs.ios).toBeDefined();
    expect(result.outputs.macos).toBeDefined();
    expect(result.outputs.android).toBeDefined();

    const totalFiles =
      result.outputs.ios!.files.length + result.outputs.macos!.files.length + result.outputs.android!.files.length;
    expect(totalFiles).toBe(12); // 1 + 10 + 1
  });
});

// ---------------------------------------------------------------------------
// Suite 3: generateAndResize full pipeline
// ---------------------------------------------------------------------------

describe('E2E: generateAndResize full pipeline', () => {
  it('generates base icon + all platform outputs', async () => {
    const outDir = freshOutputDir('gar-all');
    const result = await generateAndResize('a weather app icon', {
      outputDir: outDir,
      generation: { model: createMockModel() },
    });

    // Base icon
    expect(result.baseIcon.width).toBe(1024);
    expect(result.baseIcon.height).toBe(1024);
    expect(result.baseIcon.model).toBe('mock-model-e2e');

    const baseMeta = await sharp(result.baseIcon.path).metadata();
    expect(baseMeta.format).toBe('png');

    // All 3 platforms present
    expect(result.outputs.ios).toBeDefined();
    expect(result.outputs.macos).toBeDefined();
    expect(result.outputs.android).toBeDefined();
  });

  it('generates for specific platform only', async () => {
    const outDir = freshOutputDir('gar-ios');
    const result = await generateAndResize('ios only', {
      outputDir: outDir,
      platforms: ['ios'],
      generation: { model: createMockModel() },
    });

    expect(result.outputs.ios).toBeDefined();
    expect(result.outputs.macos).toBeUndefined();
    expect(result.outputs.android).toBeUndefined();
  });

  it('respects resize filter option', async () => {
    const outDir = freshOutputDir('gar-filter');
    const result = await generateAndResize('filter test', {
      outputDir: outDir,
      platforms: ['macos'],
      generation: { model: createMockModel() },
      resize: { resizeFilter: 'mitchell' },
    });

    // Should complete successfully with different filter
    expect(result.outputs.macos!.files).toHaveLength(10);

    // Verify actual images were written
    for (const filePath of result.outputs.macos!.files) {
      const meta = await sharp(filePath).metadata();
      expect(meta.format).toBe('png');
    }
  });

  it('respects quality option', async () => {
    const outDir = freshOutputDir('gar-quality');
    const result = await generateAndResize('quality test', {
      outputDir: outDir,
      platforms: ['ios'],
      generation: { model: createMockModel(), quality: 'draft' },
    });

    expect(result.outputs.ios!.files).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Suite 4: Error propagation
// ---------------------------------------------------------------------------

describe('E2E: error propagation', () => {
  it('maps doGenerate error to IconGenError through real pipeline', async () => {
    const outDir = freshOutputDir('err-generate');
    const model = createFailingModel(new Error('model failure'));

    await expect(generateIcon('test', { model, outputDir: outDir })).rejects.toMatchObject({
      code: 'API_ERROR',
      name: 'IconGenError',
    });
  });

  it('propagates error through generateAndResize', async () => {
    const outDir = freshOutputDir('err-gar');
    const model = createFailingModel(new Error('model failure'));

    await expect(generateAndResize('test', { outputDir: outDir, generation: { model } })).rejects.toBeInstanceOf(
      IconGenError,
    );
  });
});

// ---------------------------------------------------------------------------
// Suite 5: Android adaptive (manual strategy) — shared run
// ---------------------------------------------------------------------------

describe('E2E: Android adaptive (manual)', () => {
  let fgPath: string;
  let bgPath: string;
  let adaptiveOutDir: string;
  let adaptiveResult: GenerateAndResizeResult;

  beforeAll(async () => {
    const fixtureDir = path.join(tmpDir, 'adaptive-fixtures');
    await fs.mkdir(fixtureDir, { recursive: true });

    // 1024x1024 foreground with alpha
    fgPath = path.join(fixtureDir, 'fg.png');
    await sharp({
      create: { width: 1024, height: 1024, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 0.5 } },
    })
      .png()
      .toFile(fgPath);

    // 1024x1024 opaque background
    bgPath = path.join(fixtureDir, 'bg.png');
    await sharp({
      create: { width: 1024, height: 1024, channels: 3, background: { r: 0, g: 0, b: 255 } },
    })
      .png()
      .toFile(bgPath);

    // Single shared run
    adaptiveOutDir = freshOutputDir('adaptive-shared');
    adaptiveResult = await generateAndResize('adaptive test', {
      outputDir: adaptiveOutDir,
      platforms: ['android'],
      generation: { model: createMockModel() },
      androidAdaptive: {
        strategy: 'manual',
        foregroundPath: fgPath,
        backgroundPath: bgPath,
      },
    });
  });

  it('produces 5 densities x 2 layers + 1 XML = 11 adaptive files + 1 play-store', () => {
    expect(adaptiveResult.outputs.android).toBeDefined();
    expect(adaptiveResult.outputs.android!.files).toHaveLength(12);
  });

  it('foreground layers preserve alpha', async () => {
    for (const density of ANDROID_ADAPTIVE_DENSITIES) {
      const fgFile = path.join(adaptiveOutDir, 'android', 'adaptive', density.directory, 'ic_launcher_foreground.png');
      const meta = await sharp(fgFile).metadata();
      expect(meta.channels).toBe(4); // alpha preserved
      expect(meta.width).toBe(density.size);
      expect(meta.height).toBe(density.size);
    }
  });

  it('background layers are opaque', async () => {
    for (const density of ANDROID_ADAPTIVE_DENSITIES) {
      const bgFile = path.join(adaptiveOutDir, 'android', 'adaptive', density.directory, 'ic_launcher_background.png');
      const meta = await sharp(bgFile).metadata();
      expect(meta.channels).toBe(3); // opaque
      expect(meta.width).toBe(density.size);
      expect(meta.height).toBe(density.size);
    }
  });

  it('writes adaptive icon XML', async () => {
    const xmlPath = path.join(adaptiveOutDir, 'android', 'adaptive', 'mipmap-anydpi-v26', 'ic_launcher.xml');
    const content = await fs.readFile(xmlPath, 'utf-8');
    expect(content).toBe(ADAPTIVE_ICON_XML);
  });
});

// ---------------------------------------------------------------------------
// Suite 6: Android adaptive (auto strategy)
// ---------------------------------------------------------------------------

describe('E2E: Android adaptive (auto)', () => {
  it('generates adaptive layers with auto strategy and cleans up temp files', async () => {
    const outDir = freshOutputDir('adaptive-auto');
    const result = await generateAndResize('auto adaptive test', {
      outputDir: outDir,
      platforms: ['android'],
      generation: { model: createMockModel() },
      androidAdaptive: {
        strategy: 'auto',
        backgroundColor: '#FF5733',
      },
    });

    // 1 play-store + 11 adaptive = 12 total android files
    expect(result.outputs.android).toBeDefined();
    expect(result.outputs.android!.files).toHaveLength(12);

    // Verify adaptive layers exist with correct sizes
    for (const density of ANDROID_ADAPTIVE_DENSITIES) {
      const fgFile = path.join(outDir, 'android', 'adaptive', density.directory, 'ic_launcher_foreground.png');
      const bgFile = path.join(outDir, 'android', 'adaptive', density.directory, 'ic_launcher_background.png');

      const fgMeta = await sharp(fgFile).metadata();
      expect(fgMeta.width).toBe(density.size);
      expect(fgMeta.channels).toBe(4); // foreground preserves alpha

      const bgMeta = await sharp(bgFile).metadata();
      expect(bgMeta.width).toBe(density.size);
      expect(bgMeta.channels).toBe(3); // background is opaque
    }

    // Verify temp directory was cleaned up
    const tmpDirPath = path.join(outDir, 'android', 'adaptive', '_tmp');
    await expect(fs.access(tmpDirPath)).rejects.toThrow();
  });
});
