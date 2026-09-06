"use client";

// ============================================================
// LOCATION: components/ReportChart.tsx
// FULL REPLACE — pro chart view (pure SVG, deps naha):
//   type="bars"  — vertical gradient bars (date-wise reports)
//   type="hbars" — horizontal bars, sorted (items/staff ranking)
//   type="pie"   — donut share view (dept/payment mode share)
//   • Hover tooltip + highlight, max/top accent color
//   • Summary chips (total / avg / best-top)
//   • Same card style + grid as before (bars code unchanged)
// ============================================================
import { useState } from "react";
import { IconBarChart } from "./reports/ReportIcons";

export type ChartType = "bars" | "hbars" | "pie";

export interface ChartSeries {
  label: string;
  value: number;
}

const fmt = (n: number) =>
  n.toLocaleString("en-US", { maximumFractionDigits: 0 });

// pie palette — report theme ekema professional colors
const PIE_COLORS = [
  "#1d4ed8",
  "#059669",
  "#d97706",
  "#7c3aed",
  "#0284c7",
  "#dc2626",
  "#65a30d",
  "#db2777",
  "#4f46e5",
  "#0d9488",
];
const OTHER_COLOR = "#94a3b8";

export default function ReportChart({
  data,
  title,
  valuePrefix = "Rs. ",
  type = "bars",
}: {
  data: ChartSeries[];
  title: string;
  valuePrefix?: string;
  type?: ChartType;
}) {
  const [hover, setHover] = useState<number | null>(null);

  if (!data.length) {
    return (
      <div
        style={{
          padding: "20px 24px 26px",
          fontFamily: "Inter, sans-serif",
        }}
      >
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
            <IconBarChart size={30} strokeWidth={1.6} />
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 13.5,
              fontWeight: 600,
              color: "#334155",
            }}
          >
            No data to chart.
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#94a3b8" }}>
            Try changing the date range or clearing the search.
          </p>
        </div>
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.value), 1);
  const total = data.reduce((s, d) => s + d.value, 0);
  const avg = total / data.length;
  const best = data.reduce((a, b) => (b.value > a.value ? b : a), data[0]);

  const topLabel = type === "bars" ? "Best" : "Top";

  const chips = [
    { label: "Total", value: `${valuePrefix}${fmt(total)}`, color: "#0f172a" },
    { label: "Average", value: `${valuePrefix}${fmt(avg)}`, color: "#1d4ed8" },
    { label: `${topLabel} (${best.label})`, value: `${valuePrefix}${fmt(best.value)}`, color: "#059669" },
  ];

  // ══════════════════════════════════════════════════════════
  // PIE — slice math (sorted desc, >8 nam "Other" ekata)
  // ══════════════════════════════════════════════════════════
  const pieSlices = (() => {
    const sorted = [...data].sort((a, b) => b.value - a.value);
    const head = sorted.slice(0, 8);
    const rest = sorted.slice(8);
    const slices = head.map((d, i) => ({
      label: d.label,
      value: d.value,
      color: PIE_COLORS[i % PIE_COLORS.length],
    }));
    if (rest.length > 0) {
      slices.push({
        label: `Other (${rest.length})`,
        value: rest.reduce((s, d) => s + d.value, 0),
        color: OTHER_COLOR,
      });
    }
    return slices;
  })();

  const CX = 150;
  const CY = 130;
  const R = 96;
  const RI = 58;
  const pieH = Math.max(pieSlices.length * 26 + 16, 262);
  const pieW = 318 + 250;

  const polar = (r: number, deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
  };
  const slicePath = (a0: number, a1: number) => {
    const large = a1 - a0 > 180 ? 1 : 0;
    const p0 = polar(R, a0);
    const p1 = polar(R, a1);
    const q1 = polar(RI, a1);
    const q0 = polar(RI, a0);
    return [
      `M ${p0.x} ${p0.y}`,
      `A ${R} ${R} 0 ${large} 1 ${p1.x} ${p1.y}`,
      `L ${q1.x} ${q1.y}`,
      `A ${RI} ${RI} 0 ${large} 0 ${q0.x} ${q0.y}`,
      "Z",
    ].join(" ");
  };

  let acc = 0;
  const pieAngles = pieSlices.map((s) => {
    const sweep = total > 0 ? (s.value / total) * 360 : 0;
    const seg = { start: acc, end: acc + sweep, pct: total > 0 ? (s.value / total) * 100 : 0 };
    acc += sweep;
    return seg;
  });

  return (
    <div
      style={{
        padding: "20px 24px 26px",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 14,
          background: "#ffffff",
          boxShadow:
            "0 1px 2px rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.06)",
          padding: "16px 18px 10px",
          overflowX: "auto",
        }}
      >
      {/* Summary chips */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
        {chips.map((c) => (
          <div
            key={c.label}
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              padding: "10px 16px",
              background: "#fff",
              boxShadow: "0 1px 3px rgba(15,23,42,0.05)",
              minWidth: 120,
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0.5,
                textTransform: "uppercase",
                color: "#64748b",
              }}
            >
              {c.label}
            </p>
            <p
              style={{
                margin: "3px 0 0",
                fontSize: 17,
                fontWeight: 700,
                color: c.color,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {c.value}
            </p>
          </div>
        ))}
      </div>

      <p
        style={{
          margin: "0 0 10px",
          fontSize: 13,
          fontWeight: 700,
          color: "#0f172a",
          display: "flex",
          alignItems: "center",
          gap: 7,
        }}
      >
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: 7,
            background: "#eef2ff",
            color: "#4f46e5",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <IconBarChart size={13} />
        </span>
        {title} — {valuePrefix.trim()} view
      </p>

      {/* ══════════ BARS (vertical — date-wise) ══════════ */}
      {type === "bars" && (() => {
        const BAR_W = 52;
        const GAP = 22;
        const H = 250;
        const W = Math.max(data.length * (BAR_W + GAP) + 70, 360);
        return (
          <svg
            width={W}
            height={H + 60}
            viewBox={`0 0 ${W} ${H + 60}`}
            style={{ display: "block", minWidth: "100%" }}
          >
            <defs>
              <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#60a5fa" />
                <stop offset="100%" stopColor="#1d4ed8" />
              </linearGradient>
              <linearGradient id="barGradMax" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>
            </defs>

            {/* grid */}
            {[0, 0.25, 0.5, 0.75, 1].map((f) => (
              <g key={f}>
                <line
                  x1={56}
                  x2={W - 16}
                  y1={24 + H * (1 - f)}
                  y2={24 + H * (1 - f)}
                  stroke={f === 0 ? "#cbd5e1" : "#eef2f7"}
                  strokeWidth={1}
                />
                <text
                  x={50}
                  y={28 + H * (1 - f)}
                  fontSize={9.5}
                  fill="#94a3b8"
                  textAnchor="end"
                  fontFamily="Inter, sans-serif"
                >
                  {fmt(max * f)}
                </text>
              </g>
            ))}

            {data.map((d, i) => {
              const h = Math.max((d.value / max) * H, 3);
              const x = 66 + i * (BAR_W + GAP);
              const y = 24 + H - h;
              const isMax = d.value === max;
              const isHover = hover === i;
              const short =
                d.label.length > 11 ? `${d.label.slice(0, 10)}…` : d.label;
              return (
                <g
                  key={`${d.label}-${i}`}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  style={{ cursor: "pointer" }}
                >
                  {/* hover band */}
                  <rect
                    x={x - GAP / 2}
                    y={8}
                    width={BAR_W + GAP}
                    height={H + 16}
                    fill={isHover ? "rgba(59,130,246,0.07)" : "transparent"}
                    rx={8}
                  />
                  {/* value label */}
                  <text
                    x={x + BAR_W / 2}
                    y={y - 7}
                    fontSize={10}
                    fontWeight={700}
                    fill="#0f172a"
                    textAnchor="middle"
                    fontFamily="Inter, sans-serif"
                    opacity={isHover || isMax ? 1 : 0.75}
                  >
                    {fmt(d.value)}
                  </text>
                  {/* bar */}
                  <rect
                    x={x}
                    y={y}
                    width={BAR_W}
                    height={h}
                    rx={6}
                    fill={isMax ? "url(#barGradMax)" : "url(#barGrad)"}
                    opacity={hover == null || isHover ? 1 : 0.55}
                    style={{ transition: "opacity 0.15s" }}
                  />
                  {/* x label */}
                  <text
                    x={x + BAR_W / 2}
                    y={24 + H + 18}
                    fontSize={9.5}
                    fill="#475569"
                    textAnchor="middle"
                    fontFamily="Inter, sans-serif"
                  >
                    {short}
                  </text>
                  <title>{`${d.label} — ${valuePrefix}${d.value.toLocaleString("en-US")}`}</title>
                </g>
              );
            })}
          </svg>
        );
      })()}

      {/* ══════════ HBARS (horizontal — ranking) ══════════ */}
      {type === "hbars" && (() => {
        const sorted = [...data].sort((a, b) => b.value - a.value);
        const ROW_H = 34;
        const BAR_H = 18;
        const H = sorted.length * ROW_H + 26;
        const maxLen = Math.max(...sorted.map((d) => d.label.length), 8);
        const labelW = Math.min(Math.max(maxLen * 6.4 + 16, 90), 200);
        const barArea = 430;
        const W = labelW + barArea + 90;
        const trunc = (t: string) =>
          t.length > Math.floor(labelW / 6.4) - 1
            ? `${t.slice(0, Math.floor(labelW / 6.4) - 2)}…`
            : t;
        return (
          <svg
            width={W}
            height={H}
            viewBox={`0 0 ${W} ${H}`}
            style={{ display: "block", minWidth: "100%" }}
          >
            <defs>
              <linearGradient id="hbarGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#1d4ed8" />
                <stop offset="100%" stopColor="#60a5fa" />
              </linearGradient>
              <linearGradient id="hbarGradTop" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#059669" />
                <stop offset="100%" stopColor="#34d399" />
              </linearGradient>
            </defs>

            {/* vertical grid */}
            {[0, 0.25, 0.5, 0.75, 1].map((f) => (
              <g key={f}>
                <line
                  x1={labelW + (barArea - 20) * f}
                  x2={labelW + (barArea - 20) * f}
                  y1={6}
                  y2={H - 18}
                  stroke={f === 0 ? "#cbd5e1" : "#eef2f7"}
                  strokeWidth={1}
                />
                <text
                  x={labelW + (barArea - 20) * f}
                  y={H - 4}
                  fontSize={9}
                  fill="#94a3b8"
                  textAnchor="middle"
                  fontFamily="Inter, sans-serif"
                >
                  {fmt(max * f)}
                </text>
              </g>
            ))}

            {sorted.map((d, i) => {
              const bw = Math.max((d.value / max) * (barArea - 20), 4);
              const y = 8 + i * ROW_H;
              const isTop = d.value === max;
              const isHover = hover === i;
              return (
                <g
                  key={`${d.label}-${i}`}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  style={{ cursor: "pointer" }}
                >
                  {/* hover band */}
                  <rect
                    x={2}
                    y={y - 3}
                    width={W - 4}
                    height={ROW_H - 2}
                    fill={isHover ? "rgba(59,130,246,0.07)" : "transparent"}
                    rx={7}
                  />
                  {/* rank */}
                  <text
                    x={12}
                    y={y + BAR_H - 4}
                    fontSize={9.5}
                    fontWeight={700}
                    fill={isTop ? "#059669" : "#94a3b8"}
                    fontFamily="Inter, sans-serif"
                  >
                    {i + 1}
                  </text>
                  {/* label */}
                  <text
                    x={28}
                    y={y + BAR_H - 4}
                    fontSize={10.5}
                    fontWeight={isTop || isHover ? 700 : 500}
                    fill="#334155"
                    fontFamily="Inter, sans-serif"
                  >
                    {trunc(d.label)}
                  </text>
                  {/* bar */}
                  <rect
                    x={labelW}
                    y={y}
                    width={bw}
                    height={BAR_H}
                    rx={5}
                    fill={isTop ? "url(#hbarGradTop)" : "url(#hbarGrad)"}
                    opacity={hover == null || isHover ? 1 : 0.55}
                    style={{ transition: "opacity 0.15s" }}
                  />
                  {/* value */}
                  <text
                    x={labelW + bw + 7}
                    y={y + BAR_H - 4}
                    fontSize={10}
                    fontWeight={700}
                    fill="#0f172a"
                    fontFamily="Inter, sans-serif"
                    opacity={isHover || isTop ? 1 : 0.75}
                  >
                    {fmt(d.value)}
                  </text>
                  <title>{`${d.label} — ${valuePrefix}${d.value.toLocaleString("en-US")}`}</title>
                </g>
              );
            })}
          </svg>
        );
      })()}

      {/* ══════════ PIE / DONUT (share view) ══════════ */}
      {type === "pie" && (
        <svg
          width={pieW}
          height={pieH}
          viewBox={`0 0 ${pieW} ${pieH}`}
          style={{ display: "block", minWidth: "100%" }}
        >
          {/* slices */}
          {pieSlices.map((s, i) => {
            const seg = pieAngles[i];
            const isHover = hover === i;
            const mid = (seg.start + seg.end) / 2;
            const lbl = polar((R + RI) / 2, mid);
            return seg.end - seg.start >= 359.99 ? (
              /* single slice (100%) — full ring */
              <g key={s.label}>
                <circle
                  cx={CX}
                  cy={CY}
                  r={(R + RI) / 2}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={R - RI}
                  opacity={hover == null || isHover ? 1 : 0.55}
                  style={{ cursor: "pointer", transition: "opacity 0.15s" }}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                >
                  <title>{`${s.label} — ${valuePrefix}${s.value.toLocaleString("en-US")} (100%)`}</title>
                </circle>
              </g>
            ) : (
              <path
                key={s.label}
                d={slicePath(seg.start, seg.end)}
                fill={s.color}
                stroke="#ffffff"
                strokeWidth={2}
                opacity={hover == null || isHover ? 1 : 0.55}
                style={{ cursor: "pointer", transition: "opacity 0.15s" }}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                <title>{`${s.label} — ${valuePrefix}${s.value.toLocaleString("en-US")} (${seg.pct.toFixed(1)}%)`}</title>
              </path>
            );
          })}

          {/* inside % labels (>= 6%) */}
          {pieSlices.map((s, i) => {
            const seg = pieAngles[i];
            if (seg.pct < 6) return null;
            const mid = (seg.start + seg.end) / 2;
            const lbl = polar((R + RI) / 2, mid);
            return (
              <text
                key={`lbl-${s.label}`}
                x={lbl.x}
                y={lbl.y + 3}
                fontSize={9.5}
                fontWeight={700}
                fill="#ffffff"
                textAnchor="middle"
                fontFamily="Inter, sans-serif"
                pointerEvents="none"
              >
                {seg.pct.toFixed(0)}%
              </text>
            );
          })}

          {/* center — hovered slice info / total */}
          {hover != null ? (
            <>
              <text
                x={CX}
                y={CY - 4}
                fontSize={11}
                fontWeight={700}
                fill="#0f172a"
                textAnchor="middle"
                fontFamily="Inter, sans-serif"
                pointerEvents="none"
              >
                {pieSlices[hover].label.length > 16
                  ? `${pieSlices[hover].label.slice(0, 15)}…`
                  : pieSlices[hover].label}
              </text>
              <text
                x={CX}
                y={CY + 13}
                fontSize={11}
                fontWeight={800}
                fill={pieSlices[hover].color}
                textAnchor="middle"
                fontFamily="Inter, sans-serif"
                pointerEvents="none"
              >
                {`${valuePrefix}${fmt(pieSlices[hover].value)} (${pieAngles[hover].pct.toFixed(1)}%)`}
              </text>
            </>
          ) : (
            <>
              <text
                x={CX}
                y={CY - 4}
                fontSize={10}
                fontWeight={700}
                fill="#64748b"
                textAnchor="middle"
                fontFamily="Inter, sans-serif"
                letterSpacing={0.5}
              >
                TOTAL
              </text>
              <text
                x={CX}
                y={CY + 15}
                fontSize={14}
                fontWeight={800}
                fill="#0f172a"
                textAnchor="middle"
                fontFamily="Inter, sans-serif"
              >
                {`${valuePrefix}${fmt(total)}`}
              </text>
            </>
          )}

          {/* legend */}
          {pieSlices.map((s, i) => {
            const y = 22 + i * 26;
            const isHover = hover === i;
            return (
              <g
                key={`leg-${s.label}`}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                style={{ cursor: "pointer" }}
              >
                <rect
                  x={322}
                  y={y - 13}
                  width={pieW - 330}
                  height={24}
                  rx={7}
                  fill={isHover ? "rgba(59,130,246,0.07)" : "transparent"}
                />
                <rect
                  x={332}
                  y={y - 7}
                  width={13}
                  height={13}
                  rx={4}
                  fill={s.color}
                />
                <text
                  x={354}
                  y={y + 4}
                  fontSize={10.5}
                  fontWeight={isHover ? 700 : 500}
                  fill="#334155"
                  fontFamily="Inter, sans-serif"
                >
                  {s.label.length > 20 ? `${s.label.slice(0, 19)}…` : s.label}
                </text>
                <text
                  x={pieW - 16}
                  y={y + 4}
                  fontSize={10}
                  fontWeight={700}
                  fill="#0f172a"
                  textAnchor="end"
                  fontFamily="Inter, sans-serif"
                >
                  {`${fmt(s.value)} • ${((s.value / (total || 1)) * 100).toFixed(1)}%`}
                </text>
              </g>
            );
          })}
        </svg>
      )}
      </div>
    </div>
  );
}
