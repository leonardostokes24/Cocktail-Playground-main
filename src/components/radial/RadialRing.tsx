import React, { useEffect, useRef, useState } from 'react';

export interface Segment {
  id: string;
  label: string;
  icon: string;
  disabled?: boolean;
  color?: string;
}

interface Props {
  segments: Segment[];
  activeId?: string;
  onSelect: (id: string) => void;
  onEscape: () => void;
  radius?: number;
  size?: number;
}

export default function RadialRing({ segments, activeId, onSelect, onEscape, radius = 96, size = 64 }: Props) {
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onEscape(); return; }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex(i => (i + 1) % segments.length);
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex(i => (i - 1 + segments.length) % segments.length);
      }
      if (e.key === 'Enter' && focusedIndex >= 0) {
        const seg = segments[focusedIndex];
        if (!seg.disabled) onSelect(seg.id);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [segments, focusedIndex, onSelect, onEscape]);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: 0, height: 0 }}>
      {segments.map((seg, i) => {
        const angle = (i / segments.length) * 2 * Math.PI - Math.PI / 2;
        const cx = Math.cos(angle) * radius;
        const cy = Math.sin(angle) * radius;
        const isActive = seg.id === activeId;
        const isFocused = i === focusedIndex;
        const color = seg.color ?? 'rgba(127,230,255,0.7)';

        return (
          <button
            key={seg.id}
            disabled={seg.disabled}
            title={seg.label}
            onClick={(e) => { e.stopPropagation(); if (!seg.disabled) onSelect(seg.id); }}
            onMouseEnter={() => setFocusedIndex(i)}
            style={{
              position: 'absolute',
              left: cx - size / 2,
              top: cy - size / 2,
              width: size,
              height: size,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              borderRadius: '50%',
              border: `1px solid ${isActive || isFocused ? color : 'rgba(255,255,255,0.14)'}`,
              background: isActive || isFocused
                ? 'rgba(255,255,255,0.13)'
                : 'linear-gradient(168deg, rgba(255,255,255,.07), rgba(255,255,255,.02))',
              backdropFilter: 'blur(16px) saturate(135%)',
              WebkitBackdropFilter: 'blur(16px) saturate(135%)',
              boxShadow: isActive || isFocused
                ? `0 0 0 1px ${color}40, 0 8px 24px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.15)`
                : '0 8px 24px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.1)',
              color: seg.disabled ? 'var(--mute)' : (isActive || isFocused ? '#EEF0FA' : '#9296B4'),
              cursor: seg.disabled ? 'default' : 'pointer',
              opacity: seg.disabled ? 0.4 : 1,
              transition: 'transform 0.15s, border-color 0.15s, box-shadow 0.15s',
              transform: (isActive || isFocused) && !seg.disabled ? 'scale(1.12)' : 'scale(1)',
              fontFamily: 'var(--font-ui)',
            }}
          >
            <span style={{ fontSize: 20, lineHeight: 1 }}>{seg.icon}</span>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.03em', textAlign: 'center', lineHeight: 1.2 }}>
              {seg.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
