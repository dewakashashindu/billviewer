"use client";

// ============================================================
// LOCATION: components/reports/KotBotReport.tsx
// 16 KOT/BOT Tracing renderer (POS Vw_ItemSalesDetails print
// parity): location -> server -> order type (KOT unbilled /
// BOT billed) sections; rows ORDNO | KOT/BOT Date | Type |
// Bill Date | Bill OrdNo | Bill Type | Time of KOT/BOT Issue |
// User | Item of KOT/BOT Issue | Qty | Remark. Location band
// carries "KOT/BOT Total : N", order-type band "KOT : n".
// PDF in the shared print style.
// ============================================================
import type { CSSProperties } from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

export interface KotRow {
  ordNo: string;
  kbDate: string;
  type: string;
  billDate: string;
  billOrdNo: string;
  billType: string;
  issueTime: string;
  user: string;
  item: string;
  qty: number;
  remark: string;
}
export interface KotTypeGroup {
  orderTyp: "KOT" | "BOT";
  count: number;
  qty: number;
  rows: KotRow[];
}
export interface KotServerGroup {
  server: string;
  types: KotTypeGroup[];
}
export interface KotLocation {
  locCode: string;
  locName: string;
  total: number;
  totalQty: number;
  servers: KotServerGroup[];
}
export interface KotData {
  typeFilter: string | null;
  locations: KotLocation[];
  grandTotal: number;
  grandQty: number;
}

const fmtQty = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function kotToRows(d: KotData): Array<{ date?: string; billNo?: string; desc: string; value: number; loc?: string }> {
  const out: Array<{ date?: string; billNo?: string; desc: string; value: number; loc?: string }> = [];
  for (const l of d.locations ?? [])
    for (const s of l.servers ?? [])
      for (const t of s.types ?? [])
        for (const r of t.rows ?? [])
          out.push({ date: r.kbDate, billNo: r.ordNo, desc: `${r.item} ${r.type}`, value: r.qty, loc: l.locName });
  return out;
}

export function filterKot(d: KotData, q0: string): KotData {
  const q = q0.trim().toLowerCase();
  if (!q) return d;
  const locations = (d.locations ?? [])
    .map((l) => ({
      ...l,
      servers: (l.servers ?? [])
        .map((s) => ({
          ...s,
          types: (s.types ?? [])
            .map((t) => ({
              ...t,
              rows: (t.rows ?? []).filter((r) =>
                `${r.ordNo} ${r.kbDate} ${r.type} ${r.billDate} ${r.billOrdNo} ${r.billType} ${r.issueTime} ${r.user} ${r.item} ${r.remark} ${s.server} ${l.locCode} ${l.locName}`.toLowerCase().includes(q)
              ),
            }))
            .map((t) => ({ ...t, count: t.rows.length, qty: r2sum(t.rows) }))
            .filter((t) => t.rows.length > 0),
        }))
        .filter((s) => s.types.length > 0),
    }))
    .map((l) => ({ ...l, total: l.servers.reduce((a, s) => a + s.types.reduce((x, t) => x + t.count, 0), 0), totalQty: l.servers.reduce((a, s) => a + s.types.reduce((x, t) => x + t.qty, 0), 0) }))
    .filter((l) => l.servers.length > 0);
  return {
    ...d,
    locations,
    grandTotal: locations.reduce((a, l) => a + l.total, 0),
    grandQty: r2(locations.reduce((a, l) => a + l.totalQty, 0)),
  };
}
const r2 = (n: number) => Math.round(n * 100) / 100;
const r2sum = (rows: KotRow[]) => r2(rows.reduce((a, r) => a + (r.qty || 0), 0));

const NAVY = "#0d2b57";
const cell: CSSProperties = {
  padding: "5px 10px",
  fontSize: 11.5,
  fontFamily: "Inter, sans-serif",
  color: "#1e293b",
  verticalAlign: "top",
};
const num: CSSProperties = { ...cell, textAlign: "right", fontVariantNumeric: "tabular-nums" };

