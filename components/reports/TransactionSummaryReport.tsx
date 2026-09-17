"use client";

// ============================================================
// LOCATION: components/reports/TransactionSummaryReport.tsx
// 7.1 Transaction Summary renderer (POS Vw_DailyPerformance
// "Transaction Summary By Date" print parity): per-location date
// rows with pax / spending / avg time / dept sales columns,
// bold Total row per location, grand total + bill duration.
// Flat blue theme, no gradients.
// ============================================================
import type { CSSProperties } from "react";
import { IconPin } from "./ReportIcons";

export interface TxnRow {
  txnDate: string;
  bills: number;
  localPax: number;
  foreignPax: number;
  totalPax: number;
  spendingPerBill: number;
  spendingPerPax: number;
  avgPaxPerBill: number;
  avgTimePerBill: string;
  foodSales: number;
  beverageSales: number;
  sugarSales: number;
  otherSales: number;
  salesSupp: number;
  salesWOE: number;
  totExtraIncome: number;
  salesVolume: number;
}
export interface TxnLocation {
  locCode: string;
  locName: string;
  rows: TxnRow[];
  totals: TxnRow;
}
export interface TxnSummaryData {
  locationGroups: TxnLocation[];
  grand: TxnRow;
  billDuration: string;
}

export const TXN_COLUMNS: { h: string; k: keyof TxnRow; t: "int" | "cur" | "time" }[] = [
  { h: "Bills", k: "bills", t: "int" },
  { h: "Local Pax", k: "localPax", t: "int" },
  { h: "Foreign Pax", k: "foreignPax", t: "int" },
  { h: "Total Pax", k: "totalPax", t: "int" },
  { h: "Spending / Bill", k: "spendingPerBill", t: "cur" },
  { h: "Spending / Pax", k: "spendingPerPax", t: "cur" },
  { h: "Avg Pax / Bill", k: "avgPaxPerBill", t: "cur" },
  { h: "Avg Time / Bill", k: "avgTimePerBill", t: "time" },
  { h: "Food Sales", k: "foodSales", t: "cur" },
  { h: "Beverage Sales", k: "beverageSales", t: "cur" },
  { h: "Sugar Sales", k: "sugarSales", t: "cur" },
  { h: "Other Sales", k: "otherSales", t: "cur" },
  { h: "Sales Supp.", k: "salesSupp", t: "cur" },
  { h: "Sales WOE", k: "salesWOE", t: "cur" },
  { h: "Tot Extra Income", k: "totExtraIncome", t: "cur" },
  { h: "Sales Volume", k: "salesVolume", t: "cur" },
];

const fmtAmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtCell = (v: string | number, t: "int" | "cur" | "time") =>
  t === "time" ? String(v) : t === "int" ? String(Math.round(Number(v))) : fmtAmt(Number(v));

// -- analytics rows (generic shape: date + value columns) --
export function txnToRows(d: TxnSummaryData): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  for (const loc of d.locationGroups ?? [])
    for (const r of loc.rows ?? []) out.push({ ...r, loc: loc.locName });
  return out;
}

// -- search filter --
export function filterTxnSummary(d: TxnSummaryData, q0: string): TxnSummaryData {
  const q = q0.trim().toLowerCase();
  if (!q) return d;
  const locationGroups = (d.locationGroups ?? [])
    .map((loc) => ({
      ...loc,
      rows: (loc.rows ?? []).filter((r) =>
        `${r.txnDate} ${loc.locCode} ${loc.locName}`.toLowerCase().includes(q)
      ),
    }))
    .filter((l) => l.rows.length > 0);
  return { ...d, locationGroups };
}

// -- flat rows for the shared PDF document (with Total rows) --
export function flattenTxnForPdf(d: TxnSummaryData): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  for (const loc of d.locationGroups ?? []) {
    for (const r of loc.rows ?? []) out.push({ locCode: loc.locCode, ...r });
    out.push({ locCode: loc.locCode, ...loc.totals, txnDate: "Total" });
  }
  out.push({ locCode: "GRAND TOTAL", ...d.grand, txnDate: "" });
  return out;
}

export const TXN_PDF_COLUMNS = [
  { header: "Location", accessorKey: "locCode", type: "text" as const },
  { header: "Txn Date", accessorKey: "txnDate", type: "text" as const },
  ...TXN_COLUMNS.map((c) => ({
    header: c.h,
    accessorKey: c.k as string,
    type: (c.t === "int" ? "number" : "currency") as "number" | "currency",
  })),
];

// -- flat styles --
const NAVY = "#0d2b57";
const cell: CSSProperties = {
  padding: "5px 8px",
  fontSize: 11,
  fontFamily: "Inter, sans-serif",
  color: "#1e293b",
  verticalAlign: "top",
  whiteSpace: "nowrap",
};
const num: CSSProperties = { ...cell, textAlign: "right", fontVariantNumeric: "tabular-nums" };

export default function TransactionSummaryReport({ report }: { report: TxnSummaryData }) {
  if ((report.locationGroups ?? []).length === 0)
    return (
      <p style={{ padding: 30, textAlign: "center", color: "#64748b", fontFamily: "Inter, sans-serif", fontSize: 13 }}>
        No transaction records found for this range.
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
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtAmt(loc.totals.salesVolume)}</span>
          </div>

          <div style={{ overflowX: "auto", marginTop: 6 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#dbeafe", borderBottom: "2px solid #1d4ed8" }}>
                  <th style={{ ...cell, textAlign: "left", fontWeight: 800, color: "#1e3a8a" }}>Txn Date</th>
                  {TXN_COLUMNS.map((c) => (
                    <th key={c.k as string} style={{ ...cell, textAlign: "right", fontWeight: 700, color: "#1e3a8a" }}>
                      {c.h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loc.rows.map((r, ri) => (
                  <tr key={`${loc.locCode}-${r.txnDate}`} style={{ background: ri % 2 === 1 ? "#f8fafc" : "#fff" }}>
                    <td style={{ ...cell, fontWeight: 700 }}>{r.txnDate}</td>
                    {TXN_COLUMNS.map((c) => (
                      <td key={c.k as string} style={num}>
                        {fmtCell(r[c.k], c.t)}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr style={{ background: "#dbeafe", borderTop: "1px solid #94a3b8" }}>
                  <td style={{ ...cell, fontWeight: 800, color: "#1e3a8a" }}>Total</td>
                  {TXN_COLUMNS.map((c) => (
                    <td key={c.k as string} style={{ ...num, fontWeight: 800, color: "#1e3a8a" }}>
                      {fmtCell(loc.totals[c.k], c.t)}
                    </td>
                  ))}
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
          alignItems: "center",
          fontSize: 13,
          fontWeight: 700,
          fontFamily: "Inter, sans-serif",
          marginTop: 14,
        }}
      >
        <span>Grand Total (all locations) — Bill Duration {report.billDuration}</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtAmt(report.grand.salesVolume)}</span>
      </div>
    </div>
  );
}
