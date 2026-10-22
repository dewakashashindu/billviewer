"use client";

import React, { Fragment, type CSSProperties } from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

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

export interface PerformanceLocationReport {
  locCode: string;
  locName: string;
  subHeader?: string;
  sections: PerformanceReportSection[];
}

export interface PerformanceReportData {
  companyName: string;
  subHeader: string;
  printDate: string;
  printTime: string;
  printUser: string;
  businessDate?: string;
  reportDate?: string;
  currentTime?: string;
  reportUser?: string;
  mainLocations?: Array<{ code: string; name: string }>;
  locationReports?: PerformanceLocationReport[];
  meta: Array<{ label: string; value: string }>;
  sections: PerformanceReportSection[];
}

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

function isBottomSpecialRow(desc: string): boolean {
  return isSummaryRow(desc) || String(desc ?? "").trim().toUpperCase() === "MONTH TO DATE AVERAGE";
}

interface MergedPerfRow {
  desc: string;
  bold?: boolean;
  cells: Array<{
    val: string;
    amt: string;
    centerVal?: boolean;
  }>;
}

interface MergedPerfSection {
  heading: string;
  rows: MergedPerfRow[];
}

function getEffectiveLocations(d: PerformanceReportData): PerformanceLocationReport[] {
  if (Array.isArray(d.locationReports) && d.locationReports.length > 0) {
    return d.locationReports;
  }
  const locMeta =
    (d.meta ?? []).find((m) => m.label.toLowerCase() === "location")?.value || "";
  return [
    {
      locCode: locMeta.replace(/^\[|\].*$/g, "").trim() || "LOC",
      locName: d.companyName || locMeta || "Location",
      subHeader: d.subHeader,
      sections: d.sections ?? [],
    },
  ];
}

function mergeLocationSections(
  locations: PerformanceLocationReport[]
): MergedPerfSection[] {
  if (locations.length === 0) return [];

  // Preserve canonical section heading order across all selected locations
  const headings: string[] = [];
  const headingSeen = new Set<string>();
  for (const loc of locations) {
    for (const sec of loc.sections ?? []) {
      const key = sec.heading.trim().toUpperCase();
      if (!headingSeen.has(key)) {
        headingSeen.add(key);
        headings.push(sec.heading);
      }
    }
  }

  return headings.map((heading) => {
    const hKey = heading.trim().toUpperCase();
    const regularDescs: string[] = [];
    const bottomDescs: string[] = [];
    const seenDesc = new Set<string>();

    const perLocMap = locations.map((loc) => {
      const sec = (loc.sections ?? []).find(
        (s) => s.heading.trim().toUpperCase() === hKey
      );
      const rowMap = new Map<string, PerformanceReportRow>();
      for (const r of sec?.rows ?? []) {
        const dKey = r.desc.trim().toUpperCase();
        if (!rowMap.has(dKey)) rowMap.set(dKey, r);
        if (!seenDesc.has(dKey)) {
          seenDesc.add(dKey);
          if (isBottomSpecialRow(r.desc)) {
            bottomDescs.push(r.desc);
          } else {
            regularDescs.push(r.desc);
          }
        }
      }
      return rowMap;
    });

    const orderedDescs = [...regularDescs, ...bottomDescs];
    const rows: MergedPerfRow[] = orderedDescs.map((desc) => {
      const dKey = desc.trim().toUpperCase();
      let anyBold = false;
      const cells = perLocMap.map((rm) => {
        const hit = rm.get(dKey);
        if (hit) {
          if (hit.bold) anyBold = true;
          return {
            val: hit.val,
            amt: hit.amt,
            centerVal: hit.centerVal,
          };
        }
        return {
          val: "",
          amt: "0.00",
          centerVal: false,
        };
      });
      return { desc, bold: anyBold, cells };
    });

    return { heading, rows };
  });
}

