"use client";

// ============================================================
// LOCATION: components/reports/CategoryReports.tsx
// ✅ 1.3.1 Sales By Category – Summery + 1.3.2 – Detail web renderers
//    POS print eke wage: LEVEL1 (main category) sections, LEVEL2/3
//    sub-sections, item rows + Category/Main totals, location-wise.
//    Flat blue theme — gradients NAE.
// ============================================================
import { Fragment } from "react";
import type { CSSProperties } from "react";
import { IconPin } from "./ReportIcons";

// ── types ──
export interface CatItem {
  name: string;
  total: number;
}
export interface CatSub {
  level2: string;
  level3: string;
  total: number;
  items: CatItem[];
}
export interface CatGroup {
  level1: string;
  total: number;
  subs: CatSub[];
}
export interface CatSummaryLocation {
  locCode: string;
  locName: string;
  cats: CatGroup[];
  locTotal: number;
}
export interface CatSummaryData {
  locationGroups: CatSummaryLocation[];
  grandTotal: number;
}

export interface CatDetRow {
  billNo: string;
  item: string;
  saleTotal: number;
  orderMode: string;
  txnTime: string;
  steward: string;
  txnDate: string;
}
export interface CatDetSub {
  level2: string;
  level3: string;
  total: number;
  rows: CatDetRow[];
}
export interface CatDetGroup {
  level1: string;
  total: number;
  subs: CatDetSub[];
}
export interface CatDetLocation {
  locCode: string;
  locName: string;
  cats: CatDetGroup[];
  locTotal: number;
}
export interface CatDetailData {
  locationGroups: CatDetLocation[];
  grandTotal: number;
}

export interface CatRow {
  level1: string;
  item: string;
  value: number;
  date?: string;
  mode?: string;
  billNo?: string;
}

const fmtAmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const r2 = (n: number) => Math.round(n * 100) / 100;

// ── analytics rows (dashboard ekata) ──
export function summaryToCatRows(d: CatSummaryData): CatRow[] {
  const out: CatRow[] = [];
  for (const loc of d.locationGroups ?? [])
    for (const c of loc.cats ?? [])
      for (const s of c.subs ?? [])
        for (const it of s.items ?? [])
          out.push({ level1: c.level1, item: it.name, value: it.total });
  return out;
}
export function detailToCatRows(d: CatDetailData): CatRow[] {
  const out: CatRow[] = [];
  for (const loc of d.locationGroups ?? [])
    for (const c of loc.cats ?? [])
      for (const s of c.subs ?? [])
        for (const r of s.rows ?? [])
          out.push({
            level1: c.level1,
            item: r.item,
            value: r.saleTotal,
            date: r.txnDate,
            mode: r.orderMode,
            billNo: r.billNo,
          });
  return out;
}

// ── search filters ──
export function filterCategorySummary(d: CatSummaryData, q0: string): CatSummaryData {
  const q = q0.trim().toLowerCase();
  if (!q) return d;
  const locationGroups = (d.locationGroups ?? [])
    .map((loc) => {
      const cats = (loc.cats ?? [])
        .map((c) => {
          const subs = (c.subs ?? [])
            .map((s) => {
              const items = (s.items ?? []).filter(
                (it) =>
                  `${c.level1} ${s.level2} ${s.level3} ${it.name}`.toLowerCase().includes(q)
              );
              return { ...s, items, total: r2(items.reduce((t, i) => t + i.total, 0)) };
            })
            .filter((s) => s.items.length > 0);
          return { ...c, subs, total: r2(subs.reduce((t, s) => t + s.total, 0)) };
        })
        .filter((c) => c.subs.length > 0);
      return { ...loc, cats, locTotal: r2(cats.reduce((t, c) => t + c.total, 0)) };
    })
    .filter((l) => l.cats.length > 0);
  return { locationGroups, grandTotal: r2(locationGroups.reduce((t, l) => t + l.locTotal, 0)) };
}

