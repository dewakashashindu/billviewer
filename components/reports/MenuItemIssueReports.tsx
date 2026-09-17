"use client";

// ============================================================
// LOCATION: components/reports/MenuItemIssueReports.tsx
// 4.1 Menu Item Issue – Item Issue + 4.2 – By Date renderers.
// POS print parity: sales-department bands ("Beverage:") with
// rows Menu Item Code | Description | Qty | Weight Per 1 Menu
// It. | Value Per Unit Based on Qty | Last Price | Total
// (Value); 4.2 adds the date sections. Location-wise groups.
// Flat blue theme; PDF in the shared print style.
// ============================================================
import { Fragment } from "react";
import type { CSSProperties } from "react";
import { IconPin } from "./ReportIcons";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

export interface MiiRow {
  code: string;
  desc: string;
  qty: number;
  weight: number;
  unitValue: number;
  lastPrice: number;
  total: number;
}
export interface MiiDept {
  dept: string;
  rows: MiiRow[];
  total: number;
}
export interface MiiDate {
  date: string;
  depts: MiiDept[];
  total: number;
}
export interface MiiLocation {
  locCode: string;
  locName: string;
  dates: MiiDate[];
  locTotal: number;
}
export interface MiiData {
  locationGroups: MiiLocation[];
  grandTotal: number;
}

const fmtAmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtW = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
const r2 = (n: number) => Math.round(n * 100) / 100;

export function miiToRows(d: MiiData): Array<{ date?: string; billNo?: string; desc: string; value: number; loc?: string }> {
  const out: Array<{ date?: string; billNo?: string; desc: string; value: number; loc?: string }> = [];
  for (const l of d.locationGroups ?? [])
    for (const dt of l.dates ?? [])
      for (const dep of dt.depts ?? [])
        for (const r of dep.rows ?? [])
          out.push({ date: dt.date, billNo: r.code, desc: `${dep.dept} ${r.desc}`, value: r.total, loc: l.locName });
  return out;
}

export function filterMii(d: MiiData, q0: string): MiiData {
  const q = q0.trim().toLowerCase();
  if (!q) return d;
  const locationGroups = (d.locationGroups ?? [])
    .map((l) => ({
      ...l,
      dates: (l.dates ?? [])
        .map((dt) => ({
          ...dt,
          depts: (dt.depts ?? [])
            .map((dep) => ({
              ...dep,
              rows: (dep.rows ?? []).filter((r) =>
                `${r.code} ${r.desc} ${dep.dept} ${dt.date} ${l.locCode} ${l.locName}`.toLowerCase().includes(q)
              ),
            }))
            .filter((dep) => dep.rows.length > 0),
        }))
        .filter((dt) => dt.depts.length > 0),
    }))
    .filter((l) => l.dates.length > 0);
  return { ...d, locationGroups };
}

// merge dept rows across dates (4.1 view)
function mergeDepts(l: MiiLocation): MiiDept[] {
  const m = new Map<string, MiiDept>();
  for (const dt of l.dates ?? [])
    for (const dep of dt.depts ?? []) {
      let D = m.get(dep.dept);
      if (!D) {
        D = { dept: dep.dept, rows: [], total: 0 };
        m.set(dep.dept, D);
      }
      for (const r of dep.rows) D.rows.push(r);
      D.total = r2(D.total + dep.total);
    }
  return Array.from(m.values());
}

const NAVY = "#0d2b57";
const cell: CSSProperties = {
  padding: "5px 8px",
  fontSize: 11,
  fontFamily: "Inter, sans-serif",
  color: "#1e293b",
  verticalAlign: "top",
};
const num: CSSProperties = { ...cell, textAlign: "right", fontVariantNumeric: "tabular-nums" };
const locBar: CSSProperties = {
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
};
const dateBar: CSSProperties = {
  background: "#1d4ed8",
  color: "#fff",
  borderRadius: 6,
  padding: "5px 10px",
  display: "flex",
  justifyContent: "space-between",
  fontSize: 11.5,
  fontWeight: 800,
  fontFamily: "Inter, sans-serif",
  marginTop: 10,
};
const deptBar: CSSProperties = {
  background: "#dbeafe",
  color: "#1e3a8a",
  borderRadius: 6,
  padding: "5px 10px",
  display: "flex",
  justifyContent: "space-between",
  fontSize: 11.5,
  fontWeight: 800,
  fontFamily: "Inter, sans-serif",
  marginTop: 8,
  textTransform: "capitalize",
};

