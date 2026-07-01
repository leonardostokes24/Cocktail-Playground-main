import React, { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { computeSpecCosts } from '../../utils/calculations';
import { useProofStore } from '../../store/useProofStore';
import Glass from '../common/Glass';

export type SpecNodeData = Record<string, never>;

const MAX_VISIBLE_COMPONENTS = 4;

function SpecNode({ id, selected }: { id: string; selected: boolean }) {
  const spec              = useProofStore(s => s.specs.find(sp => sp.id === id));
  const components        = useProofStore(s => s.specComponentsMap[id]);
  const dilutionOverrides = useProofStore(s => s.dilutionOverrides);
  const branchSpec        = useProofStore(s => s.branchSpec);
  const removeSpec        = useProofStore(s => s.removeSpec);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [hovered, setHovered] = useState(false);

  if (!spec) return null;

  const costs = components
    ? computeSpecCosts(spec.method, spec.sale_price, components, dilutionOverrides)
    : null;

  const visibleComponents = (components ?? []).slice(0, MAX_VISIBLE_COMPONENTS);
  const overflowCount = (components?.length ?? 0) - visibleComponents.length;

  return (
    <Glass
      selected={selected}
      style={cardStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Handle type="target" position={Position.Top} style={handle} />

      {/* ── Top row: lineage hint + status badge ───────────────── */}
      <div style={topRow}>
        <span style={muteText}>{spec.parent_spec_id ? '↳ Riff' : 'Origin'}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={statusBadge(spec.status)}>{spec.status}</span>
          <div style={{ display: 'flex', gap: 3, opacity: hovered ? 1 : 0, transition: 'opacity 0.15s' }}>
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); branchSpec(id); }}
              title="Branch a riff" style={iconBtn}
            >⎇</button>
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
              title="Delete spec" style={iconBtn}
            >✕</button>
          </div>
        </div>
      </div>

      {/* ── Name ─────────────────────────────────────────────────── */}
      <h3 style={nameStyle} title={spec.name}>{spec.name}</h3>

      {/* ── Method · Glass ───────────────────────────────────────── */}
      {(spec.method || spec.glass) && (
        <p style={subtitleStyle}>
          {[spec.method, spec.glass].filter(Boolean).join(' · ').toUpperCase()}
        </p>
      )}

      {/* ── Component list ──────────────────────────────────────── */}
      {visibleComponents.length > 0 && (
        <div style={componentList}>
          {visibleComponents.map((c) => (
            <div key={c.id} style={componentRow}>
              <span style={componentName}>{c.ingredients?.name ?? '—'}</span>
              <span style={componentAmount}>
                {c.original_amount ?? c.amount_ml}{c.original_unit ?? 'ml'}
              </span>
            </div>
          ))}
          {overflowCount > 0 && <span style={overflowText}>+{overflowCount} more</span>}
        </div>
      )}

      {/* ── Gauge footer ─────────────────────────────────────────── */}
      <div style={divider} />
      <div style={gaugeRow}>
        <Gauge label="GP" value={costs?.gpPct != null ? `${costs.gpPct.toFixed(0)}` : '—'} unit="%" />
        <div style={gaugeDivider} />
        <Gauge label="ABV" value={costs ? costs.finalAbvPct.toFixed(1) : '—'} unit="%" />
        <div style={gaugeDivider} />
        <Gauge label="VOL" value={costs ? Math.round(costs.finalVolumeMl).toString() : '—'} unit="ml" />
      </div>

      {/* Inline delete confirmation — no browser dialog */}
      {confirmDelete && (
        <div style={confirmBox} onMouseDown={(e) => e.stopPropagation()}>
          <span style={{ fontSize: 11, color: 'var(--ink)' }}>Delete "{spec.name}"?</span>
          <div style={{ display: 'flex', gap: 5, marginTop: 6 }}>
            <button
              onClick={(e) => { e.stopPropagation(); removeSpec(id); }}
              style={{ ...confirmBtn, background: '#ef4444', color: '#fff', border: 'none' }}
            >Delete</button>
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }}
              style={confirmBtn}
            >Cancel</button>
          </div>
        </div>
      )}

      <Handle type="source" position={Position.Bottom} style={handle} />
    </Glass>
  );
}

export default memo(SpecNode);

function Gauge({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div style={gauge}>
      <span style={gaugeLabel}>{label}</span>
      <span style={gaugeValue}>{value}<span style={gaugeUnit}>{unit}</span></span>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  padding: '10px 12px', width: 240, cursor: 'pointer',
};

const topRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6,
};

const muteText: React.CSSProperties = {
  fontFamily: 'var(--font-ui)', fontSize: 10.5, color: 'var(--mute)', fontWeight: 500,
};

const nameStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--ink)',
  margin: 0, lineHeight: 1.25, textShadow: 'var(--aberration)',
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
};

const subtitleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-ui)', fontSize: 10, fontWeight: 500, color: 'var(--mute)',
  margin: '3px 0 0', letterSpacing: '0.04em',
};

const componentList: React.CSSProperties = {
  marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3,
};

const componentRow: React.CSSProperties = {
  display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8,
};

const componentName: React.CSSProperties = {
  fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--ink)',
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
};

const componentAmount: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--mute)', flexShrink: 0,
};

const overflowText: React.CSSProperties = {
  fontFamily: 'var(--font-ui)', fontSize: 10.5, color: 'var(--mute)', fontStyle: 'italic',
};

const divider: React.CSSProperties = {
  height: 1, background: 'rgba(255,255,255,0.08)', margin: '10px 0 8px',
};

const gaugeRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
};

const gauge: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, flex: 1,
};

const gaugeLabel: React.CSSProperties = {
  fontFamily: 'var(--font-ui)', fontSize: 9, color: 'var(--mute)', fontWeight: 600, letterSpacing: '0.06em',
};

const gaugeValue: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500, color: 'var(--ink)',
};

const gaugeUnit: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--cyan)', marginLeft: 1,
};

const gaugeDivider: React.CSSProperties = {
  width: 1, height: 20, background: 'rgba(255,255,255,0.08)',
};

const handle: React.CSSProperties = { background: 'var(--mute)', border: '1.5px solid rgba(255,255,255,0.2)', width: 8, height: 8 };

const iconBtn: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 4, color: 'var(--mute)',
  cursor: 'pointer', fontSize: 11, padding: '2px 5px', lineHeight: 1,
};

function statusBadge(status: string): React.CSSProperties {
  const published = status === 'published';
  return {
    fontFamily: 'var(--font-ui)', fontSize: 9.5, fontWeight: 700,
    color: published ? '#7FE6FF' : 'var(--mute)',
    background: published ? 'rgba(127,230,255,0.12)' : 'transparent',
    border: `1px solid ${published ? 'rgba(127,230,255,0.3)' : 'rgba(255,255,255,0.1)'}`,
    borderRadius: 20, padding: '1px 6px', textTransform: 'uppercase',
  };
}

const confirmBox: React.CSSProperties = {
  marginTop: 8, padding: '8px 10px',
  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
  borderRadius: 8,
};
const confirmBtn: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 5, color: 'var(--mute)', cursor: 'pointer', fontSize: 11,
  padding: '3px 10px', fontWeight: 600,
};