export function filterCategoryDetail(d: CatDetailData, q0: string): CatDetailData {
  const q = q0.trim().toLowerCase();
  if (!q) return d;
  const locationGroups = (d.locationGroups ?? [])
    .map((loc) => {
      const cats = (loc.cats ?? [])
        .map((c) => {
          const subs = (c.subs ?? [])
            .map((s) => {
              const rows = (s.rows ?? []).filter((r) =>
                `${c.level1} ${s.level2} ${s.level3} ${r.billNo} ${r.item} ${r.orderMode} ${r.steward}`
                  .toLowerCase()
                  .includes(q)
              );
              return { ...s, rows, total: r2(rows.reduce((t, r) => t + r.saleTotal, 0)) };
            })
            .filter((s) => s.rows.length > 0);
          return { ...c, subs, total: r2(subs.reduce((t, s) => t + s.total, 0)) };
        })
        .filter((c) => c.subs.length > 0);
      return { ...loc, cats, locTotal: r2(cats.reduce((t, c) => t + c.total, 0)) };
    })
    .filter((l) => l.cats.length > 0);
  return { locationGroups, grandTotal: r2(locationGroups.reduce((t, l) => t + l.locTotal, 0)) };
}

// ── flat styles ──
const NAVY = "#684830";
const thRow: CSSProperties = {
  background: "#E4D6BF",
  color: "#684830",
  fontWeight: 700,
  fontSize: 11,
  fontFamily: "Inter, sans-serif",
};
const locBar: CSSProperties = {
  background: "#F0E8D8",
  color: "#45301D",
  border: "1px solid #E4D6BF",
  borderRadius: 8,
  padding: "8px 12px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontSize: 12,
  fontWeight: 700,
  fontFamily: "Inter, sans-serif",
};
const catBar: CSSProperties = {
  background: "#F0E8D8",
  borderLeft: `3px solid #684830`,
  borderRadius: 6,
  padding: "6px 10px",
  display: "flex",
  justifyContent: "space-between",
  fontSize: 12,
  fontWeight: 800,
  color: NAVY,
  fontFamily: "Inter, sans-serif",
};
const subBar: CSSProperties = {
  padding: "4px 10px 4px 22px",
  display: "flex",
  justifyContent: "space-between",
  fontSize: 11,
  fontWeight: 700,
  color: "#6B543E",
  fontFamily: "Inter, sans-serif",
};
const cell: CSSProperties = {
  padding: "5px 10px",
  fontSize: 11.5,
  fontFamily: "Inter, sans-serif",
  color: "#45301D",
};
const num: CSSProperties = { ...cell, textAlign: "right", fontVariantNumeric: "tabular-nums" };

function GrandBanner({ total }: { total: number }) {
  return (
    <div style={{ ...locBar, background: "#684830", color: "#fff", marginTop: 14, fontSize: 13 }}>
      <span>Grand Total (all locations)</span>
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtAmt(total)}</span>
    </div>
  );
}

