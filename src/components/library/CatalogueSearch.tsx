import React, { useCallback, useEffect, useState } from 'react';
import { searchCatalogueIngredients, type CatalogueIngredient } from '../../lib/supabase/catalogue';
import { useProofStore } from '../../store/useProofStore';
import Glass from '../common/Glass';
import { typeDot } from '../common/typeDot';

interface Props {
  onClose: () => void;
}

/**
 * Search the shared catalogue and import an entry into your own library.
 *
 * ⚑ `reference_price` is a *suggestion only*. It pre-fills the price field so
 * you aren't typing from nothing, and it is labelled as a community figure —
 * but the row is only ever created with whatever the user leaves in the box.
 * It never reaches a cost formula, and importing without touching the price
 * leaves the ingredient unpriced rather than silently adopting someone else's.
 */
export default function CatalogueSearch({ onClose }: Props) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [results, setResults] = useState<CatalogueIngredient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CatalogueIngredient | null>(null);
  const [packCost, setPackCost] = useState('');
  const [packSize, setPackSize] = useState('');
  const [busy, setBusy] = useState(false);

  const importCatalogueIngredient = useProofStore(s => s.importCatalogueIngredient);
  const ingredients = useProofStore(s => s.ingredients);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    searchCatalogueIngredients(debounced)
      .then(r => { if (!cancelled) { setResults(r); setError(null); } })
      .catch(e => { if (!cancelled) setError(e?.message ?? 'Catalogue search failed'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [debounced]);

  const startImport = useCallback((c: CatalogueIngredient) => {
    setSelected(c);
    // Pre-filled as a starting point, clearly labelled — never applied silently.
    setPackCost('');
    setPackSize(String(c.default_pack_size_ml));
  }, []);

  const confirmImport = useCallback(async () => {
    if (!selected || busy) return;
    setBusy(true);
    setError(null);
    try {
      const cost = packCost.trim() === '' ? null : Number(packCost);
      await importCatalogueIngredient(selected.id, cost, Number(packSize) || selected.default_pack_size_ml);
      setSelected(null);
      setPackCost('');
    } catch (e) {
      setError((e as { message?: string })?.message ?? 'Import failed');
    } finally {
      setBusy(false);
    }
  }, [selected, busy, packCost, packSize, importCatalogueIngredient]);

  const alreadyHave = useCallback(
    (name: string) => ingredients.some(i => i.name.toLowerCase() === name.toLowerCase()),
    [ingredients],
  );

  return (
    <div style={backdrop} onClick={onClose}>
      <Glass variant="panel" style={panel} onClick={e => e.stopPropagation()}>
        <div style={header}>
          <h2 className="display" style={{ fontSize: 20, margin: 0 }}>Community catalogue</h2>
          <button onClick={onClose} style={closeBtn} aria-label="Close">✕</button>
        </div>

        <input
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search the shared catalogue…"
          style={input}
        />

        {error && <p style={errorLine}>{error}</p>}

        {selected ? (
          <div style={importBox}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={typeDot(selected.type, 7)} />
              <span style={importName}>{selected.name}</span>
              <span style={abvTag}>{selected.abv}% ABV</span>
            </div>

            <p style={priceNote}>
              The community lists this around <b>£{selected.reference_price}</b> per{' '}
              {selected.default_pack_size_ml} ml. That's a reference only — your GP uses the
              price <em>you</em> pay, so enter yours. Leave it blank to import unpriced.
            </p>

            <div style={{ display: 'flex', gap: 8 }}>
              <label style={fieldLabel}>
                Your pack cost (£)
                <input
                  type="number" min={0} step="0.01" value={packCost}
                  onChange={e => setPackCost(e.target.value)}
                  placeholder="leave blank for unpriced"
                  style={field}
                />
              </label>
              <label style={fieldLabel}>
                Pack size (ml)
                <input
                  type="number" min={1} step="1" value={packSize}
                  onChange={e => setPackSize(e.target.value)}
                  style={field}
                />
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setSelected(null)} style={secondaryBtn}>Back</button>
              <button onClick={confirmImport} disabled={busy} style={primaryBtn(busy)}>
                {busy ? 'Importing…' : packCost.trim() === '' ? 'Import unpriced' : 'Import at my price'}
              </button>
            </div>
          </div>
        ) : (
          <div style={list}>
            {loading && results.length === 0 && <p style={muted}>Searching…</p>}
            {!loading && results.length === 0 && (
              <p style={muted}>
                {debounced ? `Nothing in the catalogue matches "${debounced}".` : 'The catalogue is empty.'}
              </p>
            )}
            {results.map(c => (
              <button key={c.id} onClick={() => startImport(c)} style={row}>
                <span style={typeDot(c.type, 6)} />
                <span style={{ flex: 1, textAlign: 'left' }}>{c.name}</span>
                {c.verified && <span style={verifiedTag}>verified</span>}
                {alreadyHave(c.name) && <span style={haveTag}>in library</span>}
                <span style={refPrice}>ref £{c.reference_price}</span>
              </button>
            ))}
          </div>
        )}
      </Glass>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const backdrop: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 2100, background: 'rgba(6,5,12,.58)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
};

const panel: React.CSSProperties = {
  width: 'min(560px, 100%)', maxHeight: '86vh',
  display: 'flex', flexDirection: 'column', gap: 12, padding: 22, overflowY: 'auto',
};

const header: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between' };

const closeBtn: React.CSSProperties = {
  background: 'transparent', border: 'none', color: 'var(--text-2)',
  fontSize: 15, cursor: 'pointer', padding: 4, lineHeight: 1,
};

const input: React.CSSProperties = {
  width: '100%', padding: '10px 13px', boxSizing: 'border-box',
  background: 'rgba(0,0,0,.32)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 9,
  color: 'var(--text)', fontFamily: 'var(--font-ui)', fontSize: 13, outline: 'none',
};

const list: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 380, overflowY: 'auto' };

