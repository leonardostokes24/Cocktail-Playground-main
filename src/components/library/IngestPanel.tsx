import React, { useCallback, useMemo, useRef, useState } from 'react';
import { parseRecipe } from '../../utils/ingestion';
import { useProofStore } from '../../store/useProofStore';
import Glass from '../common/Glass';

interface Props {
  onClose: () => void;
  onDone?: (specId: string) => void;
}

/**
 * Paste a recipe, see exactly what was read, then commit.
 *
 * The preview is the whole point: parsing is deterministic but not infallible,
 * so the panel shows what it understood and what it couldn't, and nothing is
 * written until the user says so.
 */
export default function IngestPanel({ onClose, onDone }: Props) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ingestRecipe = useProofStore(s => s.ingestRecipe);
  const ingredients = useProofStore(s => s.ingredients);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  const draft = useMemo(() => (text.trim() ? parseRecipe(text) : null), [text]);

  const known = useCallback(
    (name: string) => ingredients.some(i => i.name.toLowerCase() === name.toLowerCase()),
    [ingredients],
  );
  const newCount = draft ? draft.components.filter(c => !known(c.name)).length : 0;

  const handleCreate = useCallback(async () => {
    if (!draft || !draft.components.length || busy) return;
    setBusy(true);
    setError(null);
    try {
      const spec = await ingestRecipe(draft);
      onDone?.(spec.id);
      onClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message
        : typeof err === 'object' && err !== null && typeof (err as { message?: unknown }).message === 'string'
          ? (err as { message: string }).message
          : 'Could not create the spec';
      setError(message);
      setBusy(false);
    }
  }, [draft, busy, ingestRecipe, onDone, onClose]);

  return (
    <div style={backdrop} onClick={onClose}>
      <Glass variant="panel" style={panel} onClick={e => e.stopPropagation()}>
        <div style={header}>
          <h2 className="display" style={{ fontSize: 20, margin: 0 }}>Paste a recipe</h2>
          <button onClick={onClose} style={closeBtn} aria-label="Close">✕</button>
        </div>

        <p style={hint}>
          Amounts, method, glass and garnish are read from the text. Nothing is saved until you
          create the spec.
        </p>

        <textarea
          ref={areaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={'Old Fashioned\n50 ml bourbon\n10 ml sugar syrup\n2 dashes Angostura\nStir over ice. Rocks glass.'}
          style={textarea}
          spellCheck={false}
        />

        {draft && (
          <div style={preview}>
            <div style={previewHead}>
              <span style={previewTitle}>{draft.name || 'Untitled'}</span>
              <span style={previewMeta}>
                {[draft.method, draft.glass].filter(Boolean).join(' · ') || 'no method read'}
              </span>
            </div>

            {draft.components.length === 0 ? (
              <p style={emptyRead}>No ingredient lines read yet.</p>
            ) : (
              <ul style={list}>
                {draft.components.map((c, i) => (
                  <li key={i} style={row}>
                    <span style={amountCell}>{c.amount} {c.unit}</span>
                    <span style={{ flex: 1 }}>{c.name}</span>
                    {!known(c.name) && <span style={newTag}>new</span>}
                  </li>
                ))}
              </ul>
            )}

            {draft.garnish && <p style={garnishLine}>Garnish · {draft.garnish}</p>}

            {draft.unparsed.length > 0 && (
              <div style={unparsedBox}>
                <span style={unparsedHead}>Couldn't read {draft.unparsed.length} line{draft.unparsed.length > 1 ? 's' : ''} — add {draft.unparsed.length > 1 ? 'them' : 'it'} by hand after:</span>
                {draft.unparsed.map((u, i) => <div key={i} style={unparsedLine}>{u}</div>)}
              </div>
            )}

            {newCount > 0 && (
              <p style={newNote}>
                {newCount} ingredient{newCount > 1 ? 's' : ''} not in your library yet. A paste can't tell us
                strength or price, so {newCount > 1 ? 'they are' : 'it is'} created at 0% ABV with no cost — set both in
                the Library and this spec's ABV and GP fill in.
              </p>
            )}
          </div>
        )}

        {error && <p style={errorLine}>{error}</p>}

        <div style={footer}>
          <button onClick={onClose} style={secondaryBtn}>Cancel</button>
          <button
            onClick={handleCreate}
            disabled={!draft?.components.length || busy}
            style={primaryBtn(!draft?.components.length || busy)}
          >
            {busy ? 'Creating…'
              : draft?.components.length
                ? `Create spec with ${draft.components.length} ingredient${draft.components.length > 1 ? 's' : ''}`
                : 'Create spec'}
          </button>
        </div>
      </Glass>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const backdrop: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 2100,
  background: 'rgba(6,5,12,.58)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
};

const panel: React.CSSProperties = {
  width: 'min(560px, 100%)', maxHeight: '86vh',
  display: 'flex', flexDirection: 'column', gap: 12, padding: 22,
  overflowY: 'auto',
};

const header: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
};

