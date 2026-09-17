"use client";

// ============================================================
// LOCATION: components/reports/HourlySalesReport.tsx
// 1.5 Hourly Sales renderer — POS parity (Tbl_Temp_HourlyCollection
// output): rows are the Tbl_TimeRange slots (ListingOrder, Range)
// with NOSales (bill count) + SalesAmt (sum NetTotal). Per
// location sections, inline proportion bar, peak slot badge.
// Flat blue theme; PDF in the shared print style.
// ============================================================
import type { CSSProperties } from "react";
import { IconPin } from "./ReportIcons";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

export interface HourRow {
  order: number;
  label: string; // Tbl_TimeRange.Range e.g. "7.00 AM - 11.00 AM"
  from: number;
  to: number;
  bills: number; // NOSales = Count(LocCode)
  value: number; // SalesAmt = Sum(NetTotal)
}
export interface HourlyLocation {
  locCode: string;
  locName: string;
  rows: HourRow[];
  locBills: number;
  locTotal: number;
  peakLabel: string | null;
}
export interface HourlySalesData {
  slotsDefined: boolean;
  locationGroups: HourlyLocation[];
  grandBills: number;
  grandTotal: number;
}

const fmtAmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function hourlyToRows(d: HourlySalesData): Array<{ date?: string; billNo?: string; desc: string; value: number; loc?: string }> {
  const out: Array<{ date?: string; billNo?: string; desc: string; value: number; loc?: string }> = [];
  for (const l of d.locationGroups ?? [])
    for (const r of l.rows ?? []) out.push({ desc: `${r.label} ${l.locName}`, value: r.value, loc: l.locName });
  return out;
}

export function filterHourly(d: HourlySalesData, q0: string): HourlySalesData {
  const q = q0.trim().toLowerCase();
  if (!q) return d;
  const locationGroups = (d.locationGroups ?? [])
    .map((l) => ({
      ...l,
      rows: (l.rows ?? []).filter((r) => `${r.label} ${l.locCode} ${l.locName}`.toLowerCase().includes(q)),
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

export default function HourlySalesReport({ report }: { report: HourlySalesData }) {
  if ((report.locationGroups ?? []).length === 0)
    return (
      <p style={{ padding: 30, textAlign: "center", color: "#64748b", fontFamily: "Inter, sans-serif", fontSize: 13 }}>
        {report.slotsDefined
          ? "No sales found in the defined time slots for this range."
          : "No time slots defined (Tbl_TimeRange empty) and no default slot data for this range."}
      </p>
    );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {report.locationGroups.map((l) => {
        return (
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
                {l.peakLabel ? (
                  <span style={{ background: "#1d4ed8", borderRadius: 999, padding: "2px 9px", fontSize: 10.5, fontWeight: 800 }}>
                    PEAK {l.peakLabel}
                  </span>
                ) : null}
              </span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtAmt(l.locTotal)}</span>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 6 }}>
              <thead>
                <tr style={{ background: "#eff6ff" }}>
                  <th style={{ ...cell, textAlign: "left", width: 190, fontWeight: 700 }}>Time Range</th>
                  <th style={{ ...cell, textAlign: "right", width: 90, fontWeight: 700 }}>No. of Sales</th>
                  <th style={{ ...cell, textAlign: "right", width: 140, fontWeight: 700 }}>Sales Amount</th>
                </tr>
              </thead>
              <tbody>
                {l.rows.map((r, i) => (
                  <tr key={`${r.order}-${r.from}`} style={{ background: i % 2 === 1 ? "#f8fafc" : "#fff" }}>
                    <td style={{ ...cell, fontWeight: 700 }}>{r.label}</td>
                    <td style={num}>{r.bills.toLocaleString("en-US")}</td>
                    <td style={{ ...num, fontWeight: r.label === l.peakLabel ? 800 : 400, color: r.label === l.peakLabel ? "#1d4ed8" : "#1e293b" }}>
                      {fmtAmt(r.value)}
                    </td>
                  </tr>
                ))}
                <tr style={{ background: "#fbfdff", borderTop: "1px solid #94a3b8" }}>
                  <td style={{ ...cell, fontWeight: 800, color: "#1e3a8a" }}>Location Total</td>
                  <td style={{ ...num, fontWeight: 800 }}>{l.locBills.toLocaleString("en-US")}</td>
                  <td style={{ ...num, fontWeight: 800, color: NAVY }}>{fmtAmt(l.locTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      })}
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
          {report.grandBills.toLocaleString("en-US")} sales · {fmtAmt(report.grandTotal)}
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
const HW = { range: 150, bills: 80, value: 110 };

export function HourlySalesPdfDocument({
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
  data: HourlySalesData;
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
        {data.locationGroups.map((l) => {
          return (
            <View key={l.locCode}>
              <Text style={pStyles.location}>{l.locCode}   {l.locName}</Text>
              <View style={pStyles.row}>
                <Text style={[pStyles.th, { width: HW.range }]}>Time Range</Text>
                <Text style={[pStyles.th, { width: HW.bills }, pStyles.right]}>No. of Sales</Text>
                <Text style={[pStyles.th, { width: HW.value }, pStyles.right]}>Sales Amount</Text>
              </View>
              {l.rows.map((r) => (
                <View style={pStyles.row} key={`${r.order}-${r.from}`}>
                  <Text style={[pStyles.td, { width: HW.range }]}>{r.label}</Text>
                  <Text style={[pStyles.td, { width: HW.bills }, pStyles.right]}>{r.bills}</Text>
                  <Text style={[pStyles.td, { width: HW.value }, pStyles.right]}>{fmtAmt(r.value)}</Text>
                </View>
              ))}
              <View style={pStyles.totalRow}>
                <Text style={[pStyles.td, { width: HW.range }, pStyles.bold]}>Location Total</Text>
                <Text style={[pStyles.td, { width: HW.bills }, pStyles.right]}>{l.locBills}</Text>
                <Text style={[pStyles.td, { width: HW.value }, pStyles.right, pStyles.bold]}>{fmtAmt(l.locTotal)}</Text>
              </View>
            </View>
          );
        })}
        <View style={pStyles.grandRow}>
          <Text style={[pStyles.bold, { width: HW.range }]}>Grand Total</Text>
          <Text style={[pStyles.bold, { width: HW.bills }, pStyles.right]}>{data.grandBills}</Text>
          <Text style={[pStyles.bold, { width: HW.value }, pStyles.right]}>{fmtAmt(data.grandTotal)}</Text>
        </View>
      </Page>
    </Document>
  );
}
