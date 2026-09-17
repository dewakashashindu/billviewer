"use client";

// ============================================================
// LOCATION: components/reports/VoidReport.tsx
// 10 Void Summery and Detail renderer (POS Vw_VoidItemSettlement
// "Voided Items POS Details" print parity): location -> cashier
// sections with voided item rows (Bill No / Item / Qty / Rate /
// Value), cashier sub totals, VOID TOTAL per location and grand.
// Flat blue theme; PDF uses the shared print style (Helvetica).
// ============================================================
import type { CSSProperties } from "react";
import { IconPin } from "./ReportIcons";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

export interface VoidRow {
  billNo: string;
  date: string;
  time: string;
  item: string;
  qty: number;
  rate: number;
  value: number;
}
export interface VoidCashier {
  casherId: string;
  casherName: string;
  rows: VoidRow[];
  subTotal: number;
}
export interface VoidLocation {
  locCode: string;
  locName: string;
  cashiers: VoidCashier[];
  voidTotal: number;
}
export interface VoidData {
  locationGroups: VoidLocation[];
  grandTotal: number;
}

const fmtAmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtQty = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// -- analytics rows --
export function voidToRows(d: VoidData): Array<{ date?: string; billNo?: string; desc: string; value: number; loc?: string }> {
  const out: Array<{ date?: string; billNo?: string; desc: string; value: number; loc?: string }> = [];
  for (const l of d.locationGroups ?? [])
    for (const c of l.cashiers ?? [])
      for (const r of c.rows ?? [])
        out.push({ date: r.date, billNo: r.billNo, desc: r.item, value: r.value, loc: l.locName });
  return out;
}

// -- search filter --
export function filterVoid(d: VoidData, q0: string): VoidData {
  const q = q0.trim().toLowerCase();
  if (!q) return d;
  const locationGroups = (d.locationGroups ?? [])
    .map((l) => ({
      ...l,
      cashiers: (l.cashiers ?? [])
        .map((c) => ({
          ...c,
          rows: (c.rows ?? []).filter((r) =>
            `${r.billNo} ${r.item} ${r.date} ${c.casherId} ${c.casherName} ${l.locCode} ${l.locName}`
              .toLowerCase()
              .includes(q)
          ),
        }))
        .filter((c) => c.rows.length > 0),
    }))
    .filter((l) => l.cashiers.length > 0);
  return { ...d, locationGroups };
}

// -- flat rows for PDF --
export function flattenVoidForPdf(d: VoidData): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  for (const l of d.locationGroups ?? []) {
    for (const c of l.cashiers ?? []) {
      for (const r of c.rows ?? [])
        out.push({ loc: `${l.locCode} ${l.locName}`, cashier: `${c.casherId} ${c.casherName}`.trim(), billNo: r.billNo, date: r.date, item: r.item, qty: r.qty, rate: r.rate, value: r.value });
      out.push({ loc: "", cashier: `${c.casherId} ${c.casherName}`.trim(), billNo: "", date: "Sub Total", item: "", qty: 0, rate: 0, value: c.subTotal });
    }
    out.push({ loc: `${l.locCode} ${l.locName}`, cashier: "", billNo: "", date: "VOID TOTAL", item: "", qty: 0, rate: 0, value: l.voidTotal });
  }
  out.push({ loc: "GRAND TOTAL", cashier: "", billNo: "", date: "", item: "", qty: 0, rate: 0, value: d.grandTotal });
  return out;
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