function LocHead({ loc }: { loc: { locCode: string; locName: string; locTotal: number } }) {
  return (
    <div style={{ ...locBar, marginTop: 16 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <IconPin size={13} />
        {loc.locCode} — {loc.locName}
      </span>
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtAmt(loc.locTotal)}</span>
    </div>
  );
}

// ═══════════════ 1.3.1 SUMMARY (POS "Category Wise Sales" print eke widiyatama) ═══════════════
export default function CategorySummaryReport({ report }: { report: CatSummaryData }) {
  if ((report.locationGroups ?? []).length === 0)
    return (
      <p style={{ padding: 30, textAlign: "center", color: "#6B543E", fontFamily: "Inter, sans-serif", fontSize: 13 }}>
        No category sales found for this range.
      </p>
    );
  return (
    <div style={{ background: "#fff", border: `1px solid ${"#E4D6BF"}`, borderRadius: 10, overflow: "hidden" }}>
      {/* column header — POS print eke light-blue header eka wage */}
      <div style={{ display: "flex", justifyContent: "space-between", background: "#E4D6BF", color: "#684830", fontWeight: 700, fontSize: 12, padding: "8px 14px", borderBottom: "2px solid #684830", fontFamily: "Inter, sans-serif" }}>
        <span>Item Categories</span>
        <span>SalesTotal</span>
      </div>

      {report.locationGroups.map((loc) => (
        <div key={loc.locCode}>
          <div style={{ background: "#F0E8D8", color: "#45301D", borderBottom: "1px solid #E4D6BF", padding: "7px 14px", display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, fontFamily: "Inter, sans-serif" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <IconPin size={13} />
              {loc.locCode} — {loc.locName}
            </span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtAmt(loc.locTotal)}</span>
          </div>

          {loc.cats.map((c) => (
            <div key={c.level1}>
              {/* category band */}
              <div style={{ background: "#F0E8D8", padding: "6px 14px", fontWeight: 800, fontSize: 12, color: "#684830", fontFamily: "Inter, sans-serif", textTransform: "uppercase" }}>
                {c.level1}
              </div>

              {/* item rows — level2/level3 + item name + total */}
              {c.subs.map((sub, si) =>
                sub.items.map((it, ii) => (
                  <div
                    key={`${si}-${ii}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "200px 1fr 150px",
                      gap: 10,
                      padding: "4px 14px",
                      borderBottom: "1px solid #FCF7F3",
                      fontSize: 11.5,
                      fontFamily: "Inter, sans-serif",
                      color: "#45301D",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ color: "#907860", fontSize: 10.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {[sub.level2, sub.level3].filter(Boolean).join(" / ")}
                    </span>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={it.name}>
                      {it.name}
                    </span>
                    <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtAmt(it.total)}</span>
                  </div>
                ))
              )}

              {/* category total — print eke wage bold + top border */}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 14px", borderTop: "1px solid #907860", fontWeight: 800, fontSize: 12, color: "#684830", fontFamily: "Inter, sans-serif" }}>
                <span>Category Total</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtAmt(c.total)}</span>
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* grand total — double underline wage */}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 14px", fontWeight: 800, fontSize: 13, color: "#684830", fontFamily: "Inter, sans-serif", borderBottom: "4px double #684830" }}>
        <span>Grand Total</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtAmt(report.grandTotal)}</span>
      </div>
    </div>
  );
}

// ═══════════════ 1.3.2 DETAIL ═══════════════
export function CategoryDetailReport({ report }: { report: CatDetailData }) {
  if ((report.locationGroups ?? []).length === 0)
    return (
      <p style={{ padding: 30, textAlign: "center", color: "#6B543E", fontFamily: "Inter, sans-serif", fontSize: 13 }}>
        No category sales found for this range.
      </p>
    );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {report.locationGroups.map((loc) => (
        <div key={loc.locCode}>
          <LocHead loc={loc} />
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
            <thead>
              <tr style={thRow}>
                <th style={{ ...cell, textAlign: "left", width: 90 }}>BillNO</th>
                <th style={{ ...cell, textAlign: "left" }}>MenuitemNM</th>
                <th style={{ ...cell, textAlign: "right", width: 110 }}>SaleTotal</th>
                <th style={{ ...cell, textAlign: "left", width: 90 }}>OrderMode</th>
                <th style={{ ...cell, textAlign: "left", width: 150 }}>TxnTime</th>
                <th style={{ ...cell, textAlign: "left", width: 90 }}>Steward</th>
              </tr>
            </thead>
            <tbody>
              {loc.cats.map((c) => (
                <Fragment key={c.level1}>
                  <tr>
                    <td colSpan={6} style={{ ...catBar, marginTop: 8 }}>
                      <span>{c.level1}</span>
                      <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtAmt(c.total)}</span>
                    </td>
                  </tr>
                  {c.subs.map((s, si) => (
                    <Fragment key={`${c.level1}-${si}`}>
                      <tr>
                        <td colSpan={6} style={subBar}>
                          <span>{[s.level2, s.level3].filter(Boolean).join(" / ") || "—"}</span>
                          <span style={{ fontVariantNumeric: "tabular-nums" }}>Sub Total {fmtAmt(s.total)}</span>
                        </td>
                      </tr>
                      {s.rows.map((r, ri) => (
                        <tr key={`${r.billNo}-${ri}`} style={{ background: ri % 2 === 1 ? "#FCF7F3" : "#fff" }}>
                          <td style={cell}>{r.billNo}</td>
                          <td style={cell}>{r.item}</td>
                          <td style={num}>{fmtAmt(r.saleTotal)}</td>
                          <td style={cell}>{r.orderMode}</td>
                          <td style={cell}>{r.txnDate} {r.txnTime}</td>
                          <td style={cell}>{r.steward}</td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                  <tr key={`${c.level1}-t`}>
                    <td colSpan={2} style={{ ...cell, fontWeight: 800, color: NAVY, background: "#F0E8D8" }}>
                      Main Category Total
                    </td>
                    <td colSpan={4} style={{ ...num, fontWeight: 800, color: NAVY, background: "#F0E8D8" }}>
                      {fmtAmt(c.total)}
                    </td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      <GrandBanner total={report.grandTotal} />
    </div>
  );
}
