import { describe, it, expect } from 'vitest';
import {
  IOS_SIZES,
  MACOS_SIZES,
  ANDROID_PLAY_STORE,
  ANDROID_ADAPTIVE_DENSITIES,
  ANDROID_PLAY_STORE_MAX_BYTES,
  ADAPTIVE_ICON_XML,
} from '../constants.js';

describe('IOS_SIZES', () => {
  it('has exactly 1 entry', () => {
    expect(IOS_SIZES).toHaveLength(1);
  });

  it('is 1024x1024 AppIcon.png', () => {
    expect(IOS_SIZES[0]).toEqual({ name: 'AppIcon.png', size: 1024 });
  });
});

describe('MACOS_SIZES', () => {
  it('has exactly 10 entries', () => {
    expect(MACOS_SIZES).toHaveLength(10);
  });

  it('has correct sizes in ascending order', () => {
    const sizes = MACOS_SIZES.map((e) => e.size);
    expect(sizes).toEqual([16, 32, 32, 64, 128, 256, 256, 512, 512, 1024]);
  });

  it('all files are in icon_*x*.png format', () => {
    for (const entry of MACOS_SIZES) {
      expect(entry.name).toMatch(/^icon_\d+x\d+(@2x)?\.png$/);
    }
  });
});

describe('ANDROID_PLAY_STORE', () => {
  it('is 512x512', () => {
    expect(ANDROID_PLAY_STORE.size).toBe(512);
  });

  it('is named play-store.png', () => {
    expect(ANDROID_PLAY_STORE.name).toBe('play-store.png');
  });
});

describe('ANDROID_ADAPTIVE_DENSITIES', () => {
  it('has 5 density buckets', () => {
    expect(ANDROID_ADAPTIVE_DENSITIES).toHaveLength(5);
  });

  it('has correct sizes', () => {
    const sizes = ANDROID_ADAPTIVE_DENSITIES.map((d) => d.size);
    expect(sizes).toEqual([108, 162, 216, 324, 432]);
  });

  it('has correct density names', () => {
    const densities = ANDROID_ADAPTIVE_DENSITIES.map((d) => d.density);
    expect(densities).toEqual(['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']);
  });

  it('has correct directory names', () => {
    const dirs = ANDROID_ADAPTIVE_DENSITIES.map((d) => d.directory);
    expect(dirs).toEqual(['mipmap-mdpi', 'mipmap-hdpi', 'mipmap-xhdpi', 'mipmap-xxhdpi', 'mipmap-xxxhdpi']);
  });
});

describe('ANDROID_PLAY_STORE_MAX_BYTES', () => {
  it('is 1024 KB', () => {
    expect(ANDROID_PLAY_STORE_MAX_BYTES).toBe(1024 * 1024);
  });
});

describe('ADAPTIVE_ICON_XML', () => {
  it('contains adaptive-icon element', () => {
    expect(ADAPTIVE_ICON_XML).toContain('<adaptive-icon');
  });

  it('references foreground and background drawables', () => {
    expect(ADAPTIVE_ICON_XML).toContain('@mipmap/ic_launcher_foreground');
    expect(ADAPTIVE_ICON_XML).toContain('@mipmap/ic_launcher_background');
  });
});
