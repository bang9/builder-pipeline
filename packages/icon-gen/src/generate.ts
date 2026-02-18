import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { generateImage, APICallError } from 'ai';
import { getImageModel, getProviderName } from '@builder-pipeline/core';
import sharp from 'sharp';
import { IconGenError } from './errors.js';
import { buildIconPrompt } from './prompt.js';
import type { GenerateIconOptions, GenerateIconResult } from './types.js';

export async function generateIcon(prompt: string, options?: GenerateIconOptions): Promise<GenerateIconResult> {
  if (!prompt || typeof prompt !== 'string') {
    throw new TypeError('Prompt must be a non-empty string');
  }

  const quality = options?.quality ?? 'high';
  const background = options?.background ?? 'opaque';
  const rawFilename = options?.filename ?? 'icon-base';
  const filename = path.basename(rawFilename);
  if (filename !== rawFilename) {
    throw new TypeError('filename must not contain path separators');
  }
  const outputDir = options?.outputDir ?? (await fs.mkdtemp(path.join(os.tmpdir(), 'icon-gen-')));

  const model = options?.model ?? getImageModel(quality);

  // Transparency provider check
  if (background === 'transparent') {
    const providerName = getProviderName(model);
    if (providerName === 'google') {
      throw new IconGenError(
        'Google Imagen does not support transparent backgrounds. ' +
          'Set IMAGE_PROVIDER=openai or pass a custom model that supports transparency.',
        'UNSUPPORTED_PROVIDER',
      );
    }
  }

  await fs.mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `${filename}.png`);

  try {
    const { image, responses } = await generateImage({
      model,
      prompt: buildIconPrompt(prompt, { background }),
      size: '1024x1024',
      abortSignal: options?.signal,
      providerOptions: {
        openai: {
          quality: quality === 'draft' ? 'low' : 'high',
          background: background === 'transparent' ? 'transparent' : 'opaque',
          output_format: 'png',
        },
      },
    });

    let finalBuffer: Uint8Array = image.uint8Array;

    // Validate and normalize dimensions — sharp accepts Uint8Array directly
    const metadata = await sharp(finalBuffer).metadata();
    if (metadata.width !== 1024 || metadata.height !== 1024) {
      finalBuffer = await sharp(finalBuffer).resize(1024, 1024, { kernel: 'lanczos3' }).png().toBuffer();
    }

    await fs.writeFile(outputPath, finalBuffer);

    const modelId = responses[0]?.modelId ?? 'unknown';

    return {
      path: outputPath,
      width: 1024,
      height: 1024,
      model: modelId,
    };
  } catch (err) {
    if (err instanceof IconGenError) throw err;

    // Structured check: Vercel AI SDK typed errors
    if (err instanceof APICallError) {
      if (err.statusCode === 401 || err.statusCode === 403) {
        throw new IconGenError('API key not configured or invalid', 'MISSING_API_KEY', err);
      }
      if (err.statusCode === 429) {
        throw new IconGenError('Rate limited by provider', 'RATE_LIMITED', err);
      }
      if (err.statusCode === 400 && typeof err.responseBody === 'string' && err.responseBody.includes('safety')) {
        throw new IconGenError('Prompt rejected by content policy', 'CONTENT_POLICY', err);
      }
    }

    // Fallback: string matching
    if (err instanceof Error) {
      const msg = err.message.toLowerCase();
      if (msg.includes('api key') || msg.includes('unauthorized')) {
        throw new IconGenError('API key not configured', 'MISSING_API_KEY', err);
      }
      if (msg.includes('rate limit')) {
        throw new IconGenError('Rate limited by provider', 'RATE_LIMITED', err);
      }
      if (msg.includes('content policy') || msg.includes('safety')) {
        throw new IconGenError('Prompt rejected by content policy', 'CONTENT_POLICY', err);
      }
    }

    // Catch-all
    throw new IconGenError('Image generation failed', 'API_ERROR', err);
  }
}