export function filterPerformanceReport(
  d: PerformanceReportData,
  search: string
): PerformanceReportData {
  if (!d) return d;
  const q = search.trim().toLowerCase();
  if (!q) return d;

  const filterSecList = (secs: PerformanceReportSection[], keepDescs?: Set<string>) =>
    (secs ?? [])
      .map((sec) => {
        if (sec.heading.toLowerCase().includes(q)) return sec;
        const rows = (sec.rows ?? []).filter((r) => {
          if (keepDescs && keepDescs.has(`${sec.heading.toUpperCase()}||${r.desc.toUpperCase()}`)) {
            return true;
          }
          return (
            r.desc.toLowerCase().includes(q) ||
            r.val.toLowerCase().includes(q) ||
            r.amt.toLowerCase().includes(q)
          );
        });
        return rows.length > 0 ? { ...sec, rows } : null;
      })
      .filter((s): s is PerformanceReportSection => s !== null);

  if (Array.isArray(d.locationReports) && d.locationReports.length > 0) {
    // Keep any (section, desc) that matches in ANY selected location so columns stay aligned
    const matchedKeys = new Set<string>();
    for (const loc of d.locationReports) {
      for (const sec of loc.sections ?? []) {
        const secMatch = sec.heading.toLowerCase().includes(q);
        for (const r of sec.rows ?? []) {
          if (
            secMatch ||
            r.desc.toLowerCase().includes(q) ||
            r.val.toLowerCase().includes(q) ||
            r.amt.toLowerCase().includes(q)
          ) {
            matchedKeys.add(`${sec.heading.toUpperCase()}||${r.desc.toUpperCase()}`);
          }
        }
      }
    }

    const locationReports = d.locationReports.map((loc) => ({
      ...loc,
      sections: filterSecList(loc.sections ?? [], matchedKeys),
    }));

    return {
      ...d,
      locationReports,
      sections: filterSecList(d.sections ?? [], matchedKeys),
    };
  }

  return {
    ...d,
    sections: filterSecList(d.sections ?? []),
  };
}

