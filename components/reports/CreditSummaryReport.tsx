"use client";

// ============================================================
// LOCATION: components/reports/CreditSummaryReport.tsx
// 21.1 Credit Settlement — Current Credit Summary renderer
// (POS Vw_CreditCustomer "Total Customers Credit" print
// parity): per customer: CustCode / CustName / This Credit
// Period / Total Credit with totals. Flat blue theme; PDF in
// the shared print style.
// ============================================================
import type { CSSProperties } from "react";
import { IconPin } from "./ReportIcons";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

export interface CreditCustomer {
  code: string;
  name: string;
  period: number;
  total: number;
}
export interface CreditSummaryLocation {
  locCode: string;
  locName: string;
  customers: CreditCustomer[];
  locPeriod: number;
  locTotal: number;
}
export interface CreditSummaryData {
  locationGroups: CreditSummaryLocation[];
  grandPeriod: number;
  grandTotal: number;
}

const fmtAmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function credSumToRows(d: CreditSummaryData): Array<{ date?: string; billNo?: string; desc: string; value: number; loc?: string }> {
  const out: Array<{ date?: string; billNo?: string; desc: string; value: number; loc?: string }> = [];
  for (const l of d.locationGroups ?? [])
    for (const c of l.customers ?? [])
      out.push({ billNo: c.code, desc: c.name, value: c.total, loc: l.locName });
  return out;
}

export function filterCreditSummary(d: CreditSummaryData, q0: string): CreditSummaryData {
  const q = q0.trim().toLowerCase();
  if (!q) return d;
  const locationGroups = (d.locationGroups ?? [])
    .map((l) => ({
      ...l,
      customers: (l.customers ?? []).filter((c) => `${c.code} ${c.name}`.toLowerCase().includes(q)),
    }))
    .filter((l) => l.customers.length > 0);
  return { ...d, locationGroups };
}

const NAVY = "#0d2b57";
const cell: CSSProperties = {
  padding: "5px 10px",
  fontSize: 11.5,
  fontFamily: "Inter, sans-serif",
  color: "#1e293b",
  verticalAlign: "top",
};
const num: CSSProperties = { ...cell, textAlign: "right", fontVariantNumeric: "tabular-nums" };

export default function CreditSummaryReport({ report }: { report: CreditSummaryData }) {
  if ((report.locationGroups ?? []).length === 0)
    return (
      <p style={{ padding: 30, textAlign: "center", color: "#64748b", fontFamily: "Inter, sans-serif", fontSize: 13 }}>
        No credit customers for this range.
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
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtAmt(l.locTotal)}</span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 6 }}>
            <thead>
              <tr style={{ background: "#eff6ff" }}>
                <th style={{ ...cell, textAlign: "left", width: 110, fontWeight: 700 }}>Cust Code</th>
                <th style={{ ...cell, textAlign: "left", fontWeight: 700 }}>Customer Name</th>
                <th style={{ ...cell, textAlign: "right", width: 150, fontWeight: 700 }}>This Credit Period</th>
                <th style={{ ...cell, textAlign: "right", width: 130, fontWeight: 700 }}>Total Credit</th>
              </tr>
            </thead>
            <tbody>
              {l.customers.map((c, i) => (
                <tr key={`${l.locCode}-${c.code}`} style={{ background: i % 2 === 1 ? "#f8fafc" : "#fff" }}>
                  <td style={{ ...cell, fontWeight: 700 }}>{c.code}</td>
                  <td style={cell}>{c.name}</td>
                  <td style={num}>{fmtAmt(c.period)}</td>
                  <td style={{ ...num, fontWeight: 700, color: NAVY }}>{fmtAmt(c.total)}</td>
                </tr>
              ))}
              <tr style={{ background: "#fbfdff", borderTop: "1px solid #94a3b8" }}>
                <td colSpan={2} style={{ ...cell, fontWeight: 800, color: "#1e3a8a" }}>Location Total</td>
                <td style={num}>{fmtAmt(l.locPeriod)}</td>
                <td style={{ ...num, fontWeight: 800, color: NAVY }}>{fmtAmt(l.locTotal)}</td>
              </tr>
            </tbody>
          </table>
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
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          {fmtAmt(report.grandPeriod)} · {fmtAmt(report.grandTotal)}
        </span>
      </div>
    </div>
  );
}

