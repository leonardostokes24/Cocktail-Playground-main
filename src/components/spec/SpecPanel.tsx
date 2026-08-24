import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useProofStore } from '../../store/useProofStore';
import { computeSpecCosts } from '../../utils/calculations';
import { formulaRegistry, formulaSecondArg } from '../../utils/formulaRegistry';
import SpecFields from './SpecFields';
import ComponentRow from './ComponentRow';
import RecipeBuilder from '../builder/RecipeBuilder';
import { buildExportRows, exportFilename, exportSpecToPdf, exportSpecToCsv } from '../../utils/export';

interface Props {
  specId: string;
  onClose: () => void;
}

export default function SpecPanel({ specId, onClose }: Props) {
  const {
    specs, specComponents, componentsLoading, dilutionOverrides,
    vatRate, sundriesPerServe, wasteRate, targetGpPct, activeFormulaId,
    editSpec, setActiveFormulaId,
    branchSpec, publishSpec, unpublishSpec,
  } = useProofStore();
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [publishing, setPublishing] = useState(false);

  const spec = specs.find((s) => s.id === specId);
  const costs = useMemo(() =>
    spec
      ? computeSpecCosts(spec.method, spec.sale_price, specComponents, dilutionOverrides, { sundriesPerServe, wasteRate })
      : null,
    [spec, specComponents, dilutionOverrides, sundriesPerServe, wasteRate]
  );

  const handleSaveField = useCallback((patch: Parameters<typeof editSpec>[1]) => {
    editSpec(specId, patch);
  }, [specId, editSpec]);

  const handleNameSave = () => {
    const trimmed = nameDraft.trim();
    if (trimmed && spec && trimmed !== spec.name) editSpec(specId, { name: trimmed });
    setEditingName(false);
  };

  // Export builds its rows from the same spec/costs the panel is already showing,
  // so what lands in the file is what the user can see.
  const handleExport = useCallback(async (fmt: 'pdf' | 'csv') => {
    if (!spec) return;
    const payload = buildExportRows(spec, specComponents, costs, { vatRate });
    const filename = exportFilename(spec, fmt);
    if (fmt === 'pdf') await exportSpecToPdf(payload, filename);
    else exportSpecToCsv(payload, filename);
  }, [spec, specComponents, costs, vatRate]);

  const handleBranch = useCallback(async () => {
    await branchSpec(specId);
  }, [branchSpec, specId]);

  const handlePublish = useCallback(async () => {
    if (publishing) return;
    setPublishing(true);
    try {
      await publishSpec(specId);
    } finally {
      setPublishing(false);
    }
  }, [publishSpec, specId, publishing]);

  const handleUnpublish = useCallback(async () => {
    if (publishing) return;
    setPublishing(true);
    try {
      await unpublishSpec(specId);
      setConfirmUnpublish(false);
    } finally {
      setPublishing(false);
    }
  }, [unpublishSpec, specId, publishing]);

  if (!spec) return null;

  const subtitle = [spec.method, spec.glass].filter(Boolean).join(' · ');
  const gpVal = costs?.gpPct != null ? costs.gpPct.toFixed(1) : '—';

  return (
    <div style={panelOuter}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={headerStyle}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {editingName ? (
            <input
              autoFocus
              className="display"
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
            <h2
              className="display"
              style={nameTitleStyle}
              onClick={() => { setNameDraft(spec.name); setEditingName(true); }}
              title="Click to rename"
            >
              {spec.name}
            </h2>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
            {subtitle && <span style={subtitleStyle}>{subtitle}</span>}
            <span style={statusBadgeStyle(spec.status)}>{spec.status}</span>
          </div>
        </div>
        <button onClick={onClose} style={closeBtnStyle}>✕</button>
      </div>

      {/* ── 3-up gauge strip ──────────────────────────────────── */}
      {costs && (
        <div style={gaugeStrip}>
          <GaugeTile label="GP" value={gpVal} unit="%" accent />
          <GaugeTile label="ABV" value={costs.finalAbvPct.toFixed(1)} unit="%" />
          <GaugeTile label="VOL" value={costs.finalVolumeMl.toFixed(0)} unit="ml" />
        </div>
      )}

      {/* ── Scrollable body ───────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <section style={sectionStyle}>
          <p style={sectionLabel}>Spec</p>
          <SpecFields spec={spec} onSave={handleSaveField} />
        </section>

        {/* BUILD section — read-only; the block builder owns recipe editing */}
        <section style={sectionStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <p style={{ ...sectionLabel, margin: 0 }}>Build</p>
            <button onClick={() => setBuilderOpen(true)} style={addBtnStyle}>Edit recipe</button>
          </div>

          {componentsLoading ? (
            <p style={dimStyle}>Loading…</p>
          ) : specComponents.length === 0 ? (
            <p style={dimStyle}>No ingredients yet — open the builder to start.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {specComponents.map((c) => (
                <ComponentRow key={c.id} component={c} />
              ))}
            </div>
          )}
        </section>

        {/* COSTING block — pricing is optional; the breakdown appears once priced */}
        {costs && (
          <section style={sectionStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <p style={{ ...sectionLabel, margin: 0 }}>Costing</p>
              {costs.fullyPriced && (
                <span style={costSummaryStyle}>
                  pour £{costs.pourCost.toFixed(3)} · +£{costs.modifiedCost.toFixed(3)} modified
                </span>
              )}
            </div>

            {!costs.fullyPriced ? (
              <div style={unpricedNote}>
                <p style={{ margin: 0, fontFamily: 'var(--font-ui)', fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>
                  Pricing is optional
                </p>
                <p style={{ margin: '4px 0 0', fontFamily: 'var(--font-ui)', fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {costs.unpricedCount} ingredient{costs.unpricedCount !== 1 ? 's' : ''} {costs.unpricedCount === 1 ? 'has' : 'have'} no price yet. Add prices in the Library to see GP and the full breakdown.
                </p>
              </div>
            ) : (
            <div style={costingCard}>
              {formulaRegistry.map((f) => {
                const secondArg = formulaSecondArg(f, spec.sale_price, targetGpPct);
                const value = secondArg != null
                  ? f.compute(costs.modifiedCost, secondArg, vatRate)
                  : null;
                const isActive = f.id === activeFormulaId;
                return (
                  <button
                    key={f.id}
                    onClick={() => setActiveFormulaId(f.id)}
                    style={formulaRowStyle(isActive)}
                    title={f.label}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {isActive && <span style={activeFormulaChip}>headline</span>}
                      <span style={formulaLabelStyle}>{f.label}</span>
                    </div>
                    <span style={formulaValueStyle}>
                      {value != null
                        ? `${f.unit === '£' ? '£' : ''}${value.toFixed(f.unit === '%' ? 1 : 2)}${f.unit !== '£' ? f.unit : ''}`
                        : '—'}
                    </span>
                  </button>
                );
              })}

              {targetGpPct != null && costs.gpPct != null && (
                <div style={targetRow}>
                  <span style={targetLabelStyle}>Realized GP</span>
                  <span style={targetValueStyle}>{costs.gpPct.toFixed(1)}%</span>
                  <span style={targetLabelStyle}>vs target</span>
                  <span style={targetValueStyle}>{targetGpPct.toFixed(1)}%</span>
                </div>
              )}
            </div>
            )}
          </section>
        )}
      </div>

      {confirmUnpublish && (
        <p style={unpublishNote}>
          Unpublishing removes this from search and the commons feed. The published snapshot
          itself stays — anyone who already forked it keeps working lineage back to you, and
          your credit travels with it.
        </p>
      )}

      {/* ── Footer: Branch + Publish ─────────────────────────── */}
      <div style={footerStyle}>
        <button onClick={handleBranch} style={branchBtnStyle}>⎇ Branch</button>
        <button onClick={() => handleExport('pdf')} style={branchBtnStyle} title="Export as PDF">PDF</button>
        <button onClick={() => handleExport('csv')} style={branchBtnStyle} title="Export as CSV — opens in Excel">CSV</button>
        {spec.status === 'published' ? (
          confirmUnpublish ? (
            <button onClick={handleUnpublish} disabled={publishing} style={unpublishBtnStyle}>
              {publishing ? 'Hiding…' : 'Hide it — snapshot stays'}
            </button>
          ) : (
            <button onClick={() => setConfirmUnpublish(true)} style={publishBtnStyle(false)}>
              ✓ Published · unpublish
            </button>
          )
        ) : (
          <button
            disabled={publishing}
            onClick={handlePublish}
            style={publishBtnStyle(publishing)}
          >
            {publishing ? 'Publishing…' : '↑ Publish to commons'}
          </button>
        )}
      </div>

      {builderOpen && <RecipeBuilder specId={specId} onClose={() => setBuilderOpen(false)} />}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function GaugeTile({ label, value, unit, accent }: { label: string; value: string; unit: string; accent?: boolean }) {
  return (
    <div style={gaugeTile}>
      <span style={gaugeTileLabel}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
        <span style={{ ...gaugeTileNum, color: accent ? 'var(--cyan)' : 'var(--text)' }}>{value}</span>
        {value !== '—' && <span style={gaugeTileUnit}>{unit}</span>}
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const panelOuter: React.CSSProperties = {
  position: 'fixed', top: 0, right: 0, bottom: 0, width: 560,
  background: 'var(--panel-fill)',
  borderLeft: '1px solid rgba(255,255,255,.12)',
  boxShadow: 'inset 1px 0 0 var(--panel-edge-cyan), inset 0 1px 0 rgba(255,255,255,.16), -14px 0 48px rgba(0,0,0,.65)',
  zIndex: 3100,
  display: 'flex',
  flexDirection: 'column',
};

const headerStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', gap: 12,
  padding: '20px 22px 16px',
  borderBottom: '1px solid rgba(255,255,255,.07)',
  flexShrink: 0,
};

const nameTitleStyle: React.CSSProperties = {
  fontSize: 26, margin: 0, cursor: 'text', lineHeight: 1.1,
};

const nameInputStyle: React.CSSProperties = {
  fontSize: 26, background: 'transparent', border: 'none',
  borderBottom: '1px solid var(--cyan)', outline: 'none', width: '100%',
};

const subtitleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-ui)', fontSize: 10, fontWeight: 500,
  color: 'var(--text-muted)', letterSpacing: '0.05em',
};

const closeBtnStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.12)',
  borderRadius: 6, color: 'var(--text-muted)', cursor: 'pointer',
  fontFamily: 'var(--font-ui)', fontSize: 13, padding: '5px 10px', flexShrink: 0,
};

const gaugeStrip: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  padding: '12px 22px',
  borderBottom: '1px solid rgba(255,255,255,.06)',
  flexShrink: 0,
};

const gaugeTile: React.CSSProperties = {
  flex: 1,
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
  background: 'rgba(255,255,255,.05)',
  border: '1px solid rgba(255,255,255,.08)',
  borderRadius: 10,
  padding: '10px 8px',
};

const gaugeTileLabel: React.CSSProperties = {
  fontFamily: 'var(--font-ui)', fontSize: 9, fontWeight: 700,
  color: 'var(--text-muted)', letterSpacing: '0.09em', textTransform: 'uppercase',
};

const gaugeTileNum: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 500, lineHeight: 1,
};

const gaugeTileUnit: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--cyan)',
};

const sectionStyle: React.CSSProperties = {
  padding: '16px 22px',
  borderBottom: '1px solid rgba(255,255,255,.05)',
};

const sectionLabel: React.CSSProperties = {
  fontFamily: 'var(--font-ui)', fontSize: 9, fontWeight: 700,
  color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.10em',
  marginBottom: 10, margin: '0 0 10px',
};

const addBtnStyle: React.CSSProperties = {
  background: 'rgba(127,230,255,.08)', border: '1px solid rgba(127,230,255,.22)',
  borderRadius: 6, color: 'var(--cyan)', cursor: 'pointer',
  fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 700, padding: '3px 10px',
};

const dimStyle: React.CSSProperties = {
  fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text-muted)', margin: 0,
};

const costSummaryStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)',
};

