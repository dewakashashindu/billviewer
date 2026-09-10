"use client";

// ============================================================
// LOCATION: components/reports/DynamicReportTable.tsx
// FULL REPLACE — pro-level report table:
//   • Sticky gradient header + sortable columns (click to sort)
//   • Zebra rows + hover highlight + totals footer
//   • Currency/number cells tabular-nums + delta badges
//   • Empty state + column count / row count strip
// ============================================================
import { useMemo, useState } from "react";
import { ColumnConfig } from "@/config/reports.config";
import {
  IconChevronUp,
  IconChevronDown,
  IconChevronsUpDown,
  IconInbox,
} from "./ReportIcons";

interface DynamicTableProps {
  columns: ColumnConfig[];
  data: Record<string, any>[];
}

type SortState = { key: string; dir: "asc" | "desc" } | null;

export default function DynamicReportTable({ columns, data }: DynamicTableProps) {
  const [sort, setSort] = useState<SortState>(null);

  const isNum = (t?: string) => t === "currency" || t === "number";

  const sorted = useMemo(() => {
    if (!sort) return data;
    const rows = [...data];
    rows.sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      const an = Number(av);
      const bn = Number(bv);
      if (!isNaN(an) && !isNaN(bn) && av !== "" && bv !== "") {
        return sort.dir === "asc" ? an - bn : bn - an;
      }
      const as = String(av ?? "").toLowerCase();
      const bs = String(bv ?? "").toLowerCase();
      return sort.dir === "asc"
        ? as.localeCompare(bs)
        : bs.localeCompare(as);
    });
    return rows;
  }, [data, sort]);

  const totals = useMemo(() => {
    const t: Record<string, number> = {};
    for (const col of columns) {
      if (isNum(col.type) && data.length > 1) {
        t[col.accessorKey] = data.reduce(
          (s, r) => s + (Number(r[col.accessorKey]) || 0),
          0
        );
      }
    }
    return t;
  }, [columns, data]);

  const toggleSort = (key: string) => {
    setSort((p) =>
      p && p.key === key
        ? { key, dir: p.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
  };

  const fmt = (value: any, type?: string) => {
    if (value === undefined || value === null || value === "") return "—";
    if (type === "currency") {
      return Number(value).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
    if (type === "number") {
      return Number(value).toLocaleString("en-US");
    }
    return value;
  };

  const th = (col: ColumnConfig) => ({
    padding: "11px 14px",
    fontSize: 10.5,
    fontWeight: 700,
    letterSpacing: 0.6,
    textTransform: "uppercase" as const,
    color: "#1e3a8a",
    whiteSpace: "nowrap" as const,
    cursor: "pointer",
    userSelect: "none" as const,
    textAlign: isNum(col.type) ? ("right" as const) : ("left" as const),
    borderRight: "1px solid #bfdbfe",
  });

  const td = (col: ColumnConfig) => ({
    padding: "10px 14px",
    fontSize: 12.5,
    color: "#1e293b",
    whiteSpace: "nowrap" as const,
    textAlign: isNum(col.type) ? ("right" as const) : ("left" as const),
    borderRight: "1px solid #f1f5f9",
    fontVariantNumeric: isNum(col.type) ? ("tabular-nums" as const) : undefined,
  });

  return (
    <div style={{ padding: "20px 24px 28px", fontFamily: "Inter, sans-serif" }}>
      {/* Table card */}
      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 14,
          overflow: "hidden",
          boxShadow:
            "0 1px 2px rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.06)",
          background: "#fff",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              minWidth: 640,
            }}
          >
            <thead>
              {/* ✅ Light-blue header (POS report eke wage) */}
              <tr style={{ background: "#dbeafe" }}>
                {columns.map((col: ColumnConfig, i: number) => (
                  <th
                    key={col.accessorKey}
                    onClick={() => toggleSort(col.accessorKey)}
                    style={th(col)}
                    title="Click to sort"
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      {col.header}
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          opacity:
                            sort?.key === col.accessorKey ? 1 : 0.4,
                        }}
                      >
                        {sort?.key === col.accessorKey ? (
                          sort.dir === "asc" ? (
                            <IconChevronUp size={11} strokeWidth={2.6} />
                          ) : (
                            <IconChevronDown size={11} strokeWidth={2.6} />
                          )
                        ) : i === 0 ? (
                          <IconChevronsUpDown size={11} strokeWidth={2.2} />
                        ) : null}
                      </span>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    style={{ padding: "46px 20px", textAlign: "center" }}
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
                      No report data available.
                    </p>
                    <p
                      style={{
                        margin: "4px 0 0",
                        fontSize: 12,
                        color: "#94a3b8",
                      }}
                    >
                      Try changing the date range or clearing the search.
                    </p>
                  </td>
                </tr>
              ) : (
                sorted.map((row: Record<string, any>, idx: number) => (
                  <tr
                    key={idx}
                    style={{
                      background:
                        idx % 2 === 1 ? "#f8fafc" : "#fff",
                      borderBottom: "1px solid #f1f5f9",
                      transition: "background 0.12s",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "#eef4ff")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background =
                        idx % 2 === 1 ? "#f8fafc" : "#fff")
                    }
                  >
                    {columns.map((col: ColumnConfig) => (
                      <td key={col.accessorKey} style={td(col)}>
                        {fmt(row[col.accessorKey], col.type)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
            {sorted.length > 1 && Object.keys(totals).length > 0 && (
              <tfoot>
                <tr
                  style={{
                    background: "#f1f5f9",
                    borderTop: "2px solid #cbd5e1",
                  }}
                >
                  {columns.map((col: ColumnConfig, i: number) => (
                    <td
                      key={col.accessorKey}
                      style={{
                        ...td(col),
                        fontWeight: 700,
                        color: "#0f172a",
                        background: "#f1f5f9",
                      }}
                    >
                      {i === 0
                        ? `TOTAL (${sorted.length})`
                        : totals[col.accessorKey] != null
                        ? fmt(totals[col.accessorKey], col.type)
                        : ""}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Footer strip */}
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
            {sorted.length} row{sorted.length === 1 ? "" : "s"}
            {sort ? ` • sorted by ${sort.key} (${sort.dir})` : ""}
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