// ── PDF — shared print style ──
const pStyles = StyleSheet.create({
  page: { padding: 28, fontFamily: "Helvetica", fontSize: 9, color: "#1a1a1a" },
  title: { textAlign: "center", fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 10 },
  infoRow: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 2 },
  infoLabel: { width: 80 },
  range: { fontFamily: "Helvetica-Bold", fontSize: 10, marginTop: 8, marginBottom: 4 },
  location: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    marginTop: 12,
    marginBottom: 4,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
  },
  row: { flexDirection: "row" },
  th: {
    backgroundColor: "#efefef",
    fontFamily: "Helvetica-Bold",
    padding: 4,
    fontSize: 8,
    borderRightWidth: 1,
    borderRightColor: "#cccccc",
    borderBottomWidth: 1,
    borderBottomColor: "#999999",
  },
  td: { padding: 4, borderRightWidth: 1, borderRightColor: "#e5e5e5" },
  bold: { fontFamily: "Helvetica-Bold" },
  right: { textAlign: "right" },
  totalRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#1a1a1a", marginTop: 2 },
  grandRow: { flexDirection: "row", borderTopWidth: 2, borderTopColor: "#1a1a1a", marginTop: 6, paddingTop: 4 },
});
const CW = { code: 70, name: 200, period: 110, total: 100 };

export function CreditSummaryPdfDocument({
  title,
  printDate,
  printTime,
  from,
  to,
  data,
}: {
  title: string;
  printDate: string;
  printTime: string;
  from: string;
  to: string;
  data: CreditSummaryData;
}) {
  return (
    <Document>
      <Page size="A4" style={pStyles.page}>
        <Text style={pStyles.title}>{title}</Text>
        <View style={pStyles.infoRow}>
          <Text style={pStyles.infoLabel}>Print Date</Text>
          <Text>: {printDate}</Text>
        </View>
        <View style={pStyles.infoRow}>
          <Text style={pStyles.infoLabel}>Print Time</Text>
          <Text>: {printTime}</Text>
        </View>
        <Text style={pStyles.range}>From {from}  To {to}</Text>
        {data.locationGroups.map((l) => (
          <View key={l.locCode}>
            <Text style={pStyles.location}>{l.locCode}   {l.locName}</Text>
            <View style={pStyles.row}>
              <Text style={[pStyles.th, { width: CW.code }]}>Cust Code</Text>
              <Text style={[pStyles.th, { width: CW.name }]}>Customer Name</Text>
              <Text style={[pStyles.th, { width: CW.period }, pStyles.right]}>This Credit Period</Text>
              <Text style={[pStyles.th, { width: CW.total }, pStyles.right]}>Total Credit</Text>
            </View>
            {l.customers.map((c) => (
              <View style={pStyles.row} key={c.code}>
                <Text style={[pStyles.td, { width: CW.code }]}>{c.code}</Text>
                <Text style={[pStyles.td, { width: CW.name }]}>{c.name}</Text>
                <Text style={[pStyles.td, { width: CW.period }, pStyles.right]}>{fmtAmt(c.period)}</Text>
                <Text style={[pStyles.td, { width: CW.total }, pStyles.right]}>{fmtAmt(c.total)}</Text>
              </View>
            ))}
            <View style={pStyles.totalRow}>
              <Text style={[pStyles.td, { width: CW.code + CW.name }, pStyles.bold]}>Location Total</Text>
              <Text style={[pStyles.td, { width: CW.period }, pStyles.right]}>{fmtAmt(l.locPeriod)}</Text>
              <Text style={[pStyles.td, { width: CW.total }, pStyles.right, pStyles.bold]}>{fmtAmt(l.locTotal)}</Text>
            </View>
          </View>
        ))}
        <View style={pStyles.grandRow}>
          <Text style={[pStyles.bold, { width: CW.code + CW.name }]}>Grand Total</Text>
          <Text style={[pStyles.bold, { width: CW.period }, pStyles.right]}>{fmtAmt(data.grandPeriod)}</Text>
          <Text style={[pStyles.bold, { width: CW.total }, pStyles.right]}>{fmtAmt(data.grandTotal)}</Text>
        </View>
      </Page>
    </Document>
  );
}
