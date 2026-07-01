import React, { useMemo, useState, useCallback } from 'react';
import { useProofStore } from '../../store/useProofStore';
import { computeSpecCosts } from '../../utils/calculations';
import SpecFields from './SpecFields';
import ComponentRow from './ComponentRow';
import AddComponentForm from './AddComponentForm';

interface Props {
  specId: string;
  onClose: () => void;
}

export default function SpecPanel({ specId, onClose }: Props) {
  const {
    specs, specComponents, componentsLoading, ingredients, dilutionOverrides,
    editSpec, addComponent, editComponent, removeComponent,
  } = useProofStore();
  const [addingComponent, setAddingComponent] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  const spec = specs.find((s) => s.id === specId);
  const costs = useMemo(() =>
    spec ? computeSpecCosts(spec.method, spec.sale_price, specComponents, dilutionOverrides) : null,
    [spec, specComponents, dilutionOverrides]
  );

  const handleSaveField = useCallback((patch: Parameters<typeof editSpec>[1]) => {
    editSpec(specId, patch);
  }, [specId, editSpec]);

  const handleNameSave = () => {
    const trimmed = nameDraft.trim();
    if (trimmed && spec && trimmed !== spec.name) editSpec(specId, { name: trimmed });
    setEditingName(false);
  };

  const handleUpdateComponent = useCallback(async (id: string, amountMl: number, originalAmount: number, originalUnit: string) => {
    await editComponent(id, { amount_ml: amountMl, original_amount: originalAmount, original_unit: originalUnit });
  }, [editComponent]);

  const handleAddComponent = useCallback(async (payload: Parameters<typeof addComponent>[0]) => {
    await addComponent(payload);
    setAddingComponent(false);
  }, [addComponent]);

  if (!spec) return null;

  const subtitle = [spec.method, spec.glass].filter(Boolean).join(' · ');

  return (
    <div style={panelStyle}>
      {/* ── Header ───────────────────────────────────────────── */}
      <div style={headerStyle}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {editingName ? (
            <input
              autoFocus
              style={nameInputStyle}
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={handleNameSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNameSave();
                if (e.key === 'Escape') setEditingName(false);
              }}
            />
          ) : (
            <h2 style={nameTitleStyle} onClick={() => { setNameDraft(spec.name); setEditingName(true); }} title="Click to rename">
              {spec.name}
            </h2>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            {subtitle && <span style={subtitleStyle}>{subtitle.toUpperCase()}</span>}
            <span style={statusBadgeStyle(spec.status)}>{spec.status}</span>
          </div>
        </div>
        <button onClick={onClose} style={closeBtnStyle}>✕</button>
      </div>

      {/* ── Scrollable body ───────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <section style={sectionStyle}>
          <p style={sectionLabel}>Spec</p>
          <SpecFields spec={spec} onSave={handleSaveField} />
        </section>

        <section style={sectionStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <p style={{ ...sectionLabel, margin: 0 }}>Ingredients</p>
            {!addingComponent && (
              <button onClick={() => setAddingComponent(true)} style={addBtnStyle}>+ Add</button>
            )}
          </div>

          {addingComponent && (
            <div style={{ marginBottom: 12 }}>
              <AddComponentForm
                ingredients={ingredients}
                nextPosition={specComponents.length}
                specId={specId}
                onAdd={handleAddComponent}
                onCancel={() => setAddingComponent(false)}
              />
            </div>
          )}

          {componentsLoading ? (
            <p style={dimStyle}>Loading…</p>
          ) : specComponents.length === 0 ? (
            <p style={dimStyle}>No ingredients yet — add one above.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {specComponents.map((c) => (
                <ComponentRow key={c.id} component={c} onUpdate={handleUpdateComponent} onRemove={removeComponent} />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ── Pinned cost gauges ────────────────────────────────── */}
      {costs && (
        <div style={costBarStyle}>
          <div style={gaugeRowStyle}>
            <Gauge
              label="GP"
              value={costs.gpPct != null ? costs.gpPct.toFixed(1) : '—'}
              unit="%"
              accent={costs.gpPct != null}
            />
            <div style={gaugeDivider} />
            <Gauge label="ABV" value={costs.finalAbvPct.toFixed(1)} unit="%" />
            <div style={gaugeDivider} />
            <Gauge label="VOL" value={costs.finalVolumeMl.toFixed(0)} unit="ml" />
          </div>
          <div style={costDetailRowStyle}>
            <CostDetail label="Pour cost" value={`£${costs.pourCost.toFixed(3)}`} />
            <CostDetail label="Liquid" value={`${costs.liquidVolumeMl.toFixed(0)} ml`} />
            <CostDetail label="Pre-dil ABV" value={`${costs.preDilutionAbv.toFixed(1)}%`} />
          </div>
        </div>
      )}
    </div>
  );
}

function Gauge({ label, value, unit, accent }: { label: string; value: string; unit: string; accent?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flex: 1 }}>
      <span style={{ fontFamily: 'var(--font-ui)', fontSize: 9, fontWeight: 700, color: 'var(--mute)', letterSpacing: '0.09em', textTransform: 'uppercase' as const }}>
        {label}
      </span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 500, color: accent ? 'var(--cyan)' : 'var(--ink)', lineHeight: 1 }}>
        {value}
        {value !== '—' && <span style={{ fontSize: 12, color: 'var(--cyan)', marginLeft: 2 }}>{unit}</span>}
      </span>
    </div>
  );
}

