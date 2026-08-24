import React, { useEffect, useRef, useState } from 'react';

/** Ingredients and preps are both addable, so the search is item-shaped. */
export interface SearchItem {
  id: string;
  name: string;
  type?: string | null;
}

interface Props {
  /** Already filtered to the chosen category by the caller. */
  items: SearchItem[];
  categoryLabel: string;
  emptyHint: string;
  onSelect: (item: SearchItem) => void;
  onEscape: () => void;
}

export default function RadialSearch({ items, categoryLabel, emptyHint, onSelect, onEscape }: Props) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onEscape(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onEscape]);

  const filtered = items
    .filter(i => !debouncedQuery.trim() || i.name.toLowerCase().includes(debouncedQuery.toLowerCase()))
    .slice(0, 6);

  const placeholder = `Search ${categoryLabel.toLowerCase()}…`;

  return (
    <div style={container} onClick={e => e.stopPropagation()}>
      <input
        ref={inputRef}
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder={placeholder}
        style={inputStyle}
      />
      <div style={results}>
        {filtered.length === 0 ? (
          <p style={empty}>{debouncedQuery.trim() ? 'Nothing matches' : emptyHint}</p>
        ) : (
          filtered.map(item => (
            <button
              key={item.id}
              style={resultBtn}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              onClick={e => { e.stopPropagation(); onSelect(item); }}
            >
              <span style={{ color: 'var(--ink)', fontSize: 13, fontFamily: 'var(--font-ui)' }}>{item.name}</span>
              {item.type && <span style={{ color: 'var(--mute)', fontSize: 10, fontFamily: 'var(--font-ui)', textTransform: 'uppercase' }}>{item.type}</span>}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

const container: React.CSSProperties = {
  position: 'absolute',
  top: -28,
  left: '50%',
  transform: 'translateX(-50%)',
  width: 200,
  background: 'linear-gradient(168deg, rgba(255,255,255,.10), rgba(255,255,255,.04))',
  backdropFilter: 'blur(24px) saturate(135%)',
  WebkitBackdropFilter: 'blur(24px) saturate(135%)',
  border: '1px solid var(--glass-border)',
  borderRadius: 12,
  boxShadow: 'inset 1px 0 0 var(--edge-cyan), inset -1px 0 0 var(--edge-magenta), inset 0 1px 0 var(--edge-top), 0 16px 40px rgba(0,0,0,.6)',
  overflow: 'hidden',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  color: 'var(--ink)',
  fontSize: 13,
  fontFamily: 'var(--font-ui)',
  outline: 'none',
  boxSizing: 'border-box',
};

const results: React.CSSProperties = {
  maxHeight: 200,
  overflowY: 'auto',
  padding: '4px 0',
};

const resultBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  padding: '7px 12px',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  textAlign: 'left',
  transition: 'background 0.1s',
  gap: 8,
};

const empty: React.CSSProperties = {
  color: 'var(--mute)',
  fontSize: 11,
  fontFamily: 'var(--font-ui)',
  padding: '10px 12px',
  margin: 0,
  textAlign: 'center',
};
