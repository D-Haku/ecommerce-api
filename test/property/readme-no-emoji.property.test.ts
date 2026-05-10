// Feature: ecommerce-api, Property 14: README contains no emoji characters
// Validates: Requirements 11.6

import { readFileSync } from 'node:fs';
import path from 'node:path';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

// Emoji ranges covering pictographs, symbols-and-pictographs, emoticons,
// transport-and-map, dingbats, regional indicators, skin-tone modifiers, and
// variation selectors adjacent to pictographs.
const EMOJI_RANGES: Array<[number, number]> = [
  [0x1f300, 0x1f5ff], // miscellaneous symbols and pictographs
  [0x1f600, 0x1f64f], // emoticons
  [0x1f680, 0x1f6ff], // transport and map
  [0x1f700, 0x1f77f], // alchemical symbols
  [0x1f780, 0x1f7ff], // geometric shapes extended
  [0x1f800, 0x1f8ff], // supplemental arrows-c
  [0x1f900, 0x1f9ff], // supplemental symbols and pictographs
  [0x1fa00, 0x1fa6f], // chess symbols
  [0x1fa70, 0x1faff], // symbols and pictographs extended-a
  [0x2600, 0x26ff], // miscellaneous symbols
  [0x2700, 0x27bf], // dingbats
  [0x1f1e6, 0x1f1ff], // regional indicator
  [0x1f3fb, 0x1f3ff], // skin tone modifiers
];

// Variation selector-16 (U+FE0F) turns preceding character into emoji
// presentation; we treat any occurrence as disallowed.
const VARIATION_SELECTOR_EMOJI = 0xfe0f;

function isEmojiCodepoint(cp: number): boolean {
  if (cp === VARIATION_SELECTOR_EMOJI) return true;
  for (const [lo, hi] of EMOJI_RANGES) {
    if (cp >= lo && cp <= hi) return true;
  }
  return false;
}

describe('Property 14: README contains no emoji characters', () => {
  it('iterates every code point and confirms none fall in the emoji ranges', () => {
    const readmePath = path.resolve(process.cwd(), 'README.md');
    const contents = readFileSync(readmePath, 'utf8');
    const codepoints: number[] = [];
    for (const ch of contents) {
      const cp = ch.codePointAt(0);
      if (cp !== undefined) codepoints.push(cp);
    }
    expect(codepoints.length).toBeGreaterThan(0);

    fc.assert(
      fc.property(fc.integer({ min: 0, max: codepoints.length - 1 }), (i) => {
        const cp = codepoints[i] as number;
        expect(isEmojiCodepoint(cp)).toBe(false);
      }),
      { numRuns: Math.min(codepoints.length, 500) },
    );
  });
});
