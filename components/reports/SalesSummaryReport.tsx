"use client";

// ============================================================
// LOCATION: components/reports/SalesSummaryReport.tsx
// FULL REPLACE — presentational Sales Summary (data page eken enawa):
//   per-date cards — table style EXACTLY DynamicReportTable ekema
//     (right-aligned numeric header, balanced column widths, zebra,
//      generic totals-row style, footer strip + Live data dot)
//   + grand total banner
// Exports:
//   filterSalesSummary(report, query) — search filter + dayTotal recompute
//   SalesSummaryData / SalesSummaryRow types
// ============================================================
import type { CSSProperties } from "react";
import { IconCoins, IconCalendar, IconInbox } from "./ReportIcons";

export interface SalesSummaryRow {
  billNo: string;
  netTotal: number;
  steward: string;
  billType: string;
  orderMode: string;
  txnTime: string;
  casher: string;
}

export interface SalesSummaryGroup {
  date: string;
  rows: SalesSummaryRow[];
  dayTotal: number;
}

export interface SalesSummaryData {
  location?: string;
  dateGroups: SalesSummaryGroup[];
  grandTotal: number;
}

const fmtAmt = (n: number) =>
  n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** Search filter — all bill fields scan + dayTotal recompute + empty groups hide */
export function filterSalesSummary(
  report: SalesSummaryData,
  query: string
): SalesSummaryData {
  const q = query.trim().toLowerCase();
  if (!q) return report;
  const matches = (r: SalesSummaryRow) =>
    `${r.billNo} ${r.steward} ${r.casher} ${r.billType} ${r.orderMode} ${r.txnTime} ${r.netTotal}`
      .toLowerCase()
      .includes(q);
  return {
    ...report,
    dateGroups: report.dateGroups
      .map((g) => {
        const rows = g.rows.filter(matches);
        return { ...g, rows, dayTotal: rows.reduce((s, r) => s + r.netTotal, 0) };
      })
      .filter((g) => g.rows.length > 0),
  };
}

const grad = "linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%)";

// ── column plan — DynamicReportTable ekema widths (fixed layout) ──
const COLS: {
  key: keyof SalesSummaryRow;
  header: string;
  w: string;
  num?: boolean;
}[] = [
  { key: "billNo", header: "BillNo", w: "13%" },
  { key: "netTotal", header: "NetTotal", w: "13%", num: true },
  { key: "steward", header: "Steward", w: "17%" },
  { key: "billType", header: "BillType", w: "13%" },
  { key: "orderMode", header: "OrderMode", w: "14%" },
  { key: "txnTime", header: "TxnTime", w: "15%" },
  { key: "casher", header: "Casher", w: "15%" },
];

const thBase: CSSProperties = {
  background: grad,
  color: "#e0eafc",
  padding: "11px 14px",
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  borderRight: "1px solid rgba(255,255,255,0.08)",
  whiteSpace: "nowrap",
  textAlign: "left",
};

const tdBase: CSSProperties = {
  padding: "10px 14px",
  fontSize: 12.5,
  color: "#1e293b",
  borderRight: "1px solid #f1f5f9",
  borderBottom: "1px solid #f1f5f9",
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

export default function SalesSummaryReport({
  report,
}: {
  report: SalesSummaryData;
}) {
  return (
    <div style={{ padding: "22px 24px 28px", fontFamily: "Inter, sans-serif" }}>
      {/* ── Empty state (same family as generic table) ── */}
      {report.dateGroups.length === 0 && (
        <div
          style={{
            marginTop: 16,
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
            No bills found for the selected date range.
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#94a3b8" }}>
            Try changing the date range or clearing the search.
          </p>
        </div>
      )}

      {/* ── Date group cards ── */}
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
              margin: 0,
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
              {g.rows.length} bill{g.rows.length === 1 ? "" : "s"}
            </span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                tableLayout: "fixed",
                borderCollapse: "collapse",
                fontSize: 12,
                minWidth: 760,
              }}
            >
              <thead>
                <tr>
                  {COLS.map((c) => (
                    <th
                      key={c.key}
                      style={{
                        ...thBase,
                        width: c.w,
                        textAlign: c.num ? "right" : "left",
                      }}
                    >
                      {c.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r, i) => (
                  <tr
                    key={`${r.billNo}-${i}`}
                    style={{
                      background: i % 2 === 1 ? "#f8fafc" : "#ffffff",
                      transition: "background 0.12s",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "#eef4ff")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background =
                        i % 2 === 1 ? "#f8fafc" : "#ffffff")
                    }
                  >
                    {COLS.map((c) => (
                      <td
                        key={c.key}
                        title={String(r[c.key] ?? "")}
                        style={{
                          ...tdBase,
                          textAlign: c.num ? "right" : "left",
                          fontWeight: c.num ? 600 : 400,
                          color:
                            !c.num && !String(r[c.key] ?? "").trim()
                              ? "#cbd5e1"
                              : "#1e293b",
                        }}
                      >
                        {c.key === "netTotal"
                          ? fmtAmt(r.netTotal)
                          : r[c.key] || "—"}
                      </td>
                    ))}
                  </tr>
                ))}

                {/* Daily Collection — generic totals-row style ekema */}
                <tr>
                  <td
                    style={{
                      ...tdBase,
                      fontWeight: 700,
                      fontSize: 12,
                      color: "#0f172a",
                      background: "#f1f5f9",
                      borderRight: "none",
                      borderTop: "2px solid #cbd5e1",
                      overflow: "visible",
                    }}
                  >
                    Daily Collection
                  </td>
                  <td
                    style={{
                      ...tdBase,
                      fontWeight: 700,
                      color: "#0f172a",
                      background: "#f1f5f9",
                      borderTop: "2px solid #cbd5e1",
                      textAlign: "right",
                    }}
                  >
                    {fmtAmt(g.dayTotal)}
                  </td>
                  <td
                    style={{
                      ...tdBase,
                      background: "#f1f5f9",
                      borderTop: "2px solid #cbd5e1",
                      borderRight: "none",
                    }}
                    colSpan={5}
                  />
                </tr>
              </tbody>
            </table>
          </div>

          {/* footer strip — DynamicReportTable ekema */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "9px 14px",
              background: "#f8fafc",
              borderTop: "1px solid #e2e8f0",
              fontSize: 11,
              color: "#64748b",
            }}
          >
            <span>
              {g.rows.length} row{g.rows.length === 1 ? "" : "s"} • total{" "}
              {fmtAmt(g.dayTotal)}
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
      {report.dateGroups.length > 0 && (
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
              display: "flex",
              alignItems: "center",
              gap: 9,
            }}
          >
            <IconCoins size={16} strokeWidth={2} />
            Grand Total
          </span>
          <span
            style={{
              color: "#ffffff",
              fontSize: 20,
              fontWeight: 800,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            Rs. {fmtAmt(report.grandTotal)}
          </span>
        </div>
      )}
    </div>
  );
}