/* ── PDF STYLES (A4 Crystal Reports Performance Report layout + Multi-Location Compare PDF) ── */
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
  const locs = getEffectiveLocations(data);

  // Multi-Location Compare PDF (2+ locations selected)
  if (locs.length > 1) {
    const merged = mergeLocationSections(locs);
    const landscape = locs.length >= 3;
    const descPct = locs.length >= 4 ? 24 : locs.length === 3 ? 28 : 34;
    const perLocPct = (100 - descPct) / locs.length;
    const ratePct = perLocPct * 0.36;
    const amtPct = perLocPct * 0.64;

    return (
      <Document title="Performance Report - Location Comparison">
        <Page
          size="A4"
          orientation={landscape ? "landscape" : "portrait"}
          style={ps.page}
        >
          <View style={ps.topHdr}>
            <View style={ps.compCol}>
              <Text style={ps.compName}>Performance Report (Compare)</Text>
              <Text style={ps.compAddr}>
                Business Date: {data.businessDate || "—"} • User:{" "}
                {data.reportUser || data.printUser}
              </Text>
            </View>
            <View style={ps.titleCol}>
              <Text style={ps.reportTitle}>Performance Report</Text>
            </View>
            <View style={ps.printCol}>
              <View style={ps.printRow}>
                <Text style={ps.printLbl}>Report Date</Text>
                <Text style={ps.printVal}>
                  {data.reportDate || data.printDate}
                </Text>
              </View>
              <View style={ps.printRow}>
                <Text style={ps.printLbl}>Time</Text>
                <Text style={ps.printVal}>
                  {data.currentTime || data.printTime}
                </Text>
              </View>
            </View>
          </View>

          {/* Repeating Location Column Header */}
          <View
            fixed
            style={{
              borderWidth: 0.9,
              borderColor: "#7f9db9",
              marginBottom: 6,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                backgroundColor: "#45301D",
                paddingVertical: 4,
              }}
            >
              <Text
                style={{
                  width: `${descPct}%`,
                  paddingHorizontal: 5,
                  fontSize: 8,
                  fontFamily: "Helvetica-Bold",
                  color: "#ffffff",
                }}
              >
                DESCRIPTION
              </Text>
              {locs.map((l) => (
                <Text
                  key={`ploc-${l.locCode}`}
                  style={{
                    width: `${perLocPct}%`,
                    paddingHorizontal: 3,
                    fontSize: 8,
                    fontFamily: "Helvetica-Bold",
                    color: "#ffffff",
                    textAlign: "center",
                  }}
                >
                  {l.locName}
                </Text>
              ))}
            </View>
            <View
              style={{
                flexDirection: "row",
                backgroundColor: "#E4D6BF",
                paddingVertical: 3,
              }}
            >
              <Text style={{ width: `${descPct}%`, paddingHorizontal: 5, fontSize: 7.2 }} />
              {locs.map((l) => (
                <Fragment key={`psub-${l.locCode}`}>
                  <Text
                    style={{
                      width: `${ratePct}%`,
                      fontSize: 7,
                      fontFamily: "Helvetica-Bold",
                      color: "#45301D",
                      textAlign: "center",
                    }}
                  >
                    Rate / Count
                  </Text>
                  <Text
                    style={{
                      width: `${amtPct}%`,
                      paddingRight: 4,
                      fontSize: 7,
                      fontFamily: "Helvetica-Bold",
                      color: "#45301D",
                      textAlign: "right",
                    }}
                  >
                    Amount
                  </Text>
                </Fragment>
              ))}
            </View>
          </View>

          {merged.map((sec, sIdx) => (
            <View
              key={`msec-${sIdx}`}
              style={ps.secBlock}
              wrap={(sec.rows ?? []).length > 8}
            >
              <View style={ps.secBox} minPresenceAhead={24}>
                <Text style={ps.secTitle}>{sec.heading}</Text>
              </View>
              {sec.rows.map((r, rIdx) => {
                const bold = isSummaryRow(r.desc) || Boolean(r.bold);
                return (
                  <View key={`mr-${sIdx}-${rIdx}`} style={ps.rowLine} wrap={false}>
                    <Text
                      style={{
                        width: `${descPct}%`,
                        fontSize: 7.8,
                        fontFamily: bold ? "Helvetica-Bold" : "Helvetica",
                        color: "#111111",
                      }}
                    >
                      {r.desc}
                    </Text>
                    {r.cells.map((c, cIdx) => (
                      <Fragment key={`mc-${sIdx}-${rIdx}-${cIdx}`}>
                        <Text
                          style={{
                            width: `${ratePct}%`,
                            fontSize: 7.5,
                            color: "#333333",
                            textAlign: "center",
                          }}
                        >
                          {c.val || "—"}
                        </Text>
                        <Text
                          style={{
                            width: `${amtPct}%`,
                            paddingRight: 4,
                            fontSize: 7.8,
                            fontFamily: bold ? "Helvetica-Bold" : "Helvetica",
                            color: "#111111",
                            textAlign: "right",
                          }}
                        >
                          {fmtWebAmt(c.amt, r.desc)}
                        </Text>
                      </Fragment>
                    ))}
                  </View>
                );
              })}
            </View>
          ))}

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

  // Single-Location Crystal Report A4 PDF (UNCHANGED)
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

/* ── ON-SCREEN WEB REPORT VIEW (Metadata Line + Location-Wise Multi-Column Table) ── */
const thDescStyle: CSSProperties = {
  background: "#E4D6BF",
  color: "#45301D",
  padding: "12px 16px",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  borderRight: "2px solid #C8B8A8",
  borderBottom: "2px solid #684830",
  whiteSpace: "nowrap",
  textAlign: "left",
  verticalAlign: "middle",
  minWidth: 230,
};

const thLocGroupStyle: CSSProperties = {
  background: "linear-gradient(180deg,#5A3E28 0%,#684830 100%)",
  color: "#FFFFFF",
  padding: "9.5px 14px",
  fontSize: 11.5,
  fontWeight: 800,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  textAlign: "center",
  borderRight: "2px solid #45301D",
  borderBottom: "1px solid #8C6A4E",
  whiteSpace: "nowrap",
};

const thSubStyle: CSSProperties = {
  background: "#E4D6BF",
  color: "#684830",
  padding: "8.5px 14px",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 0.55,
  textTransform: "uppercase",
  borderRight: "1px solid #C8B8A8",
  borderBottom: "2px solid #684830",
  whiteSpace: "nowrap",
};

const tdStyle: CSSProperties = {
  padding: "9.5px 14px",
  fontSize: 12.5,
  color: "#45301D",
  borderRight: "1px solid #F3ECE2",
  borderBottom: "1px solid #F3ECE2",
  fontVariantNumeric: "tabular-nums",
};

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
  const activeLocations = getEffectiveLocations(report);
  const mergedSections = mergeLocationSections(activeLocations);
  const totalCols = 1 + activeLocations.length * 2;

  const findMeta = (needle: string) =>
    (report.meta ?? []).find((m) =>
      m.label.toLowerCase().includes(needle.toLowerCase())
    )?.value || "";

  // Top 4-card metadata line ONLY: Business Date | Report Date | Current Time | User
  const metaCards: Array<{ label: string; value: string }> = [
    {
      label: "Business Date",
      value:
        report.businessDate ||
        findMeta("bussiness day") ||
        findMeta("business") ||
        "—",
    },
    {
      label: "Report Date",
      value:
        report.reportDate ||
        findMeta("report date") ||
        report.printDate ||
        "—",
    },
    {
      label: "Current Time",
      value:
        report.currentTime ||
        findMeta("current time") ||
        report.printTime ||
        "—",
    },
    {
      label: "User",
      value: report.reportUser || findMeta("user") || report.printUser || "—",
    },
  ];

  const totalRows = mergedSections.reduce(
    (acc, sec) => acc + (sec.rows?.length ?? 0),
    0
  );

  return (
    <div style={{ padding: "14px 24px 28px", fontFamily: "Inter, sans-serif" }}>
      {/* Metadata Info Line: Business Date | Report Date | Current Time | User */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: 10,
        }}
      >
        {metaCards.map((m, idx) => (
          <div
            key={`mcard-${idx}`}
            style={{
              background: "#ffffff",
              border: "1px solid #E4D6BF",
              borderRadius: 10,
              padding: "9px 14px",
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

      {/* Location-wise Performance Table (Location headers sit directly between Metadata line & Table rows) */}
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
              borderCollapse: "collapse",
              fontSize: 12.5,
              minWidth: Math.max(560, 240 + activeLocations.length * 230),
            }}
          >
            <thead>
              {/* Header Row 1: Common Description + Selected Location Column Headers */}
              <tr>
                <th rowSpan={2} style={thDescStyle}>
                  Description
                </th>
                {activeLocations.map((loc, idx) => (
                  <th
                    key={`hloc-${loc.locCode}-${idx}`}
                    colSpan={2}
                    style={{
                      ...thLocGroupStyle,
                      borderRight:
                        idx < activeLocations.length - 1
                          ? "2px solid #45301D"
                          : "none",
                    }}
                  >
                    {loc.locName}
                  </th>
                ))}
              </tr>

              {/* Header Row 2: Rate / Count + Amount (Rs.) under each Location */}
              <tr>
                {activeLocations.map((loc, idx) => {
                  const isLastLoc = idx === activeLocations.length - 1;
                  return (
                    <Fragment key={`hsub-${loc.locCode}-${idx}`}>
                      <th
                        style={{
                          ...thSubStyle,
                          textAlign: "center",
                          minWidth: 100,
                        }}
                      >
                        Rate / Count
                      </th>
                      <th
                        style={{
                          ...thSubStyle,
                          textAlign: "right",
                          minWidth: 130,
                          borderRight: isLastLoc
                            ? "none"
                            : "2px solid #B5A18B",
                        }}
                      >
                        Amount (Rs.)
                      </th>
                    </Fragment>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {mergedSections.map((sec, sIdx) => {
                const sRows = sec.rows ?? [];
                return (
                  <Fragment key={`sec-grp-${sIdx}`}>
                    {/* Section Header Band */}
                    <tr>
                      <td
                        colSpan={totalCols}
                        style={{
                          background: "#E9DCC6",
                          color: "#45301D",
                          padding: "8.5px 16px",
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
                          colSpan={totalCols}
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
                          ? "#F5EDE0"
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
                                paddingLeft: 16,
                                fontWeight: sumRow || r.bold ? 800 : 500,
                                borderRight: "2px solid #EAE0D2",
                                borderTop: sumRow
                                  ? "1.5px solid #C8B8A8"
                                  : undefined,
                                borderBottom: sumRow
                                  ? "1.5px solid #C8B8A8"
                                  : "1px solid #F3ECE2",
                              }}
                            >
                              {r.desc}
                            </td>

                            {r.cells.map((cell, cIdx) => {
                              const isLastLoc =
                                cIdx === activeLocations.length - 1;
                              return (
                                <Fragment key={`scell-${sIdx}-${rIdx}-${cIdx}`}>
                                  <td
                                    style={{
                                      ...tdStyle,
                                      textAlign: "center",
                                      borderTop: sumRow
                                        ? "1.5px solid #C8B8A8"
                                        : undefined,
                                      borderBottom: sumRow
                                        ? "1.5px solid #C8B8A8"
                                        : "1px solid #F3ECE2",
                                    }}
                                  >
                                    {cell.val ? (
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
                                        {cell.val}
                                      </span>
                                    ) : (
                                      <span style={{ color: "#C8B8A8" }}>—</span>
                                    )}
                                  </td>
                                  <td
                                    style={{
                                      ...tdStyle,
                                      textAlign: "right",
                                      borderRight: isLastLoc
                                        ? "none"
                                        : "2px solid #EAE0D2",
                                      fontWeight: sumRow || r.bold ? 800 : 600,
                                      color: sumRow ? "#45301D" : "#45301D",
                                      borderTop: sumRow
                                        ? "1.5px solid #C8B8A8"
                                        : undefined,
                                      borderBottom: sumRow
                                        ? "1.5px solid #C8B8A8"
                                        : "1px solid #F3ECE2",
                                    }}
                                  >
                                    {fmtWebAmt(cell.amt, r.desc)}
                                  </td>
                                </Fragment>
                              );
                            })}
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

        {/* Footer Strip */}
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
            {mergedSections.length} section
            {mergedSections.length === 1 ? "" : "s"} • {totalRows} row
            {totalRows === 1 ? "" : "s"} • {activeLocations.length} location
            {activeLocations.length === 1 ? "" : "s"}
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
    </div>
  );
}