const row: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 9, width: '100%',
  padding: '9px 10px', borderRadius: 8,
  background: 'transparent', border: '1px solid transparent',
  color: 'var(--text)', fontFamily: 'var(--font-ui)', fontSize: 12.5, cursor: 'pointer',
};

const verifiedTag: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase',
  color: '#8fe0ff', border: '1px solid rgba(127,230,255,.3)', borderRadius: 4, padding: '1px 5px',
};

const haveTag: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase',
  color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,.14)', borderRadius: 4, padding: '1px 5px',
};

const refPrice: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-muted)', flexShrink: 0,
};

const importBox: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 11,
  border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, padding: '14px 15px',
  background: 'rgba(255,255,255,.03)',
};

const importName: React.CSSProperties = {
  fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: 'var(--text)', flex: 1,
};

const abvTag: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-2)' };

const priceNote: React.CSSProperties = {
  margin: 0, fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5,
};

const fieldLabel: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 4, flex: 1,
  fontFamily: 'var(--font-ui)', fontSize: 10.5, fontWeight: 600,
  letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--text-muted)',
};

const field: React.CSSProperties = {
  padding: '8px 10px', boxSizing: 'border-box',
  background: 'rgba(0,0,0,.32)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8,
  color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 12.5, outline: 'none',
};

const muted: React.CSSProperties = {
  margin: 0, padding: '10px 2px', fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-muted)',
};

const errorLine: React.CSSProperties = {
  margin: 0, fontFamily: 'var(--font-ui)', fontSize: 12, color: '#ff9d9d',
};

const secondaryBtn: React.CSSProperties = {
  padding: '9px 15px', borderRadius: 8,
  background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)',
  color: 'var(--text-2)', fontFamily: 'var(--font-ui)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
};

const primaryBtn = (disabled: boolean): React.CSSProperties => ({
  padding: '9px 15px', borderRadius: 8,
  background: disabled ? 'rgba(255,255,255,.05)' : 'linear-gradient(168deg, rgba(127,230,255,.26), rgba(127,230,255,.13))',
  border: `1px solid ${disabled ? 'rgba(255,255,255,.1)' : 'rgba(127,230,255,.4)'}`,
  color: disabled ? 'var(--text-muted)' : '#eaf9ff',
  fontFamily: 'var(--font-ui)', fontSize: 12.5, fontWeight: 600,
  cursor: disabled ? 'default' : 'pointer',
});
