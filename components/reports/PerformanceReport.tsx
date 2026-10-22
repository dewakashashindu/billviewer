"use client";

import React, { Fragment, type CSSProperties } from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { IconCoins, IconPin } from "./ReportIcons";

export interface PerformanceReportRow {
  desc: string;
  val: string;
  amt: string;
  centerVal?: boolean;
  bold?: boolean;
}

export interface PerformanceReportSection {
  heading: string;
  rows: PerformanceReportRow[];
}

export interface PerformanceReportData {
  companyName: string;
  subHeader: string;
  printDate: string;
  printTime: string;
  printUser: string;
  meta: Array<{ label: string; value: string }>;
  sections: PerformanceReportSection[];
}

export function filterPerformanceReport(
  d: PerformanceReportData,
  search: string
): PerformanceReportData {
  if (!d || !Array.isArray(d.sections)) return d;
  const q = search.trim().toLowerCase();
  if (!q) return d;

  const sections = d.sections
    .map((sec) => {
      if (sec.heading.toLowerCase().includes(q)) return sec;
      const rows = (sec.rows ?? []).filter(
        (r) =>
          r.desc.toLowerCase().includes(q) ||
          r.val.toLowerCase().includes(q) ||
          r.amt.toLowerCase().includes(q)
      );
      return rows.length > 0 ? { ...sec, rows } : null;
    })
    .filter((s): s is PerformanceReportSection => s !== null);

  return { ...d, sections };
}

/* ── PDF STYLES (A4 portrait — Crystal Reports Performance Report layout, UNCHANGED) ── */
const ps = StyleSheet.create({
  page: {
    paddingTop: 26,
    paddingBottom: 42,
    paddingHorizontal: 32,
    fontFamily: "Helvetica",
    fontSize: 8.5,
    color: "#111111",
    backgroundColor: "#ffffff",
  },
  topHdr: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  compCol: {
    width: "36%",
  },
  compName: {
    fontSize: 10.5,
    fontFamily: "Helvetica-Bold",
    color: "#111111",
  },
  compAddr: {
    fontSize: 7.5,
    color: "#333333",
    marginTop: 2,
  },
  titleCol: {
    width: "32%",
    alignItems: "center",
    paddingTop: 1,
  },
  reportTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#111111",
  },
  printCol: {
    width: "32%",
    alignItems: "flex-end",
  },
  printRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 1.5,
  },
  printLbl: {
    fontSize: 7.5,
    color: "#333333",
    width: 44,
    textAlign: "left",
  },
  printVal: {
    fontSize: 7.5,
    color: "#111111",
    width: 68,
    textAlign: "right",
  },
  colBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#d6eaf8",
    borderWidth: 0.9,
    borderColor: "#7f9db9",
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 6,
  },
  colBarLeft: {
    fontSize: 8.8,
    fontFamily: "Helvetica-Bold",
    color: "#111111",
  },
  colBarRight: {
    fontSize: 8.8,
    fontFamily: "Helvetica-Bold",
    color: "#111111",
  },
  metaWrap: {
    marginBottom: 4,
  },
  rowLine: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 2.6,
    paddingHorizontal: 3,
    borderBottomWidth: 0.6,
    borderBottomStyle: "dotted",
    borderBottomColor: "#c4c4c4",
  },
  metaLbl: {
    width: "42%",
    fontSize: 8.3,
    color: "#111111",
  },
  metaVal: {
    width: "58%",
    fontSize: 8.3,
    color: "#111111",
  },
  secBlock: {
    marginTop: 7,
  },
  secBox: {
    borderWidth: 1.1,
    borderColor: "#111111",
    paddingVertical: 2.5,
    paddingHorizontal: 6,
    marginBottom: 2,
    backgroundColor: "#ffffff",
  },
  secTitle: {
    fontSize: 8.6,
    fontFamily: "Helvetica-Bold",
    color: "#111111",
  },
  cellDesc: {
    width: "46%",
    fontSize: 8.3,
    color: "#111111",
  },
  cellDescBold: {
    width: "46%",
    fontSize: 8.3,
    fontFamily: "Helvetica-Bold",
    color: "#111111",
  },
  cellVal: {
    width: "26%",
    fontSize: 8.3,
    color: "#222222",
    textAlign: "left",
  },
  cellValCenter: {
    width: "26%",
    fontSize: 8.3,
    color: "#222222",
    textAlign: "center",
  },
  cellAmt: {
    width: "28%",
    fontSize: 8.3,
    color: "#111111",
    textAlign: "right",
  },
  cellAmtBold: {
    width: "28%",
    fontSize: 8.3,
    fontFamily: "Helvetica-Bold",
    color: "#111111",
    textAlign: "right",
  },
  footer: {
    position: "absolute",
    bottom: 18,
    left: 32,
    right: 32,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 4,
  },
  footerBrand: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#222222",
    width: "33%",
  },
  footerPage: {
    fontSize: 8,
    color: "#222222",
    width: "34%",
    textAlign: "center",
  },
  footerSpacer: {
    width: "33%",
  },
});

