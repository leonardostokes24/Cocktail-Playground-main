import React from 'react';
import { useProofStore } from '../../store/useProofStore';
import { DILUTION_DEFAULTS, METHODS } from '../../utils/calculations';

interface Props {
  onClose: () => void;
}

export default function SettingsPanel({ onClose }: Props) {
  const {
    vatRate, sundriesPerServe, wasteRate, targetGpPct,
    setVatRate, setSundriesPerServe, setWasteRate, setTargetGpPct,
    dilutionOverrides, setDilutionOverride, resetDilutionOverrides,
  } = useProofStore();

  return (
    <div style={panel}>
      <div style={header}>
        <span style={{ fontWeight: 700, fontSize: 15, color: '#e2e8f0' }}>Settings</span>
        <button onClick={onClose} style={btnClose}>✕</button>
      </div>

      <div style={{ overflowY: 'auto', flex: 1, padding: '16px 20px' }}>
        <section style={sectionStyle}>
          <p style={sectionLabel}>Costing</p>

          <Field label="VAT rate" hint="ex-VAT GP is calculated on net price, sale price ÷ (1 + VAT rate)">
            <PercentInput value={vatRate} onChange={setVatRate} />
          </Field>

          <Field label="Sundries / serve" hint="fixed £ per drink — garnish, ice, straw">
            <MoneyInput value={sundriesPerServe} onChange={setSundriesPerServe} />
          </Field>

          <Field label="Waste rate" hint="% applied to (pour cost + sundries) before any formula">
            <PercentInput value={wasteRate} onChange={setWasteRate} />
          </Field>

          <Field label="Target GP %" hint="shown against realized GP — never editorialized">
            <input
              type="number"
              step="0.1"
              value={targetGpPct ?? ''}
              placeholder="none set"
              onChange={(e) => setTargetGpPct(e.target.value === '' ? null : Number(e.target.value))}
              style={numberInput}
            />
          </Field>
        </section>

        <section style={sectionStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <p style={{ ...sectionLabel, margin: 0 }}>Dilution factors</p>
            <button onClick={resetDilutionOverrides} style={btnReset}>Reset to defaults</button>
          </div>
          {METHODS.map((method) => (
            <Field key={method} label={method}>
              <PercentInput
                value={dilutionOverrides[method] ?? DILUTION_DEFAULTS[method]}
                onChange={(v) => setDilutionOverride(method, v)}
              />
            </Field>
          ))}
        </section>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={fieldRow}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={fieldLabel}>{label}</div>
        {hint && <div style={fieldHint}>{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function PercentInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <input
        type="number"
        step="0.1"
        value={(value * 100).toFixed(1)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        style={numberInput}
      />
      <span style={unitSuffix}>%</span>
    </div>
  );
}

function MoneyInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={unitSuffix}>£</span>
      <input
        type="number"
        step="0.01"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={numberInput}
      />
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const panel: React.CSSProperties = {
  position: 'fixed', top: 0, right: 0, bottom: 0, width: 420,
  background: 'rgba(10,15,28,0.97)', backdropFilter: 'blur(16px)',
  borderLeft: '1px solid #1e293b', zIndex: 3000,
  display: 'flex', flexDirection: 'column',
  boxShadow: '-8px 0 32px rgba(0,0,0,0.5)',
};

const header: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '14px 16px', borderBottom: '1px solid #1e293b', flexShrink: 0,
};

const btnClose: React.CSSProperties = {
  background: 'rgba(30,41,59,0.8)', border: '1px solid #334155', borderRadius: 6,
  color: '#94a3b8', fontSize: 13, padding: '4px 10px', cursor: 'pointer',
};

const btnReset: React.CSSProperties = {
  background: 'rgba(30,41,59,0.8)', border: '1px solid #334155', borderRadius: 6,
  color: '#94a3b8', fontSize: 11, padding: '3px 8px', cursor: 'pointer',
};

const sectionStyle: React.CSSProperties = {
  marginBottom: 24,
};

const sectionLabel: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, color: '#64748b',
  textTransform: 'uppercase', letterSpacing: '0.10em',
  marginBottom: 12,
};

const fieldRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  gap: 12, padding: '8px 0', borderBottom: '1px solid #0f172a',
};

const fieldLabel: React.CSSProperties = {
  fontSize: 13, color: '#e2e8f0', textTransform: 'capitalize',
};

const fieldHint: React.CSSProperties = {
  fontSize: 10.5, color: '#64748b', marginTop: 2,
};

const numberInput: React.CSSProperties = {
  width: 70, background: 'rgba(30,41,59,0.6)', border: '1px solid #334155',
  borderRadius: 5, color: '#e2e8f0', fontSize: 12, padding: '4px 6px',
  textAlign: 'right',
};

const unitSuffix: React.CSSProperties = {
  fontSize: 12, color: '#64748b',
};