export default function KotBotReport({ report }: { report: KotData }) {
  if ((report.locations ?? []).length === 0)
    return (
      <p style={{ padding: 30, textAlign: "center", color: "#64748b", fontFamily: "Inter, sans-serif", fontSize: 13 }}>
        No KOT/BOT issues for this range.
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
        <span>KOT/BOT REPORT</span>
        {report.typeFilter ? <span>[Tracing Type : {report.typeFilter}]</span> : null}
      </div>
      {report.locations.map((l) => (
        <div key={l.locCode}>
          <div
            style={{
              background: NAVY,
              color: "#fff",
              borderRadius: 8,
              padding: "7px 12px",
              display: "flex",
              justifyContent: "space-between",
              fontSize: 12.5,
              fontWeight: 800,
              fontFamily: "Inter, sans-serif",
              marginTop: 10,
            }}
          >
            <span>LOCATION : {l.locCode}{l.locName ? ` - ${l.locName}` : ""}</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>KOT/BOT Total : {l.total}</span>
          </div>
          {l.servers.map((s) => (
            <div key={s.server} style={{ marginTop: 6 }}>
              <div
                style={{
                  background: "#e2e8f0",
                  color: "#0f172a",
                  borderRadius: 6,
                  padding: "4px 10px",
                  fontSize: 11.5,
                  fontWeight: 800,
                  fontFamily: "Inter, sans-serif",
                }}
              >
                SERVER : {s.server || "—"}
              </div>
              {s.types.map((t) => (
                <div key={t.orderTyp} style={{ marginTop: 6 }}>
                  <div
                    style={{
                      background: "#eff6ff",
                      border: "1px solid #bfdbfe",
                      color: "#1e40af",
                      borderRadius: 6,
                      padding: "4px 10px",
                      fontSize: 11,
                      fontWeight: 800,
                      fontFamily: "Inter, sans-serif",
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>ORDER TYP : {t.orderTyp}</span>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>
                      {t.orderTyp} : {t.count} · QTY : {fmtQty(t.qty)}
                    </span>
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 4 }}>
                    <thead>
                      <tr style={{ background: "#eff6ff" }}>
                        <th style={{ ...cell, textAlign: "left", width: 70, fontWeight: 700 }}>ORDNO</th>
                        <th style={{ ...cell, textAlign: "left", width: 85, fontWeight: 700 }}>KOT/BOT Date</th>
                        <th style={{ ...cell, textAlign: "left", width: 40, fontWeight: 700 }}>Type</th>
                        <th style={{ ...cell, textAlign: "left", width: 85, fontWeight: 700 }}>Bill Date</th>
                        <th style={{ ...cell, textAlign: "left", width: 70, fontWeight: 700 }}>Bill OrdNo</th>
                        <th style={{ ...cell, textAlign: "left", width: 80, fontWeight: 700 }}>Bill Type</th>
                        <th style={{ ...cell, textAlign: "left", width: 90, fontWeight: 700 }}>Time of KOT/BOT Issue</th>
                        <th style={{ ...cell, textAlign: "left", width: 80, fontWeight: 700 }}>User</th>
                        <th style={{ ...cell, textAlign: "left", fontWeight: 700 }}>Item of KOT/BOT Issue</th>
                        <th style={{ ...cell, textAlign: "right", width: 55, fontWeight: 700 }}>Qty</th>
                        <th style={{ ...cell, textAlign: "left", width: 110, fontWeight: 700 }}>Remark</th>
                      </tr>
                    </thead>
                    <tbody>
                      {t.rows.map((r, i) => (
                        <tr key={`${r.ordNo}-${i}`} style={{ background: i % 2 === 1 ? "#f8fafc" : "#fff" }}>
                          <td style={{ ...cell, fontWeight: 700 }}>{r.ordNo}</td>
                          <td style={cell}>{r.kbDate}</td>
                          <td style={{ ...cell, fontWeight: 700 }}>{r.type}</td>
                          <td style={cell}>{r.billDate}</td>
                          <td style={cell}>{r.billOrdNo}</td>
                          <td style={cell}>{r.billType}</td>
                          <td style={cell}>{r.issueTime}</td>
                          <td style={cell}>{r.user}</td>
                          <td style={cell}>{r.item}</td>
                          <td style={num}>{fmtQty(r.qty)}</td>
                          <td style={cell}>{r.remark}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
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
          KOT/BOT : {report.grandTotal} · QTY : {fmtQty(report.grandQty)}
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
  serverBand: { fontFamily: "Helvetica-Bold", fontSize: 9, marginTop: 6, marginBottom: 3, backgroundColor: "#e5e5e5", padding: 3 },
  typeBand: { fontFamily: "Helvetica-Bold", fontSize: 9, marginTop: 4, marginBottom: 3, backgroundColor: "#f5f5f5", padding: 3 },
  row: { flexDirection: "row" },
  th: { backgroundColor: "#efefef", fontFamily: "Helvetica-Bold", padding: 4, fontSize: 7, borderRightWidth: 1, borderRightColor: "#cccccc", borderBottomWidth: 1, borderBottomColor: "#999999" },
  td: { padding: 4, borderRightWidth: 1, borderRightColor: "#e5e5e5" },
  bold: { fontFamily: "Helvetica-Bold" },
  right: { textAlign: "right" },
  grandRow: { flexDirection: "row", borderTopWidth: 2, borderTopColor: "#1a1a1a", marginTop: 6, paddingTop: 4 },
});
const KW = { ord: 40, kbdate: 52, type: 22, billdate: 50, billord: 40, billtype: 46, time: 52, user: 52, qty: 28, remark: 62 };

export function KotBotPdfDocument({
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
  data: KotData;
}) {
  return (
    <Document>
      <Page size="A4" style={pStyles.page}>
        <Text style={pStyles.title}>{title}</Text>
        {data.typeFilter ? <Text style={pStyles.filtered}>[Tracing Type : {data.typeFilter}]</Text> : null}
        <View style={pStyles.infoRow}><Text style={pStyles.infoLabel}>Print Date</Text><Text>: {printDate}</Text></View>
        <View style={pStyles.infoRow}><Text style={pStyles.infoLabel}>Print Time</Text><Text>: {printTime}</Text></View>
        <Text style={pStyles.range}>KOT From {from}  KOT To {to}</Text>
        {data.locations.map((l) => (
          <View key={l.locCode}>
            <Text style={pStyles.location}>LOCATION : {l.locCode}{l.locName ? ` - ${l.locName}` : ""}   (KOT/BOT Total : {l.total})</Text>
            {l.servers.map((s, si) => (
              <View key={`${s.server}-${si}`}>
                <Text style={pStyles.serverBand}>SERVER : {s.server || "—"}</Text>
                {s.types.map((t) => (
                  <View key={t.orderTyp}>
                    <Text style={pStyles.typeBand}>ORDER TYP : {t.orderTyp}   ({t.orderTyp} : {t.count})</Text>
                    <View style={pStyles.row}>
                      <Text style={[pStyles.th, { width: KW.ord }]}>ORDNO</Text>
                      <Text style={[pStyles.th, { width: KW.kbdate }]}>KOT/BOT Date</Text>
                      <Text style={[pStyles.th, { width: KW.type }]}>Type</Text>
                      <Text style={[pStyles.th, { width: KW.billdate }]}>Bill Date</Text>
                      <Text style={[pStyles.th, { width: KW.billord }]}>Bill OrdNo</Text>
                      <Text style={[pStyles.th, { width: KW.billtype }]}>Bill Type</Text>
                      <Text style={[pStyles.th, { width: KW.time }]}>Time of Issue</Text>
                      <Text style={[pStyles.th, { width: KW.user }]}>User</Text>
                      <Text style={[pStyles.th]}>Item of KOT/BOT Issue</Text>
                      <Text style={[pStyles.th, { width: KW.qty }, pStyles.right]}>Qty</Text>
                      <Text style={[pStyles.th, { width: KW.remark }]}>Remark</Text>
                    </View>
                    {t.rows.map((r, i) => (
                      <View style={pStyles.row} key={i}>
                        <Text style={[pStyles.td, { width: KW.ord }]}>{r.ordNo}</Text>
                        <Text style={[pStyles.td, { width: KW.kbdate }]}>{r.kbDate}</Text>
                        <Text style={[pStyles.td, { width: KW.type }]}>{r.type}</Text>
                        <Text style={[pStyles.td, { width: KW.billdate }]}>{r.billDate}</Text>
                        <Text style={[pStyles.td, { width: KW.billord }]}>{r.billOrdNo}</Text>
                        <Text style={[pStyles.td, { width: KW.billtype }]}>{r.billType}</Text>
                        <Text style={[pStyles.td, { width: KW.time }]}>{r.issueTime}</Text>
                        <Text style={[pStyles.td, { width: KW.user }]}>{r.user}</Text>
                        <Text style={[pStyles.td]}>{r.item}</Text>
                        <Text style={[pStyles.td, { width: KW.qty }, pStyles.right]}>{fmtQty(r.qty)}</Text>
                        <Text style={[pStyles.td, { width: KW.remark }]}>{r.remark}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            ))}
          </View>
        ))}
        <View style={pStyles.grandRow}>
          <Text style={pStyles.bold}>Grand Total</Text>
          <Text style={[pStyles.bold, { marginLeft: 200 }]}>KOT/BOT : {data.grandTotal} · QTY : {fmtQty(data.grandQty)}</Text>
        </View>
      </Page>
    </Document>
  );
}