export function PerformancePdfDocument({
  data,
}: {
  data: PerformanceReportData;
}) {
  return (
    <Document title="Performance Report">
      <Page size="A4" style={ps.page}>
        {/* Page-1 Top Report Header */}
        <View style={ps.topHdr}>
          <View style={ps.compCol}>
            <Text style={ps.compName}>{data.companyName || "RESTAURANT"}</Text>
            {data.subHeader ? (
              <Text style={ps.compAddr}>{data.subHeader}</Text>
            ) : null}
          </View>
          <View style={ps.titleCol}>
            <Text style={ps.reportTitle}>Performance Report</Text>
          </View>
          <View style={ps.printCol}>
            <View style={ps.printRow}>
              <Text style={ps.printLbl}>Print Date</Text>
              <Text style={ps.printVal}>{data.printDate}</Text>
            </View>
            <View style={ps.printRow}>
              <Text style={ps.printLbl}>Print Time</Text>
              <Text style={ps.printVal}>{data.printTime}</Text>
            </View>
            <View style={ps.printRow}>
              <Text style={ps.printLbl}>User</Text>
              <Text style={ps.printVal}>{data.printUser}</Text>
            </View>
          </View>
        </View>

        {/* Repeating Column Header Bar across pages */}
        <View style={ps.colBar} fixed>
          <Text style={ps.colBarLeft}>Description</Text>
          <Text style={ps.colBarRight}>Amount</Text>
        </View>

        {/* Metadata Rows */}
        <View style={ps.metaWrap}>
          {(data.meta ?? []).map((m, idx) => (
            <View key={`meta-${idx}`} style={ps.rowLine}>
              <Text style={ps.metaLbl}>{m.label}</Text>
              <Text style={ps.metaVal}>{m.value}</Text>
            </View>
          ))}
        </View>

        {/* Sections */}
        {(data.sections ?? []).map((sec, sIdx) => (
          <View
            key={`sec-${sIdx}`}
            style={ps.secBlock}
            wrap={(sec.rows ?? []).length > 8}
          >
            <View style={ps.secBox} minPresenceAhead={24}>
              <Text style={ps.secTitle}>{sec.heading}</Text>
            </View>
            {(sec.rows ?? []).map((r, rIdx) => (
              <View key={`r-${sIdx}-${rIdx}`} style={ps.rowLine} wrap={false}>
                <Text style={r.bold ? ps.cellDescBold : ps.cellDesc}>
                  {r.desc}
                </Text>
                <Text style={r.centerVal ? ps.cellValCenter : ps.cellVal}>
                  {r.val}
                </Text>
                <Text style={r.bold ? ps.cellAmtBold : ps.cellAmt}>
                  {r.amt}
                </Text>
              </View>
            ))}
          </View>
        ))}

        {/* Fixed Crystal-style Bottom Footer */}
        <View style={ps.footer} fixed>
          <Text style={ps.footerBrand}>MicroMax - eChef</Text>
          <Text
            style={ps.footerPage}
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
          <View style={ps.footerSpacer} />
        </View>
      </Page>
    </Document>
  );
}

/* ── ON-SCREEN WEB REPORT VIEW (Matched to SalesSummaryReport / CategorySummaryReport / DynamicReportTable) ── */
const grad = "linear-gradient(135deg,#45301D 0%,#684830 100%)";

const thStyle: CSSProperties = {
  background: "#E4D6BF",
  color: "#684830",
  padding: "11px 16px",
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  borderRight: "1px solid #C8B8A8",
  borderBottom: "2px solid #684830",
  whiteSpace: "nowrap",
  textAlign: "left",
};

const tdStyle: CSSProperties = {
  padding: "9.5px 16px",
  fontSize: 12.5,
  color: "#45301D",
  borderRight: "1px solid #FCF7F3",
  borderBottom: "1px solid #FCF7F3",
  fontVariantNumeric: "tabular-nums",
};

