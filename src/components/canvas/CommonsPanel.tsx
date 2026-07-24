import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useProofStore, type PublishedSpec } from '../../store/useProofStore';

interface Props {
  onClose: () => void;
}

export default function CommonsPanel({ onClose }: Props) {
  const {
    publishedFeed, publishedFeedLoading, publishedFeedLoaded,
    loadPublishedFeed, searchPublishedFeed, forkPublished, preloadPublished,
  } = useProofStore(useShallow(s => ({
    publishedFeed: s.publishedFeed,
    publishedFeedLoading: s.publishedFeedLoading,
    publishedFeedLoaded: s.publishedFeedLoaded,
    loadPublishedFeed: s.loadPublishedFeed,
    searchPublishedFeed: s.searchPublishedFeed,
    forkPublished: s.forkPublished,
    preloadPublished: s.preloadPublished,
  })));

  const [query, setQuery] = useState('');
  const [forkingId, setForkingId] = useState<string | null>(null);
  const [preloading, setPreloading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const BATCH_CAP = 8;
  const handleAddToCanvas = useCallback(async () => {
    setPreloading(true);
    try {
      await preloadPublished(publishedFeed.slice(0, BATCH_CAP).map(s => s.id));
      onClose();
    } finally {
      setPreloading(false);
    }
  }, [preloadPublished, publishedFeed, onClose]);

  useEffect(() => {
    if (!publishedFeedLoaded) loadPublishedFeed();
  }, [publishedFeedLoaded, loadPublishedFeed]);

  const handleSearch = useCallback((q: string) => {
    setQuery(q);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchPublishedFeed(q), 200);
  }, [searchPublishedFeed]);

  const handleFork = useCallback(async (spec: PublishedSpec) => {
    setForkingId(spec.id);
    try {
      await forkPublished(spec.id);
      onClose();
    } finally {
      setForkingId(null);
    }
  }, [forkPublished, onClose]);

  return (
    <div style={panel}>
      {/* Edge dispersion */}
      <div style={edgeLayer} />

      {/* Header */}
      <div style={header}>
        <span className="display" style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' }}>
          Commons
        </span>
        <input
          autoFocus
          type="text"
          placeholder="Search recipes…"
          value={query}
          onChange={e => handleSearch(e.target.value)}
          style={searchInput}
        />
        <button onClick={onClose} style={closeBtn} aria-label="Close">✕</button>
      </div>

      {/* Feed */}
      <div style={feed}>
        {publishedFeedLoading && (
          <div style={loadingRow}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={skeleton} />
            ))}
          </div>
        )}

        {!publishedFeedLoading && publishedFeed.length === 0 && (
          <div style={emptyState}>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text-muted)' }}>
              {query ? 'No recipes match that search.' : 'No published recipes yet.'}
            </span>
          </div>
        )}

        {!publishedFeedLoading && publishedFeed.map(spec => (
          <SpecCard
            key={spec.id}
            spec={spec}
            forking={forkingId === spec.id}
            onFork={handleFork}
          />
        ))}
      </div>

      {/* Footer */}
      {!publishedFeedLoading && publishedFeed.length > 0 && (
        <div style={footer}>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--text-muted)' }}>
            {publishedFeed.length} recipe{publishedFeed.length !== 1 ? 's' : ''} · fork any to start your lineage
          </span>
          <button onClick={handleAddToCanvas} disabled={preloading} style={forkBtn(preloading)}>
            {preloading ? 'Adding…' : `Add ${Math.min(publishedFeed.length, BATCH_CAP)} to canvas`}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Spec card ─────────────────────────────────────────────────────────────────

interface CardProps {
  spec: PublishedSpec;
  forking: boolean;
  onFork: (spec: PublishedSpec) => void;
}

function SpecCard({ spec, forking, onFork }: CardProps) {
  const [hovered, setHovered] = useState(false);
  const componentCount = Array.isArray(spec.components_snapshot) ? spec.components_snapshot.length : 0;
  const creator = spec.creator_name ?? spec.creator_id?.slice(0, 8) ?? 'unknown';
  const isIBA = spec.creator_id === '00000000-0000-4000-a000-000000000001';

  return (
    <div
      style={{
        ...card,
        background: hovered ? 'rgba(255,255,255,.07)' : card.background,
        transition: 'background 0.12s',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
            {spec.name}
          </span>
          {spec.method && (
            <span style={methodChip}>{spec.method}</span>
          )}
          {isIBA && (
            <span style={ibaChip}>IBA</span>
          )}
          {spec.lineage_depth > 0 && (
            <span style={{ ...ibaChip, background: 'rgba(255,135,210,.1)', color: '#ffd6f0', border: '1px solid rgba(255,135,210,.22)' }}>
              fork
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--text-muted)' }}>
            {isIBA ? 'IBA Official' : creator}
          </span>
          {spec.venue_name && (
            <>
              <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>·</span>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--text-muted)' }}>{spec.venue_name}</span>
            </>
          )}
          <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>·</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
            {componentCount} component{componentCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
      <button
        disabled={forking}
        onClick={() => onFork(spec)}
        style={forkBtn(forking)}
      >
        {forking ? '…' : 'Fork'}
      </button>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const panel: React.CSSProperties = {
  position: 'absolute',
  top: 82,
  right: 20,
  bottom: 22,
  width: 480,
  borderRadius: 16,
  background: 'var(--panel-fill)',
  backdropFilter: 'var(--glass-blur)',
  WebkitBackdropFilter: 'var(--glass-blur)',
  border: '1px solid rgba(255,255,255,.12)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.18), inset 1.2px 0 0 rgba(120,225,255,.28), inset -1.2px 0 0 rgba(255,135,210,.22), 0 28px 60px -24px rgba(0,0,0,.85)',
  zIndex: 50,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const edgeLayer: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  borderRadius: 16,
  pointerEvents: 'none',
  border: '1px solid rgba(255,255,255,.12)',
};

const header: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '18px 20px 14px',
  borderBottom: '1px solid rgba(255,255,255,.07)',
  flexShrink: 0,
};

const searchInput: React.CSSProperties = {
  flex: 1,
  background: 'rgba(255,255,255,.05)',
  border: '1px solid rgba(255,255,255,.1)',
  borderRadius: 8,
  color: 'var(--text)',
  fontFamily: 'var(--font-ui)',
  fontSize: 12,
  padding: '7px 11px',
  outline: 'none',
};

const closeBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  fontFamily: 'var(--font-ui)',
  fontSize: 14,
  padding: '4px 6px',
  borderRadius: 5,
  flexShrink: 0,
};

const feed: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '10px 12px',
  display: 'flex',
  flexDirection: 'column',
  gap: 3,
};

const loadingRow: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 8,
};

const skeleton: React.CSSProperties = {
  height: 56,
  borderRadius: 8,
  background: 'rgba(255,255,255,.04)',
  animation: 'pulse 1.5s ease-in-out infinite',
};

const emptyState: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: 1,
  padding: 40,
};

const card: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '10px 12px',
  borderRadius: 9,
  background: 'rgba(255,255,255,.035)',
  cursor: 'default',
};

