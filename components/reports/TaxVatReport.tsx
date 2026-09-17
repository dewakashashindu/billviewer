"use client";

// ============================================================
// LOCATION: components/reports/TaxVatReport.tsx
// 8.2 Taxes And Service Charge - Tax & VAT Report renderer.
// POS "Taxes And Vat Report" print parity: bill-wise rows with
// Sales W/O Tax, VAT, TDL, Other VAT, Packing and VAT+TDL Total,
// Locationwise Total rows + grand total. Flat blue, no gradients.
// ============================================================
import type { CSSProperties } from "react";
import { IconPin } from "./ReportIcons";

export interface TaxVatRow {
  billNo: string;
  date: string;
  salesWOT: number;
  vat: number;
  tdl: number;
  otherVat: number;
  packing: number;
  vatTdl: number;
}
export interface TaxVatTotals {
  salesWOT: number;
  vat: number;
  tdl: number;
  otherVat: number;
  packing: number;
  vatTdl: number;
}
export interface TaxVatLocation {
  locCode: string;
  locName: string;
  rows: TaxVatRow[];
  totals: TaxVatTotals;
}
export interface TaxVatData {
  locationGroups: TaxVatLocation[];
  grand: TaxVatTotals;
}

export const TAXVAT_COLUMNS: { h: string; k: keyof TaxVatRow; time?: boolean }[] = [
  { h: "Sales W/O Tax", k: "salesWOT" },
  { h: "VAT", k: "vat" },
  { h: "TDL", k: "tdl" },
  { h: "Other VAT", k: "otherVat" },
  { h: "Packing", k: "packing" },
  { h: "VAT+TDL Total", k: "vatTdl" },
];

const fmtAmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// -- analytics rows (full tax shape for the taxes branch) --
export function taxVatToRows(
  d: TaxVatData
): Array<{ date?: string; billNo?: string; loc?: string; vat: number; tdl: number; otherVat: number; packing: number; vatTdl: number }> {
  const out: Array<{ date?: string; billNo?: string; loc?: string; vat: number; tdl: number; otherVat: number; packing: number; vatTdl: number }> = [];
  for (const l of d.locationGroups ?? [])
    for (const r of l.rows ?? [])
      out.push({
        date: r.date,
        billNo: r.billNo,
        loc: l.locName,
        vat: r.vat,
        tdl: r.tdl,
        otherVat: r.otherVat,
        packing: r.packing,
        vatTdl: r.vatTdl,
      });
  return out;
}

// -- search filter --
export function filterTaxVat(d: TaxVatData, q0: string): TaxVatData {
  const q = q0.trim().toLowerCase();
  if (!q) return d;
  const locationGroups = (d.locationGroups ?? [])
    .map((l) => ({
      ...l,
      rows: (l.rows ?? []).filter((r) =>
        `${r.billNo} ${r.date} ${l.locCode} ${l.locName}`.toLowerCase().includes(q)
      ),
    }))
    .filter((l) => l.rows.length > 0);
  return { ...d, locationGroups };
}

// -- flat rows for the shared PDF document --
export function flattenTaxVatForPdf(d: TaxVatData): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  for (const l of d.locationGroups ?? []) {
    for (const r of l.rows ?? []) out.push({ ...r, locCode: l.locCode, billNo: r.billNo, date: r.date });
    out.push({ locCode: l.locCode, billNo: "Locationwise Total", date: "", ...l.totals });
  }
  out.push({ locCode: "GRAND TOTAL", billNo: "", date: "", ...d.grand });
  return out;
}

export const TAXVAT_PDF_COLUMNS = [
  { header: "Location", accessorKey: "locCode", type: "text" as const },
  { header: "Bill No", accessorKey: "billNo", type: "text" as const },
  { header: "Date", accessorKey: "date", type: "text" as const },
  ...TAXVAT_COLUMNS.map((c) => ({ header: c.h, accessorKey: c.k as string, type: "currency" as const })),
];

// -- flat styles --
const NAVY = "#0d2b57";
const cell: CSSProperties = {
  padding: "5px 10px",
  fontSize: 11.5,
  fontFamily: "Inter, sans-serif",
  color: "#1e293b",
  verticalAlign: "top",
  whiteSpace: "nowrap",
};
const num: CSSProperties = { ...cell, textAlign: "right", fontVariantNumeric: "tabular-nums" };

export default function TaxVatReport({ report }: { report: TaxVatData }) {
  if ((report.locationGroups ?? []).length === 0)
    return (
      <p style={{ padding: 30, textAlign: "center", color: "#64748b", fontFamily: "Inter, sans-serif", fontSize: 13 }}>
        No tax records found for this range.
      </p>
    );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {report.locationGroups.map((l) => (
        <div key={l.locCode}>
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
              {l.locCode} — {l.locName}
            </span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtAmt(l.totals.vatTdl)}</span>
          </div>

          <div style={{ overflowX: "auto", marginTop: 6 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#dbeafe", borderBottom: "2px solid #1d4ed8" }}>
                  <th style={{ ...cell, textAlign: "left", fontWeight: 800, color: "#1e3a8a" }}>Bill No</th>
                  <th style={{ ...cell, textAlign: "left", fontWeight: 700, color: "#1e3a8a" }}>Date</th>
                  {TAXVAT_COLUMNS.map((c) => (
                    <th key={c.k as string} style={{ ...cell, textAlign: "right", fontWeight: 700, color: "#1e3a8a" }}>
                      {c.h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {l.rows.map((r, ri) => (
                  <tr key={`${l.locCode}-${r.billNo}`} style={{ background: ri % 2 === 1 ? "#f8fafc" : "#fff" }}>
                    <td style={{ ...cell, fontWeight: 700 }}>{r.billNo}</td>
                    <td style={cell}>{r.date}</td>
                    {TAXVAT_COLUMNS.map((c) => (
                      <td key={c.k as string} style={num}>
                        {fmtAmt(r[c.k] as number)}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr style={{ background: "#dbeafe", borderTop: "1px solid #94a3b8" }}>
                  <td colSpan={2} style={{ ...cell, fontWeight: 800, color: "#1e3a8a" }}>
                    Locationwise Total
                  </td>
                  {TAXVAT_COLUMNS.map((c) => (
                    <td key={c.k as string} style={{ ...num, fontWeight: 800, color: "#1e3a8a" }}>
                      {fmtAmt(l.totals[c.k as keyof TaxVatTotals])}
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
          fontSize: 13,
          fontWeight: 700,
          fontFamily: "Inter, sans-serif",
          marginTop: 14,
        }}
      >
        <span>Locationwise Total (all locations)</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtAmt(report.grand.vatTdl)}</span>
      </div>
    </div>
  );
}
