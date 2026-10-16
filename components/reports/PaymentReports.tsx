"use client";

// ============================================================
// LOCATION: components/reports/PaymentReports.tsx
// ✅ 2.1 Payment Mode – Payment Summary (+ 2.2 Mode Wise) renderer
//    POS print eke wage: location → date (Daily Total) → bill-wise
//    payment rows (CASH / MASTER CARD / ...) + bill total + Grand Total.
//    Flat blue theme — gradients NAE.
// ============================================================
import { Fragment } from "react";
import type { CSSProperties } from "react";
import { IconPin } from "./ReportIcons";

export interface PayPayment {
  desc: string;
  amount: number;
}
export interface PayBill {
  billNo: string;
  billTotal: number;
  payments: PayPayment[];
  casher: string;
  remarks: string;
}
export interface PayDateGroup {
  date: string;
  dailyTotal: number;
  bills: PayBill[];
}
export interface PayLocation {
  locCode: string;
  locName: string;
  locTotal: number;
  dateGroups: PayDateGroup[];
}
export interface PaymentSummaryData {
  locationGroups: PayLocation[];
  grandTotal: number;
}

export interface PayRow {
  date?: string;
  billNo?: string;
  desc: string;
  value: number;
  loc?: string;
}

const fmtAmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const r2 = (n: number) => Math.round(n * 100) / 100;

// ── analytics rows ──
export function paymentsToRows(d: PaymentSummaryData): PayRow[] {
  const out: PayRow[] = [];
  for (const loc of d.locationGroups ?? [])
    for (const g of loc.dateGroups ?? [])
      for (const b of g.bills ?? [])
        for (const p of b.payments ?? [])
          out.push({ date: g.date, billNo: b.billNo, desc: p.desc, value: p.amount, loc: loc.locName });
  return out;
}

// ── search filter ──
export function filterPayments(d: PaymentSummaryData, q0: string): PaymentSummaryData {
  const q = q0.trim().toLowerCase();
  if (!q) return d;
  const locationGroups = (d.locationGroups ?? [])
    .map((loc) => {
      const dateGroups = (loc.dateGroups ?? [])
        .map((g) => {
          const bills = (g.bills ?? [])
            .map((b) => {
              const payments = (b.payments ?? []).filter((p) =>
                `${b.billNo} ${p.desc} ${b.casher} ${b.remarks}`.toLowerCase().includes(q)
              );
              return {
                ...b,
                payments,
                billTotal: r2(payments.reduce((s, p) => s + p.amount, 0)),
              };
            })
            .filter((b) => b.payments.length > 0);
          return { ...g, bills, dailyTotal: r2(bills.reduce((s, b) => s + b.billTotal, 0)) };
        })
        .filter((g) => g.bills.length > 0);
      return { ...loc, dateGroups, locTotal: r2(dateGroups.reduce((s, g) => s + g.dailyTotal, 0)) };
    })
    .filter((l) => l.dateGroups.length > 0);
  return {
    locationGroups,
    grandTotal: r2(locationGroups.reduce((s, l) => s + l.locTotal, 0)),
  };
}

// ── flat styles ──
const NAVY = "#684830";
const cell: CSSProperties = {
  padding: "5px 10px",
  fontSize: 11.5,
  fontFamily: "Inter, sans-serif",
  color: "#45301D",
  verticalAlign: "top",
};
const num: CSSProperties = { ...cell, textAlign: "right", fontVariantNumeric: "tabular-nums" };

export default function PaymentSummaryReport({ report }: { report: PaymentSummaryData }) {
  if ((report.locationGroups ?? []).length === 0)
    return (
      <p style={{ padding: 30, textAlign: "center", color: "#6B543E", fontFamily: "Inter, sans-serif", fontSize: 13 }}>
        No payment records found for this range.
      </p>
    );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {report.locationGroups.map((loc) => (
        <div key={loc.locCode}>
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
              {loc.locCode} — {loc.locName}
            </span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtAmt(loc.locTotal)}</span>
          </div>

          {loc.dateGroups.map((g) => (
            <div key={g.date} style={{ marginTop: 10 }}>
              <div
                style={{
                  background: "#E4D6BF",
                  color: "#684830",
                  borderRadius: 6,
                  padding: "6px 10px",
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  fontWeight: 800,
                  fontFamily: "Inter, sans-serif",
                }}
              >
                <span>{g.date}</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>Daily Total {fmtAmt(g.dailyTotal)}</span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 6 }}>
                <thead>
                  <tr style={{ background: "#F0E8D8" }}>
                    <th style={{ ...cell, textAlign: "left", width: 110, fontWeight: 700 }}>BillNo</th>
                    <th style={{ ...cell, textAlign: "left", fontWeight: 700 }}>Payment Description</th>
                    <th style={{ ...cell, textAlign: "right", width: 120, fontWeight: 700 }}>Amount</th>
                    <th style={{ ...cell, textAlign: "left", width: 130, fontWeight: 700 }}>Remarks</th>
                    <th style={{ ...cell, textAlign: "left", width: 110, fontWeight: 700 }}>Casher Name</th>
                  </tr>
                </thead>
                <tbody>
                  {g.bills.map((b, bi) => (
                    <Fragment key={b.billNo}>
                      {b.payments.map((p, pi) => (
                        <tr key={`${b.billNo}-${pi}`} style={{ background: bi % 2 === 1 ? "#FCF7F3" : "#fff" }}>
                          {pi === 0 && (
                            <td rowSpan={b.payments.length} style={{ ...cell, fontWeight: 700 }}>
                              {b.billNo}
                            </td>
                          )}
                          <td style={cell}>{p.desc}</td>
                          <td style={num}>{fmtAmt(p.amount)}</td>
                          {pi === 0 && (
                            <td rowSpan={b.payments.length} style={cell}>
                              {b.remarks}
                            </td>
                          )}
                          {pi === 0 && (
                            <td rowSpan={b.payments.length} style={cell}>
                              {b.casher}
                            </td>
                          )}
                        </tr>
                      ))}
                      <tr key={`${b.billNo}-t`} style={{ background: "#FCF7F3" }}>
                        <td colSpan={2} style={{ ...cell, color: "#6B543E", fontSize: 10.5 }}>
                          Bill Total
                        </td>
                        <td style={{ ...num, fontWeight: 800, color: NAVY, borderBottom: "1px solid #E4D6BF" }}>
                          {fmtAmt(b.billTotal)}
                        </td>
                        <td colSpan={2} style={cell} />
                      </tr>
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
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
        <span>Grand Total (all locations)</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtAmt(report.grandTotal)}</span>
      </div>
    </div>
  );
}
