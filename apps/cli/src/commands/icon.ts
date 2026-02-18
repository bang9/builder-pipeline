import path from 'node:path';
import { Command, Option, InvalidArgumentError } from 'commander';
import {
  generateAndResize,
  IconGenError,
  type Platform,
  type GenerateAndResizeOptions,
} from '@builder-pipeline/icon-gen';
import { getImageModel } from '@builder-pipeline/core';
import { spinner, success, info, error, dim } from '../utils/logger.js';

const ERROR_MESSAGES: Record<string, string> = {
  MISSING_API_KEY: 'API key not configured. Set GOOGLE_GENERATIVE_AI_API_KEY or OPENAI_API_KEY in .env',
  UNSUPPORTED_PROVIDER: 'Current provider does not support this feature',
  RATE_LIMITED: 'Rate limited. Please wait and try again',
  CONTENT_POLICY: 'Prompt rejected by content policy. Try a different prompt',
  API_ERROR: 'Image generation failed',
  INVALID_SOURCE: 'Invalid source image',
  SOURCE_TOO_SMALL: 'Source image too small',
  FILE_TOO_LARGE: 'Output file exceeds size limit',
  WRITE_ERROR: 'Cannot write to output directory',
};

export function formatErrorMessage(err: IconGenError): string {
  const base = ERROR_MESSAGES[err.code] ?? err.code;
  // Append the original message if it provides extra detail
  if (err.message && err.message !== base) {
    return `${base}: ${err.message}`;
  }
  return base;
}

const VALID_PLATFORMS: Platform[] = ['ios', 'macos', 'android'];

export function parsePlatforms(value: string): Platform[] {
  const platforms = value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (platforms.length === 0) {
    throw new InvalidArgumentError('At least one platform is required');
  }
  for (const p of platforms) {
    if (!(VALID_PLATFORMS as string[]).includes(p)) {
      throw new InvalidArgumentError(`Invalid platform "${p}". Valid: ${VALID_PLATFORMS.join(', ')}`);
    }
  }
  return platforms as Platform[];
}

export const iconCommand = new Command('icon')
  .description('Generate app icons from a text prompt')
  .argument('<prompt>', 'Description of the icon to generate')
  .requiredOption('-o, --output <dir>', 'Output directory')
  .option('-p, --platforms <list>', 'Target platforms (comma-separated)', parsePlatforms, VALID_PLATFORMS)
  .addOption(new Option('-q, --quality <tier>', 'Generation quality').choices(['high', 'draft']).default('high'))
  .addOption(
    new Option('-b, --background <style>', 'Background style').choices(['opaque', 'transparent']).default('opaque'),
  )
  .addOption(
    new Option('--resize-filter <filter>', 'Resize filter')
      .choices(['lanczos3', 'lanczos2', 'mitchell'])
      .default('lanczos3'),
  )
  .addOption(new Option('--adaptive <strategy>', 'Android adaptive icon strategy').choices(['auto', 'manual']))
  .option('--adaptive-bg-color <hex>', 'Adaptive icon background color', '#FFFFFF')
  .option('--adaptive-fg <path>', 'Adaptive icon foreground image path')
  .option('--adaptive-bg <path>', 'Adaptive icon background image path')
  .action(async (prompt: string, opts) => {
    const outputDir = path.resolve(opts.output);
    const platforms: Platform[] = opts.platforms;
    const quality: 'high' | 'draft' = opts.quality;
    const background: 'opaque' | 'transparent' = opts.background;
    const resizeFilter: 'lanczos3' | 'lanczos2' | 'mitchell' = opts.resizeFilter;

    const options: GenerateAndResizeOptions = {
      outputDir,
      platforms,
      generation: {
        model: getImageModel(quality),
        quality,
        background,
      },
      resize: { resizeFilter },
    };

    // Build androidAdaptive only when --adaptive is specified
    if (opts.adaptive) {
      if (opts.adaptive === 'manual') {
        options.androidAdaptive = {
          strategy: 'manual',
          foregroundPath: opts.adaptiveFg,
          backgroundPath: opts.adaptiveBg,
        };
      } else {
        options.androidAdaptive = {
          strategy: 'auto',
          backgroundColor: opts.adaptiveBgColor,
        };
      }
    }

    const spin = spinner('Generating icon...');

    try {
      const result = await generateAndResize(prompt, options);
      spin.stop(`Icon generated (model: ${result.baseIcon.model})`);

      const rel = (p: string) => path.relative(process.cwd(), p);

      // Base icon
      console.log();
      info(`Base: ${rel(result.baseIcon.path)} (${result.baseIcon.width}x${result.baseIcon.height})`);

      // Platform outputs
      for (const platform of platforms) {
        const output = result.outputs[platform];
        if (!output) continue;

        console.log();
        const fileCount = output.files.length;
        info(
          `${platform.charAt(0).toUpperCase() + platform.slice(1)} ${dim(`(${fileCount} file${fileCount !== 1 ? 's' : ''}):`)}`,
        );

        if (platform === 'macos' && output.directory) {
          console.log(`    ${rel(output.directory)}/AppIcon.iconset/`);
        } else {
          for (const filePath of output.files) {
            console.log(`    ${rel(filePath)}`);
          }
        }
      }

      console.log();
    } catch (err) {
      spin.stop();

      if (err instanceof IconGenError) {
        error(formatErrorMessage(err));
      } else if (err instanceof TypeError) {
        error(err.message);
      } else {
        error(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
      }

      process.exitCode = 1;
    }
  });
