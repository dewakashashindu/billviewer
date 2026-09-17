"use client";

// ============================================================
// LOCATION: components/reports/CashierReports.tsx
// 2.4 Payment – Bill Type Wise (VW_SalesSummery grouped by
// BILLTYPE, POS Sp_SalesPayment output parity), 3.1 Cashier
// Collection – Cashier Wise Sales (VW_SalesSummery per cashier:
// BillNo | Total Value | Txn Date-Time + Cashier Collection)
// and 3.2 Cashier Collection – Payment Break Down (per cashier,
// per payment mode rows + subtotals). Flat blue theme; PDFs in
// the shared print style.
// ============================================================
import { Fragment } from "react";
import type { CSSProperties } from "react";
import { IconPin } from "./ReportIcons";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const fmtAmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const r2 = (n: number) => Math.round(n * 100) / 100;

// ── 2.4 Bill Type Wise ──
export interface BillTypeRow { type: string; bills: number; total: number; }
export interface BillTypeLocation { locCode: string; locName: string; rows: BillTypeRow[]; locBills: number; locTotal: number; }
export interface BillTypeData { locationGroups: BillTypeLocation[]; grandBills: number; grandTotal: number; }

export function billTypeToRows(d: BillTypeData): Array<{ date?: string; billNo?: string; desc: string; value: number; loc?: string }> {
  const out: Array<{ date?: string; billNo?: string; desc: string; value: number; loc?: string }> = [];
  for (const l of d.locationGroups ?? [])
    for (const r of l.rows ?? []) out.push({ desc: r.type, value: r.total, loc: l.locName });
  return out;
}
export function filterBillType(d: BillTypeData, q0: string): BillTypeData {
  const q = q0.trim().toLowerCase();
  if (!q) return d;
  const locationGroups = (d.locationGroups ?? [])
    .map((l) => ({ ...l, rows: (l.rows ?? []).filter((r) => `${r.type} ${l.locCode} ${l.locName}`.toLowerCase().includes(q)) }))
    .filter((l) => l.rows.length > 0);
  return { ...d, locationGroups };
}

// ── 3.1 Cashier Collection ──
export interface CcBill { billNo: string; value: number; dateTime: string; }
export interface CcCashier { code: string; bills: CcBill[]; total: number; }
export interface CcLocation { locCode: string; locName: string; cashiers: CcCashier[]; locTotal: number; }
export interface CcData { locationGroups: CcLocation[]; grandTotal: number; }

export function ccToRows(d: CcData): Array<{ date?: string; billNo?: string; desc: string; value: number; loc?: string }> {
  const out: Array<{ date?: string; billNo?: string; desc: string; value: number; loc?: string }> = [];
  for (const l of d.locationGroups ?? [])
    for (const c of l.cashiers ?? [])
      for (const b of c.bills ?? []) out.push({ date: b.dateTime, billNo: b.billNo, desc: c.code, value: b.value, loc: l.locName });
  return out;
}
export function filterCc(d: CcData, q0: string): CcData {
  const q = q0.trim().toLowerCase();
  if (!q) return d;
  const locationGroups = (d.locationGroups ?? [])
    .map((l) => ({
      ...l,
      cashiers: (l.cashiers ?? [])
        .filter((c) => `${c.code} ${l.locCode} ${l.locName}`.toLowerCase().includes(q))
        .map((c) => ({
          ...c,
          bills: `${c.code}`.toLowerCase().includes(q)
            ? c.bills
            : (c.bills ?? []).filter((b) => `${b.billNo} ${b.dateTime}`.toLowerCase().includes(q)),
        }))
        .filter((c) => (c.bills ?? []).length > 0),
    }))
    .filter((l) => l.cashiers.length > 0);
  return { ...d, locationGroups };
}

// ── 3.2 Payment Break Down ──
export interface CbdRow { dateTime: string; amount: number; }
export interface CbdMode { mode: string; rows: CbdRow[]; total: number; }
export interface CbdCashier { code: string; modes: CbdMode[]; total: number; }
export interface CbdLocation { locCode: string; locName: string; cashiers: CbdCashier[]; locTotal: number; }
export interface CbdData { locationGroups: CbdLocation[]; grandTotal: number; }

