"use client";

// ============================================================
// LOCATION: components/reports/SalesSummaryReport.tsx
// FULL REPLACE — presentational Sales Summary (data page eken enawa):
//   ✅ LOCATION-WISE grouping — POS PDF eka wage:
//      date-wise cards (DynamicReportTable style ekama) + Daily Collection.
//   + grand total banner (okkoma locations wala total eka)
// Exports:
//   filterSalesSummary(report, query) — search filter + totals recompute
//   SalesSummaryData / SalesSummaryRow / SalesSummaryLocation types
// ============================================================
import type { CSSProperties } from "react";
import { IconCoins, IconCalendar, IconInbox, IconPin } from "./ReportIcons";

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

export interface SalesSummaryLocation {
  locCode: string;
  locName: string;
  dateGroups: SalesSummaryGroup[];
  locTotal: number;
}

export interface SalesSummaryData {
  locationGroups: SalesSummaryLocation[];
  grandTotal: number;
}

const fmtAmt = (n: number) =>
  n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** Search filter — all bill fields scan + dayTotal/locTotal recompute +
 *  empty groups/locations hide */
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
  const locationGroups = (report.locationGroups ?? [])
    .map((loc) => {
      const dateGroups = (loc.dateGroups ?? [])
        .map((g) => {
          const rows = (g.rows ?? []).filter(matches);
          return {
            ...g,
            rows,
            dayTotal: rows.reduce((s, r) => s + r.netTotal, 0),
          };
        })
        .filter((g) => g.rows.length > 0);
      return {
        ...loc,
        dateGroups,
        locTotal: dateGroups.reduce((s, g) => s + g.dayTotal, 0),
      };
    })
    .filter((loc) => loc.dateGroups.length > 0);
  return {
    locationGroups,
    grandTotal: locationGroups.reduce((s, l) => s + l.locTotal, 0),
  };
}

const grad = "linear-gradient(135deg,#45301D 0%,#684830 100%)";
const locGrad = "linear-gradient(135deg,#907860 0%,#684830 100%)";

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

// ✅ Light-blue header (POS report eke wage) — dark gradient eka ain karala
const thBase: CSSProperties = {
  background: "#E4D6BF",
  color: "#684830",
  padding: "11px 14px",
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  borderRight: "1px solid #C8B8A8",
  whiteSpace: "nowrap",
  textAlign: "left",
};

const tdBase: CSSProperties = {
  padding: "10px 14px",
  fontSize: 12.5,
  color: "#45301D",
  borderRight: "1px solid #FCF7F3",
  borderBottom: "1px solid #FCF7F3",
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

function DateGroupCard({ g }: { g: SalesSummaryGroup }) {
  return (
    <div
      style={{
        marginTop: 14,
        border: "1px solid #E4D6BF",
        borderRadius: 14,
        overflow: "hidden",
        background: "#ffffff",
        boxShadow:
          "0 1px 2px rgba(114,86,60,0.04), 0 8px 24px rgba(114,86,60,0.06)",
      }}
    >
      {/* gradient date bar */}
      <div
        style={{
          margin: 0,
          padding: "11px 16px",
          fontSize: 13,
          fontWeight: 700,
          color: "#45301D",
          background: "#E9DCC6",
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
            background: "rgba(104,72,48,0.12)",
            color: "#684830",
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
                  background: i % 2 === 1 ? "#FCF7F3" : "#ffffff",
                  transition: "background 0.12s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "#F0E8D8")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background =
                    i % 2 === 1 ? "#FCF7F3" : "#ffffff")
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
                          ? "#C8B8A8"
                          : "#45301D",
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
                  color: "#45301D",
                  background: "#FCF7F3",
                  borderRight: "none",
                  borderTop: "2px solid #C8B8A8",
                  overflow: "visible",
                }}
              >
                Daily Collection
              </td>
              <td
                style={{
                  ...tdBase,
                  fontWeight: 700,
                  color: "#45301D",
                  background: "#FCF7F3",
                  borderTop: "2px solid #C8B8A8",
                  textAlign: "right",
                }}
              >
                {fmtAmt(g.dayTotal)}
              </td>
              <td
                style={{
                  ...tdBase,
                  background: "#FCF7F3",
                  borderTop: "2px solid #C8B8A8",
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
          background: "#FCF7F3",
          borderTop: "1px solid #E4D6BF",
          fontSize: 11,
          color: "#6B543E",
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
  );
}

export default function SalesSummaryReport({
  report,
}: {
  report: SalesSummaryData;
}) {
  const totalRows = report.locationGroups.reduce(
    (s, l) => s + l.dateGroups.reduce((x, g) => x + g.rows.length, 0),
    0
  );

  return (
    <div style={{ padding: "22px 24px 28px", fontFamily: "Inter, sans-serif" }}>
      {/* ── Empty state ── */}
      {report.locationGroups.length === 0 && (
        <div
          style={{
            marginTop: 16,
            border: "1px solid #E4D6BF",
            borderRadius: 14,
            background: "#ffffff",
            boxShadow:
              "0 1px 2px rgba(114,86,60,0.04), 0 8px 24px rgba(114,86,60,0.06)",
            padding: "46px 20px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: 10,
              color: "#C8B8A8",
            }}
          >
            <IconInbox size={30} strokeWidth={1.6} />
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 13.5,
              fontWeight: 600,
              color: "#684830",
            }}
          >
            No bills found for the selected date range.
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#907860" }}>
            Try changing the date range or clearing the search.
          </p>
        </div>
      )}

      {/* ── Location-wise sections (POS PDF eka wage) ── */}
      {report.locationGroups.map((loc) => (
        <div key={loc.locCode} style={{ marginTop: 22 }}>
          {/* location header bar */}
          <div
            style={{
              borderRadius: 12,
              overflow: "hidden",
              background: "#F0E8D8",
              border: "1px solid #E4D6BF",
              padding: "12px 16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              boxShadow: "0 2px 6px rgba(104,72,48,0.08)",
            }}
          >
            <span
              style={{
                color: "#45301D",
                fontSize: 13.5,
                fontWeight: 800,
                letterSpacing: 0.5,
                display: "flex",
                alignItems: "center",
                gap: 9,
                textTransform: "uppercase",
              }}
            >
              <IconPin size={15} strokeWidth={2.2} />
              {loc.locCode} — {loc.locName}
            </span>
            <span
              style={{
                color: "#684830",
                fontSize: 13,
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              Rs. {fmtAmt(loc.locTotal)}
            </span>
          </div>

          {/* date cards for this location */}
          {loc.dateGroups.map((g) => (
            <DateGroupCard key={`${loc.locCode}-${g.date}`} g={g} />
          ))}
        </div>
      ))}

      {/* ── Grand total banner (all locations) ── */}
      {totalRows > 0 && (
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
            boxShadow: "0 4px 14px rgba(114,86,60,0.25)",
          }}
        >
          <span
            style={{
              color: "#E4D6BF",
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