export default function VoidReport({ report }: { report: VoidData }) {
  if ((report.locationGroups ?? []).length === 0)
    return (
      <p style={{ padding: 30, textAlign: "center", color: "#64748b", fontFamily: "Inter, sans-serif", fontSize: 13 }}>
        No void records found for this range.
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
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtAmt(l.voidTotal)}</span>
          </div>

          {l.cashiers.map((c) => (
            <div key={c.casherId} style={{ marginTop: 8 }}>
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
                <span>CASHIER {c.casherId} — {c.casherName}</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtAmt(c.subTotal)}</span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 6 }}>
                <thead>
                  <tr style={{ background: "#eff6ff" }}>
                    <th style={{ ...cell, textAlign: "left", width: 100, fontWeight: 700 }}>Bill No</th>
                    <th style={{ ...cell, textAlign: "left", width: 90, fontWeight: 700 }}>Date</th>
                    <th style={{ ...cell, textAlign: "left", fontWeight: 700 }}>Voided Item</th>
                    <th style={{ ...cell, textAlign: "right", width: 70, fontWeight: 700 }}>Qty</th>
                    <th style={{ ...cell, textAlign: "right", width: 100, fontWeight: 700 }}>Rate</th>
                    <th style={{ ...cell, textAlign: "right", width: 110, fontWeight: 700 }}>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {c.rows.map((r, ri) => (
                    <tr key={`${c.casherId}-${r.billNo}-${ri}`} style={{ background: ri % 2 === 1 ? "#f8fafc" : "#fff" }}>
                      <td style={{ ...cell, fontWeight: 700 }}>{r.billNo}</td>
                      <td style={cell}>{r.date}</td>
                      <td style={cell}>{r.item}</td>
                      <td style={num}>{fmtQty(r.qty)}</td>
                      <td style={num}>{fmtAmt(r.rate)}</td>
                      <td style={num}>{fmtAmt(r.value)}</td>
                    </tr>
                  ))}
                  <tr style={{ background: "#fbfdff", borderTop: "1px solid #94a3b8" }}>
                    <td colSpan={5} style={{ ...cell, fontWeight: 800, color: "#1e3a8a" }}>Sub Total</td>
                    <td style={{ ...num, fontWeight: 800, color: NAVY }}>{fmtAmt(c.subTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "6px 10px",
              marginTop: 6,
              fontWeight: 800,
              fontSize: 12,
              color: "#0d2b57",
              fontFamily: "Inter, sans-serif",
              borderTop: "2px solid #0d2b57",
            }}
          >
            <span>VOID TOTAL — {l.locName}</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtAmt(l.voidTotal)}</span>
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
        <span>Void Grand Total (all locations)</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtAmt(report.grandTotal)}</span>
      </div>
    </div>
  );
}

// ============================================================
// PDF — shared print style (Helvetica, grey heads, ruled totals)
// ============================================================
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
  cashier: { fontFamily: "Helvetica-Bold", fontSize: 10, marginTop: 8, marginBottom: 4 },
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

const PW = { billNo: 62, date: 62, item: 170, qty: 45, rate: 70, value: 80 };

export function VoidPdfDocument({
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
  data: VoidData;
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
            {l.cashiers.map((c) => (
              <View key={c.casherId}>
                <Text style={pStyles.cashier}>CASHIER {c.casherId} — {c.casherName}</Text>
                <View style={pStyles.row}>
                  <Text style={[pStyles.th, { width: PW.billNo }]}>BillNo</Text>
                  <Text style={[pStyles.th, { width: PW.date }]}>Date</Text>
                  <Text style={[pStyles.th, { width: PW.item }]}>Voided Item</Text>
                  <Text style={[pStyles.th, { width: PW.qty }, pStyles.right]}>Qty</Text>
                  <Text style={[pStyles.th, { width: PW.rate }, pStyles.right]}>Rate</Text>
                  <Text style={[pStyles.th, { width: PW.value }, pStyles.right]}>Value</Text>
                </View>
                {c.rows.map((r, i) => (
                  <View style={pStyles.row} key={`${r.billNo}-${i}`}>
                    <Text style={[pStyles.td, { width: PW.billNo }]}>{r.billNo}</Text>
                    <Text style={[pStyles.td, { width: PW.date }]}>{r.date}</Text>
                    <Text style={[pStyles.td, { width: PW.item }]}>{r.item}</Text>
                    <Text style={[pStyles.td, { width: PW.qty }, pStyles.right]}>{fmtQty(r.qty)}</Text>
                    <Text style={[pStyles.td, { width: PW.rate }, pStyles.right]}>{fmtAmt(r.rate)}</Text>
                    <Text style={[pStyles.td, { width: PW.value }, pStyles.right]}>{fmtAmt(r.value)}</Text>
                  </View>
                ))}
                <View style={pStyles.totalRow}>
                  <Text style={[pStyles.td, { width: PW.billNo + PW.date + PW.item + PW.qty + PW.rate }]} />
                  <Text style={[pStyles.td, { width: PW.value }, pStyles.right, pStyles.bold]}>
                    {fmtAmt(c.subTotal)}
                  </Text>
                </View>
              </View>
            ))}
            <View style={pStyles.totalRow}>
              <Text style={[pStyles.td, { width: PW.billNo + PW.date + PW.item + PW.qty + PW.rate }, pStyles.bold]}>
                VOID TOTAL
              </Text>
              <Text style={[pStyles.td, { width: PW.value }, pStyles.right, pStyles.bold]}>
                {fmtAmt(l.voidTotal)}
              </Text>
            </View>
          </View>
        ))}
        <View style={pStyles.grandRow}>
          <Text style={[pStyles.bold, { width: PW.billNo + PW.date + PW.item + PW.qty + PW.rate }]}>
            Grand Total
          </Text>
          <Text style={[pStyles.bold, { width: PW.value }, pStyles.right]}>{fmtAmt(data.grandTotal)}</Text>
        </View>
      </Page>
    </Document>
  );
}