export function cbdToRows(d: CbdData): Array<{ date?: string; billNo?: string; desc: string; value: number; loc?: string }> {
  const out: Array<{ date?: string; billNo?: string; desc: string; value: number; loc?: string }> = [];
  for (const l of d.locationGroups ?? [])
    for (const c of l.cashiers ?? [])
      for (const m of c.modes ?? [])
        for (const r of m.rows ?? []) out.push({ date: r.dateTime, desc: `${c.code} ${m.mode}`, value: r.amount, loc: l.locName });
  return out;
}
export function filterCbd(d: CbdData, q0: string): CbdData {
  const q = q0.trim().toLowerCase();
  if (!q) return d;
  const locationGroups = (d.locationGroups ?? [])
    .map((l) => ({
      ...l,
      cashiers: (l.cashiers ?? [])
        .filter((c) => `${c.code} ${l.locCode} ${l.locName}`.toLowerCase().includes(q))
        .map((c) => ({
          ...c,
          modes: (c.modes ?? [])
            .map((m) => ({
              ...m,
              rows: `${c.code} ${m.mode}`.toLowerCase().includes(q)
                ? m.rows
                : (m.rows ?? []).filter((r) => r.dateTime.toLowerCase().includes(q)),
            }))
            .filter((m) => (m.rows ?? []).length > 0),
        }))
        .filter((c) => (c.modes ?? []).length > 0),
    }))
    .filter((l) => l.cashiers.length > 0);
  return { ...d, locationGroups };
}

// ── shared flat styles ──
const NAVY = "#0d2b57";
const cell: CSSProperties = {
  padding: "5px 10px",
  fontSize: 11.5,
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
const band: CSSProperties = {
  background: "#dbeafe",
  color: "#1e3a8a",
  borderRadius: 6,
  padding: "6px 10px",
  display: "flex",
  justifyContent: "space-between",
  fontSize: 12,
  fontWeight: 800,
  fontFamily: "Inter, sans-serif",
  marginTop: 8,
};
const grand: CSSProperties = {
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
};

function Empty({ text }: { text: string }) {
  return (
    <p style={{ padding: 30, textAlign: "center", color: "#64748b", fontFamily: "Inter, sans-serif", fontSize: 13 }}>
      {text}
    </p>
  );
}

// ═══════════════ 2.4 BILL TYPE WISE ═══════════════
export function BillTypeReport({ report }: { report: BillTypeData }) {
  if ((report.locationGroups ?? []).length === 0) return <Empty text="No bill type payments for this range." />;
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
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 6 }}>
            <thead>
              <tr style={{ background: "#eff6ff" }}>
                <th style={{ ...cell, textAlign: "left", fontWeight: 700 }}>Bill Type</th>
                <th style={{ ...cell, textAlign: "right", width: 110, fontWeight: 700 }}>No of Bills</th>
                <th style={{ ...cell, textAlign: "right", width: 140, fontWeight: 700 }}>Total Value</th>
              </tr>
            </thead>
            <tbody>
              {l.rows.map((r, i) => (
                <tr key={r.type} style={{ background: i % 2 === 1 ? "#f8fafc" : "#fff" }}>
                  <td style={{ ...cell, fontWeight: 700 }}>{r.type}</td>
                  <td style={num}>{r.bills.toLocaleString("en-US")}</td>
                  <td style={num}>{fmtAmt(r.total)}</td>
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
      ))}
      <div style={grand}>
        <span>Grand Total (all locations)</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          {report.grandBills.toLocaleString("en-US")} bills · {fmtAmt(report.grandTotal)}
        </span>
      </div>
    </div>
  );
}

