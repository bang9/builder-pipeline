import { describe, it, expect } from 'vitest';
import { IconGenError } from '../errors.js';
import type { IconGenErrorCode } from '../types.js';

describe('IconGenError', () => {
  it('has correct name', () => {
    const err = new IconGenError('test', 'API_ERROR');
    expect(err.name).toBe('IconGenError');
  });

  it('is instanceof Error', () => {
    const err = new IconGenError('test', 'API_ERROR');
    expect(err).toBeInstanceOf(Error);
  });

  it('stores code', () => {
    const err = new IconGenError('test', 'MISSING_API_KEY');
    expect(err.code).toBe('MISSING_API_KEY');
  });

  it('stores cause', () => {
    const cause = new Error('original');
    const err = new IconGenError('wrapped', 'API_ERROR', cause);
    expect(err.cause).toBe(cause);
  });

  it('has undefined cause when not provided', () => {
    const err = new IconGenError('test', 'API_ERROR');
    expect(err.cause).toBeUndefined();
  });

  it('supports all error codes', () => {
    const codes: IconGenErrorCode[] = [
      'MISSING_API_KEY',
      'UNSUPPORTED_PROVIDER',
      'RATE_LIMITED',
      'CONTENT_POLICY',
      'API_ERROR',
      'INVALID_SOURCE',
      'SOURCE_TOO_SMALL',
      'FILE_TOO_LARGE',
      'WRITE_ERROR',
    ];

    for (const code of codes) {
      const err = new IconGenError(`msg for ${code}`, code);
      expect(err.code).toBe(code);
      expect(err.message).toBe(`msg for ${code}`);
    }
  });
});
