import React, { useEffect, useState } from 'react';

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
  size?: number; // ignored — kept for compat
}

// Per-segment tint (matches design_handoff_proof prototype exactly)
function tintStyle(id: string): { bg: string; border: string; color: string; iconColor: string } {
  if (id === 'branch') return {
    bg:        'linear-gradient(168deg, rgba(127,230,255,.16), rgba(127,230,255,.05))',
    border:    '1px solid rgba(127,230,255,.34)',
    color:     '#eaf9ff',
    iconColor: '#bfeeff',
  };
  if (id === 'publish') return {
    bg:        'linear-gradient(168deg, rgba(255,135,210,.14), rgba(255,135,210,.04))',
    border:    '1px solid rgba(255,135,210,.32)',
    color:     '#ffd6f0',
    iconColor: '#ffb3e2',
  };
  if (id === 'delete' || id === 'confirm') return {
    bg:        'linear-gradient(168deg, rgba(255,255,255,.09), rgba(255,255,255,.03))',
    border:    '1px solid rgba(255,255,255,.14)',
    color:     'rgba(255,190,190,.9)',
    iconColor: 'rgba(255,150,150,.85)',
  };
  return {
    bg:        'linear-gradient(168deg, rgba(255,255,255,.09), rgba(255,255,255,.03))',
    border:    '1px solid rgba(255,255,255,.14)',
    color:     'rgba(240,238,250,.9)',
    iconColor: 'rgba(230,228,245,.85)',
  };
}

export default function RadialRing({ segments, activeId, onSelect, onEscape, radius = 118 }: Props) {
  const [focusedIndex, setFocusedIndex] = useState(-1);

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
    <div style={{ position: 'relative', width: 0, height: 0 }}>
      {segments.map((seg, i) => {
        const angle = (i / segments.length) * 2 * Math.PI - Math.PI / 2;
        const cx = Math.cos(angle) * radius;
        const cy = Math.sin(angle) * radius;
        const isFocused = i === focusedIndex || seg.id === activeId;
        const t = tintStyle(seg.id);

        return (
          <button
            key={seg.id}
            disabled={seg.disabled}
            title={seg.label}
            onClick={(e) => { e.stopPropagation(); if (!seg.disabled) onSelect(seg.id); }}
            onMouseEnter={() => setFocusedIndex(i)}
            onMouseLeave={() => setFocusedIndex(-1)}
            style={{
              position: 'absolute',
              left: cx - 48,        // 96px wide, centred
              top: cy - 18,         // ~36px tall (9+9 padding + content), centred
              width: 96,
              padding: '9px 8px',
              borderRadius: 12,
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              background: t.bg,
              border: t.border,
              boxShadow: isFocused && !seg.disabled
                ? 'inset 0 1px 0 rgba(255,255,255,.28), 0 12px 26px -10px rgba(0,0,0,.8)'
                : 'inset 0 1px 0 rgba(255,255,255,.2), 0 12px 26px -12px rgba(0,0,0,.7)',
              cursor: seg.disabled ? 'default' : 'pointer',
              opacity: seg.disabled ? 0.35 : 1,
              transform: isFocused && !seg.disabled ? 'scale(1.06)' : 'scale(1)',
              transition: 'transform 0.12s, box-shadow 0.12s',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              fontFamily: 'var(--font-ui)',
            }}
          >
            <span style={{ fontSize: 15, lineHeight: 1, color: t.iconColor }}>{seg.icon}</span>
            <span style={{ font: '600 11px var(--font-ui)', color: t.color, letterSpacing: '0.01em' }}>
              {seg.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
