import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import sharp from 'sharp';
import { IconGenError } from '../errors.js';

// Mock the AI SDK
vi.mock('ai', () => {
  class APICallError extends Error {
    statusCode?: number;
    responseBody?: string;
    url = 'https://api.example.com';
    requestBodyValues = {};
    isRetryable = false;
    constructor(opts: { message: string; statusCode?: number; responseBody?: string }) {
      super(opts.message);
      this.name = 'APICallError';
      this.statusCode = opts.statusCode;
      this.responseBody = opts.responseBody;
    }
  }
  return {
    generateImage: vi.fn(),
    APICallError,
  };
});

// Mock core
vi.mock('@builder-pipeline/core', () => ({
  getImageModel: vi.fn(() => ({
    modelId: 'mock-model',
    provider: 'mock-provider',
    specificationVersion: 'v3',
    maxImagesPerCall: 1,
    doGenerate: vi.fn(),
  })),
  getProviderName: vi.fn(() => 'openai'),
}));

import { generateIcon } from '../generate.js';
import { generateImage, APICallError } from 'ai';
import { getProviderName } from '@builder-pipeline/core';

const mockedGenerateImage = vi.mocked(generateImage);
const mockedGetProviderName = vi.mocked(getProviderName);

let tmpDir: string;
let pngBuffer: Buffer;

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gen-test-'));
  // Create a 1024x1024 PNG buffer for mock responses
  pngBuffer = await sharp({
    create: { width: 1024, height: 1024, channels: 4, background: { r: 100, g: 100, b: 100, alpha: 1 } },
  })
    .png()
    .toBuffer();
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

afterEach(() => {
  vi.clearAllMocks();
  mockedGetProviderName.mockReturnValue('openai');
});

function mockSuccessfulGeneration(buffer?: Buffer) {
  mockedGenerateImage.mockResolvedValue({
    image: { uint8Array: new Uint8Array(buffer ?? pngBuffer), base64: '', mediaType: 'image/png' },
    images: [],
    responses: [{ modelId: 'test-model-id', timestamp: new Date(), headers: {} }],
    warnings: [],
    providerMetadata: {},
    usage: { inputTokens: 0, outputTokens: 0 },
  } as any);
}

describe('generateIcon - validation', () => {
  it('throws TypeError for empty string prompt', async () => {
    await expect(generateIcon('')).rejects.toThrow(TypeError);
  });

  it('throws TypeError for non-string prompt', async () => {
    await expect(generateIcon(42 as any)).rejects.toThrow(TypeError);
  });

  it('throws TypeError for filename with path separators', async () => {
    mockSuccessfulGeneration();
    await expect(
      generateIcon('test', { filename: '../evil', outputDir: path.join(tmpDir, 'sep-test') }),
    ).rejects.toThrow('filename must not contain path separators');
  });
});

describe('generateIcon - transparency check', () => {
  it('throws UNSUPPORTED_PROVIDER for Google + transparent background', async () => {
    mockedGetProviderName.mockReturnValue('google');
    await expect(
      generateIcon('test', { background: 'transparent', outputDir: path.join(tmpDir, 'trans-test') }),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_PROVIDER' });
  });

  it('allows transparent background with non-Google provider', async () => {
    mockedGetProviderName.mockReturnValue('openai');
    mockSuccessfulGeneration();
    const result = await generateIcon('test', {
      background: 'transparent',
      outputDir: path.join(tmpDir, 'trans-ok'),
    });
    expect(result.path).toBeDefined();
  });
});

describe('generateIcon - successful generation', () => {
  it('returns correct result structure', async () => {
    mockSuccessfulGeneration();
    const result = await generateIcon('a cute cat', { outputDir: path.join(tmpDir, 'success') });
    expect(result.path).toContain('icon-base.png');
    expect(result.width).toBe(1024);
    expect(result.height).toBe(1024);
    expect(result.model).toBe('test-model-id');
  });

  it('writes valid PNG to disk', async () => {
    mockSuccessfulGeneration();
    const outDir = path.join(tmpDir, 'write-test');
    const result = await generateIcon('test', { outputDir: outDir });
    const meta = await sharp(result.path).metadata();
    expect(meta.format).toBe('png');
    expect(meta.width).toBe(1024);
    expect(meta.height).toBe(1024);
  });

  it('uses custom filename', async () => {
    mockSuccessfulGeneration();
    const result = await generateIcon('test', {
      outputDir: path.join(tmpDir, 'custom-name'),
      filename: 'my-icon',
    });
    expect(path.basename(result.path)).toBe('my-icon.png');
  });

  it('normalizes non-1024x1024 images', async () => {
    const smallBuffer = await sharp({
      create: { width: 512, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } },
    })
      .png()
      .toBuffer();
    mockSuccessfulGeneration(smallBuffer);
    const result = await generateIcon('test', { outputDir: path.join(tmpDir, 'normalize') });
    const meta = await sharp(result.path).metadata();
    expect(meta.width).toBe(1024);
    expect(meta.height).toBe(1024);
  });

  it('returns "unknown" when responses array is empty', async () => {
    mockedGenerateImage.mockResolvedValue({
      image: { uint8Array: new Uint8Array(pngBuffer), base64: '', mediaType: 'image/png' },
      images: [],
      responses: [],
      warnings: [],
      providerMetadata: {},
      usage: { inputTokens: 0, outputTokens: 0 },
    } as any);
    const result = await generateIcon('test', { outputDir: path.join(tmpDir, 'empty-resp') });
    expect(result.model).toBe('unknown');
  });
});