const closeBtn: React.CSSProperties = {
  background: 'transparent', border: 'none', color: 'var(--text-2)',
  fontSize: 15, cursor: 'pointer', padding: 4, lineHeight: 1,
};

const hint: React.CSSProperties = {
  margin: 0, fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-2)', lineHeight: 1.45,
};

const textarea: React.CSSProperties = {
  width: '100%', minHeight: 150, resize: 'vertical',
  background: 'rgba(0,0,0,.32)', border: '1px solid rgba(255,255,255,.12)',
  borderRadius: 10, padding: '11px 13px',
  color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 12.5, lineHeight: 1.55,
  outline: 'none', boxSizing: 'border-box',
};

const preview: React.CSSProperties = {
  border: '1px solid rgba(255,255,255,.1)', borderRadius: 10,
  padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8,
  background: 'rgba(255,255,255,.03)',
};

const previewHead: React.CSSProperties = {
  display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10,
};

const previewTitle: React.CSSProperties = {
  fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: 'var(--text)',
};

const previewMeta: React.CSSProperties = {
  fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--text-2)',
};

const emptyRead: React.CSSProperties = {
  margin: 0, fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-muted)',
};

const list: React.CSSProperties = { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 };

const row: React.CSSProperties = {
  display: 'flex', alignItems: 'baseline', gap: 10,
  fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--text)',
};

const amountCell: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text-2)',
  width: 72, textAlign: 'right', flexShrink: 0,
};

const newTag: React.CSSProperties = {
  fontFamily: 'var(--font-ui)', fontSize: 9, fontWeight: 700, letterSpacing: '.05em',
  textTransform: 'uppercase', color: '#8fe0ff',
  border: '1px solid rgba(127,230,255,.32)', borderRadius: 4, padding: '1px 5px',
};

const garnishLine: React.CSSProperties = {
  margin: 0, fontFamily: 'var(--font-ui)', fontSize: 11.5, color: 'var(--text-2)',
};

const unparsedBox: React.CSSProperties = {
  border: '1px solid rgba(255,190,120,.28)', borderRadius: 8, padding: '8px 10px',
  display: 'flex', flexDirection: 'column', gap: 3,
};

const unparsedHead: React.CSSProperties = {
  fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 600, color: '#ffca8a',
};

const unparsedLine: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)',
};

const newNote: React.CSSProperties = {
  margin: 0, fontFamily: 'var(--font-ui)', fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.45,
};

const errorLine: React.CSSProperties = {
  margin: 0, fontFamily: 'var(--font-ui)', fontSize: 12, color: '#ff9d9d',
};

const footer: React.CSSProperties = {
  display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 2,
};

const secondaryBtn: React.CSSProperties = {
  padding: '9px 15px', borderRadius: 8,
  background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)',
  color: 'var(--text-2)', fontFamily: 'var(--font-ui)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
};

const primaryBtn = (disabled: boolean): React.CSSProperties => ({
  padding: '9px 15px', borderRadius: 8,
  background: disabled ? 'rgba(255,255,255,.05)' : 'var(--ink)',
  border: `1px solid ${disabled ? 'rgba(255,255,255,.1)' : 'var(--ink)'}`,
  color: disabled ? 'var(--text-muted)' : 'var(--on-ink)',
  fontFamily: 'var(--font-ui)', fontSize: 12.5, fontWeight: 600,
  cursor: disabled ? 'default' : 'pointer',
});