// ═══════════════ 3.1 CASHIER WISE SALES ═══════════════
export function CashierCollectionReport({ report }: { report: CcData }) {
  if ((report.locationGroups ?? []).length === 0) return <Empty text="No cashier collections for this range." />;
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
          {l.cashiers.map((c) => (
            <div key={c.code}>
              <div style={band}>
                <span>CASHIER — {c.code}</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtAmt(c.total)}</span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 6 }}>
                <thead>
                  <tr style={{ background: "#eff6ff" }}>
                    <th style={{ ...cell, textAlign: "left", width: 130, fontWeight: 700 }}>BillNo</th>
                    <th style={{ ...cell, textAlign: "right", width: 140, fontWeight: 700 }}>Total Value</th>
                    <th style={{ ...cell, textAlign: "left", fontWeight: 700 }}>Txn Date-Time</th>
                  </tr>
                </thead>
                <tbody>
                  {c.bills.map((b, i) => (
                    <tr key={`${c.code}-${b.billNo}-${i}`} style={{ background: i % 2 === 1 ? "#f8fafc" : "#fff" }}>
                      <td style={{ ...cell, fontWeight: 700 }}>{b.billNo}</td>
                      <td style={num}>{fmtAmt(b.value)}</td>
                      <td style={cell}>{b.dateTime}</td>
                    </tr>
                  ))}
                  <tr style={{ background: "#fbfdff", borderTop: "1px solid #94a3b8" }}>
                    <td style={{ ...cell, fontWeight: 800, color: "#1e3a8a" }}>Cashier Collection</td>
                    <td style={{ ...num, fontWeight: 800, color: NAVY }}>{fmtAmt(c.total)}</td>
                    <td style={cell} />
                  </tr>
                </tbody>
              </table>
            </div>
          ))}
        </div>
      ))}
      <div style={grand}>
        <span>Grand Total (all locations)</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtAmt(report.grandTotal)}</span>
      </div>
    </div>
  );
}

// ═══════════════ 3.2 PAYMENT BREAK DOWN ═══════════════
export function CashierBreakdownReport({ report }: { report: CbdData }) {
  if ((report.locationGroups ?? []).length === 0) return <Empty text="No cashier payments for this range." />;
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
          {l.cashiers.map((c) => (
            <div key={c.code}>
              <div style={band}>
                <span>CASHIER — {c.code}</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtAmt(c.total)}</span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 6 }}>
                <thead>
                  <tr style={{ background: "#eff6ff" }}>
                    <th style={{ ...cell, textAlign: "left", width: 170, fontWeight: 700 }}>Date-Time</th>
                    <th style={{ ...cell, textAlign: "left", fontWeight: 700 }}>Payment Mode</th>
                    <th style={{ ...cell, textAlign: "right", width: 140, fontWeight: 700 }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {c.modes.map((m) => (
                    <Fragment key={`${c.code}-${m.mode}`}>
                      {m.rows.map((r, i) => (
                        <tr key={`${m.mode}-${i}`} style={{ background: i % 2 === 1 ? "#f8fafc" : "#fff" }}>
                          <td style={cell}>{r.dateTime}</td>
                          <td style={{ ...cell, fontWeight: 700 }}>{m.mode}</td>
                          <td style={num}>{fmtAmt(r.amount)}</td>
                        </tr>
                      ))}
                      <tr style={{ background: "#eff6ff" }}>
                        <td colSpan={2} style={{ ...cell, fontWeight: 800, color: "#1e3a8a" }}>{m.mode} sub total</td>
                        <td style={{ ...num, fontWeight: 800, color: "#1e3a8a" }}>{fmtAmt(m.total)}</td>
                      </tr>
                    </Fragment>
                  ))}
                  <tr style={{ background: "#fbfdff", borderTop: "1px solid #94a3b8" }}>
                    <td colSpan={2} style={{ ...cell, fontWeight: 800, color: "#1e3a8a" }}>Cashier Total</td>
                    <td style={{ ...num, fontWeight: 800, color: NAVY }}>{fmtAmt(c.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))}
        </div>
      ))}
      <div style={grand}>
        <span>Grand Total (all locations)</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtAmt(report.grandTotal)}</span>
      </div>
    </div>
  );
}

