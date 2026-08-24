import React, { useCallback, useEffect, useState } from 'react';
import {
  listMyVenues, searchVenues, createVenue, joinVenue, leaveVenue,
  type Venue, type VenueMembership,
} from '../../lib/supabase/venues';
import Glass from '../common/Glass';

interface Props { onClose: () => void }

type Tab = 'mine' | 'find' | 'new';

/**
 * Create / join / leave a venue. Venue profile pages are deferred by VISION,
 * so this is membership only — no public surface, no roster editing.
 */
export default function VenuePanel({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>('mine');
  const [mine, setMine] = useState<VenueMembership[]>([]);
  const [found, setFound] = useState<Venue[]>([]);
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try { setMine(await listMyVenues()); setError(null); }
    catch (e) { setError((e as { message?: string })?.message ?? 'Could not load your venues'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (tab !== 'find') return;
    const t = setTimeout(() => {
      searchVenues(query)
        .then(setFound)
        .catch(e => setError((e as { message?: string })?.message ?? 'Search failed'));
    }, 200);
    return () => clearTimeout(t);
  }, [tab, query]);

  const act = useCallback(async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true); setError(null);
    try { await fn(); await refresh(); }
    catch (e) { setError((e as { message?: string })?.message ?? 'That didn\'t work'); }
    finally { setBusy(false); }
  }, [busy, refresh]);

  const memberIds = new Set(mine.map(m => m.venue_id));

  return (
    <div style={backdrop} onClick={onClose}>
      <Glass variant="panel" style={panel} onClick={e => e.stopPropagation()}>
        <div style={header}>
          <h2 className="display" style={{ fontSize: 20, margin: 0 }}>Venues</h2>
          <button onClick={onClose} style={closeBtn} aria-label="Close">✕</button>
        </div>

        <div style={tabs}>
          {(['mine', 'find', 'new'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} style={tabBtn(tab === t)}>
              {t === 'mine' ? 'My venues' : t === 'find' ? 'Find one' : 'Create one'}
            </button>
          ))}
        </div>

        {error && <p style={errorLine}>{error}</p>}

        {tab === 'mine' && (
          <div style={list}>
            {loading ? <p style={muted}>Loading…</p>
              : mine.length === 0 ? <p style={muted}>You're not in a venue yet. Find one, or create it.</p>
              : mine.map(m => (
                <div key={m.venue_id} style={row}>
                  <span style={{ flex: 1 }}>{m.venues?.name ?? 'Venue'}</span>
                  <span style={roleTag}>{m.role}</span>
                  <button onClick={() => act(() => leaveVenue(m.venue_id))} disabled={busy} style={leaveBtn}>Leave</button>
                </div>
              ))}
          </div>
        )}

        {tab === 'find' && (
          <>
            <input value={query} onChange={e => setQuery(e.target.value)}
                   placeholder="Search venues by name…" style={input} autoFocus />
            <div style={list}>
              {found.length === 0 ? <p style={muted}>No venues match.</p> : found.map(v => (
                <div key={v.id} style={row}>
                  <span style={{ flex: 1 }}>{v.name}</span>
                  {v.city && <span style={cityTag}>{v.city}</span>}
                  {memberIds.has(v.id)
                    ? <span style={roleTag}>joined</span>
                    : <button onClick={() => act(() => joinVenue(v.id))} disabled={busy} style={joinBtn}>Join</button>}
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'new' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={fieldLabel}>Name
              <input value={name} onChange={e => setName(e.target.value)} style={input} autoFocus />
            </label>
            <label style={fieldLabel}>City (optional)
              <input value={city} onChange={e => setCity(e.target.value)} style={input} />
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                disabled={!name.trim() || busy}
                onClick={() => act(async () => {
                  await createVenue({ name: name.trim(), city: city.trim() || null });
                  setName(''); setCity(''); setTab('mine');
                })}
                style={primaryBtn(!name.trim() || busy)}
              >
                {busy ? 'Creating…' : 'Create venue'}
              </button>
            </div>
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
  width: 'min(520px, 100%)', maxHeight: '86vh',
  display: 'flex', flexDirection: 'column', gap: 12, padding: 22, overflowY: 'auto',
};
const header: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between' };
const closeBtn: React.CSSProperties = {
  background: 'transparent', border: 'none', color: 'var(--text-2)', fontSize: 15, cursor: 'pointer', padding: 4, lineHeight: 1,
};
const tabs: React.CSSProperties = { display: 'flex', gap: 4 };
const tabBtn = (on: boolean): React.CSSProperties => ({
  padding: '6px 12px', borderRadius: 7,
  background: on ? 'rgba(255,255,255,.12)' : 'transparent',
  border: '1px solid ' + (on ? 'rgba(255,255,255,.18)' : 'transparent'),
  color: on ? 'var(--text)' : 'var(--text-2)',
  fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
});
const input: React.CSSProperties = {
  width: '100%', padding: '9px 12px', boxSizing: 'border-box',
  background: 'rgba(0,0,0,.32)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8,
  color: 'var(--text)', fontFamily: 'var(--font-ui)', fontSize: 13, outline: 'none',
};
const list: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 340, overflowY: 'auto' };
const row: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 9, padding: '9px 10px', borderRadius: 8,
  border: '1px solid rgba(255,255,255,.08)',
  fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--text)',
};
const roleTag: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase',
  color: '#8fe0ff', border: '1px solid rgba(127,230,255,.3)', borderRadius: 4, padding: '1px 5px',
};
const cityTag: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-muted)' };
const joinBtn: React.CSSProperties = {
  padding: '4px 10px', borderRadius: 6, background: 'rgba(127,230,255,.14)',
  border: '1px solid var(--rule-strong)', color: 'var(--on-ink)',
  fontFamily: 'var(--font-ui)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
};
const leaveBtn: React.CSSProperties = {
  padding: '4px 10px', borderRadius: 6, background: 'transparent',
  border: '1px solid rgba(255,255,255,.14)', color: 'var(--text-2)',
  fontFamily: 'var(--font-ui)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
};
const fieldLabel: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 4,
  fontFamily: 'var(--font-ui)', fontSize: 10.5, fontWeight: 600,
  letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--text-muted)',
};
const muted: React.CSSProperties = {
  margin: 0, padding: '10px 2px', fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-muted)',
};
const errorLine: React.CSSProperties = { margin: 0, fontFamily: 'var(--font-ui)', fontSize: 12, color: '#ff9d9d' };
const primaryBtn = (disabled: boolean): React.CSSProperties => ({
  padding: '9px 15px', borderRadius: 8,
  background: disabled ? 'rgba(255,255,255,.05)' : 'var(--ink)',
  border: `1px solid ${disabled ? 'rgba(255,255,255,.1)' : 'var(--ink)'}`,
  color: disabled ? 'var(--text-muted)' : 'var(--on-ink)',
  fontFamily: 'var(--font-ui)', fontSize: 12.5, fontWeight: 600, cursor: disabled ? 'default' : 'pointer',
});
