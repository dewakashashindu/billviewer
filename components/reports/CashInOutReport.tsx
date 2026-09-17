"use client";

// ============================================================
// LOCATION: components/reports/CashInOutReport.tsx
// 12 Cash In/Out Report renderer (POS VW_CASHINOUTREPORT print
// parity): location -> date sections, rows Txn ID | Txn Time |
// Pay IN | Pay Out | Category | Remarks | User Name with green
// Pay-IN / red Pay-OUT highlights, Daily Total + Grand Total.
// Category filter banner "[Filtered For : X]". PDF in the shared
// print style.
// ============================================================
import type { CSSProperties } from "react";
import { IconPin } from "./ReportIcons";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

export interface CioRow {
  txnId: string;
  time: string;
  payIn: number;
  payOut: number;
  category: string;
  remarks: string;
  user: string;
}
export interface CioDate {
  date: string;
  rows: CioRow[];
  inTotal: number;
  outTotal: number;
}
export interface CioLocation {
  locCode: string;
  locName: string;
  dates: CioDate[];
  locIn: number;
  locOut: number;
}
export interface CioCategory {
  id: string;
  des: string;
}
export interface CioData {
  categoryFilter: string | null;
  categories: CioCategory[];
  locationGroups: CioLocation[];
  grandIn: number;
  grandOut: number;
}

const fmtAmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function cioToRows(d: CioData): Array<{ date?: string; billNo?: string; desc: string; value: number; loc?: string }> {
  const out: Array<{ date?: string; billNo?: string; desc: string; value: number; loc?: string }> = [];
  for (const l of d.locationGroups ?? [])
    for (const dt of l.dates ?? [])
      for (const r of dt.rows ?? [])
        out.push({ date: dt.date, billNo: r.txnId, desc: `${r.category} ${r.remarks}`, value: r.payIn - r.payOut, loc: l.locName });
  return out;
}

