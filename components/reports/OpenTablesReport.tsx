"use client";

// ============================================================
// LOCATION: components/reports/OpenTablesReport.tsx
// 14 Open (On-Going) Tables renderer (POS Vw_HoldUps "Open Table
// Details" print parity): table/section bands with held item
// rows (Description / Qty / Sales Price / Item Price /
// OrderMode / Cancel / Cashier), Table Amount per section and a
// Grand Total. Flat blue theme; PDF in the shared print style.
// ============================================================
import type { CSSProperties } from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

export interface OpenRow {
  desc: string;
  qty: number;
  price: number;
  value: number;
  mode: string;
  cancel: string;
  cashier: string;
}
export interface OpenSection {
  code: string;
  rows: OpenRow[];
  amount: number;
}
export interface OpenTablesData {
  sections: OpenSection[];
  grandTotal: number;
}

const fmtAmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtQty = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function openToRows(d: OpenTablesData): Array<{ date?: string; billNo?: string; desc: string; value: number; loc?: string }> {
  const out: Array<{ date?: string; billNo?: string; desc: string; value: number; loc?: string }> = [];
  for (const s of d.sections ?? [])
    for (const r of s.rows ?? []) out.push({ billNo: s.code, desc: r.desc, value: r.value });
  return out;
}

export function filterOpen(d: OpenTablesData, q0: string): OpenTablesData {
  const q = q0.trim().toLowerCase();
  if (!q) return d;
  const sections = (d.sections ?? [])
    .map((s) => ({
      ...s,
      rows: (s.rows ?? []).filter((r) =>
        `${s.code} ${r.desc} ${r.mode} ${r.cancel} ${r.cashier}`.toLowerCase().includes(q)
      ),
    }))
    .filter((s) => s.rows.length > 0);
  return { ...d, sections };
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

export default function OpenTablesReport({ report }: { report: OpenTablesData }) {
  if ((report.sections ?? []).length === 0)
    return (
      <p style={{ padding: 30, textAlign: "center", color: "#64748b", fontFamily: "Inter, sans-serif", fontSize: 13 }}>
        No open tables right now.
      </p>
    );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {report.sections.map((s) => (
        <div key={s.code}>
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
              marginTop: 12,
            }}
          >
            <span>TABLE {s.code}</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtAmt(s.amount)}</span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 6 }}>
            <thead>
              <tr style={{ background: "#eff6ff" }}>
                <th style={{ ...cell, textAlign: "left", fontWeight: 700 }}>Description</th>
                <th style={{ ...cell, textAlign: "right", width: 70, fontWeight: 700 }}>Qty</th>
                <th style={{ ...cell, textAlign: "right", width: 100, fontWeight: 700 }}>Sales Price</th>
                <th style={{ ...cell, textAlign: "right", width: 100, fontWeight: 700 }}>Item Price</th>
                <th style={{ ...cell, textAlign: "left", width: 100, fontWeight: 700 }}>Order Mode</th>
                <th style={{ ...cell, textAlign: "left", width: 80, fontWeight: 700 }}>Cancel</th>
                <th style={{ ...cell, textAlign: "left", width: 100, fontWeight: 700 }}>Cashier</th>
              </tr>
            </thead>
            <tbody>
              {s.rows.map((r, ri) => (
                <tr key={`${s.code}-${ri}`} style={{ background: ri % 2 === 1 ? "#f8fafc" : "#fff" }}>
                  <td style={cell}>{r.desc}</td>
                  <td style={num}>{fmtQty(r.qty)}</td>
                  <td style={num}>{fmtAmt(r.price)}</td>
                  <td style={num}>{fmtAmt(r.value)}</td>
                  <td style={cell}>{r.mode}</td>
                  <td style={cell}>{r.cancel}</td>
                  <td style={cell}>{r.cashier}</td>
                </tr>
              ))}
              <tr style={{ background: "#fbfdff", borderTop: "1px solid #94a3b8" }}>
                <td colSpan={3} style={{ ...cell, fontWeight: 800, color: "#1e3a8a" }}>Table Amount</td>
                <td style={{ ...num, fontWeight: 800, color: NAVY }}>{fmtAmt(s.amount)}</td>
                <td colSpan={3} style={cell} />
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
        <span>Grand Total (open tables)</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtAmt(report.grandTotal)}</span>
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
  section: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    marginTop: 10,
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
const OW = { desc: 170, qty: 40, price: 65, value: 70, mode: 60, cancel: 45, cashier: 60 };

export function OpenTablesPdfDocument({
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
  data: OpenTablesData;
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
        {data.sections.map((s) => (
          <View key={s.code}>
            <Text style={pStyles.section}>TABLE {s.code}</Text>
            <View style={pStyles.row}>
              <Text style={[pStyles.th, { width: OW.desc }]}>Description</Text>
              <Text style={[pStyles.th, { width: OW.qty }, pStyles.right]}>Qty</Text>
              <Text style={[pStyles.th, { width: OW.price }, pStyles.right]}>Sales Price</Text>
              <Text style={[pStyles.th, { width: OW.value }, pStyles.right]}>Item Price</Text>
              <Text style={[pStyles.th, { width: OW.mode }]}>OrderMode</Text>
              <Text style={[pStyles.th, { width: OW.cancel }]}>Cancel</Text>
              <Text style={[pStyles.th, { width: OW.cashier }]}>Cashier</Text>
            </View>
            {s.rows.map((r, i) => (
              <View style={pStyles.row} key={i}>
                <Text style={[pStyles.td, { width: OW.desc }]}>{r.desc}</Text>
                <Text style={[pStyles.td, { width: OW.qty }, pStyles.right]}>{fmtQty(r.qty)}</Text>
                <Text style={[pStyles.td, { width: OW.price }, pStyles.right]}>{fmtAmt(r.price)}</Text>
                <Text style={[pStyles.td, { width: OW.value }, pStyles.right]}>{fmtAmt(r.value)}</Text>
                <Text style={[pStyles.td, { width: OW.mode }]}>{r.mode}</Text>
                <Text style={[pStyles.td, { width: OW.cancel }]}>{r.cancel}</Text>
                <Text style={[pStyles.td, { width: OW.cashier }]}>{r.cashier}</Text>
              </View>
            ))}
            <View style={pStyles.totalRow}>
              <Text style={[pStyles.td, { width: OW.desc + OW.qty + OW.price }, pStyles.bold]}>Table Amount</Text>
              <Text style={[pStyles.td, { width: OW.value }, pStyles.right, pStyles.bold]}>{fmtAmt(s.amount)}</Text>
            </View>
          </View>
        ))}
        <View style={pStyles.grandRow}>
          <Text style={[pStyles.bold, { width: OW.desc + OW.qty + OW.price }]}>Grand Total</Text>
          <Text style={[pStyles.bold, { width: OW.value }, pStyles.right]}>{fmtAmt(data.grandTotal)}</Text>
        </View>
      </Page>
    </Document>
  );
}
