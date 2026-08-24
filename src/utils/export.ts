import type { Spec, SpecComponent } from '../lib/supabase/queries';
import type { SpecCosts } from './calculations';
import { toMoney } from './money';

/**
 * Spec → PDF / Excel.
 *
 * The rows are built once, in `buildExportRows`, and both writers render the
 * same array. That keeps the two formats honest with each other and leaves the
 * only interesting logic testable without touching jsPDF or xlsx.
 *
 * Money is formatted from Decimal at the edge, never accumulated as float.
 */

export type ExportRow = {
  component: string;
  type: string;
  amount: string;
  amountMl: number;
  costPerMl: string;
  lineCost: string;
};

export type ExportPayload = {
  title: string;
  subtitle: string;
  rows: ExportRow[];
  /** label / value pairs for the summary block. */
  summary: [string, string][];
  /** Present when at least one component has no price. */
  unpricedNote: string | null;
};

function componentName(c: SpecComponent): string {
  return c.ingredients?.name ?? c.preps?.name ?? '—';
}

function componentType(c: SpecComponent): string {
  if (c.preps) return 'prep';
  return c.ingredients?.type ?? 'ingredient';
}

function costPerMlOf(c: SpecComponent): number | null {
  const raw = c.preps ? c.preps.cost_per_ml : c.ingredients?.cost_per_ml;
  return raw == null ? null : Number(raw);
}

/** Amount as the user entered it, falling back to ml when there's no original. */
function amountLabel(c: SpecComponent): string {
  if (c.original_amount != null) return `${c.original_amount} ${c.original_unit ?? 'ml'}`;
  return `${c.amount_ml} ml`;
}

export function buildExportRows(
  spec: Spec,
  components: SpecComponent[],
  costs: SpecCosts | null,
  opts: { vatRate: number; currency?: string } = { vatRate: 0.2 },
): ExportPayload {
  const rows: ExportRow[] = [...components]
    .sort((a, b) => a.position - b.position)
    .map(c => {
      const cpm = costPerMlOf(c);
      return {
        component: componentName(c),
        type: componentType(c),
        amount: amountLabel(c),
        amountMl: c.amount_ml,
        // An unpriced component is blank, never 0 — zero would read as free.
        costPerMl: cpm == null ? '' : toMoney(cpm).toDecimalPlaces(4).toString(),
        lineCost: cpm == null ? '' : toMoney(cpm).times(c.amount_ml).toDecimalPlaces(2).toString(),
      };
    });

  const summary: [string, string][] = [];
  if (costs) {
    summary.push(['Volume (ml)', String(Math.round(costs.finalVolumeMl))]);
    summary.push(['ABV', `${costs.finalAbvPct.toFixed(1)}%`]);
    if (costs.fullyPriced) {
      summary.push(['Pour cost', toMoney(costs.pourCost).toDecimalPlaces(2).toString()]);
      summary.push(['Cost incl. waste & sundries', toMoney(costs.modifiedCost).toDecimalPlaces(2).toString()]);
      if (spec.sale_price != null) {
        const gross = toMoney(spec.sale_price);
        const net = gross.dividedBy(1 + opts.vatRate);
        summary.push(['Sale price (inc. VAT)', gross.toDecimalPlaces(2).toString()]);
        summary.push(['Net of VAT', net.toDecimalPlaces(2).toString()]);
        if (costs.gpPct != null) summary.push(['GP % (ex-VAT)', `${costs.gpPct.toFixed(1)}%`]);
      }
    }
  }

  const descriptor = [spec.method, spec.glass].filter(Boolean).join(' · ');

  return {
    title: spec.name,
    subtitle: descriptor || 'Spec',
    rows,
    summary,
    unpricedNote: costs && costs.unpricedCount > 0
      ? `${costs.unpricedCount} component${costs.unpricedCount > 1 ? 's have' : ' has'} no price yet — costs below exclude ${costs.unpricedCount > 1 ? 'them' : 'it'}.`
      : null,
  };
}

/** Filename stem: safe on every OS, still recognisable. */
export function exportFilename(spec: Spec, ext: 'pdf' | 'csv'): string {
  const stem = spec.name
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 60) || 'spec';
  return `${stem}.${ext}`;
}

// ── Writers ───────────────────────────────────────────────────────────────────
// Both dynamically import their library so jspdf/xlsx stay out of the main
// bundle — neither is needed until someone actually exports.

export async function exportSpecToPdf(payload: ExportPayload, filename: string): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const M = 48;
  let y = M;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(payload.title, M, y);
  y += 20;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(payload.subtitle, M, y);
  doc.setTextColor(0);
  y += 26;

  const cols = [M, M + 210, M + 290, M + 380, M + 470];
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  ['Component', 'Type', 'Amount', 'Cost/ml', 'Line cost'].forEach((h, i) => doc.text(h, cols[i], y));
  y += 6;
  doc.setDrawColor(200);
  doc.line(M, y, 547, y);
  y += 14;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  for (const r of payload.rows) {
    if (y > 780) { doc.addPage(); y = M; }
    doc.text(r.component.slice(0, 34), cols[0], y);
    doc.text(r.type, cols[1], y);
    doc.text(r.amount, cols[2], y);
    doc.text(r.costPerMl, cols[3], y);
    doc.text(r.lineCost, cols[4], y);
    y += 15;
  }

  if (payload.unpricedNote) {
    y += 8;
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.text(payload.unpricedNote, M, y);
    doc.setTextColor(0);
    y += 12;
  }

  if (payload.summary.length) {
    y += 12;
    doc.setDrawColor(200);
    doc.line(M, y, 547, y);
    y += 18;
    doc.setFontSize(10);
    for (const [label, value] of payload.summary) {
      if (y > 780) { doc.addPage(); y = M; }
      doc.setFont('helvetica', 'normal');
      doc.text(label, M, y);
      doc.setFont('helvetica', 'bold');
      doc.text(value, M + 210, y);
      y += 15;
    }
  }

  doc.save(filename);
}

/**
 * Spreadsheet export as CSV rather than .xlsx.
 *
 * CLAUDE.md's stack line says xlsx, but the npm registry copy of SheetJS stops
 * at 0.18.5 and carries an unpatched prototype-pollution advisory — the project
 * moved distribution off npm. CSV needs no dependency at all, opens directly in
 * Excel, Numbers and Sheets, and cannot carry a formula-injection payload the
 * way a binary workbook can. Deliberate deviation, not an oversight.
 */
function csvCell(value: string | number): string {
  const v = String(value ?? '');
  // Leading =, +, - or @ makes a spreadsheet treat the cell as a formula.
  const guarded = /^[=+\-@]/.test(v) ? `'${v}` : v;
  return /[",\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

export function toCsv(payload: ExportPayload): string {
  const rows: (string | number)[][] = [
    [payload.title],
    [payload.subtitle],
    [],
    ['Component', 'Type', 'Amount', 'Amount (ml)', 'Cost/ml', 'Line cost'],
    ...payload.rows.map(r => [r.component, r.type, r.amount, r.amountMl, r.costPerMl, r.lineCost]),
  ];
  if (payload.unpricedNote) rows.push([], [payload.unpricedNote]);
  if (payload.summary.length) {
    rows.push([]);
    for (const [label, value] of payload.summary) rows.push([label, value]);
  }
  return rows.map(r => r.map(csvCell).join(',')).join('\r\n');
}

export function exportSpecToCsv(payload: ExportPayload, filename: string): void {
  // BOM so Excel reads UTF-8 rather than mangling names like "Cachaça".
  const blob = new Blob(['\uFEFF' + toCsv(payload)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
