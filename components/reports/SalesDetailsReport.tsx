"use client";

// ============================================================
// LOCATION: components/reports/SalesDetailsReport.tsx
// ALUTH FILE — mekamama create karanna
//
// Sales Details report (presentational — data page eken enawa):
//   per-date card (gradient date bar + bill count + footer strip)
//     └ per-bill block: BillNo + meta chips row
//         └ items table (Menu Item | Qty | Sales Price | Tot Item Price)
//         └ totals box (Gross → Net Total, POS PDF box eka wage)
// Exports:
//   filterSalesDetails(report, query) — bill/item search filter
//   SalesDetailsData / DetBill / DetItem types
// ============================================================
import type { CSSProperties } from "react";
import { IconCalendar, IconInbox } from "./ReportIcons";

export interface DetItem {
  name: string;
  qty: number;
  salesPrice: number;
  totItemPrice: number;
}

export interface DetTotals {
  gross: number;
  discount: number;
  discountPre: number;
  grossAfterDis: number;
  serviceCharge: number;
  otherServiceCharge: number;
  vat: number;
  otherVat: number;
  tdl: number;
  packingCharge: number;
  deliveryCharge: number;
  netTotal: number;
}

export interface DetBill {
  billNo: string;
  billType: string;
  userName: string;
  steward: string;
  noPax: string;
  tableNo: string;
  orderMode: string;
  items: DetItem[];
  totals: DetTotals;
}

export interface SalesDetailsData {
  dateGroups: {
    date: string;
    bills: DetBill[];
    dayNetTotal: number;
  }[];
}

const fmtAmt = (n: number) =>
  n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const fmtQty = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Search filter — bill fields + item names scan; matching bills full display */
export function filterSalesDetails(
  report: SalesDetailsData,
  query: string
): SalesDetailsData {
  const q = query.trim().toLowerCase();
  if (!q) return report;
  return {
    dateGroups: report.dateGroups
      .map((g) => {
        const bills = g.bills.filter((b) => {
          const itemHay = b.items.map((i) => i.name).join(" ");
          const hay = `${b.billNo} ${b.billType} ${b.userName} ${b.steward} ${b.tableNo} ${b.orderMode} ${b.noPax} ${itemHay} ${b.totals.netTotal}`;
          return hay.toLowerCase().includes(q);
        });
        return {
          ...g,
          bills,
          dayNetTotal: bills.reduce((s, b) => s + b.totals.netTotal, 0),
        };
      })
      .filter((g) => g.bills.length > 0),
  };
}

const grad = "linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%)";

const th: CSSProperties = {
  background: grad,
  color: "#e0eafc",
  padding: "9px 12px",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  borderRight: "1px solid rgba(255,255,255,0.08)",
  whiteSpace: "nowrap",
  textAlign: "left",
};

const td: CSSProperties = {
  padding: "7px 12px",
  fontSize: 12,
  color: "#1e293b",
  borderBottom: "1px solid #f1f5f9",
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
};

