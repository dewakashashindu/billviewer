"use client";

// ============================================================
// LOCATION: components/reports/PaxCountReport.tsx
// 11 Pax Count renderer (POS Vw_PaxCount print parity):
//   "Average Numbers Of Pax Per (Summary)" — date-wise Total Pax /
//   Total Bills / Average Pax Per Bill, and
//   "Average Spending On Pax" — bill-wise Total Pax / Total
//   Spending / Average Spending. Location-wise with totals.
// Flat blue theme; PDF uses the shared print style (Helvetica).
// ============================================================
import type { CSSProperties } from "react";
import { IconPin } from "./ReportIcons";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

export interface PaxDateRow {
  date: string;
  totalPax: number;
  totalBills: number;
  avgPax: number;
}
export interface PaxBillRow {
  date: string;
  billNo: string;
  totalPax: number;
  totalSpending: number;
  avgSpending: number;
}
export interface PaxTotals {
  totalPax: number;
  totalBills: number;
  avgPax: number;
  totalSpending: number;
  avgSpending: number;
}
export interface PaxLocation {
  locCode: string;
  locName: string;
  summary: PaxDateRow[];
  bills: PaxBillRow[];
  totals: PaxTotals;
}
export interface PaxData {
  locationGroups: PaxLocation[];
  grand: PaxTotals;
}

const fmtAmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// -- analytics rows --
export function paxToRows(d: PaxData): Array<{ date?: string; billNo?: string; desc: string; value: number; loc?: string }> {
  const out: Array<{ date?: string; billNo?: string; desc: string; value: number; loc?: string }> = [];
  for (const l of d.locationGroups ?? [])
    for (const b of l.bills ?? [])
      out.push({ date: b.date, billNo: b.billNo, desc: "Pax Spending", value: b.totalSpending, loc: l.locName });
  return out;
}

// -- search filter --
export function filterPax(d: PaxData, q0: string): PaxData {
  const q = q0.trim().toLowerCase();
  if (!q) return d;
  const locationGroups = (d.locationGroups ?? [])
    .map((l) => ({
      ...l,
      summary: (l.summary ?? []).filter((r) =>
        `${r.date} ${l.locCode} ${l.locName}`.toLowerCase().includes(q)
      ),
      bills: (l.bills ?? []).filter((r) =>
        `${r.billNo} ${r.date} ${l.locCode} ${l.locName}`.toLowerCase().includes(q)
      ),
    }))
    .filter((l) => l.summary.length > 0 || l.bills.length > 0);
  return { ...d, locationGroups };
}

// -- flat rows for PDF --
export function flattenPaxForPdf(d: PaxData): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  for (const l of d.locationGroups ?? []) {
    for (const r of l.summary ?? [])
      out.push({ loc: `${l.locCode} ${l.locName}`, section: "Pax Summary", date: r.date, billNo: "", pax: r.totalPax, bills: r.totalBills, spending: "", avg: r.avgPax });
    out.push({ loc: `${l.locCode} ${l.locName}`, section: "Pax Summary", date: "Total", billNo: "", pax: l.totals.totalPax, bills: l.totals.totalBills, spending: "", avg: l.totals.avgPax });
    for (const b of l.bills ?? [])
      out.push({ loc: `${l.locCode} ${l.locName}`, section: "Spending", date: b.date, billNo: b.billNo, pax: b.totalPax, bills: "", spending: b.totalSpending, avg: b.avgSpending });
    out.push({ loc: `${l.locCode} ${l.locName}`, section: "Spending", date: "Total", billNo: "", pax: l.totals.totalPax, bills: "", spending: l.totals.totalSpending, avg: l.totals.avgSpending });
  }
  out.push({ loc: "GRAND TOTAL", section: "", date: "", billNo: "", pax: d.grand.totalPax, bills: d.grand.totalBills, spending: d.grand.totalSpending, avg: d.grand.avgSpending });
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

