import { describe, it, expect, afterEach } from 'vitest';
import { getImageModel, getProviderName } from '../ai.js';

const originalEnv = process.env.IMAGE_PROVIDER;

afterEach(() => {
  if (originalEnv === undefined) {
    delete process.env.IMAGE_PROVIDER;
  } else {
    process.env.IMAGE_PROVIDER = originalEnv;
  }
});

describe('getImageModel', () => {
  it('defaults to google when IMAGE_PROVIDER is not set', () => {
    delete process.env.IMAGE_PROVIDER;
    const model = getImageModel();
    expect(model).toBeDefined();
    expect(model.modelId).toContain('imagen');
  });

  it('returns google model when IMAGE_PROVIDER=google', () => {
    process.env.IMAGE_PROVIDER = 'google';
    const model = getImageModel('high');
    expect(model.modelId).toContain('imagen');
  });

  it('returns openai model when IMAGE_PROVIDER=openai', () => {
    process.env.IMAGE_PROVIDER = 'openai';
    const model = getImageModel('high');
    expect(model.modelId).toContain('gpt-image-1');
  });

  it('returns openai draft model for quality=draft', () => {
    process.env.IMAGE_PROVIDER = 'openai';
    const model = getImageModel('draft');
    expect(model.modelId).toContain('gpt-image-1-mini');
  });

  it('returns same google model for both quality tiers', () => {
    process.env.IMAGE_PROVIDER = 'google';
    const high = getImageModel('high');
    const draft = getImageModel('draft');
    expect(high.modelId).toBe(draft.modelId);
  });

  it('throws for unknown provider', () => {
    process.env.IMAGE_PROVIDER = 'midjourney';
    expect(() => getImageModel()).toThrow('Unknown IMAGE_PROVIDER "midjourney"');
  });

  it('is case-insensitive for provider name', () => {
    process.env.IMAGE_PROVIDER = 'Google';
    const model = getImageModel();
    expect(model.modelId).toContain('imagen');
  });
});

describe('getProviderName', () => {
  it('detects google provider', () => {
    delete process.env.IMAGE_PROVIDER;
    const model = getImageModel();
    expect(getProviderName(model)).toBe('google');
  });

  it('detects openai provider', () => {
    process.env.IMAGE_PROVIDER = 'openai';
    const model = getImageModel();
    expect(getProviderName(model)).toBe('openai');
  });

  it('returns unknown for unrecognized model', () => {
    const fakeModel = { modelId: 'some-custom-model', provider: 'custom' } as any;
    expect(getProviderName(fakeModel)).toBe('unknown');
  });
});
