"use client";

// ============================================================
// LOCATION: components/reports/CreditHistoryReport.tsx
// 21.2 Credit History + 21.3 Payment History renderer (POS
// Vw_CreditHistory / Vw_creditPaymemtHistory print parity):
// per location, per customer trace of transactions: Date |
// Bill No | Bill Ref No | Total Bill | Tran Amt | Txn Balance |
// Txn Remark | User. Customer subtotal + grand total. Flat blue
// theme; PDF in the shared print style.
// ============================================================
import type { CSSProperties } from "react";
import { IconPin } from "./ReportIcons";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

export interface CreditTxn {
  date: string;
  bill: string;
  ref: string;
  totalBill: number;
  tranAmt: number;
  balance: number;
  remark: string;
  user: string;
}
export interface CreditCustomerHistory {
  code: string;
  name: string;
  rows: CreditTxn[];
  total: number;
}
export interface CreditHistoryLocation {
  locCode: string;
  locName: string;
  customers: CreditCustomerHistory[];
  locTotal: number;
}
export interface CreditHistoryData {
  locationGroups: CreditHistoryLocation[];
  grandTotal: number;
}

const fmtAmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function credHistToRows(d: CreditHistoryData): Array<{ date?: string; billNo?: string; desc: string; value: number; loc?: string }> {
  const out: Array<{ date?: string; billNo?: string; desc: string; value: number; loc?: string }> = [];
  for (const l of d.locationGroups ?? [])
    for (const c of l.customers ?? [])
      for (const r of c.rows ?? [])
        out.push({ date: r.date, billNo: r.bill, desc: `${c.code} ${c.name} ${r.remark}`, value: r.tranAmt, loc: l.locName });
  return out;
}

