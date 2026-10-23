"use client";

import { useEffect, useId, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  getDashboardPerformanceAction,
  type PerfAmountItem,
  type PerfDaySnapshot,
  type PerfFamilyItem,
  type PerfLocationOption,
} from "@/app/actions/dashboard";

function shiftIsoDays(baseIso: string, deltaDays: number): string {
  const m = baseIso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return baseIso;
  const dt = new Date(
    Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + deltaDays)
  );
  return dt.toISOString().split("T")[0];
}

const COLORS = [
  "#684830",
  "#907860",
  "#B49B7E",
  "#45301D",
  "#A98F70",
  "#7C6148",
  "#C8B8A8",
  "#D9C7AC",
];

const fmtRs = (v: number) =>
  "Rs. " +
  Number(v || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtNum = (v: number) =>
  Number(v || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtInt = (v: number) => Math.round(Number(v || 0)).toLocaleString("en-US");

const fmtShort = (v: number) =>
  Math.abs(v) >= 1_000_000
    ? `${(v / 1_000_000).toFixed(2)}M`
    : Math.abs(v) >= 1000
      ? `${(v / 1000).toFixed(1)}k`
      : v.toFixed(0);

/* ── Smooth Count-Up Component for Top Stat Cards ── */
function AnimatedStatValue({
  value,
  formatter,
  animTrigger,
}: {
  value: number | null;
  formatter: (n: number) => string;
  animTrigger: string;
}) {
  const [display, setDisplay] = useState<number>(0);

  useEffect(() => {
    if (value == null || !Number.isFinite(value)) return;
    let raf = 0;
    const duration = 1050;
    const start = performance.now();
    const target = value;

    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(target * eased);
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setDisplay(target);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, animTrigger]);

  if (value == null) return <>—</>;
  return <>{formatter(display)}</>;
}

/* ── inline SVG icons (same exact icons as before) ── */
const iconStyle = { marginBottom: 8, display: "block" } as const;
const IBill = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#684830"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={iconStyle}
  >
    <path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2z" />
    <line x1="9" y1="7" x2="15" y2="7" />
    <line x1="9" y1="11" x2="15" y2="11" />
    <line x1="9" y1="15" x2="13" y2="15" />
  </svg>
);
const IMoney = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#684830"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={iconStyle}
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v10M15 9.5c0-1.4-1.3-2.5-3-2.5s-3 1-3 2.2c0 3 6 1.6 6 4.6 0 1.2-1.3 2.2-3 2.2s-3-1.1-3-2.5" />
  </svg>
);
const IChartUp = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#684830"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={iconStyle}
  >
    <polyline points="3 17 9 11 13 15 21 7" />
    <polyline points="15 7 21 7 21 13" />
  </svg>
);
const IBar = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#684830"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={iconStyle}
  >
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
    <line x1="2" y1="20" x2="22" y2="20" />
  </svg>
);

