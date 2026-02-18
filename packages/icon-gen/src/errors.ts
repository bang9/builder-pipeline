import type { IconGenErrorCode } from './types.js';

export class IconGenError extends Error {
  constructor(
    message: string,
    public readonly code: IconGenErrorCode,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'IconGenError';
  }
}
