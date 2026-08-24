import React, { useMemo } from 'react';
import { useProofStore } from '../../store/useProofStore';
import { twistNumbers } from '../../utils/twistNumbers';
import { computeSpecCosts } from '../../utils/calculations';
import { getFormula, formulaSecondArg } from '../../utils/formulaRegistry';

/**
 * The lineage summary card from Claude Design "Proof New UI" 8a.
 *
 * Scoped to the selected spec's family — root plus everything descending from
 * it — rather than the whole canvas, so it answers "how is *this* drink doing"
 * rather than a meaningless global average.
 *
 * Median GP, not mean: one unpriced outlier or one joke spec would drag a mean
 * somewhere useless. Unpriced specs are excluded from the GP figure entirely
 * rather than counted as zero, which would read as a catastrophic margin.
 */
export default function LineageStats() {
  const specs      = useProofStore(s => s.specs);
  const selectedId = useProofStore(s => s.selectedSpecId);
  const componentsMap = useProofStore(s => s.specComponentsMap);
  const dilution   = useProofStore(s => s.dilutionOverrides);
  const vatRate    = useProofStore(s => s.vatRate);
  const sundries   = useProofStore(s => s.sundriesPerServe);
  const wasteRate  = useProofStore(s => s.wasteRate);
  const targetGpPct = useProofStore(s => s.targetGpPct);

  const stats = useMemo(() => {
    if (!specs.length) return null;

    // Walk to the root of the selected spec, then take everything under it.
    const byId = new Map(specs.map(s => [s.id, s]));
    const rootOf = (id: string): string => {
      const seen = new Set<string>([id]);
      let cur = byId.get(id);
      while (cur?.parent_spec_id) {
        const parent = byId.get(cur.parent_spec_id);
        if (!parent || seen.has(parent.id)) break;
        seen.add(parent.id);
        cur = parent;
      }
      return cur?.id ?? id;
    };

    const anchor = selectedId ?? specs[0]?.id;
    if (!anchor) return null;
    const rootId = rootOf(anchor);
    const family = specs.filter(s => rootOf(s.id) === rootId);
    const root = byId.get(rootId);

    const gps: number[] = [];
    for (const s of family) {
      const comps = componentsMap[s.id];
      if (!comps?.length) continue;
      const costs = computeSpecCosts(s.method, s.sale_price, comps, dilution, { sundriesPerServe: sundries, wasteRate });
      if (!costs.fullyPriced) continue;
      const f = getFormula('gp_ex_vat');
      const second = formulaSecondArg(f, s.sale_price, targetGpPct);
      if (second == null) continue;
      gps.push(f.compute(costs.modifiedCost, second, vatRate));
    }
    gps.sort((a, b) => a - b);
    const median = gps.length
      ? gps.length % 2 ? gps[(gps.length - 1) / 2]
        : (gps[gps.length / 2 - 1] + gps[gps.length / 2]) / 2
      : null;

    const twists = twistNumbers(specs);
    return {
      name: root ? `${root.name} family` : 'Lineage',
      count: family.length,
      median,
      priced: gps.length,
      deepest: Math.max(0, ...family.map(s => twists[s.id] ?? 0)),
    };
  }, [specs, selectedId, componentsMap, dilution, sundries, wasteRate, vatRate, targetGpPct]);

  if (!stats) return null;

  return (
    <div style={shell}>
      <div style={head}>
        <div style={eyebrow}>lineage</div>
        <div style={title}>{stats.name}</div>
      </div>
      <div style={{ display: 'flex' }}>
        <Cell value={String(stats.count).padStart(2, '0')} label="specs" />
        <Cell
          value={stats.median == null ? '—' : `${Math.round(stats.median)}%`}
          label={stats.median == null ? 'no priced specs' : `median gp · ${stats.priced} priced`}
        />
        <Cell value={String(stats.deepest).padStart(2, '0')} label="twists" last />
      </div>
    </div>
  );
}

function Cell({ value, label, last }: { value: string; label: string; last?: boolean }) {
  return (
    <div style={{ flex: 1, padding: '12px 16px', borderRight: last ? 'none' : '1px solid var(--rule-faint)', minWidth: 0 }}>
      <div style={cellValue}>{value}</div>
      <div style={cellLabel}>{label}</div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const shell: React.CSSProperties = {
  position: 'absolute',
  right: 24,
  bottom: 88,
  width: 320,
  background: 'var(--card)',
  border: '1px solid var(--rule-strong)',
  zIndex: 3,
  pointerEvents: 'none',
};

const head: React.CSSProperties = {
  padding: '12px 16px',
  borderBottom: '1px solid var(--rule)',
};

const eyebrow: React.CSSProperties = {
  font: '400 10px/1 var(--font-mono)',
  letterSpacing: '.12em',
  color: 'var(--ink-72)',
};

const title: React.CSSProperties = {
  marginTop: 8,
  font: '400 22px/1.1 var(--font-display)',
  color: 'var(--ink)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const cellValue: React.CSSProperties = {
  font: '400 20px/1 var(--font-mono)',
  color: 'var(--ink)',
};

const cellLabel: React.CSSProperties = {
  marginTop: 5,
  font: '400 9.5px/1.2 var(--font-mono)',
  color: 'var(--ink-72)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};