const methodChip: React.CSSProperties = {
  fontFamily: 'var(--font-ui)',
  fontSize: 9,
  fontWeight: 600,
  color: 'var(--text-muted)',
  background: 'rgba(255,255,255,.06)',
  border: '1px solid rgba(255,255,255,.1)',
  borderRadius: 4,
  padding: '2px 6px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const ibaChip: React.CSSProperties = {
  fontFamily: 'var(--font-ui)',
  fontSize: 9,
  fontWeight: 700,
  color: '#bfeeff',
  background: 'rgba(127,230,255,.1)',
  border: '1px solid rgba(127,230,255,.22)',
  borderRadius: 4,
  padding: '2px 6px',
  letterSpacing: '0.05em',
};

const forkBtn = (disabled: boolean): React.CSSProperties => ({
  background: disabled ? 'rgba(127,230,255,.06)' : 'rgba(127,230,255,.12)',
  border: '1px solid rgba(127,230,255,.3)',
  borderRadius: 7,
  color: disabled ? 'rgba(127,230,255,.4)' : 'var(--cyan)',
  cursor: disabled ? 'default' : 'pointer',
  fontFamily: 'var(--font-ui)',
  fontSize: 11,
  fontWeight: 600,
  padding: '6px 14px',
  flexShrink: 0,
  transition: 'background 0.12s',
});

const footer: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '12px 20px',
  borderTop: '1px solid rgba(255,255,255,.06)',
  flexShrink: 0,
};