function Table({ depts }: { depts: MiiDept[] }) {
  return (
    <>
      {depts.map((dep) => (
        <div key={dep.dept}>
          <div style={deptBar}>
            <span>{dep.dept}:</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtAmt(dep.total)}</span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 6 }}>
            <thead>
              <tr style={{ background: "#eff6ff" }}>
                <th style={{ ...cell, textAlign: "left", width: 100, fontWeight: 700 }}>Menu Item Code</th>
                <th style={{ ...cell, textAlign: "left", fontWeight: 700 }}>Description</th>
                <th style={{ ...cell, textAlign: "right", width: 70, fontWeight: 700 }}>Qty</th>
                <th style={{ ...cell, textAlign: "right", width: 110, fontWeight: 700 }}>Weight / 1 Menu It.</th>
                <th style={{ ...cell, textAlign: "right", width: 110, fontWeight: 700 }}>Value / Unit</th>
                <th style={{ ...cell, textAlign: "right", width: 90, fontWeight: 700 }}>Last Price</th>
                <th style={{ ...cell, textAlign: "right", width: 110, fontWeight: 700 }}>Total (Value)</th>
              </tr>
            </thead>
            <tbody>
              {dep.rows.map((r, i) => (
                <tr key={`${r.code}-${i}`} style={{ background: i % 2 === 1 ? "#f8fafc" : "#fff" }}>
                  <td style={{ ...cell, fontWeight: 700 }}>{r.code}</td>
                  <td style={cell}>{r.desc}</td>
                  <td style={num}>{fmtAmt(r.qty)}</td>
                  <td style={num}>{fmtW(r.weight)}</td>
                  <td style={num}>{fmtAmt(r.unitValue)}</td>
                  <td style={num}>{fmtAmt(r.lastPrice)}</td>
                  <td style={{ ...num, fontWeight: 700 }}>{fmtAmt(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </>
  );
}

function GrandBanner({ total }: { total: number }) {
  return (
    <div style={{ ...locBar, background: "#1d4ed8", marginTop: 14, fontSize: 13 }}>
      <span>Grand Total (all locations)</span>
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtAmt(total)}</span>
    </div>
  );
}

// ═══════════════ 4.1 ITEM ISSUE (dept wise) ═══════════════
export default function MenuItemIssueReport({ report }: { report: MiiData }) {
  if ((report.locationGroups ?? []).length === 0)
    return (
      <p style={{ padding: 30, textAlign: "center", color: "#64748b", fontFamily: "Inter, sans-serif", fontSize: 13 }}>
        No menu item issues for this range.
      </p>
    );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {report.locationGroups.map((l) => (
        <div key={l.locCode}>
          <div style={locBar}>
            <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <IconPin size={13} />
              {l.locCode} — {l.locName}
            </span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtAmt(l.locTotal)}</span>
          </div>
          <Table depts={mergeDepts(l)} />
        </div>
      ))}
      <GrandBanner total={report.grandTotal} />
    </div>
  );
}

// ═══════════════ 4.2 ITEM ISSUE BY DATE ═══════════════
export function MenuItemIssueByDateReport({ report }: { report: MiiData }) {
  if ((report.locationGroups ?? []).length === 0)
    return (
      <p style={{ padding: 30, textAlign: "center", color: "#64748b", fontFamily: "Inter, sans-serif", fontSize: 13 }}>
        No menu item issues for this range.
      </p>
    );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {report.locationGroups.map((l) => (
        <div key={l.locCode}>
          <div style={locBar}>
            <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <IconPin size={13} />
              {l.locCode} — {l.locName}
            </span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtAmt(l.locTotal)}</span>
          </div>
          {l.dates.map((dt) => (
            <div key={dt.date}>
              <div style={dateBar}>
                <span>{dt.date}</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtAmt(dt.total)}</span>
              </div>
              <Table depts={dt.depts} />
            </div>
          ))}
        </div>
      ))}
      <GrandBanner total={report.grandTotal} />
    </div>
  );
}

