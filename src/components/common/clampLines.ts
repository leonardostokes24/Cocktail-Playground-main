import type { CSSProperties } from 'react';

/**
 * Wrap text over up to `lines` lines instead of cutting it to one with an
 * ellipsis. Used for cocktail names, which regularly outrun the 232px node
 * ("Russian Spring Punch", "Champagne Cocktail", every "… (twist)" fork).
 *
 * `overflowWrap: anywhere` matters for the long unbroken strings that show up
 * in bar names — without it a single long word would still overflow the card.
 */
export function clampLines(lines: number): CSSProperties {
  return {
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: lines,
    overflow: 'hidden',
    overflowWrap: 'anywhere',
  };
}
