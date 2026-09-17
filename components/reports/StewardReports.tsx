"use client";

// ============================================================
// LOCATION: components/reports/StewardReports.tsx
// 6.1 Steward Wise + 8.1 Service Charge Report renderer.
// POS "Service Charge Report" print parity: steward -> location
// -> date rows (Daily Collection) with Grand Collection and
// Service Chrg columns, Total Steward Collection rows and a
// Locationwise Collection grand total. Flat blue, no gradients.
// ============================================================
import type { CSSProperties } from "react";
import { IconPin } from "./ReportIcons";

export interface StwTotals {
  bills: number;
  pax: number;
  grand: number;
  serChg: number;
}
export interface StwRow {
  date: string;
  bills: number;
  pax: number;
  grand: number;
  serChg: number;
}
export interface StwLoc {
  locCode: string;
  locName: string;
  rows: StwRow[];
  totals: StwTotals;
}
export interface StwSteward {
  stewId: string;
  stewName: string;
  locs: StwLoc[];
  stewTotals: StwTotals;
}
export interface StewardData {
  includeSerChg: boolean;
  stewards: StwSteward[];
  grand: StwTotals;
}

const fmtAmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// -- analytics rows --
export function stewardToRows(d: StewardData): Array<{ date?: string; billNo?: string; desc: string; value: number; loc?: string }> {
  const out: Array<{ date?: string; billNo?: string; desc: string; value: number; loc?: string }> = [];
  for (const s of d.stewards ?? [])
    for (const l of s.locs ?? [])
      for (const r of l.rows ?? [])
        out.push({ date: r.date, desc: `${s.stewId} ${s.stewName}`.trim(), value: r.grand, loc: l.locName });
  return out;
}

// -- search filter --
export function filterSteward(d: StewardData, q0: string): StewardData {
  const q = q0.trim().toLowerCase();
  if (!q) return d;
  const stewards = (d.stewards ?? [])
    .filter((s) => `${s.stewId} ${s.stewName}`.toLowerCase().includes(q) ||
      s.locs.some((l) => `${l.locCode} ${l.locName}`.toLowerCase().includes(q) ||
        l.rows.some((r) => r.date.toLowerCase().includes(q))))
    .map((s) => ({
      ...s,
      locs: s.locs
        .map((l) => ({
          ...l,
          rows: `${s.stewId} ${s.stewName}`.toLowerCase().includes(q) || `${l.locCode} ${l.locName}`.toLowerCase().includes(q)
            ? l.rows
            : l.rows.filter((r) => r.date.toLowerCase().includes(q)),
        }))
        .filter((l) => l.rows.length > 0),
    }))
    .filter((s) => s.locs.length > 0);
  return { ...d, stewards };
}

// -- flat rows for the shared PDF document --
export function flattenStewardForPdf(d: StewardData): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  for (const s of d.stewards ?? []) {
    for (const l of s.locs ?? [])
      for (const r of l.rows ?? [])
        out.push({ steward: `${s.stewId} ${s.stewName}`.trim(), locCode: l.locCode, date: r.date, bills: r.bills, pax: r.pax, grand: r.grand, serChg: r.serChg });
    out.push({ steward: `${s.stewId} ${s.stewName}`.trim(), locCode: "", date: "Total Steward Collection", bills: s.stewTotals.bills, pax: s.stewTotals.pax, grand: s.stewTotals.grand, serChg: s.stewTotals.serChg });
  }
  out.push({ steward: "LOCATIONWISE COLLECTION", locCode: "", date: "", bills: d.grand.bills, pax: d.grand.pax, grand: d.grand.grand, serChg: d.grand.serChg });
  return out;
}

export const STW_PDF_COLUMNS = [
  { header: "Steward", accessorKey: "steward", type: "text" as const },
  { header: "Location", accessorKey: "locCode", type: "text" as const },
  { header: "Date", accessorKey: "date", type: "text" as const },
  { header: "Bills", accessorKey: "bills", type: "number" as const },
  { header: "Pax", accessorKey: "pax", type: "number" as const },
  { header: "Grand Collection", accessorKey: "grand", type: "currency" as const },
  { header: "Service Chrg", accessorKey: "serChg", type: "currency" as const },
];

