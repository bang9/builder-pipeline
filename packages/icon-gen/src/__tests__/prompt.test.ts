import { describe, it, expect } from 'vitest';
import { buildIconPrompt } from '../prompt.js';

describe('buildIconPrompt', () => {
  it('builds an opaque background prompt', () => {
    const result = buildIconPrompt('a cute cat', { background: 'opaque' });
    expect(result).toContain('a cute cat');
    expect(result).toContain('Use a solid, clean background.');
    expect(result).not.toContain('transparent');
    expect(result).not.toContain('61%');
  });

  it('builds a transparent background prompt', () => {
    const result = buildIconPrompt('a rocket ship', { background: 'transparent' });
    expect(result).toContain('a rocket ship');
    expect(result).toContain('Use a transparent background.');
    expect(result).not.toContain('solid, clean');
  });

  it('appends adaptive foreground instructions', () => {
    const result = buildIconPrompt('a star', { background: 'transparent', adaptive: true });
    expect(result).toContain('center 61%');
    expect(result).toContain('66dp safe zone');
    expect(result).toContain('generous empty margins');
  });

  it('does not include adaptive instructions by default', () => {
    const result = buildIconPrompt('a flower', { background: 'opaque' });
    expect(result).not.toContain('61%');
    expect(result).not.toContain('safe zone');
  });

  it('includes standard icon requirements', () => {
    const result = buildIconPrompt('anything', { background: 'opaque' });
    expect(result).toContain('No text, no letters, no words, no watermarks');
    expect(result).toContain('No rounded corners');
    expect(result).toContain('Square 1:1 aspect ratio');
    expect(result).toContain('vibrant colors');
  });
});
