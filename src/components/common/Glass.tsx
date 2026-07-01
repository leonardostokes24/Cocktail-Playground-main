import React from 'react';

interface GlassProps extends React.HTMLAttributes<HTMLDivElement> {
  selected?: boolean;
  sheen?: boolean;
  children: React.ReactNode;
}

/**
 * The reusable chroma-glass material — fill, blur, and edge-cyan/magenta
 * dispersion. Selected state tightens the border into a cyan glow.
 */
export default function Glass({ selected = false, sheen = false, style, className, children, ...rest }: GlassProps) {
  return (
    <div
      className={['glass-hover-lift', sheen ? 'glass-sheen' : '', className].filter(Boolean).join(' ')}
      style={{
        background: 'var(--glass-fill)',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        border: `1px solid ${selected ? 'rgba(127,230,255,0.5)' : 'var(--glass-border)'}`,
        borderRadius: 14,
        boxShadow: selected
          ? 'inset 1px 0 0 var(--edge-cyan), inset -1px 0 0 var(--edge-magenta), inset 0 1px 0 var(--edge-top), 0 0 0 1px rgba(127,230,255,0.25), 0 28px 56px -28px rgba(0,0,0,.85)'
          : 'inset 1px 0 0 var(--edge-cyan), inset -1px 0 0 var(--edge-magenta), inset 0 1px 0 var(--edge-top), 0 28px 56px -28px rgba(0,0,0,.85)',
        transition: 'transform 0.4s cubic-bezier(.2,.7,.2,1), border-color 0.2s, box-shadow 0.2s',
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