// ── PDFs — shared print style ──
const pStyles = StyleSheet.create({
  page: { padding: 28, fontFamily: "Helvetica", fontSize: 9, color: "#1a1a1a" },
  title: { textAlign: "center", fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 10 },
  infoRow: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 2 },
  infoLabel: { width: 80 },
  range: { fontFamily: "Helvetica-Bold", fontSize: 10, marginTop: 8, marginBottom: 4 },
  location: { fontFamily: "Helvetica-Bold", fontSize: 11, marginTop: 12, marginBottom: 4, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: "#1a1a1a" },
  band: { fontFamily: "Helvetica-Bold", fontSize: 9.5, marginTop: 8, marginBottom: 4 },
  row: { flexDirection: "row" },
  th: { backgroundColor: "#efefef", fontFamily: "Helvetica-Bold", padding: 4, fontSize: 8, borderRightWidth: 1, borderRightColor: "#cccccc", borderBottomWidth: 1, borderBottomColor: "#999999" },
  td: { padding: 4, borderRightWidth: 1, borderRightColor: "#e5e5e5" },
  bold: { fontFamily: "Helvetica-Bold" },
  right: { textAlign: "right" },
  totalRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#1a1a1a", marginTop: 2 },
  grandRow: { flexDirection: "row", borderTopWidth: 2, borderTopColor: "#1a1a1a", marginTop: 6, paddingTop: 4 },
});

function PdfHead({ title, printDate, printTime, from, to }: { title: string; printDate: string; printTime: string; from: string; to: string }) {
  return (
    <>
      <Text style={pStyles.title}>{title}</Text>
      <View style={pStyles.infoRow}><Text style={pStyles.infoLabel}>Print Date</Text><Text>: {printDate}</Text></View>
      <View style={pStyles.infoRow}><Text style={pStyles.infoLabel}>Print Time</Text><Text>: {printTime}</Text></View>
      <Text style={pStyles.range}>From {from}  To {to}</Text>
    </>
  );
}

const BW = { type: 160, bills: 90, value: 130 };
export function BillTypePdfDocument({ title, printDate, printTime, from, to, data }: { title: string; printDate: string; printTime: string; from: string; to: string; data: BillTypeData }) {
  return (
    <Document>
      <Page size="A4" style={pStyles.page}>
        <PdfHead title={title} printDate={printDate} printTime={printTime} from={from} to={to} />
        {data.locationGroups.map((l) => (
          <View key={l.locCode}>
            <Text style={pStyles.location}>{l.locCode}   {l.locName}</Text>
            <View style={pStyles.row}>
              <Text style={[pStyles.th, { width: BW.type }]}>Bill Type</Text>
              <Text style={[pStyles.th, { width: BW.bills }, pStyles.right]}>No of Bills</Text>
              <Text style={[pStyles.th, { width: BW.value }, pStyles.right]}>Total Value</Text>
            </View>
            {l.rows.map((r) => (
              <View style={pStyles.row} key={r.type}>
                <Text style={[pStyles.td, { width: BW.type }]}>{r.type}</Text>
                <Text style={[pStyles.td, { width: BW.bills }, pStyles.right]}>{r.bills}</Text>
                <Text style={[pStyles.td, { width: BW.value }, pStyles.right]}>{fmtAmt(r.total)}</Text>
              </View>
            ))}
            <View style={pStyles.totalRow}>
              <Text style={[pStyles.td, { width: BW.type }, pStyles.bold]}>Location Total</Text>
              <Text style={[pStyles.td, { width: BW.bills }, pStyles.right]}>{l.locBills}</Text>
              <Text style={[pStyles.td, { width: BW.value }, pStyles.right, pStyles.bold]}>{fmtAmt(l.locTotal)}</Text>
            </View>
          </View>
        ))}
        <View style={pStyles.grandRow}>
          <Text style={[pStyles.bold, { width: BW.type }]}>Grand Total</Text>
          <Text style={[pStyles.bold, { width: BW.bills }, pStyles.right]}>{data.grandBills}</Text>
          <Text style={[pStyles.bold, { width: BW.value }, pStyles.right]}>{fmtAmt(data.grandTotal)}</Text>
        </View>
      </Page>
    </Document>
  );
}

