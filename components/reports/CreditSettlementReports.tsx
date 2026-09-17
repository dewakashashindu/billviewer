"use client";

// ============================================================
// LOCATION: components/reports/CreditSettlementReports.tsx
// 21.3 Credit Settlement – Payment History (Vw_creditPaymentHistory)
//   per location → customer band; columns Bill NO | Paid Date |
//   Invoice No | Invoice Date | Paid Amt | Balance Before Pay |
//   Balance After Pay | Settlement | Sold Date (adaptive).
// 21.4 Credit Settlement – Account Detail
//   (Vw_Credit_SettelementHistory_Details) per location → customer
//   band; columns BILL NO | TRN TYPE | TRN DATE | PREV AMT |
//   TRN AMT | BAL AMT with INV/PAY/CHG row tints.
// PDFs in the shared print style.
// ============================================================
import type { CSSProperties } from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

export interface CphRow {
  bill: string;
  paidDate: string;
  invoiceNo: string;
  invoiceDate: string;
  paidAmt: number;
  balBefore: number;
  balAfter: number;
  settlement: string;
  soldDate: string;
}
export interface CphCustomer {
  code: string;
  name: string;
  rows: CphRow[];
  totalPaid: number;
}
export interface CphLocation {
  locCode: string;
  locName: string;
  customers: CphCustomer[];
}
export interface CphCols {
  invoiceNo: boolean;
  invoiceDate: boolean;
  balBefore: boolean;
  balAfter: boolean;
  settlement: boolean;
  soldDate: boolean;
}
export interface CphData {
  customerFilter: string | null;
  customers: Array<{ id: string; des: string }>;
  cols: CphCols;
  locationGroups: CphLocation[];
  grandPaid: number;
}

export interface CadRow {
  bill: string;
  trnType: string;
  trnDate: string;
  prevAmt: number;
  trnAmt: number;
  balAmt: number;
}
export interface CadCustomer {
  code: string;
  name: string;
  rows: CadRow[];
  lastBal: number;
}
export interface CadLocation {
  locCode: string;
  locName: string;
  customers: CadCustomer[];
}
export interface CadCols {
  prevAmt: boolean;
  trnAmt: boolean;
  balAmt: boolean;
}
export interface CadData {
  customerFilter: string | null;
  customers: Array<{ id: string; des: string }>;
  cols: CadCols;
  locationGroups: CadLocation[];
}

const fmtAmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const r2 = (n: number) => Math.round(n * 100) / 100;

// ── 21.3 helpers ──
export function cphToRows(d: CphData): Array<{ date?: string; billNo?: string; desc: string; value: number; loc?: string }> {
  const out: Array<{ date?: string; billNo?: string; desc: string; value: number; loc?: string }> = [];
  for (const l of d.locationGroups ?? [])
    for (const c of l.customers ?? [])
      for (const r of c.rows ?? [])
        out.push({ date: r.paidDate, billNo: r.bill, desc: `${c.code} ${c.name} ${r.invoiceNo}`, value: r.paidAmt, loc: l.locName });
  return out;
}
export function filterCph(d: CphData, q0: string): CphData {
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
                `${r.bill} ${r.paidDate} ${r.invoiceNo} ${r.invoiceDate} ${r.settlement} ${r.soldDate}`.toLowerCase().includes(q)
              ),
        }))
        .map((c) => ({ ...c, totalPaid: r2((c.rows ?? []).reduce((a, r) => a + r.paidAmt, 0)) }))
        .filter((c) => (c.rows ?? []).length > 0),
    }))
    .filter((l) => l.customers.length > 0);
  return { ...d, locationGroups, grandPaid: r2(locationGroups.reduce((a, l) => a + l.customers.reduce((x, c) => x + c.totalPaid, 0), 0)) };
}

