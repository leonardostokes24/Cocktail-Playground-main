import type React from 'react';

// One colour vocabulary for ingredient types, shared by the spec node's recipe
// rows and the panel's component rows so a drink reads the same in both places.
export const TYPE_COLORS: Record<string, string> = {
  spirit:    'var(--type-spirit)',
  modifier:  'var(--type-modifier)',
  citrus:    'var(--type-citrus)',
  sweetener: 'var(--type-sweetener)',
  bitters:   'var(--type-bitters)',
};

export function typeDot(type: string | null | undefined, size = 6): React.CSSProperties {
  return {
    width: size, height: size, borderRadius: '50%', flexShrink: 0,
    background: (type && TYPE_COLORS[type]) || 'rgba(255,255,255,.3)',
  };
}
