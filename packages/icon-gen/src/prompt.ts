export interface BuildIconPromptOptions {
  background: 'opaque' | 'transparent';
  adaptive?: boolean;
}

export function buildIconPrompt(userPrompt: string, options: BuildIconPromptOptions): string {
  const bgInstruction =
    options.background === 'transparent' ? 'Use a transparent background.' : 'Use a solid, clean background.';

  const lines = [
    'Generate a mobile app icon with the following description:',
    userPrompt,
    '',
    'Requirements:',
    '- Simple, clean vector/flat illustration style',
    '- No text, no letters, no words, no watermarks',
    '- No rounded corners (the OS applies masking automatically)',
    '- Centered composition with balanced margins',
    `- ${bgInstruction}`,
    '- High contrast, vibrant colors suitable for small display sizes',
    '- Square 1:1 aspect ratio',
  ];

  if (options.adaptive) {
    lines.push(
      '- Place the main subject within the center 61% of the canvas (66dp safe zone of the 108dp adaptive icon)',
      '- Leave generous empty margins on all sides for OS-level masking',
    );
  }

  return lines.join('\n');
}
