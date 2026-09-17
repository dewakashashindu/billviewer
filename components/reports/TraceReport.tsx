"use client";

// ============================================================
// LOCATION: components/reports/TraceReport.tsx
// 15.1 Slip Trace + 15.2 Invoice Trace renderer (POS
// Vw_SlipPrintDetails "Trace On Slip Print / Trace On Bill"
// print parity): per location, per bill trace sections with
// event rows (Ref / Action / Date / Qty / Price / Amount /
// Status) and bill net total. Invoice Trace = same view; type
// the invoice number into the search box. Flat blue theme;
// PDF in the shared print style.
// ============================================================
import type { CSSProperties } from "react";
import { IconPin } from "./ReportIcons";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

export interface TraceRow {
  ref: string;
  action: string;
  date: string;
  qty: number;
  price: number;
  amount: number;
  status: string;
}
export interface TraceBill {
  billNo: string;
  birth: string;
  billType: string;
  user: string;
  date: string;
  rows: TraceRow[];
  net: number;
}
export interface TraceLocation {
  locCode: string;
  locName: string;
  bills: TraceBill[];
  locTotal: number;
}
export interface TraceData {
  locationGroups: TraceLocation[];
  grandTotal: number;
}

const fmtAmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtQty = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function traceToRows(d: TraceData): Array<{ date?: string; billNo?: string; desc: string; value: number; loc?: string }> {
  const out: Array<{ date?: string; billNo?: string; desc: string; value: number; loc?: string }> = [];
  for (const l of d.locationGroups ?? [])
    for (const b of l.bills ?? [])
      for (const r of b.rows ?? [])
        out.push({ date: r.date, billNo: b.billNo, desc: r.action, value: r.amount, loc: l.locName });
  return out;
}

