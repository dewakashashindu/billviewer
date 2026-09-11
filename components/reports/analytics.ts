// ============================================================
// LOCATION: components/reports/analytics.ts
// Report data ekemn (browser athulema) analytics aggregates
// ganana karana module eka — VENAM DB CALL EKAK NAE.
//
//   computeAnalytics({ summary | details | rows }) → Analytics | null
//
//   - summary  : SalesSummaryData   (locationGroups → dateGroups → rows)
//   - details  : SalesDetailsData   (locationGroups → dateGroups → bills → items)
//   - rows     : generic flat rows  (dynamic table reports)
//
//   return venna breakdowns:
//     totalSales / billCount / avgBill / top (location|item)
//     byDate (trend), byLocation, byMode, byType, topItems
// ============================================================

import type { SalesSummaryData } from "./SalesSummaryReport";
import type { SalesDetailsData } from "./SalesDetailsReport";

export interface AnaPoint {
  label: string;
  value: number;
  bills: number;
}

export interface Analytics {
  totalSales: number;
  billCount: number;
  avgBill: number;
  top: { label: string; value: number; kind: "location" | "item" } | null;
  byDate: AnaPoint[];
  byLocation: AnaPoint[];
  byMode: AnaPoint[];
  byType: AnaPoint[];
  topItems: AnaPoint[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

const num = (v: unknown): number => {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && isFinite(Number(v)))
    return Number(v);
  return 0;
};

const str = (v: unknown): string =>
  typeof v === "string" ? v : v == null ? "" : String(v);

function add(
  m: Map<string, AnaPoint>,
  key: string,
  value: number,
  bills = 0
): void {
  const k = key && key.trim() !== "" ? key.trim() : "Other";
  const p = m.get(k) ?? { label: k, value: 0, bills: 0 };
  p.value += value;
  p.bills += bills;
  m.set(k, p);
}

const desc = (a: AnaPoint, b: AnaPoint) => b.value - a.value;

/** "2026-03-08" | "08/03/2026" | "03/08/2026"(dd/MM/yyyy) → sortable "yyyy-mm-dd" */
const dateKey = (d: string): string => {
  const p = d.includes("-") ? d.split("-") : d.includes("/") ? d.split("/") : null;
  if (!p || p.length !== 3) return d;
  if (p[0].length === 4)
    return `${p[0]}-${p[1].padStart(2, "0")}-${p[2].padStart(2, "0")}`;
  return `${p[2].padStart(2, "0")}-${p[1].padStart(2, "0")}-${p[0].padStart(2, "0")}`;
};
const byDateAsc = (a: AnaPoint, b: AnaPoint) =>
  dateKey(a.label).localeCompare(dateKey(b.label));

export function computeAnalytics(input: {
  summary?: SalesSummaryData | null;
  details?: SalesDetailsData | null;
  rows?: Array<Record<string, unknown>> | null;
}): Analytics | null {
  let total = 0;
  let bills = 0;
  const byDate = new Map<string, AnaPoint>();
  const byLocation = new Map<string, AnaPoint>();
  const byMode = new Map<string, AnaPoint>();
  const byType = new Map<string, AnaPoint>();
  const items = new Map<string, AnaPoint>();

  // ── 1) Sales Summary shape — bill-level rows ──
  if (input.summary) {
    for (const loc of input.summary.locationGroups ?? []) {
      add(byLocation, loc.locName, loc.locTotal);
      for (const g of loc.dateGroups ?? []) {
        const rs = g.rows ?? [];
        add(byDate, g.date, g.dayTotal, rs.length);
        for (const r of rs) {
          const v = num(r.netTotal);
          total += v;
          bills += 1;
          add(byMode, str(r.orderMode), v);
          add(byType, str(r.billType), v);
        }
      }
    }
  }

  // ── 2) Sales Details shape — bills + items ──
  if (input.details) {
    for (const loc of input.details.locationGroups ?? []) {
      add(byLocation, loc.locName, loc.locNetTotal);
      for (const g of loc.dateGroups ?? []) {
        const bs = g.bills ?? [];
        add(byDate, g.date, g.dayNetTotal, bs.length);
        for (const b of bs) {
          const v = num(b.totals?.netTotal);
          total += v;
          bills += 1;
          add(byMode, str(b.orderMode), v);
          add(byType, str(b.billType), v);
          for (const it of b.items ?? []) {
            add(items, str(it.name) || "Unknown Item", num(it.totItemPrice));
          }
        }
      }
    }
  }

  // ── 3) Generic flat rows (dynamic table reports) ──
  if (input.rows) {
    for (const r of input.rows ?? []) {
      const v = num(
        r.salesVolume ?? r.totalSales ?? r.netTotal ?? r.total ?? 0
      );
      total += v;
      bills += 1;
      add(byDate, str(r.txnDate ?? r.date), v, 1);
      const locName = str(r.locName ?? r.location);
      if (locName) add(byLocation, locName, v);
      const mode = str(r.orderMode);
      if (mode) add(byMode, mode, v);
      const bt = str(r.billType);
      if (bt) add(byType, bt, v);
    }
  }

  if (bills === 0 && total === 0 && byDate.size === 0) return null;

  const topItems = Array.from(items.values()).sort(desc).slice(0, 8);
  const locs = Array.from(byLocation.values()).sort(desc);
  const top: Analytics["top"] =
    locs.length > 0
      ? { label: locs[0].label, value: r2(locs[0].value), kind: "location" }
      : topItems.length > 0
        ? {
            label: topItems[0].label,
            value: r2(topItems[0].value),
            kind: "item",
          }
        : null;

  return {
    totalSales: r2(total),
    billCount: bills,
    avgBill: bills > 0 ? r2(total / bills) : 0,
    top,
    byDate: Array.from(byDate.values()).sort(byDateAsc).map((p) => ({
      ...p,
      value: r2(p.value),
    })),
    byLocation: locs.map((p) => ({ ...p, value: r2(p.value) })),
    byMode: Array.from(byMode.values()).sort(desc).map((p) => ({
      ...p,
      value: r2(p.value),
    })),
    byType: Array.from(byType.values()).sort(desc).map((p) => ({
      ...p,
      value: r2(p.value),
    })),
    topItems: topItems.map((p) => ({ ...p, value: r2(p.value) })),
  };
}
