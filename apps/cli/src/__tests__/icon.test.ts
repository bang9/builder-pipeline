import { describe, it, expect } from 'vitest';
import { InvalidArgumentError } from 'commander';
import { IconGenError } from '@builder-pipeline/icon-gen';
import { parsePlatforms, formatErrorMessage } from '../commands/icon.js';

describe('parsePlatforms', () => {
  it('parses comma-separated platforms', () => {
    expect(parsePlatforms('ios,macos')).toEqual(['ios', 'macos']);
  });

  it('trims whitespace around platform names', () => {
    expect(parsePlatforms('ios , macos , android')).toEqual(['ios', 'macos', 'android']);
  });

  it('handles single platform', () => {
    expect(parsePlatforms('ios')).toEqual(['ios']);
  });

  it('throws InvalidArgumentError for invalid platform', () => {
    expect(() => parsePlatforms('ios,windows')).toThrow(InvalidArgumentError);
    expect(() => parsePlatforms('ios,windows')).toThrow('Invalid platform "windows"');
  });

  it('throws InvalidArgumentError for empty string', () => {
    expect(() => parsePlatforms('')).toThrow(InvalidArgumentError);
    expect(() => parsePlatforms('')).toThrow('At least one platform is required');
  });

  it('throws InvalidArgumentError for only commas', () => {
    expect(() => parsePlatforms(',,')).toThrow(InvalidArgumentError);
    expect(() => parsePlatforms(',,')).toThrow('At least one platform is required');
  });

  it('accepts all three valid platforms', () => {
    expect(parsePlatforms('ios,macos,android')).toEqual(['ios', 'macos', 'android']);
  });
});

describe('formatErrorMessage', () => {
  it('maps known error codes to user-friendly messages', () => {
    const err = new IconGenError('API key not configured', 'MISSING_API_KEY');
    const msg = formatErrorMessage(err);
    expect(msg).toContain('API key not configured. Set GOOGLE_API_KEY or OPENAI_API_KEY in .env');
  });

  it('appends original message when it differs from base', () => {
    const err = new IconGenError('Rate limited by provider', 'RATE_LIMITED');
    const msg = formatErrorMessage(err);
    expect(msg).toBe('Rate limited. Please wait and try again: Rate limited by provider');
  });

  it('returns base message only when original matches', () => {
    const err = new IconGenError('Image generation failed', 'API_ERROR');
    const msg = formatErrorMessage(err);
    expect(msg).toBe('Image generation failed');
  });

  it('falls back to error code for unknown codes', () => {
    const err = new IconGenError('something', 'UNKNOWN_CODE' as any);
    const msg = formatErrorMessage(err);
    expect(msg).toBe('UNKNOWN_CODE: something');
  });

  it('maps all known error codes', () => {
    const codes = [
      'MISSING_API_KEY',
      'UNSUPPORTED_PROVIDER',
      'RATE_LIMITED',
      'CONTENT_POLICY',
      'API_ERROR',
      'INVALID_SOURCE',
      'SOURCE_TOO_SMALL',
      'FILE_TOO_LARGE',
      'WRITE_ERROR',
    ] as const;

    for (const code of codes) {
      const err = new IconGenError('detail', code);
      const msg = formatErrorMessage(err);
      // Should not fall back to raw code
      expect(msg).not.toBe(code);
      expect(msg.startsWith(`${code}:`)).toBe(false);
    }
  });
});
