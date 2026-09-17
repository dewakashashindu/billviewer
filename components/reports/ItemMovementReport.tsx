"use client";

// ============================================================
// LOCATION: components/reports/ItemMovementReport.tsx
// 5.1 Item Movement — Fast / Slow / Non Moving Items renderer.
// POS FastSlow.rpt print parity: location band + ItemCode |
// MenuItemDes | Qty rows (Non mode: no Qty column). Mode +
// threshold shown in the title banner. Flat blue theme; PDF in
// the shared print style.
// ============================================================
import type { CSSProperties } from "react";
import { IconPin } from "./ReportIcons";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

export type ImvMode = "fast" | "slow" | "non";
export interface ImvRow {
  code: string;
  desc: string;
  qty: number;
}
export interface ImvLocation {
  locCode: string;
  locName: string;
  rows: ImvRow[];
}
export interface ImvData {
  mode: ImvMode;
  threshold: number;
  locationGroups: ImvLocation[];
}

const MODE_TITLE: Record<ImvMode, string> = {
  fast: "Fast Moving Items",
  slow: "Slow Moving Items",
  non: "NON-Moving Items",
};

export function imvToRows(d: ImvData): Array<{ date?: string; billNo?: string; desc: string; value: number; loc?: string }> {
  const out: Array<{ date?: string; billNo?: string; desc: string; value: number; loc?: string }> = [];
  for (const l of d.locationGroups ?? [])
    for (const r of l.rows ?? []) out.push({ billNo: r.code, desc: r.desc, value: r.qty, loc: l.locName });
  return out;
}

export function filterImv(d: ImvData, q0: string): ImvData {
  const q = q0.trim().toLowerCase();
  if (!q) return d;
  const locationGroups = (d.locationGroups ?? [])
    .map((l) => ({
      ...l,
      rows: (l.rows ?? []).filter((r) => `${r.code} ${r.desc} ${l.locCode} ${l.locName}`.toLowerCase().includes(q)),
    }))
    .filter((l) => l.rows.length > 0);
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

export default function ItemMovementReport({ report }: { report: ImvData }) {
  if ((report.locationGroups ?? []).length === 0)
    return (
      <p style={{ padding: 30, textAlign: "center", color: "#64748b", fontFamily: "Inter, sans-serif", fontSize: 13 }}>
        No {MODE_TITLE[report.mode].toLowerCase()} found for this range.
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
        <span>{MODE_TITLE[report.mode]}</span>
        {report.mode !== "non" ? <span>Top {report.threshold} per location</span> : null}
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
            <span>{l.rows.length} items</span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 6 }}>
            <thead>
              <tr style={{ background: "#eff6ff" }}>
                <th style={{ ...cell, textAlign: "left", width: 130, fontWeight: 700 }}>Item Code</th>
                <th style={{ ...cell, textAlign: "left", fontWeight: 700 }}>Menu Item Description</th>
                {report.mode !== "non" ? (
                  <th style={{ ...cell, textAlign: "right", width: 110, fontWeight: 700 }}>Qty</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {l.rows.map((r, i) => (
                <tr key={`${r.code}-${i}`} style={{ background: i % 2 === 1 ? "#f8fafc" : "#fff" }}>
                  <td style={{ ...cell, fontWeight: 700 }}>{r.code}</td>
                  <td style={cell}>{r.desc}</td>
                  {report.mode !== "non" ? <td style={num}>{r.qty.toLocaleString("en-US")}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
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
  mode: { fontFamily: "Helvetica-Bold", fontSize: 11, textAlign: "center", marginBottom: 6 },
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
  right: { textAlign: "right" },
});
const IW = { code: 90, desc: 280, qty: 70 };

export function ItemMovementPdfDocument({
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
  data: ImvData;
}) {
  return (
    <Document>
      <Page size="A4" style={pStyles.page}>
        <Text style={pStyles.title}>{title}</Text>
        <Text style={pStyles.mode}>{MODE_TITLE[data.mode]}</Text>
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
              <Text style={[pStyles.th, { width: IW.code }]}>ItemCode</Text>
              <Text style={[pStyles.th, { width: IW.desc }]}>MenuItemDes</Text>
              {data.mode !== "non" ? <Text style={[pStyles.th, { width: IW.qty }, pStyles.right]}>Qty</Text> : null}
            </View>
            {l.rows.map((r, i) => (
              <View style={pStyles.row} key={i}>
                <Text style={[pStyles.td, { width: IW.code }]}>{r.code}</Text>
                <Text style={[pStyles.td, { width: IW.desc }]}>{r.desc}</Text>
                {data.mode !== "non" ? (
                  <Text style={[pStyles.td, { width: IW.qty }, pStyles.right]}>{r.qty}</Text>
                ) : null}
              </View>
            ))}
          </View>
        ))}
      </Page>
    </Document>
  );
}