const costingCard: React.CSSProperties = {
  background: 'rgba(0,0,0,.28)',
  border: '1px solid rgba(255,255,255,.07)',
  borderRadius: 10,
  padding: '4px 6px',
  display: 'flex', flexDirection: 'column', gap: 1,
};

const unpricedNote: React.CSSProperties = {
  background: 'rgba(255,255,255,.03)',
  border: '1px dashed rgba(255,255,255,.12)',
  borderRadius: 10,
  padding: '12px 14px',
};

const activeFormulaChip: React.CSSProperties = {
  fontFamily: 'var(--font-ui)', fontSize: 7, fontWeight: 700,
  color: 'var(--cyan)', background: 'rgba(127,230,255,.12)',
  border: '1px solid rgba(127,230,255,.3)',
  borderRadius: 4, padding: '1px 5px', letterSpacing: '0.05em',
  textTransform: 'uppercase',
};

function formulaRowStyle(active: boolean): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: active ? 'rgba(127,230,255,.08)' : 'transparent',
    border: `1px solid ${active ? 'rgba(127,230,255,.22)' : 'transparent'}`,
    borderRadius: 6, cursor: 'pointer', padding: '5px 8px', textAlign: 'left',
    width: '100%',
  };
}

const formulaLabelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--text)',
};

const formulaValueStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--cyan)',
};

const targetRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  marginTop: 4, paddingTop: 8,
  borderTop: '1px solid rgba(255,255,255,.06)',
};

const targetLabelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-ui)', fontSize: 9, color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.06em',
};

const targetValueStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)', fontWeight: 500,
};

const unpublishNote: React.CSSProperties = {
  margin: '0 16px 8px',
  fontFamily: 'var(--font-ui)',
  fontSize: 11.5,
  lineHeight: 1.5,
  color: 'var(--text-2)',
  borderLeft: '2px solid rgba(255,135,210,.4)',
  paddingLeft: 10,
};

const unpublishBtnStyle: React.CSSProperties = {
  flex: 1,
  padding: '10px 14px',
  borderRadius: 9,
  background: 'linear-gradient(168deg, rgba(255,135,210,.24), rgba(255,135,210,.1))',
  border: '1px solid rgba(255,135,210,.42)',
  color: '#ffe2f5',
  fontFamily: 'var(--font-ui)',
  fontSize: 12.5,
  fontWeight: 600,
  cursor: 'pointer',
};

const footerStyle: React.CSSProperties = {
  display: 'flex', gap: 10,
  padding: '14px 22px 18px',
  borderTop: '1px solid rgba(255,255,255,.07)',
  flexShrink: 0,
};

const branchBtnStyle: React.CSSProperties = {
  flex: 1,
  background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.12)',
  borderRadius: 10, color: 'var(--text-2)', cursor: 'pointer',
  fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600, padding: '10px',
};

function publishBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    flex: 2,
    background: disabled ? 'none' : 'var(--ink)',
    border: `1px solid ${disabled ? 'var(--rule)' : 'var(--ink)'}`,
    borderRadius: 0,
    color: disabled ? 'var(--ink-45)' : 'var(--on-ink)',
    cursor: disabled ? 'default' : 'pointer',
    font: '400 13px/1 var(--font-display)', padding: '11px',
  };
}

function statusBadgeStyle(status: string): React.CSSProperties {
  return {
    display: 'inline-block',
    fontFamily: 'var(--font-ui)', fontSize: 9, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.07em',
    padding: '2px 7px', borderRadius: 20,
    background: status === 'published' ? 'rgba(127,230,255,.10)' : 'rgba(146,150,180,.12)',
    color: status === 'published' ? 'var(--cyan)' : 'var(--text-muted)',
    border: `1px solid ${status === 'published' ? 'rgba(127,230,255,.22)' : 'rgba(146,150,180,.18)'}`,
  };
}
