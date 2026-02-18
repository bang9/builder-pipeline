export interface SizeEntry {
  name: string;
  size: number;
}

export interface AdaptiveDensity {
  density: string;
  size: number;
  directory: string;
}

/** iOS: single 1024x1024 opaque PNG (Xcode 15+ generates all device sizes) */
export const IOS_SIZES: SizeEntry[] = [{ name: 'AppIcon.png', size: 1024 }];

/** macOS: 10 PNGs in AppIcon.iconset */
export const MACOS_SIZES: SizeEntry[] = [
  { name: 'icon_16x16.png', size: 16 },
  { name: 'icon_16x16@2x.png', size: 32 },
  { name: 'icon_32x32.png', size: 32 },
  { name: 'icon_32x32@2x.png', size: 64 },
  { name: 'icon_128x128.png', size: 128 },
  { name: 'icon_128x128@2x.png', size: 256 },
  { name: 'icon_256x256.png', size: 256 },
  { name: 'icon_256x256@2x.png', size: 512 },
  { name: 'icon_512x512.png', size: 512 },
  { name: 'icon_512x512@2x.png', size: 1024 },
];

/** Android Play Store icon */
export const ANDROID_PLAY_STORE: SizeEntry = { name: 'play-store.png', size: 512 };

/** Android adaptive icon densities */
export const ANDROID_ADAPTIVE_DENSITIES: AdaptiveDensity[] = [
  { density: 'mdpi', size: 108, directory: 'mipmap-mdpi' },
  { density: 'hdpi', size: 162, directory: 'mipmap-hdpi' },
  { density: 'xhdpi', size: 216, directory: 'mipmap-xhdpi' },
  { density: 'xxhdpi', size: 324, directory: 'mipmap-xxhdpi' },
  { density: 'xxxhdpi', size: 432, directory: 'mipmap-xxxhdpi' },
];

/** Android Play Store icon max file size in bytes */
export const ANDROID_PLAY_STORE_MAX_BYTES = 1024 * 1024; // 1024 KB

/** Adaptive icon XML content */
export const ADAPTIVE_ICON_XML = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;