function isSummaryRow(desc: string): boolean {
  const u = String(desc ?? "").trim().toUpperCase();
  return (
    u === "TAX TOTAL" ||
    u === "SALES WITHOUT TAX" ||
    u === "MAIN GROUP TOTAL" ||
    u === "FAMILY GROUP TOTAL" ||
    u === "MONTH TO DATE TOTAL"
  );
}

function fmtWebAmt(raw: string, desc?: string): string {
  const s = String(raw ?? "").trim();
  if (!s) return "—";
  const dLower = String(desc ?? "").toLowerCase();
  if (dLower.includes("pax count") && !dLower.includes("avg")) {
    const intVal = Number(s.replace(/,/g, ""));
    return Number.isFinite(intVal) ? Math.round(intVal).toLocaleString("en-US") : s;
  }
  const n = Number(s.replace(/,/g, ""));
  if (Number.isFinite(n)) {
    return n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return s;
}

export default function PerformanceReport({
  report,
}: {
  report: PerformanceReportData;
}) {
  const meta = report.meta ?? [];
  const sections = report.sections ?? [];

  const locVal =
    meta.find((m) => m.label.toLowerCase() === "location")?.value || "ALL";

  const salesSec = sections.find((s) => s.heading === "SALES VOLUME");
  const salesRaw = salesSec?.rows?.[0]?.amt ?? "0";
  const salesDisplay = fmtWebAmt(salesRaw, "Sales Volume");

  const mtdSec = sections.find((s) => s.heading === "MONTH TO DATE");
  const mtdTotRow = mtdSec?.rows?.find(
    (r) => r.desc.toUpperCase() === "MONTH TO DATE TOTAL"
  );
  const mtdDisplay = mtdTotRow
    ? fmtWebAmt(mtdTotRow.amt, "Month To Date Total")
    : "0.00";

  const totalRows = sections.reduce(
    (acc, sec) => acc + (sec.rows?.length ?? 0),
    0
  );

  return (
    <div style={{ padding: "16px 24px 28px", fontFamily: "Inter, sans-serif" }}>
      {/* Location Header Banner (same visual language as SalesSummaryReport / CategoryReports) */}
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
          flexWrap: "wrap",
          gap: 10,
          boxShadow: "0 2px 6px rgba(104,72,48,0.08)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
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
            {locVal} — {report.companyName || "RESTAURANT"}
          </span>
          {report.subHeader ? (
            <span style={{ fontSize: 11.5, color: "#6B543E", paddingLeft: 24 }}>
              {report.subHeader}
            </span>
          ) : null}
        </div>
        <span
          style={{
            color: "#684830",
            fontSize: 13.5,
            fontWeight: 800,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          Rs. {salesDisplay}
        </span>
      </div>

      {/* Metadata Info Cards */}
      {meta.length > 0 && (
        <div
          style={{
            marginTop: 12,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            gap: 10,
          }}
        >
          {meta.map((m, idx) => (
            <div
              key={`mcard-${idx}`}
              style={{
                background: "#ffffff",
                border: "1px solid #E4D6BF",
                borderRadius: 10,
                padding: "9px 13px",
                boxShadow: "0 1px 2px rgba(114,86,60,0.04)",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  color: "#907860",
                  marginBottom: 3,
                }}
              >
                {m.label}
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: "#45301D",
                  fontVariantNumeric: "tabular-nums",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={m.value}
              >
                {m.value || "—"}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Unified Report Table Card */}
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
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              tableLayout: "fixed",
              borderCollapse: "collapse",
              fontSize: 12.5,
              minWidth: 540,
            }}
          >
            <thead>
              <tr>
                <th style={{ ...thStyle, width: "52%" }}>Description</th>
                <th
                  style={{
                    ...thStyle,
                    width: "20%",
                    textAlign: "center",
                  }}
                >
                  Rate / Count
                </th>
                <th
                  style={{
                    ...thStyle,
                    width: "28%",
                    textAlign: "right",
                    borderRight: "none",
                  }}
                >
                  Amount (Rs.)
                </th>
              </tr>
            </thead>
            <tbody>
              {sections.map((sec, sIdx) => {
                const sRows = sec.rows ?? [];
                return (
                  <Fragment key={`sec-grp-${sIdx}`}>
                    {/* Section Header Band */}
                    <tr>
                      <td
                        colSpan={3}
                        style={{
                          background: "#E9DCC6",
                          color: "#45301D",
                          padding: "9px 16px",
                          fontSize: 11.5,
                          fontWeight: 800,
                          letterSpacing: 0.45,
                          textTransform: "uppercase",
                          borderTop: "1px solid #DECBB0",
                          borderBottom: "1px solid #DECBB0",
                          borderLeft: "3px solid #684830",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <span>{sec.heading}</span>
                          <span
                            style={{
                              background: "rgba(104,72,48,0.12)",
                              color: "#684830",
                              borderRadius: 999,
                              padding: "2px 9px",
                              fontSize: 10,
                              fontWeight: 700,
                              textTransform: "none",
                              letterSpacing: 0.2,
                            }}
                          >
                            {sRows.length} item{sRows.length === 1 ? "" : "s"}
                          </span>
                        </div>
                      </td>
                    </tr>

                    {sRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={3}
                          style={{
                            padding: "8px 16px",
                            color: "#907860",
                            fontSize: 11.5,
                            fontStyle: "italic",
                            background: "#ffffff",
                            borderBottom: "1px solid #FCF7F3",
                          }}
                        >
                          No records for this section
                        </td>
                      </tr>
                    ) : (
                      sRows.map((r, rIdx) => {
                        const sumRow = isSummaryRow(r.desc);
                        const baseBg = sumRow
                          ? "#FCF7F3"
                          : rIdx % 2 === 1
                            ? "#FCF7F3"
                            : "#ffffff";
                        return (
                          <tr
                            key={`srow-${sIdx}-${rIdx}`}
                            style={{
                              background: baseBg,
                              transition: "background 0.12s",
                            }}
                            onMouseEnter={(e) => {
                              if (!sumRow) {
                                e.currentTarget.style.background = "#F0E8D8";
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!sumRow) {
                                e.currentTarget.style.background = baseBg;
                              }
                            }}
                          >
                            <td
                              style={{
                                ...tdStyle,
                                fontWeight: sumRow || r.bold ? 700 : 500,
                                borderTop: sumRow
                                  ? "1.5px solid #C8B8A8"
                                  : undefined,
                                borderBottom: sumRow
                                  ? "1px solid #E4D6BF"
                                  : "1px solid #FCF7F3",
                              }}
                            >
                              {r.desc}
                            </td>
                            <td
                              style={{
                                ...tdStyle,
                                textAlign: "center",
                                borderTop: sumRow
                                  ? "1.5px solid #C8B8A8"
                                  : undefined,
                                borderBottom: sumRow
                                  ? "1px solid #E4D6BF"
                                  : "1px solid #FCF7F3",
                              }}
                            >
                              {r.val ? (
                                <span
                                  style={{
                                    display: "inline-block",
                                    background: "#F4EDE2",
                                    border: "1px solid #E4D6BF",
                                    color: "#684830",
                                    padding: "1.5px 8px",
                                    borderRadius: 999,
                                    fontSize: 11,
                                    fontWeight: 600,
                                  }}
                                >
                                  {r.val}
                                </span>
                              ) : (
                                <span style={{ color: "#C8B8A8" }}>—</span>
                              )}
                            </td>
                            <td
                              style={{
                                ...tdStyle,
                                textAlign: "right",
                                borderRight: "none",
                                fontWeight: sumRow || r.bold ? 800 : 600,
                                color: sumRow ? "#684830" : "#45301D",
                                borderTop: sumRow
                                  ? "1.5px solid #C8B8A8"
                                  : undefined,
                                borderBottom: sumRow
                                  ? "1px solid #E4D6BF"
                                  : "1px solid #FCF7F3",
                              }}
                            >
                              {fmtWebAmt(r.amt, r.desc)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer Strip (matches SalesSummaryReport / DynamicReportTable) */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "9px 16px",
            background: "#FCF7F3",
            borderTop: "1px solid #E4D6BF",
            fontSize: 11,
            color: "#6B543E",
          }}
        >
          <span>
            {sections.length} section{sections.length === 1 ? "" : "s"} •{" "}
            {totalRows} row{totalRows === 1 ? "" : "s"}
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

      {/* Bottom Dark Brown Summary Banner (matches SalesSummaryReport Grand Total banner) */}
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
          flexWrap: "wrap",
          gap: 12,
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
          Sales Volume Summary
        </span>
        <div style={{ display: "flex", alignItems: "baseline", gap: 20 }}>
          <span style={{ color: "#E4D6BF", fontSize: 12, fontWeight: 600 }}>
            MTD Total: Rs. {mtdDisplay}
          </span>
          <span
            style={{
              color: "#ffffff",
              fontSize: 20,
              fontWeight: 800,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            Rs. {salesDisplay}
          </span>
        </div>
      </div>
    </div>
  );
}