export function filterTrace(d: TraceData, q0: string): TraceData {
  const q = q0.trim().toLowerCase();
  if (!q) return d;
  const locationGroups = (d.locationGroups ?? [])
    .map((l) => ({
      ...l,
      bills: (l.bills ?? [])
        .filter((b) => `${b.billNo} ${b.birth} ${b.billType} ${b.user} ${l.locCode} ${l.locName}`.toLowerCase().includes(q))
        .map((b) => ({
          ...b,
          rows: (b.rows ?? []).filter((r) =>
            `${b.billNo} ${r.ref} ${r.action} ${r.status} ${r.date}`.toLowerCase().includes(q) ||
            `${b.billNo} ${b.birth} ${b.billType} ${b.user}`.toLowerCase().includes(q)
              ? true
              : `${r.ref} ${r.action} ${r.status}`.toLowerCase().includes(q)
          ),
        }))
        .filter((b) => b.rows.length > 0),
    }))
    .filter((l) => l.bills.length > 0);
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

export default function TraceReport({ report, invoiceHint }: { report: TraceData; invoiceHint?: boolean }) {
  if ((report.locationGroups ?? []).length === 0)
    return (
      <p style={{ padding: 30, textAlign: "center", color: "#64748b", fontFamily: "Inter, sans-serif", fontSize: 13 }}>
        {invoiceHint
          ? "Type an invoice number in the search box to trace it."
          : "No trace records found for this range."}
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

          {l.bills.map((b) => (
            <div key={`${l.locCode}-${b.billNo}-${b.birth}`} style={{ marginTop: 8 }}>
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
                <span>
                  {b.billNo}
                  {b.birth ? ` · #${b.birth}` : ""} · {b.billType || "—"} · {b.user || "—"} · {b.date}
                </span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtAmt(b.net)}</span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 6 }}>
                <thead>
                  <tr style={{ background: "#eff6ff" }}>
                    <th style={{ ...cell, textAlign: "left", width: 80, fontWeight: 700 }}>Ref</th>
                    <th style={{ ...cell, textAlign: "left", fontWeight: 700 }}>Action</th>
                    <th style={{ ...cell, textAlign: "left", width: 110, fontWeight: 700 }}>Date</th>
                    <th style={{ ...cell, textAlign: "right", width: 60, fontWeight: 700 }}>Qty</th>
                    <th style={{ ...cell, textAlign: "right", width: 90, fontWeight: 700 }}>Price</th>
                    <th style={{ ...cell, textAlign: "right", width: 100, fontWeight: 700 }}>Amount</th>
                    <th style={{ ...cell, textAlign: "left", width: 110, fontWeight: 700 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {b.rows.map((r, ri) => (
                    <tr key={`${b.billNo}-${ri}`} style={{ background: ri % 2 === 1 ? "#f8fafc" : "#fff" }}>
                      <td style={{ ...cell, fontWeight: 700 }}>{r.ref}</td>
                      <td style={cell}>{r.action}</td>
                      <td style={cell}>{r.date}</td>
                      <td style={num}>{r.qty ? fmtQty(r.qty) : ""}</td>
                      <td style={num}>{r.price ? fmtAmt(r.price) : ""}</td>
                      <td style={num}>{fmtAmt(r.amount)}</td>
                      <td style={cell}>{r.status}</td>
                    </tr>
                  ))}
                  <tr style={{ background: "#fbfdff", borderTop: "1px solid #94a3b8" }}>
                    <td colSpan={5} style={{ ...cell, fontWeight: 800, color: "#1e3a8a" }}>Net Total</td>
                    <td style={{ ...num, fontWeight: 800, color: NAVY }}>{fmtAmt(b.net)}</td>
                    <td style={cell} />
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
        <span>Trace Total (all locations)</span>
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
  location: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    marginTop: 12,
    marginBottom: 4,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
  },
  bill: { fontFamily: "Helvetica-Bold", fontSize: 9.5, marginTop: 8, marginBottom: 4 },
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
const TW = { ref: 50, action: 130, date: 70, qty: 40, price: 65, amount: 70, status: 70 };

export function TracePdfDocument({
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
  data: TraceData;
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
            {l.bills.map((b, bi) => (
              <View key={`${b.billNo}-${bi}`}>
                <Text style={pStyles.bill}>
                  {b.billNo}  #{b.birth}  {b.billType}  {b.user}  {b.date}
                </Text>
                <View style={pStyles.row}>
                  <Text style={[pStyles.th, { width: TW.ref }]}>Ref</Text>
                  <Text style={[pStyles.th, { width: TW.action }]}>Action</Text>
                  <Text style={[pStyles.th, { width: TW.date }]}>Date</Text>
                  <Text style={[pStyles.th, { width: TW.qty }, pStyles.right]}>Qty</Text>
                  <Text style={[pStyles.th, { width: TW.price }, pStyles.right]}>Price</Text>
                  <Text style={[pStyles.th, { width: TW.amount }, pStyles.right]}>Amount</Text>
                  <Text style={[pStyles.th, { width: TW.status }]}>Status</Text>
                </View>
                {b.rows.map((r, i) => (
                  <View style={pStyles.row} key={i}>
                    <Text style={[pStyles.td, { width: TW.ref }]}>{r.ref}</Text>
                    <Text style={[pStyles.td, { width: TW.action }]}>{r.action}</Text>
                    <Text style={[pStyles.td, { width: TW.date }]}>{r.date}</Text>
                    <Text style={[pStyles.td, { width: TW.qty }, pStyles.right]}>{r.qty ? fmtQty(r.qty) : ""}</Text>
                    <Text style={[pStyles.td, { width: TW.price }, pStyles.right]}>{r.price ? fmtAmt(r.price) : ""}</Text>
                    <Text style={[pStyles.td, { width: TW.amount }, pStyles.right]}>{fmtAmt(r.amount)}</Text>
                    <Text style={[pStyles.td, { width: TW.status }]}>{r.status}</Text>
                  </View>
                ))}
                <View style={pStyles.totalRow}>
                  <Text style={[pStyles.td, { width: TW.ref + TW.action + TW.date + TW.qty + TW.price }, pStyles.bold]}>
                    Net Total
                  </Text>
                  <Text style={[pStyles.td, { width: TW.amount }, pStyles.right, pStyles.bold]}>{fmtAmt(b.net)}</Text>
                </View>
              </View>
            ))}
          </View>
        ))}
        <View style={pStyles.grandRow}>
          <Text style={[pStyles.bold, { width: TW.ref + TW.action + TW.date + TW.qty + TW.price }]}>Grand Total</Text>
          <Text style={[pStyles.bold, { width: TW.amount }, pStyles.right]}>{fmtAmt(data.grandTotal)}</Text>
        </View>
      </Page>
    </Document>
  );
}
