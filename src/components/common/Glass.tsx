import React from 'react';

interface GlassProps extends React.HTMLAttributes<HTMLDivElement> {
  selected?: boolean;
  sheen?: boolean;
  variant?: 'node' | 'panel';
  children: React.ReactNode;
}

export default function Glass({
  selected = false,
  sheen = false,
  variant = 'node',
  style,
  className,
  children,
  ...rest
}: GlassProps) {
  const base = variant === 'panel' ? 'glass-panel' : `glass${selected ? ' glass--selected' : ''}`;
  const classes = [base, sheen ? 'glass-sheen' : '', 'glass-hover-lift', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} style={style} {...rest}>
      {children}
    </div>
  );
}
