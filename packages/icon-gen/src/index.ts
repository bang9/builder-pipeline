// Functions
export { generateIcon } from './generate.js';
export { resizeForPlatform } from './resize.js';
export { generateAndResize } from './generate-and-resize.js';

// Types
export type {
  Platform,
  GenerationQuality,
  GenerateIconOptions,
  GenerateIconResult,
  ResizeOptions,
  ResizeResult,
  PlatformOutput,
  GenerateAndResizeOptions,
  GenerateAndResizeResult,
  AndroidAdaptiveOptions,
  IconGenErrorCode,
} from './types.js';

// Error class
export { IconGenError } from './errors.js';
