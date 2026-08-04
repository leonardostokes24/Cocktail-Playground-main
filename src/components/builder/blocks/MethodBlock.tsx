import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { METHODS } from '../../../utils/calculations';

interface Props {
  method: string | null;
  onChangeMethod: (method: string) => void;
  isEmpty: boolean;
  children: React.ReactNode;
}

/**
 * The container block. There is exactly one, because the schema stores a single
 * `specs.method` — the technique wraps the whole pour, and its dilution factor
 * drives volume/ABV. Its slot is the well the component blocks live in.
 */
export default function MethodBlock({ method, onChangeMethod, isEmpty, children }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: 'method-slot' });
  const active = method ?? 'built';

  return (
    <div style={wrap}>
      <div style={lip}>
        <span style={label}>Technique</span>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {METHODS.map(m => (
            <button
              key={m}
              onClick={() => onChangeMethod(m)}
              style={methodChip(m === active)}
              aria-pressed={m === active}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={`blk-well${isOver ? ' blk-well--over' : ''}`}
      >
        {isEmpty ? (
          <div style={empty}>
            Drag an ingredient here, or tap one in the palette.
          </div>
        ) : children}
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = {
  borderRadius: 12,
  background: 'rgba(255,255,255,.05)',
  border: '1px solid rgba(255,255,255,.13)',
  borderLeft: '3px solid rgba(127,230,255,.4)', // containers are marked by an edge, not a hue
  padding: 10,
};

const lip: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
  padding: '0 2px 10px',
};

const label: React.CSSProperties = {
  fontFamily: 'var(--font-ui)', fontSize: 9, fontWeight: 700,
  letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-muted)',
};

const methodChip = (active: boolean): React.CSSProperties => ({
  fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: active ? 700 : 500,
  color: active ? '#0c0b14' : 'var(--text-2)',
  background: active ? 'rgba(230,235,245,.92)' : 'rgba(255,255,255,.06)',
  border: `1px solid ${active ? 'transparent' : 'rgba(255,255,255,.12)'}`,
  borderRadius: 7, padding: '7px 12px', cursor: 'pointer',
  textTransform: 'capitalize', minHeight: 32,
});

const empty: React.CSSProperties = {
  fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-muted)',
  textAlign: 'center', padding: '22px 12px',
};