/* ── Animated Donut Chart Component (Clockwise Sweep + Stretching Legend Bars) ── */
function DonutBreakdown({
  items,
  animKey,
  centerLabel = "TOTAL",
  valueFormatter = fmtNum,
  tooltipFormatter = fmtRs,
  centerValueFormatter = fmtShort,
}: {
  items: PerfAmountItem[];
  animKey: string;
  centerLabel?: string;
  valueFormatter?: (v: number) => string;
  tooltipFormatter?: (v: number) => string;
  centerValueFormatter?: (v: number) => string;
}) {
  const reactId = useId();
  const safeId = useMemo(
    () => `donut-sweep-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`,
    [reactId]
  );

  const clean = useMemo(() => (items ?? []).filter((x) => x.amt > 0), [items]);
  const total = useMemo(
    () => clean.reduce((sum, x) => sum + x.amt, 0),
    [clean]
  );

  if (total <= 0) {
    return (
      <div style={{ color: "#907860", fontSize: 12, padding: "22px 0" }}>
        No values &gt; 0 in selected date range.
      </div>
    );
  }

  const R = 56;
  const C = 64;
  let acc = 0;

  return (
    <div
      key={animKey}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        flex: 1,
        flexWrap: "wrap",
      }}
    >
      <svg
        width={128}
        height={128}
        viewBox="0 0 128 128"
        style={{ flexShrink: 0 }}
      >
        <defs>
          <mask id={safeId}>
            <circle
              cx={C}
              cy={C}
              r={43.5}
              fill="none"
              stroke="#fff"
              strokeWidth={30}
              transform={`rotate(-90 ${C} ${C})`}
              pathLength={100}
              className="perf-anim-donut-mask"
            />
          </mask>
        </defs>

        <g mask={`url(#${safeId})`}>
          {clean.map((it, idx) => {
            const frac = it.amt / total;
            const color = COLORS[idx % COLORS.length];
            if (frac >= 0.9999) {
              return (
                <circle key={it.name} cx={C} cy={C} r={R} fill={color}>
                  <title>{`${it.name}: ${tooltipFormatter(it.amt)} (100%)`}</title>
                </circle>
              );
            }
            const a0 = acc * 2 * Math.PI - Math.PI / 2;
            acc += frac;
            const a1 = acc * 2 * Math.PI - Math.PI / 2;
            const large = frac > 0.5 ? 1 : 0;
            const x0 = C + R * Math.cos(a0);
            const y0 = C + R * Math.sin(a0);
            const x1 = C + R * Math.cos(a1);
            const y1 = C + R * Math.sin(a1);
            const d = `M ${C} ${C} L ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} Z`;
            return (
              <path
                key={it.name}
                d={d}
                fill={color}
                stroke="#fff"
                strokeWidth={1.5}
              >
                <title>{`${it.name}: ${tooltipFormatter(it.amt)} (${(frac * 100).toFixed(1)}%)`}</title>
              </path>
            );
          })}
        </g>

        <circle cx={C} cy={C} r={31} fill="#fff" />
        <text
          x={C}
          y={C - 2}
          textAnchor="middle"
          fontSize={9.5}
          fill="#907860"
          fontWeight={600}
        >
          {centerLabel}
        </text>
        <text
          x={C}
          y={C + 11}
          textAnchor="middle"
          fontSize={11.5}
          fill="#45301D"
          fontWeight={700}
        >
          {centerValueFormatter(total)}
        </text>
      </svg>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          minWidth: 150,
        }}
      >
        {clean.map((it, idx) => {
          const pct = (it.amt / total) * 100;
          const color = COLORS[idx % COLORS.length];
          return (
            <div
              key={it.name}
              style={{ display: "flex", flexDirection: "column", gap: 3 }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: 12,
                  gap: 6,
                }}
              >
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontWeight: 600,
                    color: "#45301D",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  <span
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: 2.5,
                      background: color,
                      flexShrink: 0,
                    }}
                  />
                  {it.name}
                </span>
                <span style={{ whiteSpace: "nowrap" }}>
                  <span
                    style={{
                      fontWeight: 700,
                      color: "#45301D",
                      fontSize: 11.5,
                    }}
                  >
                    {valueFormatter(it.amt)}
                  </span>
                  <span
                    style={{
                      color: "#907860",
                      fontWeight: 600,
                      fontSize: 10.5,
                      marginLeft: 4,
                    }}
                  >
                    {pct.toFixed(1)}%
                  </span>
                </span>
              </div>
              <div
                style={{
                  height: 5,
                  background: "#F3ECE0",
                  borderRadius: 99,
                  overflow: "hidden",
                }}
              >
                <div
                  className="perf-anim-hbar"
                  style={{
                    height: "100%",
                    width: `${pct}%`,
                    background: color,
                    borderRadius: 99,
                    animationDelay: `${160 + idx * 95}ms`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Animated Daily Stacked Bar Chart Component (Charts #4 & #5) ── */
function DailyStackedChart({
  snapshots,
  seriesKeys,
  seriesColors,
  animKey,
  getDayMap,
}: {
  snapshots: PerfDaySnapshot[];
  seriesKeys: string[];
  seriesColors: string[];
  animKey: string;
  getDayMap: (s: PerfDaySnapshot) => Map<string, number>;
}) {
  if (!snapshots.length || !seriesKeys.length) {
    return (
      <div style={{ color: "#907860", fontSize: 12, padding: "22px 0" }}>
        No breakdown values &gt; 0 in selected date range.
      </div>
    );
  }

  const dayRows = snapshots.map((sn) => {
    const mp = getDayMap(sn);
    const values = seriesKeys.map((k) => Math.max(0, mp.get(k) ?? 0));
    const sum = values.reduce((a, b) => a + b, 0);
    return { sn, values, sum };
  });

  const maxSum = Math.max(...dayRows.map((r) => r.sum), 1);
  const minPerBar = snapshots.length > 24 ? 26 : 38;
  const W = Math.max(460, snapshots.length * minPerBar + 66);
  const H = 190;
  const padL = 48;
  const padR = 18;
  const padT = 18;
  const padB = 32;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const baseLineY = padT + plotH;
  const colW = plotW / Math.max(snapshots.length, 1);
  const maxLabels = Math.max(6, Math.floor(plotW / 58));
  const labelEvery = Math.max(1, Math.ceil(snapshots.length / maxLabels));
  const stepDelay = Math.min(65, Math.floor(680 / Math.max(snapshots.length, 1)));

  return (
    <div key={animKey}>
      <div style={st.inlineLegend}>
        {seriesKeys.map((k, idx) => (
          <span key={k} style={st.inlineLegendItem}>
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: 2.5,
                background: seriesColors[idx % seriesColors.length],
                display: "inline-block",
              }}
            />
            {k}
          </span>
        ))}
      </div>

      <div style={{ width: "100%", overflowX: "auto", paddingBottom: 2 }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{
            display: "block",
            width: snapshots.length > 16 ? `${W}px` : "100%",
            minWidth: "100%",
            height: 190,
          }}
        >
          {[0, 0.5, 1].map((g) => {
            const y = padT + plotH * g;
            const v = maxSum * (1 - g);
            return (
              <g key={g}>
                <line
                  x1={padL}
                  y1={y}
                  x2={W - padR}
                  y2={y}
                  stroke={g === 1 ? "#907860" : "#EAE0CF"}
                  strokeDasharray={g === 1 ? undefined : "3 3"}
                />
                <text
                  x={padL - 6}
                  y={y + 3}
                  textAnchor="end"
                  fontSize={9.5}
                  fill="#907860"
                >
                  {fmtShort(v)}
                </text>
              </g>
            );
          })}

          {dayRows.map((row, i) => {
            const xCenter = padL + colW * i + colW / 2;
            const barW = Math.min(
              36,
              Math.max(8, colW * (snapshots.length > 30 ? 0.68 : 0.54))
            );
            let curBottom = baseLineY;
            const showLabel =
              i % labelEvery === 0 || i === dayRows.length - 1;

            return (
              <g key={row.sn.dateIso}>
                <g
                  className="perf-anim-vbar"
                  style={{
                    transformOrigin: `${xCenter}px ${baseLineY}px`,
                    animationDelay: `${i * stepDelay}ms`,
                  }}
                >
                  {row.values.map((val, sIdx) => {
                    if (val <= 0) return null;
                    const segH = (val / maxSum) * plotH;
                    const y = curBottom - segH;
                    curBottom = y;
                    const isTop = row.values
                      .slice(sIdx + 1)
                      .every((later) => later <= 0);
                    return (
                      <rect
                        key={seriesKeys[sIdx]}
                        x={xCenter - barW / 2}
                        y={y}
                        width={barW}
                        height={Math.max(1.5, segH)}
                        rx={isTop ? 3 : 0}
                        fill={seriesColors[sIdx % seriesColors.length]}
                      >
                        <title>{`${row.sn.businessDay || row.sn.dateIso}\n${seriesKeys[sIdx]}: ${fmtRs(val)}`}</title>
                      </rect>
                    );
                  })}
                </g>
                {showLabel && (
                  <text
                    x={xCenter}
                    y={H - 8}
                    textAnchor="middle"
                    fontSize={10}
                    fontWeight={600}
                    fill="#6B543E"
                  >
                    {row.sn.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/* ── Combine multiple daily snapshots for a selected date range ── */
function mergeSnapshots(
  snaps: PerfDaySnapshot[],
  locLabel: string
): PerfDaySnapshot | null {
  if (!snaps.length) return null;
  if (snaps.length === 1) return snaps[0];

  const mergeAmtList = (getter: (s: PerfDaySnapshot) => PerfAmountItem[]) => {
    const map = new Map<string, PerfAmountItem>();
    for (const sn of snaps) {
      for (const it of getter(sn)) {
        const k = it.name.toUpperCase();
        const prev = map.get(k);
        if (prev) {
          prev.amt += it.amt;
        } else {
          map.set(k, { ...it });
        }
      }
    }
    return [...map.values()].sort((a, b) => b.amt - a.amt);
  };

  const famMap = new Map<string, PerfFamilyItem>();
  for (const sn of snaps) {
    for (const f of sn.families) {
      const k = f.name.toUpperCase();
      const prev = famMap.get(k);
      if (prev) {
        prev.amt += f.amt;
        prev.qty += f.qty;
      } else {
        famMap.set(k, { ...f });
      }
    }
  }

  const salesVolume = snaps.reduce((a, s) => a + s.salesVolume, 0);
  const salesWithoutTax = snaps.reduce((a, s) => a + s.salesWithoutTax, 0);
  const taxTotal = snaps.reduce((a, s) => a + s.taxTotal, 0);
  const billCount = snaps.reduce((a, s) => a + s.billCount, 0);
  const paxTotal = snaps.reduce((a, s) => a + s.pax.total, 0);
  const paxLocal = snaps.reduce((a, s) => a + s.pax.local, 0);
  const paxForeign = snaps.reduce((a, s) => a + s.pax.foreign, 0);
  const latest = snaps[snaps.length - 1];
  const first = snaps[0];

  const timesWithVal = snaps.filter((s) => s.avgTime && s.avgTime !== "—");

  return {
    dateIso: "RANGE",
    label: `${first.label} – ${latest.label}`,
    businessDay: `${first.businessDay || first.dateIso} – ${latest.businessDay || latest.dateIso}`,
    captureTime: `${snaps.length} days`,
    captureUser: latest.captureUser,
    locCode: latest.locCode,
    locName: locLabel,
    salesVolume,
    salesWithoutTax,
    taxTotal,
    taxes: mergeAmtList((s) => s.taxes),
    serviceModes: mergeAmtList((s) => s.serviceModes),
    pax: { total: paxTotal, local: paxLocal, foreign: paxForeign },
    payModes: mergeAmtList((s) => s.payModes),
    cashiers: mergeAmtList((s) => s.cashiers),
    discount: snaps.reduce((a, s) => a + s.discount, 0),
    otherSerChg: snaps.reduce((a, s) => a + s.otherSerChg, 0),
    addSerChg: snaps.reduce((a, s) => a + s.addSerChg, 0),
    compCount: snaps.reduce((a, s) => a + s.compCount, 0),
    compAmt: snaps.reduce((a, s) => a + s.compAmt, 0),
    promotionsAmt: snaps.reduce((a, s) => a + s.promotionsAmt, 0),
    voidCount: snaps.reduce((a, s) => a + s.voidCount, 0),
    voidAmt: snaps.reduce((a, s) => a + s.voidAmt, 0),
    billCount,
    unclosedCount: snaps.reduce((a, s) => a + s.unclosedCount, 0),
    unclosedAmt: snaps.reduce((a, s) => a + s.unclosedAmt, 0),
    spendBill: billCount > 0 ? salesWithoutTax / billCount : 0,
    spendPax: paxTotal > 0 ? salesWithoutTax / paxTotal : 0,
    avgPax: billCount > 0 ? paxTotal / billCount : 0,
    avgTime: timesWithVal.length
      ? timesWithVal[timesWithVal.length - 1].avgTime
      : "—",
    mainGroups: mergeAmtList((s) => s.mainGroups),
    families: [...famMap.values()].sort((a, b) => b.amt - a.amt),
    mtdModes: latest.mtdModes,
    mtdTotal: latest.mtdTotal,
    mtdDays: latest.mtdDays,
    mtdAvg: latest.mtdAvg,
  };
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locations, setLocations] = useState<PerfLocationOption[]>([]);
  const [snapshots, setSnapshots] = useState<PerfDaySnapshot[]>([]);
  const [selectedLoc, setSelectedLoc] = useState<string>("");

  /* Date Range filter state (YYYY-MM-DD) — strictly displays selected From..To gap */
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [famMode, setFamMode] = useState<"amt" | "qty">("amt");

  useEffect(() => {
    let alive = true;
    getDashboardPerformanceAction()
      .then((res) => {
        if (!alive) return;
        if (res.success && res.data) {
          const locs = res.data.locations ?? [];
          const snaps = res.data.snapshots ?? [];
          setLocations(locs);
          setSnapshots(snaps);

          // Pick default location: first location that has snapshots, else first location
          const locsWithSnaps = new Set(
            snaps.map((s) => s.locCode.toUpperCase())
          );
          const defaultLoc =
            locs.find((l) => locsWithSnaps.has(l.locCode.toUpperCase()))
              ?.locCode ??
            locs[0]?.locCode ??
            snaps[0]?.locCode ??
            "";
          setSelectedLoc(defaultLoc);

          // Default From..To range: up to recent 14 days ending at latest snapshot (or available range if <= 14 snapshots)
          const forLoc = snaps.filter(
            (s) =>
              !defaultLoc ||
              s.locCode.toUpperCase() === defaultLoc.toUpperCase()
          );
          if (forLoc.length > 0) {
            const firstIso = forLoc[0].dateIso;
            const latestIso = forLoc[forLoc.length - 1].dateIso;
            if (forLoc.length <= 14) {
              setFromDate(firstIso);
              setToDate(latestIso);
            } else {
              const candFrom = shiftIsoDays(latestIso, -13);
              setFromDate(candFrom < firstIso ? firstIso : candFrom);
              setToDate(latestIso);
            }
          }
        } else {
          setError(res.error || "Could not load performance data");
        }
      })
      .catch(() => {
        if (alive) setError("Could not load performance data");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  /* All chronological snapshots for the selected location */
  const locSnapshots = useMemo(() => {
    if (!selectedLoc || selectedLoc === "ALL_LOCS") {
      const byDate = new Map<string, PerfDaySnapshot[]>();
      for (const sn of snapshots) {
        const arr = byDate.get(sn.dateIso) ?? [];
        arr.push(sn);
        byDate.set(sn.dateIso, arr);
      }
      const combined: PerfDaySnapshot[] = [];
      for (const [dKey, list] of [...byDate.entries()].sort((a, b) =>
        a[0].localeCompare(b[0])
      )) {
        const m = mergeSnapshots(list, "All Locations");
        if (m) {
          combined.push({
            ...m,
            dateIso: dKey,
            label: list[0].label,
            businessDay: list[0].businessDay || dKey,
          });
        }
      }
      return combined;
    }
    return snapshots.filter(
      (s) => s.locCode.toUpperCase() === selectedLoc.toUpperCase()
    );
  }, [snapshots, selectedLoc]);

  const minAvailDate = locSnapshots[0]?.dateIso ?? "";
  const maxAvailDate = locSnapshots[locSnapshots.length - 1]?.dateIso ?? "";

  /* Normalized From <= To bounds */
  const [normFrom, normTo] = useMemo(() => {
    const f = fromDate || minAvailDate;
    const t = toDate || maxAvailDate;
    if (f && t && f > t) return [t, f];
    return [f, t];
  }, [fromDate, toDate, minAvailDate, maxAvailDate]);

  /* Strictly ONLY snapshots falling within the selected From..To date gap */
  const rangeSnapshots = useMemo(() => {
    if (!locSnapshots.length) return [];
    return locSnapshots.filter((s) => {
      if (normFrom && s.dateIso < normFrom) return false;
      if (normTo && s.dateIso > normTo) return false;
      return true;
    });
  }, [locSnapshots, normFrom, normTo]);

  /* Key that re-triggers smooth stretch/sweep/draw animations when filters load or change */
  const animKey = `${selectedLoc}|${normFrom}|${normTo}|${rangeSnapshots.length}`;

  const activeLocObj = useMemo(
    () =>
      locations.find(
        (l) => l.locCode.toUpperCase() === selectedLoc.toUpperCase()
      ) ?? null,
    [locations, selectedLoc]
  );

  /* Aggregated/single snapshot driving the 4 Top Stat Cards + Breakdown Charts */
  const activeData: PerfDaySnapshot | null = useMemo(() => {
    if (!rangeSnapshots.length) return null;
    return mergeSnapshots(
      rangeSnapshots,
      activeLocObj?.locName || selectedLoc || "All Locations"
    );
  }, [rangeSnapshots, activeLocObj, selectedLoc]);

  /* Trend stats strictly for rangeSnapshots */
  const trendStats = useMemo(() => {
    if (!rangeSnapshots.length) return null;
    const max = Math.max(...rangeSnapshots.map((s) => s.salesVolume), 1);
    const total = rangeSnapshots.reduce((a, s) => a + s.salesVolume, 0);
    const best = [...rangeSnapshots].sort(
      (a, b) => b.salesVolume - a.salesVolume
    )[0];
    return {
      max,
      total,
      avg: total / rangeSnapshots.length,
      best,
    };
  }, [rangeSnapshots]);

  /* Guest (Pax) Donut items for Chart #2 */
  const paxDonutItems = useMemo<PerfAmountItem[]>(() => {
    if (!activeData) return [];
    const loc = Math.max(0, activeData.pax.local);
    const frn = Math.max(0, activeData.pax.foreign);
    const oth = Math.max(0, activeData.pax.total - loc - frn);
    const out: PerfAmountItem[] = [
      { name: "Local Guests", amt: loc },
      { name: "Foreign Guests", amt: frn },
    ];
    if (oth > 0) out.push({ name: "Other Guests", amt: oth });
    return out;
  }, [activeData]);

  /* Distinct Service Modes for Stacked Chart #4 */
  const serviceModeSeries = useMemo(() => {
    const totals = new Map<string, number>();
    for (const sn of rangeSnapshots) {
      for (const sm of sn.serviceModes) {
        if (sm.amt <= 0) continue;
        const key = sm.name.toUpperCase();
        totals.set(key, (totals.get(key) ?? 0) + sm.amt);
      }
    }
    return [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k]) => k);
  }, [rangeSnapshots]);

  /* Distinct Main Groups for Stacked Chart #5 */
  const mainGroupSeries = useMemo(() => {
    const totals = new Map<string, number>();
    for (const sn of rangeSnapshots) {
      for (const mg of sn.mainGroups) {
        if (mg.amt <= 0) continue;
        const key = mg.name.toUpperCase();
        totals.set(key, (totals.get(key) ?? 0) + mg.amt);
      }
    }
    return [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k]) => k);
  }, [rangeSnapshots]);

  const sortedFamilies = useMemo(() => {
    if (!activeData) return [];
    return [...activeData.families].sort((a, b) =>
      famMode === "qty" ? b.qty - a.qty : b.amt - a.amt
    );
  }, [activeData, famMode]);

  const metaBadgeText = useMemo(() => {
    const locPrefix =
      selectedLoc === "ALL_LOCS"
        ? "All Locations"
        : activeData
          ? `Location [${activeData.locCode}]`
          : selectedLoc
            ? `Location [${selectedLoc}]`
            : "";

    if (!locSnapshots.length) return "No Tbl_PerformanceValues snapshots found";
    if (!activeData) {
      return `${locPrefix} · 0 snapshots in ${normFrom} – ${normTo}`;
    }
    if (rangeSnapshots.length > 1 || normFrom !== normTo) {
      return `${locPrefix} · ${normFrom} to ${normTo} (${rangeSnapshots.length} Snapshot Day${rangeSnapshots.length === 1 ? "" : "s"})`;
    }
    const parts = [
      locPrefix,
      activeData.businessDay || activeData.dateIso,
      activeData.captureTime,
      activeData.captureUser ? `User ${activeData.captureUser}` : "",
    ].filter(Boolean);
    return parts.join(" · ");
  }, [
    activeData,
    locSnapshots.length,
    normFrom,
    normTo,
    rangeSnapshots.length,
    selectedLoc,
  ]);

  const isSingleDay = normFrom === normTo && rangeSnapshots.length === 1;
  const periodSubtext = activeData
    ? isSingleDay
      ? `Business Date: ${rangeSnapshots[0].businessDay || rangeSnapshots[0].dateIso}`
      : `${rangeSnapshots[0].label} – ${rangeSnapshots[rangeSnapshots.length - 1].label} (${rangeSnapshots.length} days)`
    : "Selected date range";

  return (
    <div style={{ padding: "28px 26px 48px", fontFamily: "Inter, sans-serif" }}>
      <style>{`
        @keyframes perfCardFadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes perfBarGrowUp {
          from { transform: scaleY(0); opacity: 0.35; }
          to   { transform: scaleY(1); opacity: 1; }
        }
        @keyframes perfBarStretchRight {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
        @keyframes perfLineDraw {
          from { stroke-dashoffset: 1; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes perfDotPop {
          0%   { opacity: 0; transform: scale(0); }
          70%  { opacity: 1; transform: scale(1.18); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes perfDonutSweep {
          from { stroke-dashoffset: 101; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes perfLabelFade {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .perf-anim-card {
          animation: perfCardFadeUp 0.78s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .perf-anim-vbar {
          animation: perfBarGrowUp 1.25s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .perf-anim-hbar {
          transform-origin: left center;
          animation: perfBarStretchRight 1.28s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .perf-anim-line {
          stroke-dasharray: 1;
          stroke-dashoffset: 1;
          animation: perfLineDraw 1.55s cubic-bezier(0.22, 1, 0.36, 1) 0.18s forwards;
        }
        .perf-anim-dot {
          transform-box: fill-box;
          transform-origin: center center;
          animation: perfDotPop 0.62s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .perf-anim-donut-mask {
          stroke-dasharray: 101;
          stroke-dashoffset: 101;
          animation: perfDonutSweep 1.42s cubic-bezier(0.22, 1, 0.36, 1) 0.12s forwards;
        }
        .perf-anim-val-lbl {
          animation: perfLabelFade 0.6s ease 0.72s both;
        }

        @media (prefers-reduced-motion: reduce) {
          .perf-anim-card, .perf-anim-vbar, .perf-anim-hbar,
          .perf-anim-line, .perf-anim-dot, .perf-anim-donut-mask, .perf-anim-val-lbl {
            animation-duration: 0.01s !important;
            animation-delay: 0s !important;
          }
        }

        .perf-row-2-1 { display: grid; grid-template-columns: 1.35fr 1fr; gap: 14px; margin-bottom: 14px; }
        .perf-row-3   { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin-bottom: 14px; }
        .perf-row-eq2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-bottom: 14px; }
        .perf-row-2   { display: grid; grid-template-columns: 1.2fr 1fr; gap: 14px; margin-bottom: 8px; }
        @media (max-width: 1080px) {
          .perf-row-2-1, .perf-row-3, .perf-row-eq2, .perf-row-2 { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* ═══════════════════════════════════════════════════════════
          1) HEADER + 4 PERIOD-ACCURATE STAT CARDS
          ═══════════════════════════════════════════════════════════ */}
      <div style={{ marginBottom: 22 }}>
        <h1
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 700,
            color: "#45301D",
          }}
        >
          Dashboard
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: 13.5, color: "#6B543E" }}>
          Restaurant reporting overview — Mila Mirissa
        </p>
      </div>

      {/* Quick stat cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: 14,
          marginBottom: 20,
        }}
      >
        {[
          {
            label: "Total Bills",
            numValue: activeData ? activeData.billCount : null,
            formatter: fmtInt,
            sub: periodSubtext,
            Icon: IBill,
          },
          {
            label: "Total Sales",
            numValue: activeData ? activeData.salesVolume : null,
            formatter: fmtRs,
            sub: activeData
              ? isSingleDay
                ? "Gross sales (incl. SC & tax)"
                : `Gross sales across ${rangeSnapshots.length} days`
              : "Gross sales volume (incl. tax)",
            Icon: IMoney,
          },
          {
            label: "Net Sales (Excl. Tax)",
            numValue: activeData ? activeData.salesWithoutTax : null,
            formatter: fmtRs,
            sub: activeData
              ? `Tax & SC: ${fmtRs(Math.max(0, activeData.salesVolume - activeData.salesWithoutTax))}`
              : "Sales without SC & taxes",
            Icon: IChartUp,
          },
          {
            label: "Avg / Bill",
            numValue: activeData ? activeData.spendBill : null,
            formatter: fmtRs,
            sub: activeData
              ? `Avg ${activeData.avgPax.toFixed(2)} guests / bill`
              : "Average spend per bill",
            Icon: IBar,
          },
        ].map((c, idx) => (
          <div
            key={c.label}
            className="perf-anim-card"
            style={{
              border: "1px solid #E4D6BF",
              borderRadius: 14,
              padding: "18px 18px 16px",
              background: "#fff",
              boxShadow: "0 1px 3px rgba(114,86,60,0.04)",
              animationDelay: `${idx * 75}ms`,
            }}
          >
            <c.Icon />
            <p
              style={{
                margin: 0,
                fontSize: 11.5,
                fontWeight: 600,
                letterSpacing: 0.5,
                color: "#6B543E",
                textTransform: "uppercase",
              }}
            >
              {c.label}
            </p>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: 24,
                fontWeight: 700,
                color: "#45301D",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              <AnimatedStatValue
                value={c.numValue}
                formatter={c.formatter}
                animTrigger={animKey}
              />
            </p>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: 11,
                color: "#907860",
                fontWeight: 500,
              }}
            >
              {c.sub}
            </p>
          </div>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════
          2) PERFORMANCE ANALYTICS (Location + From..To ONLY)
          ═══════════════════════════════════════════════════════════ */}
      <div style={st.perfBar}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 14.5,
              fontWeight: 700,
              color: "#45301D",
            }}
          >
            Performance Analytics
          </h2>
          <span style={st.metaChip}>
            {loading ? "Loading snapshots…" : metaBadgeText}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <span style={st.ctrlLbl}>Location:</span>
          <select
            style={st.select}
            value={selectedLoc}
            onChange={(e) => {
              const nextLoc = e.target.value;
              setSelectedLoc(nextLoc);
              const nextSnaps =
                nextLoc === "ALL_LOCS"
                  ? snapshots
                  : snapshots.filter(
                      (s) => s.locCode.toUpperCase() === nextLoc.toUpperCase()
                    );
              if (nextSnaps.length > 0 && (!fromDate || !toDate)) {
                const firstIso = nextSnaps[0].dateIso;
                const latestIso = nextSnaps[nextSnaps.length - 1].dateIso;
                setFromDate(firstIso);
                setToDate(latestIso);
              }
            }}
          >
            {locations.length > 1 && (
              <option value="ALL_LOCS">All Locations</option>
            )}
            {locations.length === 0 ? (
              <option value="">Default</option>
            ) : (
              locations.map((l) => (
                <option key={l.locCode} value={l.locCode}>
                  [{l.locCode}] {l.locName}
                </option>
              ))
            )}
          </select>

          <span style={st.ctrlLbl}>From:</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => {
              const v = e.target.value;
              setFromDate(v);
              if (toDate && v && v > toDate) setToDate(v);
            }}
            style={st.dateInput}
          />
          <span style={st.ctrlLbl}>To:</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => {
              const v = e.target.value;
              setToDate(v);
              if (fromDate && v && v < fromDate) setFromDate(v);
            }}
            style={st.dateInput}
          />
        </div>
      </div>

      {error && (
        <div
          style={{
            border: "1px solid #E5B8B0",
            background: "#FFF6F5",
            color: "#8B2C1F",
            borderRadius: 12,
            padding: "12px 16px",
            fontSize: 13,
            marginBottom: 18,
          }}
        >
          {error}
        </div>
      )}

      {!loading && !error && locSnapshots.length === 0 && (
        <div
          style={{
            border: "1px solid #E4D6BF",
            background: "#fff",
            borderRadius: 14,
            padding: "32px 20px",
            textAlign: "center",
            marginBottom: 20,
            color: "#6B543E",
            fontSize: 13.5,
          }}
        >
          No snapshot records found in <b>dbo.Tbl_PerformanceValues</b> for this
          location yet.
        </div>
      )}

      {!loading && !error && locSnapshots.length > 0 && !activeData && (
        <div
          style={{
            border: "1px solid #E4D6BF",
            background: "#fff",
            borderRadius: 14,
            padding: "28px 20px",
            textAlign: "center",
            marginBottom: 20,
            color: "#6B543E",
            fontSize: 13.5,
          }}
        >
          <div>
            No snapshot records found between <b>{normFrom}</b> and{" "}
            <b>{normTo}</b>.
          </div>
          {minAvailDate && maxAvailDate && (
            <div style={{ marginTop: 6, fontSize: 12, color: "#907860" }}>
              Available snapshot dates: <b>{minAvailDate}</b> to{" "}
              <b>{maxAvailDate}</b>
            </div>
          )}
        </div>
      )}

      {activeData && (
        <>
          {/* ROW 1: Daily Sales Volume Trend + Service Mode Donut */}
          <div className="perf-row-2-1">
            <div
              className="perf-anim-card"
              style={{ ...st.chartCard, animationDelay: "80ms" }}
            >
              <div style={st.cardHead}>
                <div>
                  <h3 style={st.cardTitle}>Daily Sales Volume Trend</h3>
                  <p style={st.cardSub}>
                    Business day sales volume within selected From – To date
                    range
                  </p>
                </div>
              </div>

              {trendStats && (
                <div style={st.summaryStrip}>
                  <span style={st.sumPill}>
                    Range Total ({rangeSnapshots.length}d):{" "}
                    <b style={{ color: "#45301D" }}>
                      {fmtRs(trendStats.total)}
                    </b>
                  </span>
                  <span style={st.sumPill}>
                    Peak Day:{" "}
                    <b style={{ color: "#45301D" }}>
                      {trendStats.best.label} (
                      {fmtRs(trendStats.best.salesVolume)})
                    </b>
                  </span>
                  <span style={st.sumPill}>
                    Avg / Day:{" "}
                    <b style={{ color: "#45301D" }}>{fmtRs(trendStats.avg)}</b>
                  </span>
                </div>
              )}

              {trendStats && (
                <div
                  key={`sales-trend-${animKey}`}
                  style={{
                    width: "100%",
                    overflowX: "auto",
                    paddingBottom: 2,
                  }}
                >
                  {(() => {
                    const pts = rangeSnapshots;
                    const minPerBar = pts.length > 24 ? 26 : 44;
                    const W = Math.max(520, pts.length * minPerBar + 66);
                    const H = 190;
                    const padL = 48;
                    const padR = 18;
                    const padT = 18;
                    const padB = 32;
                    const plotW = W - padL - padR;
                    const plotH = H - padT - padB;
                    const baseLineY = padT + plotH;
                    const colW = plotW / Math.max(pts.length, 1);
                    const maxLabels = Math.max(6, Math.floor(plotW / 58));
                    const labelEvery = Math.max(
                      1,
                      Math.ceil(pts.length / maxLabels)
                    );
                    const stepDelay = Math.min(
                      65,
                      Math.floor(680 / Math.max(pts.length, 1))
                    );

                    const linePoints = pts
                      .map((p, i) => {
                        const x = padL + colW * i + colW / 2;
                        const y =
                          baseLineY - (p.salesVolume / trendStats.max) * plotH;
                        return `${x},${y}`;
                      })
                      .join(" ");

                    return (
                      <svg
                        viewBox={`0 0 ${W} ${H}`}
                        style={{
                          display: "block",
                          width: pts.length > 18 ? `${W}px` : "100%",
                          minWidth: "100%",
                          height: 190,
                        }}
                      >
                        {[0, 0.25, 0.5, 0.75, 1].map((g) => {
                          const y = padT + plotH * g;
                          const v = trendStats.max * (1 - g);
                          return (
                            <g key={g}>
                              <line
                                x1={padL}
                                y1={y}
                                x2={W - padR}
                                y2={y}
                                stroke={g === 1 ? "#907860" : "#EAE0CF"}
                                strokeDasharray={g === 1 ? undefined : "3 3"}
                              />
                              <text
                                x={padL - 6}
                                y={y + 3}
                                textAnchor="end"
                                fontSize={9.5}
                                fill="#907860"
                              >
                                {fmtShort(v)}
                              </text>
                            </g>
                          );
                        })}

                        {pts.length > 1 && (
                          <polyline
                            pathLength={1}
                            className="perf-anim-line"
                            fill="none"
                            stroke="#B49B7E"
                            strokeWidth={pts.length > 35 ? 1.6 : 2.2}
                            points={linePoints}
                          />
                        )}

                        {pts.map((p, i) => {
                          const xCenter = padL + colW * i + colW / 2;
                          const barW = Math.min(
                            42,
                            Math.max(8, colW * (pts.length > 30 ? 0.68 : 0.52))
                          );
                          const barH = Math.max(
                            3,
                            (p.salesVolume / trendStats.max) * plotH
                          );
                          const y = baseLineY - barH;
                          const showLabel =
                            i % labelEvery === 0 || i === pts.length - 1;

                          return (
                            <g key={p.dateIso}>
                              <g
                                className="perf-anim-vbar"
                                style={{
                                  transformOrigin: `${xCenter}px ${baseLineY}px`,
                                  animationDelay: `${i * stepDelay}ms`,
                                }}
                              >
                                <rect
                                  x={xCenter - barW / 2}
                                  y={y}
                                  width={barW}
                                  height={barH}
                                  rx={barW > 14 ? 5 : 3}
                                  fill="#684830"
                                >
                                  <title>{`${p.businessDay || p.dateIso}\nSales: ${fmtRs(p.salesVolume)}\nBills: ${p.billCount}`}</title>
                                </rect>
                              </g>
                              {pts.length <= 12 && (
                                <text
                                  className="perf-anim-val-lbl"
                                  x={xCenter}
                                  y={y - 5}
                                  textAnchor="middle"
                                  fontSize={9.5}
                                  fontWeight={700}
                                  fill="#45301D"
                                >
                                  {fmtShort(p.salesVolume)}
                                </text>
                              )}
                              {showLabel && (
                                <text
                                  x={xCenter}
                                  y={H - 8}
                                  textAnchor="middle"
                                  fontSize={10}
                                  fontWeight={600}
                                  fill="#6B543E"
                                >
                                  {p.label}
                                </text>
                              )}
                            </g>
                          );
                        })}
                      </svg>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Service Mode Collection */}
            <div
              className="perf-anim-card"
              style={{ ...st.chartCard, animationDelay: "140ms" }}
            >
              <div style={st.cardHead}>
                <div>
                  <h3 style={st.cardTitle}>Service Mode Collection</h3>
                  <p style={st.cardSub}>Dining vs Takeaway revenue split</p>
                </div>
              </div>
              <DonutBreakdown
                items={activeData.serviceModes}
                animKey={`sm-${animKey}`}
              />
            </div>
          </div>

          {/* ROW 2: Pay Mode + Main Group + Sales vs Taxes */}
          <div className="perf-row-3">
            <div
              className="perf-anim-card"
              style={{ ...st.chartCard, animationDelay: "180ms" }}
            >
              <div style={st.cardHead}>
                <div>
                  <h3 style={st.cardTitle}>Pay Mode Wise Collection</h3>
                  <p style={st.cardSub}>Cash, Cards &amp; Vouchers</p>
                </div>
              </div>
              <DonutBreakdown
                items={activeData.payModes}
                animKey={`pm-${animKey}`}
              />
            </div>

            <div
              className="perf-anim-card"
              style={{ ...st.chartCard, animationDelay: "230ms" }}
            >
              <div style={st.cardHead}>
                <div>
                  <h3 style={st.cardTitle}>Main Group Sales</h3>
                  <p style={st.cardSub}>Food, Beverage &amp; Other</p>
                </div>
              </div>
              <DonutBreakdown
                items={activeData.mainGroups}
                animKey={`mg-${animKey}`}
              />
            </div>

            <div
              className="perf-anim-card"
              style={{ ...st.chartCard, animationDelay: "280ms" }}
            >
              <div style={st.cardHead}>
                <div>
                  <h3 style={st.cardTitle}>
                    Sales vs Service Charge &amp; Taxes
                  </h3>
                  <p style={st.cardSub}>
                    Net sales &amp; statutory tax breakdown
                  </p>
                </div>
              </div>
              <DonutBreakdown
                items={activeData.taxes}
                animKey={`tx-${animKey}`}
              />
            </div>
          </div>

          {/* ROW 3 (#1 & #2): Daily Bills & Guest Trend + Local vs Foreign Guest Split */}
          <div className="perf-row-2-1">
            {/* Added Chart #1: Daily Bills & Guest (Pax) Trend */}
            <div
              className="perf-anim-card"
              style={{ ...st.chartCard, animationDelay: "320ms" }}
            >
              <div style={st.cardHead}>
                <div>
                  <h3 style={st.cardTitle}>
                    Daily Bills &amp; Guest (Pax) Trend
                  </h3>
                  <p style={st.cardSub}>
                    Closed bills count (bars) vs total guests served (line) per
                    day
                  </p>
                </div>
              </div>

              <div style={st.inlineLegend}>
                <span style={st.inlineLegendItem}>
                  <span
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: 2.5,
                      background: "#684830",
                      display: "inline-block",
                    }}
                  />
                  Closed Bills ({fmtInt(activeData.billCount)})
                </span>
                <span style={st.inlineLegendItem}>
                  <span
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: 2.5,
                      background: "#B86B2B",
                      display: "inline-block",
                    }}
                  />
                  Total Guests ({fmtInt(activeData.pax.total)})
                </span>
              </div>

              <div
                key={`bp-trend-${animKey}`}
                style={{ width: "100%", overflowX: "auto", paddingBottom: 2 }}
              >
                {(() => {
                  const pts = rangeSnapshots;
                  const maxBP = Math.max(
                    ...pts.map((p) => Math.max(p.billCount, p.pax.total)),
                    1
                  );
                  const minPerBar = pts.length > 24 ? 26 : 44;
                  const W = Math.max(520, pts.length * minPerBar + 66);
                  const H = 190;
                  const padL = 48;
                  const padR = 18;
                  const padT = 18;
                  const padB = 32;
                  const plotW = W - padL - padR;
                  const plotH = H - padT - padB;
                  const baseLineY = padT + plotH;
                  const colW = plotW / Math.max(pts.length, 1);
                  const maxLabels = Math.max(6, Math.floor(plotW / 58));
                  const labelEvery = Math.max(
                    1,
                    Math.ceil(pts.length / maxLabels)
                  );
                  const stepDelay = Math.min(
                    65,
                    Math.floor(680 / Math.max(pts.length, 1))
                  );

                  const paxLine = pts
                    .map((p, i) => {
                      const xc = padL + colW * i + colW / 2;
                      const yp = baseLineY - (p.pax.total / maxBP) * plotH;
                      return `${xc},${yp}`;
                    })
                    .join(" ");

                  return (
                    <svg
                      viewBox={`0 0 ${W} ${H}`}
                      style={{
                        display: "block",
                        width: pts.length > 18 ? `${W}px` : "100%",
                        minWidth: "100%",
                        height: 190,
                      }}
                    >
                      {[0, 0.5, 1].map((g) => {
                        const y = padT + plotH * g;
                        const v = Math.round(maxBP * (1 - g));
                        return (
                          <g key={g}>
                            <line
                              x1={padL}
                              y1={y}
                              x2={W - padR}
                              y2={y}
                              stroke={g === 1 ? "#907860" : "#EAE0CF"}
                              strokeDasharray={g === 1 ? undefined : "3 3"}
                            />
                            <text
                              x={padL - 6}
                              y={y + 3}
                              textAnchor="end"
                              fontSize={9.5}
                              fill="#907860"
                            >
                              {v}
                            </text>
                          </g>
                        );
                      })}

                      {pts.length > 1 && (
                        <polyline
                          pathLength={1}
                          className="perf-anim-line"
                          fill="none"
                          stroke="#B86B2B"
                          strokeWidth={pts.length > 35 ? 1.6 : 2.2}
                          points={paxLine}
                        />
                      )}

                      {pts.map((p, i) => {
                        const xc = padL + colW * i + colW / 2;
                        const bw = Math.min(
                          34,
                          Math.max(8, colW * (pts.length > 30 ? 0.6 : 0.46))
                        );
                        const bh = Math.max(
                          3,
                          (p.billCount / maxBP) * plotH
                        );
                        const yb = baseLineY - bh;
                        const yp = baseLineY - (p.pax.total / maxBP) * plotH;
                        const showLabel =
                          i % labelEvery === 0 || i === pts.length - 1;
                        const dly = i * stepDelay;

                        return (
                          <g key={p.dateIso}>
                            <g
                              className="perf-anim-vbar"
                              style={{
                                transformOrigin: `${xc}px ${baseLineY}px`,
                                animationDelay: `${dly}ms`,
                              }}
                            >
                              <rect
                                x={xc - bw / 2}
                                y={yb}
                                width={bw}
                                height={bh}
                                rx={bw > 12 ? 4 : 2.5}
                                fill="#684830"
                              >
                                <title>{`${p.businessDay || p.dateIso}\nClosed Bills: ${p.billCount}\nGuests (Pax): ${p.pax.total}`}</title>
                              </rect>
                            </g>
                            <circle
                              className="perf-anim-dot"
                              style={{ animationDelay: `${300 + dly}ms` }}
                              cx={xc}
                              cy={yp}
                              r={pts.length > 35 ? 2.8 : 3.6}
                              fill="#B86B2B"
                              stroke="#fff"
                              strokeWidth={1.2}
                            >
                              <title>{`${p.businessDay || p.dateIso}: ${p.pax.total} Guests (Local: ${p.pax.local}, Foreign: ${p.pax.foreign})`}</title>
                            </circle>
                            {showLabel && (
                              <text
                                x={xc}
                                y={H - 8}
                                textAnchor="middle"
                                fontSize={10}
                                fontWeight={600}
                                fill="#6B543E"
                              >
                                {p.label}
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </svg>
                  );
                })()}
              </div>
            </div>

            {/* Added Chart #2: Local vs Foreign Guest Distribution */}
            <div
              className="perf-anim-card"
              style={{ ...st.chartCard, animationDelay: "360ms" }}
            >
              <div style={st.cardHead}>
                <div>
                  <h3 style={st.cardTitle}>
                    Local vs Foreign Guest Distribution
                  </h3>
                  <p style={st.cardSub}>
                    Guest nationality split (Avg{" "}
                    {activeData.avgPax.toFixed(2)} pax/bill)
                  </p>
                </div>
              </div>
              <DonutBreakdown
                items={paxDonutItems}
                animKey={`pax-${animKey}`}
                centerLabel="PAX"
                valueFormatter={(v) => `${fmtInt(v)} pax`}
                tooltipFormatter={(v) => `${fmtInt(v)} Guests`}
                centerValueFormatter={fmtInt}
              />
            </div>
          </div>

          {/* ROW 4 (#4 & #5): Daily Dining vs Takeaway Mix + Daily Food vs Beverage Mix */}
          <div className="perf-row-eq2">
            {/* Added Chart #4: Daily Dining vs Takeaway Mix (Stacked) */}
            <div
              className="perf-anim-card"
              style={{ ...st.chartCard, animationDelay: "400ms" }}
            >
              <div style={st.cardHead}>
                <div>
                  <h3 style={st.cardTitle}>
                    Daily Dining vs Takeaway Mix (Stacked)
                  </h3>
                  <p style={st.cardSub}>
                    Day-by-day service mode revenue comparison
                  </p>
                </div>
              </div>
              <DailyStackedChart
                snapshots={rangeSnapshots}
                seriesKeys={serviceModeSeries}
                seriesColors={["#684830", "#C4A784", "#907860", "#45301D"]}
                animKey={`sm-stack-${animKey}`}
                getDayMap={(sn) => {
                  const mp = new Map<string, number>();
                  for (const sm of sn.serviceModes) {
                    const k = sm.name.toUpperCase();
                    mp.set(k, (mp.get(k) ?? 0) + sm.amt);
                  }
                  return mp;
                }}
              />
            </div>

            {/* Added Chart #5: Daily Food vs Beverage Mix Trend (Stacked) */}
            <div
              className="perf-anim-card"
              style={{ ...st.chartCard, animationDelay: "440ms" }}
            >
              <div style={st.cardHead}>
                <div>
                  <h3 style={st.cardTitle}>
                    Daily Food vs Beverage Mix Trend (Stacked)
                  </h3>
                  <p style={st.cardSub}>
                    Main group daily sales composition across selected dates
                  </p>
                </div>
              </div>
              <DailyStackedChart
                snapshots={rangeSnapshots}
                seriesKeys={mainGroupSeries}
                seriesColors={["#45301D", "#907860", "#D9C7AC", "#B49B7E"]}
                animKey={`mg-stack-${animKey}`}
                getDayMap={(sn) => {
                  const mp = new Map<string, number>();
                  for (const mg of sn.mainGroups) {
                    const k = mg.name.toUpperCase();
                    mp.set(k, (mp.get(k) ?? 0) + mg.amt);
                  }
                  return mp;
                }}
              />
            </div>
          </div>

          {/* ROW 5: Family Sales Ranking + Cashier & Operational Summary */}
          <div className="perf-row-2">
            <div
              className="perf-anim-card"
              style={{ ...st.chartCard, animationDelay: "480ms" }}
            >
              <div style={st.cardHead}>
                <div>
                  <h3 style={st.cardTitle}>Family Group Sales Ranking</h3>
                  <p style={st.cardSub}>
                    Category revenue &amp; item quantities sold
                  </p>
                </div>
                <div style={st.segGroup}>
                  <button
                    type="button"
                    onClick={() => setFamMode("amt")}
                    style={{
                      ...st.segBtn,
                      ...(famMode === "amt" ? st.segBtnActive : null),
                    }}
                  >
                    Revenue (Rs.)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFamMode("qty")}
                    style={{
                      ...st.segBtn,
                      ...(famMode === "qty" ? st.segBtnActive : null),
                    }}
                  >
                    Qty Sold
                  </button>
                </div>
              </div>

              {sortedFamilies.length === 0 ? (
                <div
                  style={{ color: "#907860", fontSize: 12, padding: "20px 0" }}
                >
                  No family group rows in selected date range.
                </div>
              ) : (
                <div
                  key={`fam-${animKey}-${famMode}`}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 9,
                  }}
                >
                  {(() => {
                    const maxVal = Math.max(
                      ...sortedFamilies.map((x) =>
                        famMode === "qty" ? x.qty : x.amt
                      ),
                      1
                    );
                    return sortedFamilies.map((f, idx) => {
                      const val = famMode === "qty" ? f.qty : f.amt;
                      const pct = Math.max(3, (val / maxVal) * 100);
                      const barColor = idx === 0 ? "#45301D" : "#684830";
                      return (
                        <div
                          key={f.name}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "baseline",
                              fontSize: 12,
                              gap: 8,
                            }}
                          >
                            <span style={{ fontWeight: 600, color: "#45301D" }}>
                              {f.name}
                              {f.qty > 0 && (
                                <span style={st.qtyBadge}>{f.qty} qty</span>
                              )}
                            </span>
                            <span
                              style={{
                                fontWeight: 700,
                                color: "#45301D",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {famMode === "qty"
                                ? `${f.qty} items · ${fmtRs(f.amt)}`
                                : fmtRs(f.amt)}
                            </span>
                          </div>
                          <div style={st.hbarTrack}>
                            <div
                              className="perf-anim-hbar"
                              style={{
                                height: "100%",
                                width: `${pct}%`,
                                background: barColor,
                                borderRadius: 6,
                                animationDelay: `${140 + idx * 75}ms`,
                              }}
                            />
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>

            {/* Cashier Collection & Operational Summary */}
            <div
              className="perf-anim-card"
              style={{ ...st.chartCard, animationDelay: "520ms" }}
            >
              <div style={st.cardHead}>
                <div>
                  <h3 style={st.cardTitle}>
                    Cashier Collection &amp; Operational Summary
                  </h3>
                  <p style={st.cardSub}>
                    Cashier totals, pax, averages, discounts &amp; bills
                  </p>
                </div>
              </div>

              {activeData.cashiers.length > 0 && (
                <div
                  key={`cash-${animKey}`}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    marginBottom: 10,
                  }}
                >
                  {(() => {
                    const maxC = Math.max(
                      ...activeData.cashiers.map((c) => c.amt),
                      1
                    );
                    return activeData.cashiers.map((c, idx) => (
                      <div
                        key={c.name}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: 12,
                          }}
                        >
                          <span style={{ fontWeight: 600, color: "#45301D" }}>
                            Cashier: {c.name}
                          </span>
                          <span style={{ fontWeight: 700, color: "#45301D" }}>
                            {fmtRs(c.amt)}
                          </span>
                        </div>
                        <div style={st.hbarTrack}>
                          <div
                            className="perf-anim-hbar"
                            style={{
                              height: "100%",
                              width: `${Math.max(4, (c.amt / maxC) * 100)}%`,
                              background: "#684830",
                              borderRadius: 6,
                              animationDelay: `${160 + idx * 80}ms`,
                            }}
                          />
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 9,
                  marginTop: "auto",
                }}
              >
                <div style={st.opsTile}>
                  <div style={st.opsK}>Pax Distribution</div>
                  <div style={st.opsV}>{activeData.pax.total} Guests</div>
                  <div style={st.opsSub}>
                    Local: {activeData.pax.local} · Foreign:{" "}
                    {activeData.pax.foreign}
                  </div>
                </div>

                <div style={st.opsTile}>
                  <div style={st.opsK}>Spending Averages</div>
                  <div style={st.opsV}>
                    {fmtRs(activeData.spendPax)}{" "}
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        color: "#6B543E",
                      }}
                    >
                      / pax
                    </span>
                  </div>
                  <div style={st.opsSub}>
                    Avg {activeData.avgPax.toFixed(2)} pax/bill · Time:{" "}
                    {activeData.avgTime || "—"}
                  </div>
                </div>

                <div style={st.opsTile}>
                  <div style={st.opsK}>Discounts &amp; Comp.</div>
                  <div style={st.opsV}>{fmtRs(activeData.discount)}</div>
                  <div style={st.opsSub}>
                    Complimentary: {activeData.compCount} (
                    {fmtRs(activeData.compAmt)})
                  </div>
                </div>

                <div style={st.opsTile}>
                  <div style={st.opsK}>Bills &amp; Avg / Day</div>
                  <div style={st.opsV}>
                    {activeData.billCount} Closed Bills
                  </div>
                  <div style={st.opsSub}>
                    Unclosed: {activeData.unclosedCount} (
                    {fmtRs(activeData.unclosedAmt)}) · Avg/Day:{" "}
                    {fmtRs(
                      activeData.salesVolume /
                        Math.max(1, rangeSnapshots.length)
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const st: Record<string, CSSProperties> = {
  perfBar: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "13px 16px",
    background: "linear-gradient(135deg, #FCF7F3 0%, #FFFFFF 100%)",
    border: "1px solid #E4D6BF",
    borderRadius: 14,
    marginBottom: 16,
    boxShadow: "0 1px 3px rgba(114,86,60,0.04)",
  },
  metaChip: {
    fontSize: 11.5,
    color: "#6B543E",
    background: "#F6EFE4",
    border: "1px solid #E4D6BF",
    borderRadius: 999,
    padding: "3px 10px",
    fontWeight: 500,
  },
  ctrlLbl: {
    fontSize: 11,
    fontWeight: 600,
    color: "#6B543E",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  select: {
    background: "#fff",
    border: "1px solid #D9C7AC",
    borderRadius: 9,
    padding: "6px 10px",
    fontSize: 12.5,
    fontWeight: 600,
    color: "#45301D",
    cursor: "pointer",
  },
  dateInput: {
    background: "#fff",
    border: "1px solid #D9C7AC",
    borderRadius: 9,
    padding: "5px 10px",
    fontSize: 12.5,
    fontWeight: 600,
    color: "#45301D",
    fontFamily: "inherit",
    cursor: "pointer",
  },
  segGroup: {
    display: "inline-flex",
    background: "#F3ECE0",
    border: "1px solid #E4D6BF",
    borderRadius: 9,
    padding: 2,
    flexWrap: "wrap",
  },
  segBtn: {
    border: 0,
    background: "transparent",
    color: "#6B543E",
    fontSize: 11.5,
    fontWeight: 600,
    padding: "5px 9px",
    borderRadius: 7,
    cursor: "pointer",
  },
  segBtnActive: {
    background: "#684830",
    color: "#fff",
  },
  chartCard: {
    background: "#ffffff",
    border: "1px solid #E4D6BF",
    borderRadius: 14,
    padding: "18px 18px 16px",
    boxShadow: "0 1px 3px rgba(114,86,60,0.04)",
    display: "flex",
    flexDirection: "column",
  },
  cardHead: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 12,
  },
  cardTitle: {
    margin: 0,
    fontSize: 13.5,
    fontWeight: 700,
    color: "#45301D",
  },
  cardSub: {
    margin: "2px 0 0",
    fontSize: 11.5,
    color: "#907860",
  },
  summaryStrip: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 12,
  },
  sumPill: {
    background: "#FCF7F3",
    border: "1px solid #EDE1CE",
    borderRadius: 8,
    padding: "5px 10px",
    fontSize: 11,
    color: "#6B543E",
  },
  inlineLegend: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    fontSize: 11.5,
    fontWeight: 600,
    color: "#45301D",
    marginBottom: 8,
  },
  inlineLegendItem: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
  },
  qtyBadge: {
    display: "inline-block",
    fontSize: 10.5,
    fontWeight: 700,
    background: "#F3E9DA",
    color: "#684830",
    borderRadius: 5,
    padding: "1px 6px",
    marginLeft: 6,
  },
  hbarTrack: {
    height: 9,
    background: "#F4EDE2",
    borderRadius: 6,
    overflow: "hidden",
  },
  opsTile: {
    background: "#FCF7F3",
    border: "1px solid #EAE0CF",
    borderRadius: 10,
    padding: "10px 12px",
  },
  opsK: {
    fontSize: 10.5,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: "#7C6148",
  },
  opsV: {
    marginTop: 3,
    fontSize: 15.5,
    fontWeight: 700,
    color: "#45301D",
  },
  opsSub: {
    marginTop: 2,
    fontSize: 11,
    color: "#907860",
  },
};