export function filterCio(d: CioData, q0: string): CioData {
  const q = q0.trim().toLowerCase();
  if (!q) return d;
  const locationGroups = (d.locationGroups ?? [])
    .map((l) => ({
      ...l,
      dates: (l.dates ?? [])
        .map((dt) => ({
          ...dt,
          rows: (dt.rows ?? []).filter((r) =>
            `${r.txnId} ${r.time} ${r.category} ${r.remarks} ${r.user} ${dt.date} ${l.locCode} ${l.locName}`.toLowerCase().includes(q)
          ),
        }))
        .filter((dt) => dt.rows.length > 0),
    }))
    .filter((l) => l.dates.length > 0);
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

export default function CashInOutReport({ report }: { report: CioData }) {
  if ((report.locationGroups ?? []).length === 0)
    return (
      <p style={{ padding: 30, textAlign: "center", color: "#64748b", fontFamily: "Inter, sans-serif", fontSize: 13 }}>
        No cash in/out transactions for this range.
      </p>
    );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div
        style={{
          background: "#dbeafe",
          border: "1px solid #93c5fd",
          color: "#1e3a8a",
          borderRadius: 8,
          padding: "8px 12px",
          display: "flex",
          justifyContent: "space-between",
          fontSize: 13,
          fontWeight: 800,
          fontFamily: "Inter, sans-serif",
          marginTop: 4,
        }}
      >
        <span>CASH IN/OUT REPORT</span>
        {report.categoryFilter ? <span>[Filtered For : {report.categoryFilter}]</span> : null}
      </div>
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
              marginTop: 14,
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <IconPin size={13} />
              {l.locCode} — {l.locName}
            </span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              IN {fmtAmt(l.locIn)} · OUT {fmtAmt(l.locOut)}
            </span>
          </div>

          {l.dates.map((dt) => (
            <div key={dt.date} style={{ marginTop: 8 }}>
              <div
                style={{
                  background: "#94a3b8",
                  color: "#fff",
                  borderRadius: 6,
                  padding: "4px 10px",
                  fontSize: 11.5,
                  fontWeight: 800,
                  fontFamily: "Inter, sans-serif",
                }}
              >
                {dt.date}
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 6 }}>
                <thead>
                  <tr style={{ background: "#eff6ff" }}>
                    <th style={{ ...cell, textAlign: "left", width: 90, fontWeight: 700 }}>Txn ID</th>
                    <th style={{ ...cell, textAlign: "left", width: 90, fontWeight: 700 }}>Txn Time</th>
                    <th style={{ ...cell, textAlign: "right", width: 100, fontWeight: 700 }}>Pay IN</th>
                    <th style={{ ...cell, textAlign: "right", width: 100, fontWeight: 700 }}>Pay Out</th>
                    <th style={{ ...cell, textAlign: "left", width: 140, fontWeight: 700 }}>Category</th>
                    <th style={{ ...cell, textAlign: "left", fontWeight: 700 }}>Remarks</th>
                    <th style={{ ...cell, textAlign: "left", width: 90, fontWeight: 700 }}>User</th>
                  </tr>
                </thead>
                <tbody>
                  {dt.rows.map((r, i) => (
                    <tr key={`${r.txnId}-${i}`} style={{ background: i % 2 === 1 ? "#f8fafc" : "#fff" }}>
                      <td style={{ ...cell, fontWeight: 700 }}>{r.txnId}</td>
                      <td style={cell}>{r.time}</td>
                      <td style={{ ...num, background: r.payIn ? "#dcfce7" : undefined, fontWeight: r.payIn ? 700 : 400, color: r.payIn ? "#15803d" : "#1e293b" }}>
                        {r.payIn ? fmtAmt(r.payIn) : ""}
                      </td>
                      <td style={{ ...num, background: r.payOut ? "#fee2e2" : undefined, fontWeight: r.payOut ? 700 : 400, color: r.payOut ? "#b91c1c" : "#1e293b" }}>
                        {r.payOut ? fmtAmt(r.payOut) : ""}
                      </td>
                      <td style={cell}>{r.category}</td>
                      <td style={cell}>{r.remarks}</td>
                      <td style={cell}>{r.user}</td>
                    </tr>
                  ))}
                  <tr style={{ background: "#fef9c3", borderTop: "1px solid #94a3b8" }}>
                    <td colSpan={2} style={{ ...cell, fontWeight: 800, color: "#713f12" }}>Daily Total</td>
                    <td style={{ ...num, fontWeight: 800, color: "#15803d" }}>{fmtAmt(dt.inTotal)}</td>
                    <td style={{ ...num, fontWeight: 800, color: "#b91c1c" }}>{fmtAmt(dt.outTotal)}</td>
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
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          IN {fmtAmt(report.grandIn)} · OUT {fmtAmt(report.grandOut)}
        </span>
      </div>
    </div>
  );
}

// ── PDF — shared print style ──
const pStyles = StyleSheet.create({
  page: { padding: 24, fontFamily: "Helvetica", fontSize: 8, color: "#1a1a1a" },
  title: { textAlign: "center", fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  filtered: { textAlign: "center", fontSize: 9, marginBottom: 6 },
  infoRow: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 2 },
  infoLabel: { width: 80 },
  range: { fontFamily: "Helvetica-Bold", fontSize: 10, marginTop: 8, marginBottom: 4 },
  location: { fontFamily: "Helvetica-Bold", fontSize: 11, marginTop: 12, marginBottom: 4, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: "#1a1a1a" },
  dateBand: { fontFamily: "Helvetica-Bold", fontSize: 9, marginTop: 6, marginBottom: 3, backgroundColor: "#e5e5e5", padding: 3 },
  row: { flexDirection: "row" },
  th: { backgroundColor: "#efefef", fontFamily: "Helvetica-Bold", padding: 4, fontSize: 7, borderRightWidth: 1, borderRightColor: "#cccccc", borderBottomWidth: 1, borderBottomColor: "#999999" },
  td: { padding: 4, borderRightWidth: 1, borderRightColor: "#e5e5e5" },
  bold: { fontFamily: "Helvetica-Bold" },
  right: { textAlign: "right" },
  totalRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#1a1a1a", marginTop: 2 },
  grandRow: { flexDirection: "row", borderTopWidth: 2, borderTopColor: "#1a1a1a", marginTop: 6, paddingTop: 4 },
});
const KW = { id: 60, time: 55, in: 60, out: 60, cat: 80, rem: 130, user: 55 };

export function CashInOutPdfDocument({
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
  data: CioData;
}) {
  return (
    <Document>
      <Page size="A4" style={pStyles.page}>
        <Text style={pStyles.title}>{title}</Text>
        {data.categoryFilter ? <Text style={pStyles.filtered}>[Filtered For : {data.categoryFilter}]</Text> : null}
        <View style={pStyles.infoRow}><Text style={pStyles.infoLabel}>Print Date</Text><Text>: {printDate}</Text></View>
        <View style={pStyles.infoRow}><Text style={pStyles.infoLabel}>Print Time</Text><Text>: {printTime}</Text></View>
        <Text style={pStyles.range}>From {from}  To {to}</Text>
        {data.locationGroups.map((l) => (
          <View key={l.locCode}>
            <Text style={pStyles.location}>{l.locCode}   {l.locName}</Text>
            {l.dates.map((dt) => (
              <View key={dt.date}>
                <Text style={pStyles.dateBand}>{dt.date}</Text>
                <View style={pStyles.row}>
                  <Text style={[pStyles.th, { width: KW.id }]}>Txn ID</Text>
                  <Text style={[pStyles.th, { width: KW.time }]}>Txn Time</Text>
                  <Text style={[pStyles.th, { width: KW.in }, pStyles.right]}>Pay IN</Text>
                  <Text style={[pStyles.th, { width: KW.out }, pStyles.right]}>Pay Out</Text>
                  <Text style={[pStyles.th, { width: KW.cat }]}>Category</Text>
                  <Text style={[pStyles.th, { width: KW.rem }]}>Remarks</Text>
                  <Text style={[pStyles.th, { width: KW.user }]}>User</Text>
                </View>
                {dt.rows.map((r, i) => (
                  <View style={pStyles.row} key={i}>
                    <Text style={[pStyles.td, { width: KW.id }]}>{r.txnId}</Text>
                    <Text style={[pStyles.td, { width: KW.time }]}>{r.time}</Text>
                    <Text style={[pStyles.td, { width: KW.in }, pStyles.right]}>{r.payIn ? fmtAmt(r.payIn) : ""}</Text>
                    <Text style={[pStyles.td, { width: KW.out }, pStyles.right]}>{r.payOut ? fmtAmt(r.payOut) : ""}</Text>
                    <Text style={[pStyles.td, { width: KW.cat }]}>{r.category}</Text>
                    <Text style={[pStyles.td, { width: KW.rem }]}>{r.remarks}</Text>
                    <Text style={[pStyles.td, { width: KW.user }]}>{r.user}</Text>
                  </View>
                ))}
                <View style={pStyles.totalRow}>
                  <Text style={[pStyles.td, { width: KW.id + KW.time }, pStyles.bold]}>Daily Total</Text>
                  <Text style={[pStyles.td, { width: KW.in }, pStyles.right, pStyles.bold]}>{fmtAmt(dt.inTotal)}</Text>
                  <Text style={[pStyles.td, { width: KW.out }, pStyles.right, pStyles.bold]}>{fmtAmt(dt.outTotal)}</Text>
                </View>
              </View>
            ))}
          </View>
        ))}
        <View style={pStyles.grandRow}>
          <Text style={[pStyles.bold, { width: KW.id + KW.time }]}>Grand Total</Text>
          <Text style={[pStyles.bold, { width: KW.in }, pStyles.right]}>{fmtAmt(data.grandIn)}</Text>
          <Text style={[pStyles.bold, { width: KW.out }, pStyles.right]}>{fmtAmt(data.grandOut)}</Text>
        </View>
      </Page>
    </Document>
  );
}