const CW = { bill: 110, value: 120, dt: 160 };
export function CashierCollectionPdfDocument({ title, printDate, printTime, from, to, data }: { title: string; printDate: string; printTime: string; from: string; to: string; data: CcData }) {
  return (
    <Document>
      <Page size="A4" style={pStyles.page}>
        <PdfHead title={title} printDate={printDate} printTime={printTime} from={from} to={to} />
        {data.locationGroups.map((l) => (
          <View key={l.locCode}>
            <Text style={pStyles.location}>{l.locCode}   {l.locName}</Text>
            {l.cashiers.map((c) => (
              <View key={c.code}>
                <Text style={pStyles.band}>CASHIER - {c.code}</Text>
                <View style={pStyles.row}>
                  <Text style={[pStyles.th, { width: CW.bill }]}>BillNo</Text>
                  <Text style={[pStyles.th, { width: CW.value }, pStyles.right]}>Total Value</Text>
                  <Text style={[pStyles.th, { width: CW.dt }]}>Txn Date-Time</Text>
                </View>
                {c.bills.map((b, i) => (
                  <View style={pStyles.row} key={i}>
                    <Text style={[pStyles.td, { width: CW.bill }]}>{b.billNo}</Text>
                    <Text style={[pStyles.td, { width: CW.value }, pStyles.right]}>{fmtAmt(b.value)}</Text>
                    <Text style={[pStyles.td, { width: CW.dt }]}>{b.dateTime}</Text>
                  </View>
                ))}
                <View style={pStyles.totalRow}>
                  <Text style={[pStyles.td, { width: CW.bill }, pStyles.bold]}>Cashier Collection</Text>
                  <Text style={[pStyles.td, { width: CW.value }, pStyles.right, pStyles.bold]}>{fmtAmt(c.total)}</Text>
                </View>
              </View>
            ))}
          </View>
        ))}
        <View style={pStyles.grandRow}>
          <Text style={[pStyles.bold, { width: CW.bill + CW.value }]}>Grand Total</Text>
          <Text style={[pStyles.bold, { width: CW.dt }, pStyles.right]}>{fmtAmt(data.grandTotal)}</Text>
        </View>
      </Page>
    </Document>
  );
}

const DW = { dt: 160, mode: 140, amount: 120 };
export function CashierBreakdownPdfDocument({ title, printDate, printTime, from, to, data }: { title: string; printDate: string; printTime: string; from: string; to: string; data: CbdData }) {
  return (
    <Document>
      <Page size="A4" style={pStyles.page}>
        <PdfHead title={title} printDate={printDate} printTime={printTime} from={from} to={to} />
        {data.locationGroups.map((l) => (
          <View key={l.locCode}>
            <Text style={pStyles.location}>{l.locCode}   {l.locName}</Text>
            {l.cashiers.map((c) => (
              <View key={c.code}>
                <Text style={pStyles.band}>CASHIER - {c.code}</Text>
                <View style={pStyles.row}>
                  <Text style={[pStyles.th, { width: DW.dt }]}>Date-Time</Text>
                  <Text style={[pStyles.th, { width: DW.mode }]}>Payment Mode</Text>
                  <Text style={[pStyles.th, { width: DW.amount }, pStyles.right]}>Amount</Text>
                </View>
                {c.modes.map((m) => (
                  <View key={m.mode}>
                    {m.rows.map((r, i) => (
                      <View style={pStyles.row} key={i}>
                        <Text style={[pStyles.td, { width: DW.dt }]}>{r.dateTime}</Text>
                        <Text style={[pStyles.td, { width: DW.mode }]}>{m.mode}</Text>
                        <Text style={[pStyles.td, { width: DW.amount }, pStyles.right]}>{fmtAmt(r.amount)}</Text>
                      </View>
                    ))}
                    <View style={pStyles.totalRow}>
                      <Text style={[pStyles.td, { width: DW.dt + DW.mode }, pStyles.bold]}>{m.mode} sub total</Text>
                      <Text style={[pStyles.td, { width: DW.amount }, pStyles.right]}>{fmtAmt(m.total)}</Text>
                    </View>
                  </View>
                ))}
                <View style={pStyles.grandRow}>
                  <Text style={[pStyles.bold, { width: DW.dt + DW.mode }]}>Cashier Total</Text>
                  <Text style={[pStyles.bold, { width: DW.amount }, pStyles.right]}>{fmtAmt(c.total)}</Text>
                </View>
              </View>
            ))}
          </View>
        ))}
        <View style={pStyles.grandRow}>
          <Text style={[pStyles.bold, { width: DW.dt + DW.mode }]}>Grand Total</Text>
          <Text style={[pStyles.bold, { width: DW.amount }, pStyles.right]}>{fmtAmt(data.grandTotal)}</Text>
        </View>
      </Page>
    </Document>
  );
}