function CostDetail({ label, value }: { label: string; value: string }) {
  return (
    <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
      <span style={{ fontFamily: 'var(--font-ui)', fontSize: 9, color: 'var(--mute)', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink)' }}>{value}</span>
    </span>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  position: 'fixed', top: 0, right: 0, bottom: 0, width: 560,
  background: 'linear-gradient(168deg, rgba(255,255,255,.10), rgba(255,255,255,.04))',
  backdropFilter: 'blur(24px) saturate(135%)',
  WebkitBackdropFilter: 'blur(24px) saturate(135%)',
  borderLeft: '1px solid var(--glass-border)',
  boxShadow: 'inset 1px 0 0 var(--edge-cyan), inset 0 1px 0 var(--edge-top), -14px 0 48px rgba(0,0,0,.65)',
  zIndex: 3100,
  display: 'flex', flexDirection: 'column',
};

const headerStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', gap: 12,
  padding: '18px 20px 14px',
  borderBottom: '1px solid rgba(255,255,255,0.07)',
  flexShrink: 0,
};

const nameTitleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700,
  color: 'var(--ink)', margin: 0, cursor: 'text', lineHeight: 1.15,
  textShadow: 'var(--aberration)',
};

const nameInputStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700,
  background: 'transparent', border: 'none', borderBottom: '1px solid var(--cyan)',
  color: 'var(--ink)', outline: 'none', width: '100%',
  textShadow: 'var(--aberration)',
};

const subtitleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-ui)', fontSize: 10, fontWeight: 500,
  color: 'var(--mute)', letterSpacing: '0.07em',
};

const closeBtnStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)',
  borderRadius: 6, color: 'var(--mute)', cursor: 'pointer',
  fontFamily: 'var(--font-ui)', fontSize: 13, padding: '5px 10px', flexShrink: 0,
};

const sectionStyle: React.CSSProperties = {
  padding: '16px 20px',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
};

const sectionLabel: React.CSSProperties = {
  fontFamily: 'var(--font-ui)', fontSize: 9, fontWeight: 700,
  color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.10em',
  marginBottom: 10, margin: '0 0 10px',
};

const addBtnStyle: React.CSSProperties = {
  background: 'rgba(127,230,255,0.08)', border: '1px solid rgba(127,230,255,0.22)',
  borderRadius: 6, color: 'var(--cyan)', cursor: 'pointer',
  fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 700, padding: '3px 10px',
};

const dimStyle: React.CSSProperties = {
  fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--mute)', margin: 0,
};

const costBarStyle: React.CSSProperties = {
  padding: '14px 20px 16px',
  borderTop: '1px solid rgba(255,255,255,0.07)',
  background: 'rgba(0,0,0,0.15)',
  flexShrink: 0,
};

const gaugeRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center',
  marginBottom: 10,
};

const gaugeDivider: React.CSSProperties = {
  width: 1, height: 36,
  background: 'rgba(255,255,255,0.08)',
  flexShrink: 0,
};

const costDetailRowStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-around',
};

function statusBadgeStyle(status: string): React.CSSProperties {
  return {
    display: 'inline-block',
    fontFamily: 'var(--font-ui)', fontSize: 9, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.07em',
    padding: '2px 7px', borderRadius: 20,
    background: status === 'published' ? 'rgba(127,230,255,0.10)' : 'rgba(146,150,180,0.12)',
    color: status === 'published' ? 'var(--cyan)' : 'var(--mute)',
    border: `1px solid ${status === 'published' ? 'rgba(127,230,255,0.22)' : 'rgba(146,150,180,0.18)'}`,
  };
}
