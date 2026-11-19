"use client";
import { ReportPdfHeader, ReportPdfFooter } from './ReportPdfBrand';
import ReportEmptyState from './ReportEmptyState';

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
  localPax: number | null;
  foreignPax: number | null;
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
  localPax: number | null;
  foreignPax: number | null;
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

const fmtOptional = (n: number | null | undefined) => n == null ? "—" : fmtAmt(n);
const fmtAmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// The spending source is the same bill-level value used in the existing report.
const avgSales = (spending: number, pax: number) => pax > 0 ? fmtAmt(spending / pax) : "—";
function byDate(bills: PaxBillRow[]) {
  const groups = new Map<string, PaxBillRow[]>();
  for (const b of bills) { const rows=groups.get(b.date) ?? []; rows.push(b); groups.set(b.date, rows); }
  return Array.from(groups, ([date, rows]) => ({date, rows, pax: rows.reduce((n,b)=>n+b.totalPax,0), spending: rows.reduce((n,b)=>n+b.totalSpending,0)}))
    .sort((a,b)=>a.date.split('/').reverse().join('-').localeCompare(b.date.split('/').reverse().join('-')));
}
const dateSpending = (l: PaxLocation, date: string) => l.bills.filter(b=>b.date===date).reduce((n,b)=>n+b.totalSpending,0);

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
  const q=q0.trim().toLowerCase(); if(!q)return d;
  const locationGroups=d.locationGroups.map(l=>{
    const locationMatch=`${l.locCode} ${l.locName}`.toLowerCase().includes(q);
    const bills=l.bills.filter(b=>locationMatch || `${b.billNo} ${b.date}`.toLowerCase().includes(q));
    const dates=new Set(bills.map(b=>b.date));
    const summary=l.summary.filter(r=>locationMatch || dates.has(r.date) || r.date.toLowerCase().includes(q));
    // When searching by bill, retain the corresponding complete date so summary and detail agree.
    const selectedDates=new Set(summary.map(r=>r.date));
    const allBills=l.bills.filter(b=>selectedDates.has(b.date));
    const totalPax=summary.reduce((n,r)=>n+r.totalPax,0), totalBills=summary.reduce((n,r)=>n+r.totalBills,0);
    const totalSpending=allBills.reduce((n,b)=>n+b.totalSpending,0);
    const optional=(key:'localPax'|'foreignPax')=>summary.some(r=>r[key]==null)?null:summary.reduce((n,r)=>n+(r[key]??0),0);
    return {...l,summary,bills:allBills,totals:{localPax:optional('localPax'),foreignPax:optional('foreignPax'),totalPax,totalBills,totalSpending,avgPax:totalBills?totalPax/totalBills:0,avgSpending:totalPax?totalSpending/totalPax:0}};
  }).filter(l=>l.summary.length>0);
  const totalPax=locationGroups.reduce((n,l)=>n+l.totals.totalPax,0),totalBills=locationGroups.reduce((n,l)=>n+l.totals.totalBills,0),totalSpending=locationGroups.reduce((n,l)=>n+l.totals.totalSpending,0);
  const optional=(key:'localPax'|'foreignPax')=>locationGroups.some(l=>l.totals[key]==null)?null:locationGroups.reduce((n,l)=>n+(l.totals[key]??0),0);
  return {locationGroups,grand:{localPax:optional('localPax'),foreignPax:optional('foreignPax'),totalPax,totalBills,totalSpending,avgPax:totalBills?totalPax/totalBills:0,avgSpending:totalPax?totalSpending/totalPax:0}};
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
const NAVY = "#684830";
const cell: CSSProperties = {
  padding: "5px 10px",
  fontSize: 11.5,
  fontFamily: "Inter, sans-serif",
  color: "#45301D",
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
          background: "#E4D6BF",
          color: "#684830",
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
          <tr style={{ background: "#F0E8D8" }}>
            {cols.map((c, i) => (
              <th key={c} style={{ ...cell, textAlign: i === 0 ? "left" : "right", fontWeight: 700 }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 1 ? "#FCF7F3" : "#fff" }}>
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
    return <ReportEmptyState>No pax records found for this range.</ReportEmptyState>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {report.locationGroups.map((l) => (
        <div key={l.locCode}>
          <div
            style={{
              background: "#F0E8D8",
              color: "#45301D",
              border: "1px solid #E4D6BF",
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
            cols={["Date", "Local Pax", "Foreign Pax", "Total Pax", "Total Bills", "Average Pax Per Bill", "Average Sales"]}
            rows={[
              ...l.summary.map((r) => [r.date, fmtOptional(r.localPax), fmtOptional(r.foreignPax), r.totalPax, r.totalBills, r.avgPax, avgSales(dateSpending(l,r.date),r.totalPax)] as Array<string | number>),
              ["Total", fmtOptional(l.totals.localPax), fmtOptional(l.totals.foreignPax), l.totals.totalPax, l.totals.totalBills, l.totals.avgPax, avgSales(l.totals.totalSpending,l.totals.totalPax)],
            ]}
          />
          <div style={{marginTop:16,fontWeight:800,color:NAVY}}>Average Spending On Pax</div>
          {byDate(l.bills).map(day=><SectionTable key={day.date} head={day.date}
            cols={["Bill No", "Total Pax", "Total Spending", "Average Spending On Pax"]}
            rows={[
              ...day.rows.map(b=>[b.billNo,b.totalPax,b.totalSpending,b.totalPax>0?fmtAmt(b.avgSpending):"—"]),
              ["Date Total",day.pax,day.spending,avgSales(day.spending,day.pax)],
            ]} />)}
          <SectionTable head="Location Total" cols={["", "Total Pax", "Total Spending", "Average Spending On Pax"]}
            rows={[["Total",l.totals.totalPax,l.totals.totalSpending,avgSales(l.totals.totalSpending,l.totals.totalPax)]]} />
        </div>
      ))}
      <div
        style={{
          background: "#684830",
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
  page: { padding: 28, fontFamily: "Helvetica", fontSize: 9, color: "#45301D" },
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
    borderBottomColor: "#45301D",
  },
  section: { fontFamily: "Helvetica-Bold", fontSize: 10, marginTop: 8, marginBottom: 4 },
  row: { flexDirection: "row" },
  th: {
    backgroundColor: "#E4D6BF",
    fontFamily: "Helvetica-Bold",
    padding: 4,
    fontSize: 8,
    borderRightWidth: 1,
    borderRightColor: "#C8B8A8",
    borderBottomWidth: 1,
    borderBottomColor: "#907860",
  },
  td: { padding: 4, borderRightWidth: 1, borderRightColor: "#E4D6BF" },
  bold: { fontFamily: "Helvetica-Bold" },
  right: { textAlign: "right" },
  totalRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#45301D", marginTop: 2 },
  grandRow: { flexDirection: "row", borderTopWidth: 2, borderTopColor: "#45301D", marginTop: 6, paddingTop: 4 },
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
      <Page size="A4" style={[pStyles.page, {paddingBottom: 45}]}>
        <ReportPdfHeader title={title}/>
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
              <Text style={[pStyles.th, { width: 75 }]}>Date</Text>
              <Text style={[pStyles.th, { width: 60 }, pStyles.right]}>Local Pax</Text>
              <Text style={[pStyles.th, { width: 60 }, pStyles.right]}>Foreign Pax</Text>
              <Text style={[pStyles.th, { width: 60 }, pStyles.right]}>Total Pax</Text>
              <Text style={[pStyles.th, { width: XW.c }, pStyles.right]}>Total Bills</Text>
              <Text style={[pStyles.th, { width: 85 }, pStyles.right]}>Avg Pax Per Bill</Text>
              <Text style={[pStyles.th, { width: 75 }, pStyles.right]}>Average Sales</Text>
            </View>
            {l.summary.map((r, i) => (
              <View style={pStyles.row} key={i}>
                <Text style={[pStyles.td, { width: 75 }]}>{r.date}</Text>
                <Text style={[pStyles.td, { width: 60 }, pStyles.right]}>{fmtOptional(r.localPax)}</Text>
                <Text style={[pStyles.td, { width: 60 }, pStyles.right]}>{fmtOptional(r.foreignPax)}</Text>
                <Text style={[pStyles.td, { width: 60 }, pStyles.right]}>{fmtAmt(r.totalPax)}</Text>
                <Text style={[pStyles.td, { width: XW.c }, pStyles.right]}>{fmtAmt(r.totalBills)}</Text>
                <Text style={[pStyles.td, { width: 85 }, pStyles.right]}>{fmtAmt(r.avgPax)}</Text>
                <Text style={[pStyles.td, { width: 75 }, pStyles.right]}>{avgSales(dateSpending(l,r.date),r.totalPax)}</Text>
              </View>
            ))}
            <View style={pStyles.totalRow}>
              <Text style={[pStyles.td, { width: 75 }, pStyles.bold]}>Total</Text>
              <Text style={[pStyles.td, { width: 60 }, pStyles.right, pStyles.bold]}>{fmtOptional(l.totals.localPax)}</Text>
              <Text style={[pStyles.td, { width: 60 }, pStyles.right, pStyles.bold]}>{fmtOptional(l.totals.foreignPax)}</Text>
              <Text style={[pStyles.td, { width: 60 }, pStyles.right, pStyles.bold]}>{fmtAmt(l.totals.totalPax)}</Text>
              <Text style={[pStyles.td, { width: XW.c }, pStyles.right, pStyles.bold]}>{fmtAmt(l.totals.totalBills)}</Text>
              <Text style={[pStyles.td, { width: 85 }, pStyles.right, pStyles.bold]}>{fmtAmt(l.totals.avgPax)}</Text>
              <Text style={[pStyles.td, { width: 75 }, pStyles.right, pStyles.bold]}>{avgSales(l.totals.totalSpending,l.totals.totalPax)}</Text>
            </View>

            <Text style={pStyles.section}>Average Spending On Pax</Text>
            {byDate(l.bills).map(day=><View key={day.date}>
              <Text style={pStyles.section}>{day.date}</Text>
              <View style={pStyles.row}>{["Bill No","Total Pax","Total Spending","Average Spending On Pax"].map((h,i)=><Text key={h} style={[pStyles.th,{width:[180,80,120,150][i]}, ...(i?[pStyles.right]:[])]}>{h}</Text>)}</View>
              {day.rows.map((b,i)=><View style={pStyles.row} key={i}><Text style={[pStyles.td,{width:180}]}>{b.billNo}</Text><Text style={[pStyles.td,{width:80},pStyles.right]}>{fmtAmt(b.totalPax)}</Text><Text style={[pStyles.td,{width:120},pStyles.right]}>{fmtAmt(b.totalSpending)}</Text><Text style={[pStyles.td,{width:150},pStyles.right]}>{avgSales(b.totalSpending,b.totalPax)}</Text></View>)}
              <View style={pStyles.totalRow}><Text style={[pStyles.td,{width:180},pStyles.bold]}>Date Total</Text><Text style={[pStyles.td,{width:80},pStyles.right,pStyles.bold]}>{fmtAmt(day.pax)}</Text><Text style={[pStyles.td,{width:120},pStyles.right,pStyles.bold]}>{fmtAmt(day.spending)}</Text><Text style={[pStyles.td,{width:150},pStyles.right,pStyles.bold]}>{avgSales(day.spending,day.pax)}</Text></View>
            </View>)}
            <View style={pStyles.totalRow}><Text style={[pStyles.td,{width:180},pStyles.bold]}>Location Total</Text><Text style={[pStyles.td,{width:80},pStyles.right,pStyles.bold]}>{fmtAmt(l.totals.totalPax)}</Text><Text style={[pStyles.td,{width:120},pStyles.right,pStyles.bold]}>{fmtAmt(l.totals.totalSpending)}</Text><Text style={[pStyles.td,{width:150},pStyles.right,pStyles.bold]}>{avgSales(l.totals.totalSpending,l.totals.totalPax)}</Text></View>
          </View>
        ))}
        <View style={pStyles.grandRow}>
          <Text style={[pStyles.bold, { width: XW.a + XW.b }]}>Grand Total</Text>
          <Text style={[pStyles.bold, { width: XW.c }, pStyles.right]}>{fmtAmt(data.grand.totalPax)}</Text>
          <Text style={[pStyles.bold, { width: XW.d }, pStyles.right]}>{fmtAmt(data.grand.totalSpending)}</Text>
          <Text style={[pStyles.bold, { width: XW.e }, pStyles.right]}>{fmtAmt(data.grand.avgSpending)}</Text>
        </View>
      <ReportPdfFooter/></Page>
    </Document>
  );
}