function SectionTable({
  head,
  cols,
  rows,
}: {
  head: string;
  cols: string[];
  rows: Array<Array<string | number>>;
}) {
  return (
    <div style={{ marginTop: 8 }}>
      <div
        style={{
          background: "#dbeafe",
          color: "#1e3a8a",
          borderRadius: 6,
          padding: "6px 10px",
          fontSize: 12,
          fontWeight: 800,
          fontFamily: "Inter, sans-serif",
        }}
      >
        {head}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 6 }}>
        <thead>
          <tr style={{ background: "#eff6ff" }}>
            {cols.map((c, i) => (
              <th key={c} style={{ ...cell, textAlign: i === 0 ? "left" : "right", fontWeight: 700 }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 1 ? "#f8fafc" : "#fff" }}>
              {r.map((v, ci) => (
                <td key={ci} style={ci === 0 ? { ...cell, fontWeight: 700 } : num}>
                  {typeof v === "number" ? fmtAmt(v) : v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PaxCountReport({ report }: { report: PaxData }) {
  if ((report.locationGroups ?? []).length === 0)
    return (
      <p style={{ padding: 30, textAlign: "center", color: "#64748b", fontFamily: "Inter, sans-serif", fontSize: 13 }}>
        No pax records found for this range.
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
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtAmt(l.totals.totalPax)} pax</span>
          </div>

          <SectionTable
            head="Average Numbers Of Pax Per (Summary)"
            cols={["Date", "Total Pax", "Total Bills", "Average Pax Per Bill"]}
            rows={[
              ...l.summary.map((r) => [r.date, r.totalPax, r.totalBills, r.avgPax] as Array<string | number>),
              ["Total", l.totals.totalPax, l.totals.totalBills, l.totals.avgPax],
            ]}
          />
          <SectionTable
            head="Average Spending On Pax"
            cols={["Date", "Bill No", "Total Pax", "Total Spending", "Average Spending On Pax"]}
            rows={[
              ...l.bills.map((b) => [b.date, b.billNo, b.totalPax, b.totalSpending, b.avgSpending] as Array<string | number>),
              ["Total", "", l.totals.totalPax, l.totals.totalSpending, l.totals.avgSpending],
            ]}
          />
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
        <span>Grand Total — {fmtAmt(report.grand.totalPax)} pax · {fmtAmt(report.grand.totalBills)} bills</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtAmt(report.grand.totalSpending)}</span>
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
  section: { fontFamily: "Helvetica-Bold", fontSize: 10, marginTop: 8, marginBottom: 4 },
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

const XW = { a: 90, b: 90, c: 80, d: 100, e: 110 };

export function PaxCountPdfDocument({
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
  data: PaxData;
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

            <Text style={pStyles.section}>Average Numbers Of Pax Per (Summary)</Text>
            <View style={pStyles.row}>
              <Text style={[pStyles.th, { width: XW.a }]}>Date</Text>
              <Text style={[pStyles.th, { width: XW.b }, pStyles.right]}>Total Pax</Text>
              <Text style={[pStyles.th, { width: XW.c }, pStyles.right]}>Total Bills</Text>
              <Text style={[pStyles.th, { width: XW.d }, pStyles.right]}>Avg Pax Per Bill</Text>
            </View>
            {l.summary.map((r, i) => (
              <View style={pStyles.row} key={i}>
                <Text style={[pStyles.td, { width: XW.a }]}>{r.date}</Text>
                <Text style={[pStyles.td, { width: XW.b }, pStyles.right]}>{fmtAmt(r.totalPax)}</Text>
                <Text style={[pStyles.td, { width: XW.c }, pStyles.right]}>{fmtAmt(r.totalBills)}</Text>
                <Text style={[pStyles.td, { width: XW.d }, pStyles.right]}>{fmtAmt(r.avgPax)}</Text>
              </View>
            ))}
            <View style={pStyles.totalRow}>
              <Text style={[pStyles.td, { width: XW.a }, pStyles.bold]}>Total</Text>
              <Text style={[pStyles.td, { width: XW.b }, pStyles.right, pStyles.bold]}>{fmtAmt(l.totals.totalPax)}</Text>
              <Text style={[pStyles.td, { width: XW.c }, pStyles.right, pStyles.bold]}>{fmtAmt(l.totals.totalBills)}</Text>
              <Text style={[pStyles.td, { width: XW.d }, pStyles.right, pStyles.bold]}>{fmtAmt(l.totals.avgPax)}</Text>
            </View>

            <Text style={pStyles.section}>Average Spending On Pax</Text>
            <View style={pStyles.row}>
              <Text style={[pStyles.th, { width: XW.a }]}>Date</Text>
              <Text style={[pStyles.th, { width: XW.b }]}>BillNo</Text>
              <Text style={[pStyles.th, { width: XW.c }, pStyles.right]}>Total Pax</Text>
              <Text style={[pStyles.th, { width: XW.d }, pStyles.right]}>Total Spending</Text>
              <Text style={[pStyles.th, { width: XW.e }, pStyles.right]}>Avg Spending</Text>
            </View>
            {l.bills.map((b, i) => (
              <View style={pStyles.row} key={i}>
                <Text style={[pStyles.td, { width: XW.a }]}>{b.date}</Text>
                <Text style={[pStyles.td, { width: XW.b }]}>{b.billNo}</Text>
                <Text style={[pStyles.td, { width: XW.c }, pStyles.right]}>{fmtAmt(b.totalPax)}</Text>
                <Text style={[pStyles.td, { width: XW.d }, pStyles.right]}>{fmtAmt(b.totalSpending)}</Text>
                <Text style={[pStyles.td, { width: XW.e }, pStyles.right]}>{fmtAmt(b.avgSpending)}</Text>
              </View>
            ))}
            <View style={pStyles.totalRow}>
              <Text style={[pStyles.td, { width: XW.a + XW.b }, pStyles.bold]}>Total</Text>
              <Text style={[pStyles.td, { width: XW.c }, pStyles.right, pStyles.bold]}>{fmtAmt(l.totals.totalPax)}</Text>
              <Text style={[pStyles.td, { width: XW.d }, pStyles.right, pStyles.bold]}>{fmtAmt(l.totals.totalSpending)}</Text>
              <Text style={[pStyles.td, { width: XW.e }, pStyles.right, pStyles.bold]}>{fmtAmt(l.totals.avgSpending)}</Text>
            </View>
          </View>
        ))}
        <View style={pStyles.grandRow}>
          <Text style={[pStyles.bold, { width: XW.a + XW.b }]}>Grand Total</Text>
          <Text style={[pStyles.bold, { width: XW.c }, pStyles.right]}>{fmtAmt(data.grand.totalPax)}</Text>
          <Text style={[pStyles.bold, { width: XW.d }, pStyles.right]}>{fmtAmt(data.grand.totalSpending)}</Text>
          <Text style={[pStyles.bold, { width: XW.e }, pStyles.right]}>{fmtAmt(data.grand.avgSpending)}</Text>
        </View>
      </Page>
    </Document>
  );
}