export function filterCreditHistory(d: CreditHistoryData, q0: string): CreditHistoryData {
  const q = q0.trim().toLowerCase();
  if (!q) return d;
  const locationGroups = (d.locationGroups ?? [])
    .map((l) => ({
      ...l,
      customers: (l.customers ?? [])
        .filter((c) => `${c.code} ${c.name} ${l.locCode} ${l.locName}`.toLowerCase().includes(q))
        .map((c) => ({
          ...c,
          rows: `${c.code} ${c.name}`.toLowerCase().includes(q)
            ? c.rows
            : (c.rows ?? []).filter((r) =>
                `${r.date} ${r.bill} ${r.ref} ${r.remark} ${r.user}`.toLowerCase().includes(q)
              ),
        }))
        .filter((c) => (c.rows ?? []).length > 0),
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

export default function CreditHistoryReport({ report }: { report: CreditHistoryData }) {
  if ((report.locationGroups ?? []).length === 0)
    return (
      <p style={{ padding: 30, textAlign: "center", color: "#64748b", fontFamily: "Inter, sans-serif", fontSize: 13 }}>
        No credit transactions for this range.
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

          {l.customers.map((c) => (
            <div key={`${l.locCode}-${c.code}`} style={{ marginTop: 8 }}>
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
                  {c.code} · {c.name}
                </span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtAmt(c.total)}</span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 6 }}>
                <thead>
                  <tr style={{ background: "#eff6ff" }}>
                    <th style={{ ...cell, textAlign: "left", width: 90, fontWeight: 700 }}>Date</th>
                    <th style={{ ...cell, textAlign: "left", width: 90, fontWeight: 700 }}>Bill No</th>
                    <th style={{ ...cell, textAlign: "left", width: 80, fontWeight: 700 }}>Ref No</th>
                    <th style={{ ...cell, textAlign: "right", width: 90, fontWeight: 700 }}>Total Bill</th>
                    <th style={{ ...cell, textAlign: "right", width: 90, fontWeight: 700 }}>Tran Amt</th>
                    <th style={{ ...cell, textAlign: "right", width: 90, fontWeight: 700 }}>Balance</th>
                    <th style={{ ...cell, textAlign: "left", fontWeight: 700 }}>Remark</th>
                    <th style={{ ...cell, textAlign: "left", width: 90, fontWeight: 700 }}>User</th>
                  </tr>
                </thead>
                <tbody>
                  {c.rows.map((r, ri) => (
                    <tr key={`${c.code}-${ri}`} style={{ background: ri % 2 === 1 ? "#f8fafc" : "#fff" }}>
                      <td style={cell}>{r.date}</td>
                      <td style={cell}>{r.bill}</td>
                      <td style={cell}>{r.ref}</td>
                      <td style={num}>{r.totalBill ? fmtAmt(r.totalBill) : ""}</td>
                      <td style={num}>{fmtAmt(r.tranAmt)}</td>
                      <td style={num}>{r.balance ? fmtAmt(r.balance) : ""}</td>
                      <td style={cell}>{r.remark}</td>
                      <td style={cell}>{r.user}</td>
                    </tr>
                  ))}
                  <tr style={{ background: "#fbfdff", borderTop: "1px solid #94a3b8" }}>
                    <td colSpan={4} style={{ ...cell, fontWeight: 800, color: "#1e3a8a" }}>Customer Total</td>
                    <td style={{ ...num, fontWeight: 800, color: NAVY }}>{fmtAmt(c.total)}</td>
                    <td colSpan={3} style={cell} />
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
        <span>Grand Total (all locations)</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtAmt(report.grandTotal)}</span>
      </div>
    </div>
  );
}

// ── PDF — shared print style ──
const pStyles = StyleSheet.create({
  page: { padding: 28, fontFamily: "Helvetica", fontSize: 8, color: "#1a1a1a" },
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
  customer: { fontFamily: "Helvetica-Bold", fontSize: 9.5, marginTop: 8, marginBottom: 4 },
  row: { flexDirection: "row" },
  th: {
    backgroundColor: "#efefef",
    fontFamily: "Helvetica-Bold",
    padding: 4,
    fontSize: 7,
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
const HW = { date: 55, bill: 55, ref: 45, totalBill: 60, tranAmt: 60, balance: 60, remark: 100, user: 60 };

export function CreditHistoryPdfDocument({
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
  data: CreditHistoryData;
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
            {l.customers.map((c) => (
              <View key={c.code}>
                <Text style={pStyles.customer}>{c.code}   {c.name}</Text>
                <View style={pStyles.row}>
                  <Text style={[pStyles.th, { width: HW.date }]}>Date</Text>
                  <Text style={[pStyles.th, { width: HW.bill }]}>Bill No</Text>
                  <Text style={[pStyles.th, { width: HW.ref }]}>Ref No</Text>
                  <Text style={[pStyles.th, { width: HW.totalBill }, pStyles.right]}>Total Bill</Text>
                  <Text style={[pStyles.th, { width: HW.tranAmt }, pStyles.right]}>Tran Amt</Text>
                  <Text style={[pStyles.th, { width: HW.balance }, pStyles.right]}>Balance</Text>
                  <Text style={[pStyles.th, { width: HW.remark }]}>Remark</Text>
                  <Text style={[pStyles.th, { width: HW.user }]}>User</Text>
                </View>
                {c.rows.map((r, i) => (
                  <View style={pStyles.row} key={i}>
                    <Text style={[pStyles.td, { width: HW.date }]}>{r.date}</Text>
                    <Text style={[pStyles.td, { width: HW.bill }]}>{r.bill}</Text>
                    <Text style={[pStyles.td, { width: HW.ref }]}>{r.ref}</Text>
                    <Text style={[pStyles.td, { width: HW.totalBill }, pStyles.right]}>{r.totalBill ? fmtAmt(r.totalBill) : ""}</Text>
                    <Text style={[pStyles.td, { width: HW.tranAmt }, pStyles.right]}>{fmtAmt(r.tranAmt)}</Text>
                    <Text style={[pStyles.td, { width: HW.balance }, pStyles.right]}>{r.balance ? fmtAmt(r.balance) : ""}</Text>
                    <Text style={[pStyles.td, { width: HW.remark }]}>{r.remark}</Text>
                    <Text style={[pStyles.td, { width: HW.user }]}>{r.user}</Text>
                  </View>
                ))}
                <View style={pStyles.totalRow}>
                  <Text style={[pStyles.td, { width: HW.date + HW.bill + HW.ref + HW.totalBill }, pStyles.bold]}>Customer Total</Text>
                  <Text style={[pStyles.td, { width: HW.tranAmt }, pStyles.right, pStyles.bold]}>{fmtAmt(c.total)}</Text>
                </View>
              </View>
            ))}
          </View>
        ))}
        <View style={pStyles.grandRow}>
          <Text style={[pStyles.bold, { width: HW.date + HW.bill + HW.ref + HW.totalBill }]}>Grand Total</Text>
          <Text style={[pStyles.bold, { width: HW.tranAmt }, pStyles.right]}>{fmtAmt(data.grandTotal)}</Text>
        </View>
      </Page>
    </Document>
  );
}
