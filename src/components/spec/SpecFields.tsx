import React from 'react';
import { METHODS } from '../../utils/calculations';
import type { Spec, SpecInput } from '../../store/useProofStore';

interface Props {
  spec: Spec;
  onSave: (patch: Partial<SpecInput>) => void;
}

export default function SpecFields({ spec, onSave }: Props) {
  const field = (key: keyof SpecInput, value: string | number | null) => onSave({ [key]: value });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={row}>
        <label style={lbl}>Method</label>
        <select style={sel} value={spec.method ?? ''} onChange={(e) => field('method', e.target.value || null)}>
          <option value="">— none —</option>
          {METHODS.map((m) => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ ...row, flex: 1 }}>
          <label style={lbl}>Glass</label>
          <input style={inp} value={spec.glass ?? ''} placeholder="e.g. Nick & Nora"
            onChange={(e) => field('glass', e.target.value || null)} />
        </div>
        <div style={{ ...row, flex: 1 }}>
          <label style={lbl}>Sale price (£ inc. VAT)</label>
          <input style={inp} type="number" min={0} step={0.01}
            value={spec.sale_price ?? ''}
            placeholder="0.00"
            onChange={(e) => field('sale_price', e.target.value ? parseFloat(e.target.value) : null)} />
        </div>
      </div>

      <div style={row}>
        <label style={lbl}>Garnish</label>
        <input style={inp} value={spec.garnish ?? ''} placeholder="e.g. Lemon twist"
          onChange={(e) => field('garnish', e.target.value || null)} />
      </div>

      <div style={row}>
        <label style={lbl}>Build notes</label>
        <textarea
          style={{ ...inp, resize: 'vertical', minHeight: 62, fontFamily: 'var(--font-ui)' }}
          value={spec.build_text ?? ''}
          placeholder="Step-by-step build instructions…"
          onChange={(e) => field('build_text', e.target.value || null)}
        />
      </div>
    </div>
  );
}

const row: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 };

const lbl: React.CSSProperties = {
  fontFamily: 'var(--font-ui)', fontSize: 9, fontWeight: 700,
  color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em',
};

const inp: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid var(--glass-border)',
  borderRadius: 6,
  color: 'var(--ink)',
  fontFamily: 'var(--font-ui)', fontSize: 13,
  padding: '6px 9px', outline: 'none', width: '100%',
  boxSizing: 'border-box' as const,
  transition: 'border-color 0.15s',
};

const sel: React.CSSProperties = {
  ...inp,
  cursor: 'pointer',
};