describe('generateIcon - error mapping', () => {
  it('maps APICallError 401 to MISSING_API_KEY', async () => {
    const err = new APICallError({ message: 'Unauthorized', statusCode: 401 });
    mockedGenerateImage.mockRejectedValue(err);
    await expect(generateIcon('test', { outputDir: path.join(tmpDir, 'e401') })).rejects.toMatchObject({
      code: 'MISSING_API_KEY',
    });
  });

  it('maps APICallError 403 to MISSING_API_KEY', async () => {
    const err = new APICallError({ message: 'Forbidden', statusCode: 403 });
    mockedGenerateImage.mockRejectedValue(err);
    await expect(generateIcon('test', { outputDir: path.join(tmpDir, 'e403') })).rejects.toMatchObject({
      code: 'MISSING_API_KEY',
    });
  });

  it('maps APICallError 429 to RATE_LIMITED', async () => {
    const err = new APICallError({ message: 'Too many requests', statusCode: 429 });
    mockedGenerateImage.mockRejectedValue(err);
    await expect(generateIcon('test', { outputDir: path.join(tmpDir, 'e429') })).rejects.toMatchObject({
      code: 'RATE_LIMITED',
    });
  });

  it('maps APICallError 400 with safety to CONTENT_POLICY', async () => {
    const err = new APICallError({
      message: 'Bad request',
      statusCode: 400,
      responseBody: '{"error": "safety filter triggered"}',
    });
    mockedGenerateImage.mockRejectedValue(err);
    await expect(generateIcon('test', { outputDir: path.join(tmpDir, 'e400') })).rejects.toMatchObject({
      code: 'CONTENT_POLICY',
    });
  });

  it('maps generic "api key" error to MISSING_API_KEY', async () => {
    mockedGenerateImage.mockRejectedValue(new Error('Missing api key for provider'));
    await expect(generateIcon('test', { outputDir: path.join(tmpDir, 'ekey') })).rejects.toMatchObject({
      code: 'MISSING_API_KEY',
    });
  });

  it('maps generic "rate limit" error to RATE_LIMITED', async () => {
    mockedGenerateImage.mockRejectedValue(new Error('Rate limit exceeded'));
    await expect(generateIcon('test', { outputDir: path.join(tmpDir, 'erate') })).rejects.toMatchObject({
      code: 'RATE_LIMITED',
    });
  });

  it('maps generic "content policy" error to CONTENT_POLICY', async () => {
    mockedGenerateImage.mockRejectedValue(new Error('Content policy violation'));
    await expect(generateIcon('test', { outputDir: path.join(tmpDir, 'epolicy') })).rejects.toMatchObject({
      code: 'CONTENT_POLICY',
    });
  });

  it('wraps unknown errors as API_ERROR', async () => {
    mockedGenerateImage.mockRejectedValue(new Error('Something unexpected'));
    await expect(generateIcon('test', { outputDir: path.join(tmpDir, 'eunk') })).rejects.toMatchObject({
      code: 'API_ERROR',
    });
  });

  it('re-throws IconGenError without wrapping', async () => {
    const original = new IconGenError('test error', 'UNSUPPORTED_PROVIDER');
    mockedGenerateImage.mockRejectedValue(original);
    await expect(generateIcon('test', { outputDir: path.join(tmpDir, 'erethrow') })).rejects.toBe(original);
  });
});
