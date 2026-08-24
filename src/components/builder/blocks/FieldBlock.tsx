import React, { useEffect, useState } from 'react';

interface Props {
  label: string;
  value: string | null;
  placeholder: string;
  suggestions?: string[];
  onSave: (value: string) => void;
}

/**
 * A single-value block bound to a text column on `specs` (garnish, glass).
 * Not sortable and not a container — it holds one fact about the drink, so it
 * renders as a flat block with no notch.
 */
export default function FieldBlock({ label, value, placeholder, suggestions = [], onSave }: Props) {
  const [draft, setDraft] = useState(value ?? '');
  useEffect(() => { setDraft(value ?? ''); }, [value]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed !== (value ?? '')) onSave(trimmed);
  };

  return (
    <div style={wrap}>
      <span style={labelStyle}>{label}</span>
      <input
        value={draft}
        placeholder={placeholder}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        style={input}
        aria-label={label}
      />
      {suggestions.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {suggestions.map(s => (
            <button
              key={s}
              onClick={() => { setDraft(s); onSave(s); }}
              style={suggestion(s === (value ?? ''))}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const wrap: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
  borderRadius: 10,
  background: 'rgba(255,255,255,.04)',
  border: '1px solid rgba(255,255,255,.11)',
  borderLeft: '3px solid rgba(255,135,210,.32)',
  padding: '10px 12px',
  minHeight: 44,
};

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-ui)', fontSize: 9, fontWeight: 700,
  letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-muted)',
  flexShrink: 0, minWidth: 62,
};

const input: React.CSSProperties = {
  flex: 1, minWidth: 120,
  background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.12)',
  borderRadius: 7, color: 'var(--text)',
  fontFamily: 'var(--font-ui)', fontSize: 12.5, padding: '8px 10px', outline: 'none',
};

const suggestion = (active: boolean): React.CSSProperties => ({
  fontFamily: 'var(--font-ui)', fontSize: 10.5,
  color: active ? '#0c0b14' : 'var(--text-muted)',
  background: active ? 'rgba(230,235,245,.9)' : 'rgba(255,255,255,.05)',
  border: `1px solid ${active ? 'transparent' : 'rgba(255,255,255,.1)'}`,
  borderRadius: 6, padding: '5px 9px', cursor: 'pointer', whiteSpace: 'nowrap',
});