export default function SalesDetailsReport({
  report,
}: {
  report: SalesDetailsData;
}) {
  const billCount = report.dateGroups.reduce((s, g) => s + g.bills.length, 0);

  // ── Empty state (same family as other reports) ──
  if (report.dateGroups.length === 0) {
    return (
      <div style={{ padding: "22px 24px 28px", fontFamily: "Inter, sans-serif" }}>
        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 14,
            background: "#ffffff",
            boxShadow:
              "0 1px 2px rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.06)",
            padding: "46px 20px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: 10,
              color: "#cbd5e1",
            }}
          >
            <IconInbox size={30} strokeWidth={1.6} />
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 13.5,
              fontWeight: 600,
              color: "#334155",
            }}
          >
            No bill details found for the selected date range.
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#94a3b8" }}>
            Try changing the date range or clearing the search.
          </p>
        </div>
      </div>
    );
  }

  const metaChip = (label: string, value: string) =>
    value ? (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          background: "#f1f5f9",
          border: "1px solid #e2e8f0",
          borderRadius: 999,
          padding: "3px 10px",
          fontSize: 10.5,
          fontWeight: 600,
          color: "#475569",
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ color: "#94a3b8", fontWeight: 700 }}>{label}</span>
        {value}
      </span>
    ) : null;

  return (
    <div style={{ padding: "22px 24px 28px", fontFamily: "Inter, sans-serif" }}>
      {report.dateGroups.map((g) => (
        <div
          key={g.date}
          style={{
            marginTop: 18,
            border: "1px solid #e2e8f0",
            borderRadius: 14,
            overflow: "hidden",
            background: "#ffffff",
            boxShadow:
              "0 1px 2px rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.06)",
          }}
        >
          {/* gradient date bar */}
          <div
            style={{
              padding: "11px 16px",
              fontSize: 13,
              fontWeight: 700,
              color: "#e0eafc",
              background: grad,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <IconCalendar size={13} strokeWidth={2.2} />
              {g.date}
            </span>
            <span
              style={{
                background: "rgba(255,255,255,0.14)",
                borderRadius: 999,
                padding: "3px 10px",
                fontSize: 10.5,
                fontWeight: 600,
                letterSpacing: 0.3,
              }}
            >
              {g.bills.length} bill{g.bills.length === 1 ? "" : "s"}
            </span>
          </div>

          {/* bills */}
          {g.bills.map((b) => (
            <div
              key={b.billNo}
              style={{
                padding: "14px 16px 16px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              {/* bill header — BillNo + meta chips */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                  marginBottom: 10,
                }}
              >
                <span
                  style={{
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: "#0f172a",
                    letterSpacing: 0.2,
                  }}
                >
                  {b.billNo}
                </span>
                <span
                  style={{
                    width: 1,
                    height: 14,
                    background: "#e2e8f0",
                    display: "inline-block",
                  }}
                />
                {metaChip("TYPE", b.billType)}
                {metaChip("MODE", b.orderMode)}
                {metaChip("CASHIER", b.userName)}
                {metaChip("STEWARD", b.steward)}
                {metaChip("PAX", b.noPax)}
                {metaChip("TABLE", b.tableNo)}
              </div>

              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {/* items table */}
                <div
                  style={{
                    flex: "1 1 380px",
                    minWidth: 340,
                    overflowX: "auto",
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                  }}
                >
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 12,
                      minWidth: 340,
                    }}
                  >
                    <thead>
                      <tr>
                        <th style={{ ...th, borderRadius: "0 0 0 0" }}>
                          Menu Item
                        </th>
                        <th style={{ ...th, textAlign: "right", width: 70 }}>
                          Qty
                        </th>
                        <th style={{ ...th, textAlign: "right", width: 100 }}>
                          Sales Price
                        </th>
                        <th
                          style={{
                            ...th,
                            textAlign: "right",
                            width: 110,
                            borderRight: "none",
                          }}
                        >
                          Tot Item Price
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {b.items.map((it, i) => (
                        <tr
                          key={i}
                          style={{
                            background: i % 2 === 1 ? "#f8fafc" : "#ffffff",
                          }}
                        >
                          <td
                            style={{
                              ...td,
                              fontWeight: 500,
                              whiteSpace: "normal",
                            }}
                          >
                            {it.name}
                          </td>
                          <td style={{ ...td, textAlign: "right" }}>
                            {fmtQty(it.qty)}
                          </td>
                          <td style={{ ...td, textAlign: "right" }}>
                            {fmtAmt(it.salesPrice)}
                          </td>
                          <td
                            style={{
                              ...td,
                              textAlign: "right",
                              fontWeight: 600,
                            }}
                          >
                            {fmtAmt(it.totItemPrice)}
                          </td>
                        </tr>
                      ))}
                      {b.items.length === 0 && (
                        <tr>
                          <td
                            style={{
                              ...td,
                              color: "#94a3b8",
                              textAlign: "center",
                            }}
                            colSpan={4}
                          >
                            No items
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* totals box — POS PDF box eka wage */}
                <div
                  style={{
                    flex: "0 1 270px",
                    minWidth: 240,
                    alignSelf: "flex-start",
                    border: "1.5px solid #0f172a",
                    borderRadius: 10,
                    overflow: "hidden",
                    background: "#ffffff",
                  }}
                >
                  {(() => {
                    const t = b.totals;
                    const rows: {
                      label: string;
                      value: number;
                      strong?: boolean;
                    }[] = [
                      { label: "Gross", value: t.gross, strong: true },
                      {
                        label: t.discountPre
                          ? `Discount (${fmtQty(t.discountPre)} %)`
                          : "Discount",
                        value: t.discount,
                      },
                      { label: "Gross After Dis.", value: t.grossAfterDis },
                      { label: "Service Charge", value: t.serviceCharge },
                      {
                        label: "Other Service Charge",
                        value: t.otherServiceCharge,
                      },
                      { label: "VAT", value: t.vat },
                      { label: "Other Vat", value: t.otherVat },
                      { label: "TDL", value: t.tdl },
                      { label: "Packing Charge", value: t.packingCharge },
                      { label: "Delivery Charge", value: t.deliveryCharge },
                      { label: "Net Total", value: t.netTotal, strong: true },
                    ];
                    return rows.map((r, i) => (
                      <div
                        key={r.label}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 10,
                          padding: r.strong ? "8px 12px" : "5.5px 12px",
                          fontSize: r.strong ? 12 : 11.5,
                          fontWeight: r.strong ? 700 : 400,
                          color: r.strong ? "#0f172a" : "#334155",
                          background: r.strong ? "#f1f5f9" : "#ffffff",
                          borderTop:
                            i === 0
                              ? "none"
                              : r.strong
                              ? "2px solid #0f172a"
                              : "1px solid #f1f5f9",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        <span>{r.label}</span>
                        <span style={{ fontWeight: r.strong ? 800 : 500 }}>
                          {fmtAmt(r.value)}
                        </span>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          ))}

          {/* footer strip — generic family style */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "9px 14px",
              background: "#f8fafc",
              fontSize: 11,
              color: "#64748b",
            }}
          >
            <span>
              {g.bills.length} bill{g.bills.length === 1 ? "" : "s"} • net total{" "}
              {fmtAmt(g.dayNetTotal)}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 99,
                  background: "#22c55e",
                  display: "inline-block",
                }}
              />
              Live data
            </span>
          </div>
        </div>
      ))}

      {/* ── Grand total banner ── */}
      <div
        style={{
          marginTop: 16,
          borderRadius: 14,
          overflow: "hidden",
          background: grad,
          padding: "15px 18px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          boxShadow: "0 4px 14px rgba(15,23,42,0.25)",
        }}
      >
        <span
          style={{
            color: "#e0eafc",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 0.8,
            textTransform: "uppercase",
          }}
        >
          Grand Total — {billCount} bills
        </span>
        <span
          style={{
            color: "#ffffff",
            fontSize: 20,
            fontWeight: 800,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          Rs.{" "}
          {fmtAmt(
            report.dateGroups.reduce((s, g) => s + g.dayNetTotal, 0)
          )}
        </span>
      </div>
    </div>
  );
}