// -- flat styles --
const NAVY = "#0d2b57";
const cell: CSSProperties = {
  padding: "5px 10px",
  fontSize: 11.5,
  fontFamily: "Inter, sans-serif",
  color: "#1e293b",
  verticalAlign: "top",
};
const num: CSSProperties = { ...cell, textAlign: "right", fontVariantNumeric: "tabular-nums" };

export default function StewardSummaryReport({ report }: { report: StewardData }) {
  if ((report.stewards ?? []).length === 0)
    return (
      <p style={{ padding: 30, textAlign: "center", color: "#64748b", fontFamily: "Inter, sans-serif", fontSize: 13 }}>
        No records found for this range.
      </p>
    );
  const sc = report.includeSerChg;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {report.stewards.map((s) => (
        <div key={s.stewId}>
          <div
            style={{
              background: NAVY,
              color: "#fff",
              borderRadius: 8,
              padding: "8px 12px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 12,
              fontWeight: 700,
              fontFamily: "Inter, sans-serif",
              marginTop: 16,
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <IconPin size={13} />
              {s.stewId} — {s.stewName}
            </span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtAmt(s.stewTotals.grand)}</span>
          </div>

          {s.locs.map((l) => (
            <div key={l.locCode} style={{ marginTop: 8 }}>
              <div
                style={{
                  background: "#dbeafe",
                  color: "#1e3a8a",
                  borderRadius: 6,
                  padding: "6px 10px",
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  fontWeight: 800,
                  fontFamily: "Inter, sans-serif",
                }}
              >
                <span>{l.locCode} — {l.locName}</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtAmt(l.totals.grand)}</span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 6 }}>
                <thead>
                  <tr style={{ background: "#eff6ff" }}>
                    <th style={{ ...cell, textAlign: "left", fontWeight: 700 }}>Date</th>
                    <th style={{ ...cell, textAlign: "right", width: 80, fontWeight: 700 }}>Bills</th>
                    <th style={{ ...cell, textAlign: "right", width: 80, fontWeight: 700 }}>Pax</th>
                    <th style={{ ...cell, textAlign: "right", fontWeight: 700 }}>Grand Collection</th>
                    {sc && <th style={{ ...cell, textAlign: "right", fontWeight: 700 }}>Service Chrg</th>}
                  </tr>
                </thead>
                <tbody>
                  {l.rows.map((r, ri) => (
                    <tr key={`${l.locCode}-${r.date}`} style={{ background: ri % 2 === 1 ? "#f8fafc" : "#fff" }}>
                      <td style={cell}>{r.date}</td>
                      <td style={num}>{r.bills}</td>
                      <td style={num}>{r.pax}</td>
                      <td style={num}>{fmtAmt(r.grand)}</td>
                      {sc && <td style={num}>{fmtAmt(r.serChg)}</td>}
                    </tr>
                  ))}
                  <tr style={{ background: "#fbfdff", borderTop: "1px solid #94a3b8" }}>
                    <td style={{ ...cell, fontWeight: 800, color: "#1e3a8a" }}>Total Steward Collection</td>
                    <td style={{ ...num, fontWeight: 800, color: "#1e3a8a" }}>{s.stewTotals.bills}</td>
                    <td style={{ ...num, fontWeight: 800, color: "#1e3a8a" }}>{s.stewTotals.pax}</td>
                    <td style={{ ...num, fontWeight: 800, color: NAVY }}>{fmtAmt(s.stewTotals.grand)}</td>
                    {sc && <td style={{ ...num, fontWeight: 800, color: NAVY }}>{fmtAmt(s.stewTotals.serChg)}</td>}
                  </tr>
                </tbody>
              </table>
            </div>
          ))}
        </div>
      ))}
      <div
        style={{
          background: "#1d4ed8",
          color: "#fff",
          borderRadius: 8,
          padding: "8px 12px",
          display: "flex",
          justifyContent: "space-between",
          fontSize: 13,
          fontWeight: 700,
          fontFamily: "Inter, sans-serif",
          marginTop: 14,
        }}
      >
        <span>Locationwise Collection (all stewards)</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtAmt(report.grand.grand)}</span>
      </div>
    </div>
  );
}
