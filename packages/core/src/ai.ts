import type { ImageModelV3 } from '@ai-sdk/provider';
import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';

type ImageProvider = 'google' | 'openai';
type Quality = 'high' | 'draft';

const MODEL_MAP: Record<ImageProvider, Record<Quality, () => ImageModelV3>> = {
  google: {
    high: () => google.image('imagen-4.0-generate-preview-06-06'),
    draft: () => google.image('imagen-4.0-generate-preview-06-06'),
  },
  openai: {
    high: () => openai.image('gpt-image-1'),
    draft: () => openai.image('gpt-image-1-mini'),
  },
};

/**
 * Returns an AI image model based on `IMAGE_PROVIDER` env var and quality tier.
 * Throws immediately if the provider is unrecognized.
 * Does NOT validate API keys — that happens at call time.
 */
export function getImageModel(quality: Quality = 'high'): ImageModelV3 {
  const provider = (process.env.IMAGE_PROVIDER ?? 'google').toLowerCase() as string;
  const mapping = MODEL_MAP[provider as ImageProvider];

  if (!mapping) {
    throw new Error(`Unknown IMAGE_PROVIDER "${provider}". Supported: ${Object.keys(MODEL_MAP).join(', ')}`);
  }

  return mapping[quality]();
}

/**
 * Identifies the provider name from a model instance.
 * Returns "google", "openai", or "unknown".
 */
export function getProviderName(model: ImageModelV3): 'google' | 'openai' | 'unknown' {
  const id = model.modelId ?? '';
  const provider = model.provider ?? '';

  if (provider.includes('google') || id.includes('imagen')) return 'google';
  if (provider.includes('openai') || id.includes('gpt-image') || id.includes('dall-e')) return 'openai';

  return 'unknown';
}
