"use client";

// ============================================================
// LOCATION: components/reports/PaymentGridReports.tsx
// 2.3 Payment - Bill Pay Mode Wise Grid renderer.
// Mirrors the POS "Bills By Pay Mode Wise" print: rows = bills,
// columns = pay modes, right column = bill total, bottom row =
// per-mode totals, then grand total. Flat blue theme, no gradients.
// ============================================================
import type { CSSProperties } from "react";
import { IconPin } from "./ReportIcons";
import type { PayRow } from "./PaymentReports";

export interface GridBill {
  billNo: string;
  date: string;
  cells: Record<string, number>;
  total: number;
}
export interface GridLocation {
  locCode: string;
  locName: string;
  payModes: string[];
  bills: GridBill[];
  modeTotals: Record<string, number>;
  locTotal: number;
}
export interface BillPayModeGridData {
  locationGroups: GridLocation[];
  grandTotal: number;
}

const fmtAmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const r2 = (n: number) => Math.round(n * 100) / 100;

// -- analytics rows (reuses the shared PayRow shape) --
export function gridToRows(d: BillPayModeGridData): PayRow[] {
  const out: PayRow[] = [];
  for (const loc of d.locationGroups ?? [])
    for (const b of loc.bills ?? [])
      for (const [mode, amt] of Object.entries(b.cells ?? {}))
        out.push({ date: b.date, billNo: b.billNo, desc: mode, value: amt, loc: loc.locName });
  return out;
}

// -- search filter --
export function filterPayGrid(d: BillPayModeGridData, q0: string): BillPayModeGridData {
  const q = q0.trim().toLowerCase();
  if (!q) return d;
  const locationGroups = (d.locationGroups ?? [])
    .map((loc) => {
      const bills = (loc.bills ?? [])
        .map((b) => {
          const billHit = b.billNo.toLowerCase().includes(q);
          const cells: Record<string, number> = {};
          for (const [mode, amt] of Object.entries(b.cells ?? {})) {
            if (billHit || mode.toLowerCase().includes(q)) cells[mode] = amt;
          }
          return { ...b, cells, total: r2(Object.values(cells).reduce((s, v) => s + v, 0)) };
        })
        .filter((b) => Object.keys(b.cells).length > 0);
      const modeTotals: Record<string, number> = {};
      for (const b of bills)
        for (const [m, v] of Object.entries(b.cells)) modeTotals[m] = r2((modeTotals[m] ?? 0) + v);
      const payModes = (loc.payModes ?? []).filter((m) => modeTotals[m] !== undefined);
      return {
        ...loc,
        bills,
        payModes,
        modeTotals,
        locTotal: r2(Object.values(modeTotals).reduce((s, v) => s + v, 0)),
      };
    })
    .filter((l) => l.bills.length > 0);
  return {
    locationGroups,
    grandTotal: r2(locationGroups.reduce((s, l) => s + l.locTotal, 0)),
  };
}

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

export default function BillPayModeGridReport({ report }: { report: BillPayModeGridData }) {
  if ((report.locationGroups ?? []).length === 0)
    return (
      <p style={{ padding: 30, textAlign: "center", color: "#64748b", fontFamily: "Inter, sans-serif", fontSize: 13 }}>
        No payment records found for this range.
      </p>
    );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {report.locationGroups.map((loc) => (
        <div key={loc.locCode}>
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
              {loc.locCode} — {loc.locName}
            </span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtAmt(loc.locTotal)}</span>
          </div>

          <div style={{ overflowX: "auto", marginTop: 6 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#dbeafe", borderBottom: "2px solid #1d4ed8" }}>
                  <th style={{ ...cell, textAlign: "left", minWidth: 110, fontWeight: 800, color: "#1e3a8a" }}>
                    Bill No
                  </th>
                  {loc.payModes.map((m) => (
                    <th key={m} style={{ ...cell, textAlign: "right", fontWeight: 700, color: "#1e3a8a", whiteSpace: "nowrap" }}>
                      {m}
                    </th>
                  ))}
                  <th style={{ ...cell, textAlign: "right", minWidth: 110, fontWeight: 800, color: "#1e3a8a" }}>
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {loc.bills.map((b, bi) => (
                  <tr key={b.billNo} style={{ background: bi % 2 === 1 ? "#f8fafc" : "#fff" }}>
                    <td style={{ ...cell, fontWeight: 700 }}>{b.billNo}</td>
                    {loc.payModes.map((m) => (
                      <td key={m} style={num}>
                        {b.cells[m] !== undefined ? fmtAmt(b.cells[m]) : ""}
                      </td>
                    ))}
                    <td style={{ ...num, fontWeight: 800, color: NAVY, background: "#eff6ff" }}>
                      {fmtAmt(b.total)}
                    </td>
                  </tr>
                ))}
                <tr style={{ background: "#dbeafe", borderTop: "1px solid #94a3b8" }}>
                  <td style={{ ...cell, fontWeight: 800, color: "#1e3a8a" }}>Total</td>
                  {loc.payModes.map((m) => (
                    <td key={m} style={{ ...num, fontWeight: 800, color: "#1e3a8a" }}>
                      {fmtAmt(loc.modeTotals[m] ?? 0)}
                    </td>
                  ))}
                  <td style={{ ...num, fontWeight: 800, color: NAVY }}>{fmtAmt(loc.locTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
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
        <span>Grand Total (all locations)</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtAmt(report.grandTotal)}</span>
      </div>
    </div>
  );
}