// ── 21.4 helpers ──
export function cadToRows(d: CadData): Array<{ date?: string; billNo?: string; desc: string; value: number; loc?: string }> {
  const out: Array<{ date?: string; billNo?: string; desc: string; value: number; loc?: string }> = [];
  for (const l of d.locationGroups ?? [])
    for (const c of l.customers ?? [])
      for (const r of c.rows ?? [])
        out.push({ date: r.trnDate, billNo: r.bill, desc: `${c.code} ${c.name} ${r.trnType}`, value: r.trnAmt, loc: l.locName });
  return out;
}
export function filterCad(d: CadData, q0: string): CadData {
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
            : (c.rows ?? []).filter((r) => `${r.bill} ${r.trnType} ${r.trnDate}`.toLowerCase().includes(q)),
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
const emptyMsg = (t: string) => (
  <p style={{ padding: 30, textAlign: "center", color: "#64748b", fontFamily: "Inter, sans-serif", fontSize: 13 }}>{t}</p>
);

function CustBand({ left, right }: { left: string; right?: string }) {
  return (
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
      <span>{left}</span>
      {right ? <span style={{ fontVariantNumeric: "tabular-nums" }}>{right}</span> : null}
    </div>
  );
}
function TopBanner({ title, tag }: { title: string; tag: string | null }) {
  return (
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
      <span>{title}</span>
      {tag ? <span>[Customer : {tag}]</span> : null}
    </div>
  );
}

// ── 21.3 Payment History web ──
export default function PaymentHistoryReport({ report }: { report: CphData }) {
  if ((report.locationGroups ?? []).length === 0) return emptyMsg("No credit payment history for this range.");
  const c = report.cols;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <TopBanner title="CREDIT PAYMENT HISTORY" tag={report.customerFilter} />
      {report.locationGroups.map((l) => (
        <div key={l.locCode}>
          {l.customers.map((cu) => (
            <div key={cu.code}>
              <CustBand left={`${l.locCode} · ${cu.code} — ${l.locName} · ${cu.name}`} right={`Paid : ${fmtAmt(cu.totalPaid)}`} />
              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 4 }}>
                <thead>
                  <tr style={{ background: "#eff6ff" }}>
                    <th style={{ ...cell, textAlign: "left", width: 100, fontWeight: 700 }}>Bill NO</th>
                    <th style={{ ...cell, textAlign: "left", width: 95, fontWeight: 700 }}>Paid Date</th>
                    {c.invoiceNo ? <th style={{ ...cell, textAlign: "left", width: 95, fontWeight: 700 }}>Invoice No</th> : null}
                    {c.invoiceDate ? <th style={{ ...cell, textAlign: "left", width: 95, fontWeight: 700 }}>Invoice Date</th> : null}
                    <th style={{ ...cell, textAlign: "right", width: 100, fontWeight: 700 }}>Paid Amt</th>
                    {c.balBefore ? <th style={{ ...cell, textAlign: "right", width: 120, fontWeight: 700 }}>Balance Before Pay</th> : null}
                    {c.balAfter ? <th style={{ ...cell, textAlign: "right", width: 110, fontWeight: 700 }}>Balance After Pay</th> : null}
                    {c.settlement ? <th style={{ ...cell, textAlign: "left", width: 80, fontWeight: 700 }}>Settlement</th> : null}
                    {c.soldDate ? <th style={{ ...cell, textAlign: "left", width: 95, fontWeight: 700 }}>Sold Date</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {cu.rows.map((r, i) => (
                    <tr key={`${r.bill}-${i}`} style={{ background: i % 2 === 1 ? "#f8fafc" : "#fff" }}>
                      <td style={{ ...cell, fontWeight: 700 }}>{r.bill}</td>
                      <td style={cell}>{r.paidDate}</td>
                      {c.invoiceNo ? <td style={cell}>{r.invoiceNo}</td> : null}
                      {c.invoiceDate ? <td style={cell}>{r.invoiceDate}</td> : null}
                      <td style={{ ...num, fontWeight: 700, color: "#15803d" }}>{fmtAmt(r.paidAmt)}</td>
                      {c.balBefore ? <td style={num}>{fmtAmt(r.balBefore)}</td> : null}
                      {c.balAfter ? <td style={num}>{fmtAmt(r.balAfter)}</td> : null}
                      {c.settlement ? <td style={cell}>{r.settlement}</td> : null}
                      {c.soldDate ? <td style={cell}>{r.soldDate}</td> : null}
                    </tr>
                  ))}
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
        <span style={{ fontVariantNumeric: "tabular-nums" }}>PAID {fmtAmt(report.grandPaid)}</span>
      </div>
    </div>
  );
}

// ── 21.4 Account Detail web ──
export function AccountDetailReport({ report }: { report: CadData }) {
  if ((report.locationGroups ?? []).length === 0) return emptyMsg("No credit settlement details for this range.");
  const c = report.cols;
  const tint = (t: string, i: number) =>
    t === "INV" ? "#dcfce7" : t === "PAY" ? "#dbeafe" : t === "CHG" ? "#fef9c3" : i % 2 === 1 ? "#f8fafc" : "#fff";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <TopBanner title="CREDIT SETTLEMENT DETAILS" tag={report.customerFilter} />
      {report.locationGroups.map((l) => (
        <div key={l.locCode}>
          {l.customers.map((cu) => (
            <div key={cu.code}>
              <CustBand left={`${l.locCode} · ${cu.code} — ${l.locName} · ${cu.name}`} right={`Balance : ${fmtAmt(cu.lastBal)}`} />
              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 4 }}>
                <thead>
                  <tr style={{ background: "#eff6ff" }}>
                    <th style={{ ...cell, textAlign: "left", width: 110, fontWeight: 700 }}>BILL NO</th>
                    <th style={{ ...cell, textAlign: "left", width: 80, fontWeight: 700 }}>TRN TYPE</th>
                    <th style={{ ...cell, textAlign: "left", width: 100, fontWeight: 700 }}>TRN DATE</th>
                    {c.prevAmt ? <th style={{ ...cell, textAlign: "right", width: 110, fontWeight: 700 }}>PREV AMT</th> : null}
                    {c.trnAmt ? <th style={{ ...cell, textAlign: "right", width: 110, fontWeight: 700 }}>TRN AMT</th> : null}
                    {c.balAmt ? <th style={{ ...cell, textAlign: "right", width: 110, fontWeight: 700 }}>BAL AMT</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {cu.rows.map((r, i) => (
                    <tr key={`${r.bill}-${i}`} style={{ background: tint(r.trnType, i) }}>
                      <td style={{ ...cell, fontWeight: 700 }}>{r.bill}</td>
                      <td style={{ ...cell, fontWeight: 700 }}>{r.trnType}</td>
                      <td style={cell}>{r.trnDate}</td>
                      {c.prevAmt ? <td style={num}>{fmtAmt(r.prevAmt)}</td> : null}
                      {c.trnAmt ? <td style={num}>{fmtAmt(r.trnAmt)}</td> : null}
                      {c.balAmt ? <td style={{ ...num, fontWeight: 700 }}>{fmtAmt(r.balAmt)}</td> : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      ))}
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
  band: { fontFamily: "Helvetica-Bold", fontSize: 10, marginTop: 10, marginBottom: 4, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: "#1a1a1a" },
  row: { flexDirection: "row" },
  th: { backgroundColor: "#efefef", fontFamily: "Helvetica-Bold", padding: 4, fontSize: 7, borderRightWidth: 1, borderRightColor: "#cccccc", borderBottomWidth: 1, borderBottomColor: "#999999" },
  td: { padding: 4, borderRightWidth: 1, borderRightColor: "#e5e5e5" },
  bold: { fontFamily: "Helvetica-Bold" },
  right: { textAlign: "right" },
  grandRow: { flexDirection: "row", borderTopWidth: 2, borderTopColor: "#1a1a1a", marginTop: 6, paddingTop: 4 },
});

export function PaymentHistoryPdfDocument({
  title, printDate, printTime, from, to, data,
}: {
  title: string; printDate: string; printTime: string; from: string; to: string; data: CphData;
}) {
  const c = data.cols;
  const W = { bill: 60, paid: 55, inv: 55, invd: 55, amt: 60, bb: 70, ba: 65, st: 45, sd: 55 };
  return (
    <Document>
      <Page size="A4" style={pStyles.page}>
        <Text style={pStyles.title}>{title}</Text>
        {data.customerFilter ? <Text style={pStyles.filtered}>[Customer : {data.customerFilter}]</Text> : null}
        <View style={pStyles.infoRow}><Text style={pStyles.infoLabel}>Print Date</Text><Text>: {printDate}</Text></View>
        <View style={pStyles.infoRow}><Text style={pStyles.infoLabel}>Print Time</Text><Text>: {printTime}</Text></View>
        <Text style={pStyles.range}>From {from}  To {to}</Text>
        {data.locationGroups.map((l) => (
          <View key={l.locCode}>
            {l.customers.map((cu) => (
              <View key={cu.code}>
                <Text style={pStyles.band}>{l.locCode} {cu.code}   {l.locName}   {cu.name}</Text>
                <View style={pStyles.row}>
                  <Text style={[pStyles.th, { width: W.bill }]}>Bill NO</Text>
                  <Text style={[pStyles.th, { width: W.paid }]}>Paid Date</Text>
                  {c.invoiceNo ? <Text style={[pStyles.th, { width: W.inv }]}>Invoice No</Text> : null}
                  {c.invoiceDate ? <Text style={[pStyles.th, { width: W.invd }]}>Invoice Date</Text> : null}
                  <Text style={[pStyles.th, { width: W.amt }, pStyles.right]}>Paid Amt</Text>
                  {c.balBefore ? <Text style={[pStyles.th, { width: W.bb }, pStyles.right]}>Bal Before Pay</Text> : null}
                  {c.balAfter ? <Text style={[pStyles.th, { width: W.ba }, pStyles.right]}>Bal After Pay</Text> : null}
                  {c.settlement ? <Text style={[pStyles.th, { width: W.st }]}>Settle</Text> : null}
                  {c.soldDate ? <Text style={[pStyles.th, { width: W.sd }]}>Sold Date</Text> : null}
                </View>
                {cu.rows.map((r, i) => (
                  <View style={pStyles.row} key={i}>
                    <Text style={[pStyles.td, { width: W.bill }]}>{r.bill}</Text>
                    <Text style={[pStyles.td, { width: W.paid }]}>{r.paidDate}</Text>
                    {c.invoiceNo ? <Text style={[pStyles.td, { width: W.inv }]}>{r.invoiceNo}</Text> : null}
                    {c.invoiceDate ? <Text style={[pStyles.td, { width: W.invd }]}>{r.invoiceDate}</Text> : null}
                    <Text style={[pStyles.td, { width: W.amt }, pStyles.right]}>{fmtAmt(r.paidAmt)}</Text>
                    {c.balBefore ? <Text style={[pStyles.td, { width: W.bb }, pStyles.right]}>{fmtAmt(r.balBefore)}</Text> : null}
                    {c.balAfter ? <Text style={[pStyles.td, { width: W.ba }, pStyles.right]}>{fmtAmt(r.balAfter)}</Text> : null}
                    {c.settlement ? <Text style={[pStyles.td, { width: W.st }]}>{r.settlement}</Text> : null}
                    {c.soldDate ? <Text style={[pStyles.td, { width: W.sd }]}>{r.soldDate}</Text> : null}
                  </View>
                ))}
              </View>
            ))}
          </View>
        ))}
        <View style={pStyles.grandRow}>
          <Text style={pStyles.bold}>Grand Total</Text>
          <Text style={[pStyles.bold, { marginLeft: 200 }]}>PAID {fmtAmt(data.grandPaid)}</Text>
        </View>
      </Page>
    </Document>
  );
}

export function AccountDetailPdfDocument({
  title, printDate, printTime, from, to, data,
}: {
  title: string; printDate: string; printTime: string; from: string; to: string; data: CadData;
}) {
  const c = data.cols;
  const W = { bill: 70, type: 45, date: 60, prev: 70, trn: 70, bal: 70 };
  return (
    <Document>
      <Page size="A4" style={pStyles.page}>
        <Text style={pStyles.title}>{title}</Text>
        {data.customerFilter ? <Text style={pStyles.filtered}>[Customer : {data.customerFilter}]</Text> : null}
        <View style={pStyles.infoRow}><Text style={pStyles.infoLabel}>Print Date</Text><Text>: {printDate}</Text></View>
        <View style={pStyles.infoRow}><Text style={pStyles.infoLabel}>Print Time</Text><Text>: {printTime}</Text></View>
        <Text style={pStyles.range}>From {from}  To {to}</Text>
        {data.locationGroups.map((l) => (
          <View key={l.locCode}>
            {l.customers.map((cu) => (
              <View key={cu.code}>
                <Text style={pStyles.band}>{l.locCode} {cu.code}   {l.locName}   {cu.name}</Text>
                <View style={pStyles.row}>
                  <Text style={[pStyles.th, { width: W.bill }]}>BILL NO</Text>
                  <Text style={[pStyles.th, { width: W.type }]}>TRN TYPE</Text>
                  <Text style={[pStyles.th, { width: W.date }]}>TRN DATE</Text>
                  {c.prevAmt ? <Text style={[pStyles.th, { width: W.prev }, pStyles.right]}>PREV AMT</Text> : null}
                  {c.trnAmt ? <Text style={[pStyles.th, { width: W.trn }, pStyles.right]}>TRN AMT</Text> : null}
                  {c.balAmt ? <Text style={[pStyles.th, { width: W.bal }, pStyles.right]}>BAL AMT</Text> : null}
                </View>
                {cu.rows.map((r, i) => (
                  <View style={pStyles.row} key={i}>
                    <Text style={[pStyles.td, { width: W.bill }]}>{r.bill}</Text>
                    <Text style={[pStyles.td, { width: W.type }]}>{r.trnType}</Text>
                    <Text style={[pStyles.td, { width: W.date }]}>{r.trnDate}</Text>
                    {c.prevAmt ? <Text style={[pStyles.td, { width: W.prev }, pStyles.right]}>{fmtAmt(r.prevAmt)}</Text> : null}
                    {c.trnAmt ? <Text style={[pStyles.td, { width: W.trn }, pStyles.right]}>{fmtAmt(r.trnAmt)}</Text> : null}
                    {c.balAmt ? <Text style={[pStyles.td, { width: W.bal }, pStyles.right]}>{fmtAmt(r.balAmt)}</Text> : null}
                  </View>
                ))}
              </View>
            ))}
          </View>
        ))}
      </Page>
    </Document>
  );
}