// ── PDF — shared print style ──
const pStyles = StyleSheet.create({
  page: { padding: 24, fontFamily: "Helvetica", fontSize: 8, color: "#1a1a1a" },
  title: { textAlign: "center", fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 10 },
  infoRow: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 2 },
  infoLabel: { width: 80 },
  range: { fontFamily: "Helvetica-Bold", fontSize: 10, marginTop: 8, marginBottom: 4 },
  location: { fontFamily: "Helvetica-Bold", fontSize: 11, marginTop: 12, marginBottom: 4, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: "#1a1a1a" },
  dateBand: { fontFamily: "Helvetica-Bold", fontSize: 9.5, marginTop: 8, marginBottom: 4 },
  deptBand: { fontFamily: "Helvetica-Bold", fontSize: 9, marginTop: 6, marginBottom: 3 },
  row: { flexDirection: "row" },
  th: { backgroundColor: "#efefef", fontFamily: "Helvetica-Bold", padding: 4, fontSize: 7, borderRightWidth: 1, borderRightColor: "#cccccc", borderBottomWidth: 1, borderBottomColor: "#999999" },
  td: { padding: 4, borderRightWidth: 1, borderRightColor: "#e5e5e5" },
  bold: { fontFamily: "Helvetica-Bold" },
  right: { textAlign: "right" },
  grandRow: { flexDirection: "row", borderTopWidth: 2, borderTopColor: "#1a1a1a", marginTop: 6, paddingTop: 4 },
});
const MW = { code: 60, desc: 150, qty: 40, weight: 60, unit: 60, last: 50, total: 60 };

function PdfDepts({ depts }: { depts: MiiDept[] }) {
  return (
    <>
      {depts.map((dep) => (
        <View key={dep.dept}>
          <Text style={pStyles.deptBand}>{dep.dept}:   {fmtAmt(dep.total)}</Text>
          <View style={pStyles.row}>
            <Text style={[pStyles.th, { width: MW.code }]}>Code</Text>
            <Text style={[pStyles.th, { width: MW.desc }]}>Description</Text>
            <Text style={[pStyles.th, { width: MW.qty }, pStyles.right]}>Qty</Text>
            <Text style={[pStyles.th, { width: MW.weight }, pStyles.right]}>Weight/1</Text>
            <Text style={[pStyles.th, { width: MW.unit }, pStyles.right]}>Value/Unit</Text>
            <Text style={[pStyles.th, { width: MW.last }, pStyles.right]}>Last Price</Text>
            <Text style={[pStyles.th, { width: MW.total }, pStyles.right]}>Total</Text>
          </View>
          {dep.rows.map((r, i) => (
            <View style={pStyles.row} key={i}>
              <Text style={[pStyles.td, { width: MW.code }]}>{r.code}</Text>
              <Text style={[pStyles.td, { width: MW.desc }]}>{r.desc}</Text>
              <Text style={[pStyles.td, { width: MW.qty }, pStyles.right]}>{fmtAmt(r.qty)}</Text>
              <Text style={[pStyles.td, { width: MW.weight }, pStyles.right]}>{fmtW(r.weight)}</Text>
              <Text style={[pStyles.td, { width: MW.unit }, pStyles.right]}>{fmtAmt(r.unitValue)}</Text>
              <Text style={[pStyles.td, { width: MW.last }, pStyles.right]}>{fmtAmt(r.lastPrice)}</Text>
              <Text style={[pStyles.td, { width: MW.total }, pStyles.right]}>{fmtAmt(r.total)}</Text>
            </View>
          ))}
        </View>
      ))}
    </>
  );
}

export function MenuItemIssuePdfDocument({
  title,
  printDate,
  printTime,
  from,
  to,
  data,
  byDate,
}: {
  title: string;
  printDate: string;
  printTime: string;
  from: string;
  to: string;
  data: MiiData;
  byDate?: boolean;
}) {
  return (
    <Document>
      <Page size="A4" style={pStyles.page}>
        <Text style={pStyles.title}>{title}</Text>
        <View style={pStyles.infoRow}><Text style={pStyles.infoLabel}>Print Date</Text><Text>: {printDate}</Text></View>
        <View style={pStyles.infoRow}><Text style={pStyles.infoLabel}>Print Time</Text><Text>: {printTime}</Text></View>
        <Text style={pStyles.range}>From {from}  To {to}</Text>
        {data.locationGroups.map((l) => (
          <View key={l.locCode}>
            <Text style={pStyles.location}>{l.locCode}   {l.locName}</Text>
            {byDate
              ? l.dates.map((dt) => (
                  <View key={dt.date}>
                    <Text style={pStyles.dateBand}>{dt.date}   {fmtAmt(dt.total)}</Text>
                    <PdfDepts depts={dt.depts} />
                  </View>
                ))
              : <PdfDepts depts={mergeDepts(l)} />}
          </View>
        ))}
        <View style={pStyles.grandRow}>
          <Text style={[pStyles.bold, { width: MW.code + MW.desc }]}>Grand Total</Text>
          <Text style={[pStyles.bold, { width: MW.total }, pStyles.right]}>{fmtAmt(data.grandTotal)}</Text>
        </View>
      </Page>
    </Document>
  );
}
