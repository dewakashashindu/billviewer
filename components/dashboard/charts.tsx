"use client";

// ============================================================
// LOCATION: components/dashboard/charts.tsx   (ALUTH FILE)
//
// Dashboard aluth tabs walata one SVG chart primitives + animations.
//   • external chart library ekak nathiwa (SVG witharai)
//   • source / table name labels NATHIWA (UI copy eke DB names penenne naha)
//   • animation: KPI count-up, card stagger, bar grow, donut draw,
//     line draw, heatmap stagger — `go` class eken re-trigger wenawa
//
// Exports:
//   DashStyles  AnimatedNumber  KpiCard  ChartCard  SectionShell
//   Donut  HBars  ComboChart  Heatmap  Waterfall  Funnel
//   EmptyBlock  LoadingBlock  gridStyle  kpiGridStyle  DASH  DASH_COLORS  fmt*
// ============================================================
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/* ── theme (repo palette) ── */
export const DASH = {
  dark: "#45301D",
  accent: "#684830",
  border: "#E4D6BF",
  band: "#F0E8D8",
  soft: "#FCF7F3",
  muted: "#907860",
  ink: "#2A1C10",
  good: "#2F7A4F",
  bad: "#B4462F",
  kitchen: "#3F6B4A",
  kitchenSoft: "#F1F5EE",
} as const;

export const DASH_COLORS = [
  "#684830", "#907860", "#B49B7E", "#45301D", "#A98F70",
  "#7C6148", "#C8B8A8", "#D9C7AC", "#8A6A4C", "#BFA98B",
];

export const KITCHEN_COLORS = [
  "#3F6B4A", "#5C8465", "#7A9E80", "#2F5238", "#6E9475",
  "#9BB79E", "#B7CCB8", "#4A7155",
];

/* ── formatting ── */
export const fmtRs = (v: number) => "Rs " + fmtInt(v);
export const fmtRs2 = (v: number) =>
  "Rs " +
  Number(v || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
export const fmtInt = (v: number) =>
  Math.round(Number(v || 0)).toLocaleString("en-US");
export const fmtShort = (v: number) => {
  const n = Number(v || 0);
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return fmtInt(n);
};
export const fmtMin = (v: number) => `${Number(v || 0).toFixed(1)} min`;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/* ═══════════════════ animation stylesheet ═══════════════════ */
export function DashStyles() {
  return (
    <style>{`
      @keyframes dashFadeUp { from { opacity:0; transform:translateY(9px) } to { opacity:1; transform:none } }
      @keyframes dashFadeIn { from { opacity:0 } to { opacity:1 } }
      @keyframes dashGrowX  { from { transform:scaleX(0) } to { transform:scaleX(1) } }
      @keyframes dashGrowY  { from { transform:scaleY(0) } to { transform:scaleY(1) } }
      @keyframes dashDraw   { from { stroke-dasharray:0 9999 } }
      @keyframes dashLine   { from { stroke-dashoffset:1 } to { stroke-dashoffset:0 } }
      @keyframes dashPop    { from { opacity:0; transform:scale(.4) } to { opacity:1; transform:scale(1) } }

      .dashgo .da-anim   { animation: dashFadeUp .42s cubic-bezier(.2,.75,.3,1) var(--d,0s) both }
      .dashgo .da-fade   { animation: dashFadeIn .5s ease var(--d,0s) both }
      .dashgo .da-fadein { animation: dashFadeIn .5s ease var(--d,0s) both }
      .dashgo .da-grow   { transform-box: fill-box; transform-origin: left center;
                           animation: dashGrowX .72s cubic-bezier(.2,.8,.2,1) var(--d,0s) both }
      .dashgo .da-growy  { transform-box: fill-box; transform-origin: center bottom;
                           animation: dashGrowY .7s cubic-bezier(.2,.8,.2,1) var(--d,0s) both }
      .dashgo .da-draw   { animation: dashDraw .9s cubic-bezier(.3,.7,.3,1) var(--d,0s) both }
      .dashgo .da-line   { stroke-dasharray:1; animation: dashLine 1.05s ease var(--d,.1s) both }
      .dashgo .da-pop    { animation: dashPop .4s cubic-bezier(.2,1.3,.4,1) var(--d,0s) both }

      @media (prefers-reduced-motion: reduce) {
        .dashgo .da-anim, .dashgo .da-fade, .dashgo .da-fadein, .dashgo .da-grow,
        .dashgo .da-growy, .dashgo .da-draw, .dashgo .da-line, .dashgo .da-pop {
          animation: none !important;
        }
      }
    `}</style>
  );
}

/* ═══════════════════ helpers ═══════════════════ */
const d = (s: number) => ({ ["--d" as string]: `${s.toFixed(2)}s` }) as CSSProperties;

/* ═══════════════════ count-up number ═══════════════════ */
export function AnimatedNumber({
  value,
  formatter,
  animKey = 0,
  duration = 700,
}: {
  value: number;
  formatter: (v: number) => string;
  /** wenas karama animation aye run wenawa (tab switch) */
  animKey?: number;
  duration?: number;
}) {
  const [shown, setShown] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      setShown(value);
      return;
    }
    const reduce =
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
    if (reduce) {
      setShown(value);
      return;
    }
    const t0 = performance.now();
    const from = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(from + (value - from) * eased);
      if (k < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
  }, [value, duration, animKey]);

  return <>{formatter(shown)}</>;
}

/* ═══════════════════ KPI card ═══════════════════ */
export function KpiCard({
  label,
  value,
  sub,
  delta,
  up = true,
  animKey = 0,
  delay = 0,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  delta?: string;
  up?: boolean;
  animKey?: number;
  delay?: number;
  accent?: string;
}) {
  /* "Rs 902,270" → prefix "Rs " + number ; "11.4 min" → 11.4 + " min" */
  const m = /^([^\d-]*)(-?[\d,]*\.?\d*)(.*)$/.exec(value);
  const prefix = m?.[1] ?? "";
  const numTxt = (m?.[2] ?? "").replace(/,/g, "");
  const suffix = m?.[3] ?? "";
  const numeric = numTxt !== "" && !Number.isNaN(Number(numTxt));
  const decimals = numTxt.includes(".") ? numTxt.split(".")[1].length : 0;
  const formatter = (v: number) =>
    `${prefix}${v.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}${suffix}`;

  return (
    <div
      className="da-anim"
      style={{
        ...d(delay),
        border: `1px solid ${DASH.border}`,
        borderRadius: 11,
        padding: "9px 11px",
        background: "#fff",
        boxShadow: "0 1px 2px rgba(114,86,60,0.04)",
      }}
    >
      <div
        style={{
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: 0.7,
          color: accent ?? DASH.muted,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 17,
          fontWeight: 800,
          marginTop: 3,
          color: DASH.ink,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {numeric ? (
          <AnimatedNumber value={Number(numTxt)} formatter={formatter} animKey={animKey} />
        ) : (
          value
        )}
      </div>
      {(sub || delta) && (
        <div style={{ fontSize: 10, color: DASH.muted, marginTop: 2 }}>
          {sub}
          {delta && (
            <span
              style={{
                fontWeight: 800,
                marginLeft: 4,
                color: up ? DASH.good : DASH.bad,
              }}
            >
              {up ? "▲" : "▼"} {delta}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════ chart card ═══════════════════ */
export function ChartCard({
  title,
  sub,
  children,
  span = 1,
  delay = 0,
  accent,
}: {
  title: string;
  sub?: string;
  /* ⚠️ source/table labels nathuwa — DB names UI eke penenne naha */
  children: ReactNode;
  span?: number;
  delay?: number;
  accent?: string;
}) {
  return (
    <div
      className="da-anim"
      style={{
        ...d(delay),
        gridColumn: `span ${span}`,
        minWidth: 0,
        border: `1px solid ${DASH.border}`,
        borderRadius: 12,
        background: "#fff",
        padding: "12px 13px",
        boxShadow: "0 1px 2px rgba(114,86,60,0.04)",
      }}
    >
      <div style={{ marginBottom: 9 }}>
        <div
          style={{
            fontSize: 12.5,
            fontWeight: 800,
            color: accent ?? DASH.dark,
          }}
        >
          {title}
        </div>
        {sub && (
          <div
            style={{
              fontSize: 10.5,
              color: DASH.muted,
              marginTop: 2,
              lineHeight: 1.4,
            }}
          >
            {sub}
          </div>
        )}
      </div>
      <div style={{ minHeight: 36 }}>{children}</div>
    </div>
  );
}

/* ═══════════════════ section shell (tab pane) ═══════════════════ */
export function SectionShell({
  kicker,
  title,
  desc,
  right,
  children,
  accent = DASH.accent,
  paneRef,
  goKey,
}: {
  kicker: string;
  title: string;
  desc?: string;
  right?: ReactNode;
  children: ReactNode;
  accent?: string;
  paneRef?: React.RefObject<HTMLDivElement | null>;
  goKey?: number;
}) {
  return (
    <div ref={paneRef} key={goKey} data-dash-pane>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 14,
          alignItems: "flex-start",
          flexWrap: "wrap",
          background: "#fff",
          border: `1px solid ${DASH.border}`,
          borderRadius: 13,
          padding: "13px 15px",
          marginBottom: 13,
          boxShadow: "0 1px 2px rgba(114,86,60,0.05)",
        }}
      >
        <div style={{ minWidth: 240 }}>
          <div
            style={{
              fontSize: 9.5,
              fontWeight: 800,
              letterSpacing: 1,
              color: accent,
            }}
          >
            {kicker}
          </div>
          <h2
            style={{
              margin: "3px 0 4px",
              fontSize: 18,
              fontWeight: 800,
              color: DASH.dark,
            }}
          >
            {title}
          </h2>
          {desc && (
            <p
              style={{
                margin: 0,
                fontSize: 11.5,
                color: DASH.muted,
                maxWidth: 560,
                lineHeight: 1.5,
              }}
            >
              {desc}
            </p>
          )}
        </div>
        <div>{right}</div>
      </div>
      {children}
    </div>
  );
}

/* ═══════════════════ grids ═══════════════════ */
export const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
  gap: 12,
};

export const kpiGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 9,
  marginBottom: 13,
};

/* ═══════════════════ DONUT ═══════════════════ */
export function Donut({
  items,
  size = 168,
  thickness = 25,
  centerTop = "",
  centerSub = "",
  colors = DASH_COLORS,
}: {
  items: { name: string; amt: number }[];
  size?: number;
  thickness?: number;
  centerTop?: string;
  centerSub?: string;
  colors?: string[];
}) {
  const list = (items ?? []).filter((i) => i.amt > 0);
  const total = list.reduce((s, i) => s + i.amt, 0) || 1;
  const r = (size - thickness) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  let acc = 0;

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        {list.map((it, idx) => {
          const frac = it.amt / total;
          const dash = frac * circ;
          const el = (
            <circle
              key={it.name}
              cx={c}
              cy={c}
              r={r}
              fill="none"
              stroke={colors[idx % colors.length]}
              strokeWidth={thickness}
              strokeDasharray={`${dash.toFixed(2)} ${(circ - dash).toFixed(2)}`}
              strokeDashoffset={(-acc).toFixed(2)}
              transform={`rotate(-90 ${c} ${c})`}
              className="da-draw"
              style={d(0.12 * idx)}
            >
              <title>{`${it.name}: ${fmtRs(it.amt)} (${(frac * 100).toFixed(1)}%)`}</title>
            </circle>
          );
          acc += dash;
          return el;
        })}
        <circle cx={c} cy={c} r={r - thickness / 2 - 1} fill="#fff" />
        <text x={c} y={c - 2} textAnchor="middle" fontSize={15} fontWeight={800} fill={DASH.dark}>
          {centerTop}
        </text>
        <text
          x={c}
          y={c + 14}
          textAnchor="middle"
          fontSize={9}
          fontWeight={700}
          letterSpacing={0.5}
          fill={DASH.muted}
        >
          {centerSub}
        </text>
      </svg>

      <div style={{ flex: 1, minWidth: 140, display: "grid", gap: 5 }}>
        {list.map((it, idx) => (
          <div
            key={it.name}
            className="da-fade"
            style={{ ...d(0.05 * idx + 0.15), display: "flex", alignItems: "center", gap: 7 }}
          >
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: 3,
                flex: "0 0 9px",
                background: colors[idx % colors.length],
              }}
            />
            <span
              style={{
                flex: 1,
                fontSize: 10.5,
                fontWeight: 700,
                color: DASH.accent,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {it.name}
            </span>
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 800,
                color: DASH.ink,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {fmtShort(it.amt)}
            </span>
            <span
              style={{
                width: 34,
                textAlign: "right",
                fontSize: 10,
                color: DASH.muted,
                fontWeight: 700,
              }}
            >
              {((it.amt / total) * 100).toFixed(0)}%
            </span>
          </div>
        ))}
        {list.length === 0 && (
          <span style={{ fontSize: 11, color: DASH.muted }}>No data</span>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════ HORIZONTAL BARS ═══════════════════ */
export function HBars({
  items,
  unit = "",
  formatter,
  barHeight = 17,
  gap = 10,
  labelWidth = 150,
  colors = DASH_COLORS,
  colorOffset = 0,
}: {
  items: { name: string; amt: number }[];
  unit?: string;
  formatter?: (v: number) => string;
  barHeight?: number;
  gap?: number;
  labelWidth?: number;
  colors?: string[];
  colorOffset?: number;
}) {
  const list = items ?? [];
  if (list.length === 0)
    return <span style={{ fontSize: 11, color: DASH.muted }}>No data</span>;

  const f = formatter ?? fmtShort;
  const w = 420;
  const h = list.length * (barHeight + gap) + 6;
  const valueW = 78;
  const trackW = w - labelWidth - valueW - 8;
  const max = Math.max(...list.map((i) => i.amt), 1);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h}>
      {list.map((it, idx) => {
        const y = idx * (barHeight + gap) + 2;
        const bw = Math.max(3, trackW * (it.amt / max));
        const label = it.name.length > 26 ? `${it.name.slice(0, 25)}…` : it.name;
        return (
          <g key={`${it.name}-${idx}`}>
            <text x={0} y={y + barHeight - 4} fontSize={10.5} fontWeight={700} fill={DASH.accent}>
              {label}
            </text>
            <rect
              x={labelWidth}
              y={y}
              width={trackW}
              height={barHeight}
              rx={4}
              fill={DASH.soft}
              stroke={DASH.border}
              strokeWidth={0.7}
            />
            <g className="da-grow" style={d(0.06 * idx + 0.1)}>
              <rect
                x={labelWidth}
                y={y}
                width={bw}
                height={barHeight}
                rx={4}
                fill={colors[(idx + colorOffset) % colors.length]}
              >
                <title>{`${it.name}: ${f(it.amt)}${unit}`}</title>
              </rect>
            </g>
            <text
              x={w}
              y={y + barHeight - 4}
              textAnchor="end"
              fontSize={10.5}
              fontWeight={800}
              fill={DASH.dark}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {f(it.amt)}
              {unit}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ═══════════════════ COMBO (area + bars) ═══════════════════ */
export function ComboChart({
  labels,
  area,
  bars,
  height = 196,
  areaName = "Revenue",
  barName = "Bills",
}: {
  labels: string[];
  area: number[];
  bars: number[];
  height?: number;
  areaName?: string;
  barName?: string;
}) {
  const n = labels.length;
  if (!n || area.length !== n)
    return <span style={{ fontSize: 11, color: DASH.muted }}>No data</span>;

  const w = 640;
  const padL = 40;
  const padB = 24;
  const padT = 12;
  const iw = w - padL - 8;
  const ih = height - padB - padT;
  const maxA = Math.max(...area, 1);
  const maxB = Math.max(...bars, 1);
  const step = n > 1 ? iw / (n - 1) : iw;
  const pts = area.map((v, i) => [padL + i * (n > 1 ? step : 0), padT + ih - (v / maxA) * ih] as const);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPath =
    `M${pts[0][0].toFixed(1)},${(padT + ih).toFixed(1)} L` +
    pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" L") +
    ` L${pts[n - 1][0].toFixed(1)},${(padT + ih).toFixed(1)} Z`;
  const bw = Math.max(2.5, (iw / Math.max(n - 1, 1)) * 0.34);

  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height}>
      <path d={areaPath} fill={DASH.band} opacity={0.55} className="da-fade" style={d(0.5)} />
      {bars.map((b, i) => {
        const bh = (b / maxB) * ih * 0.55;
        const x = padL + i * (n > 1 ? step : 0) - bw / 2;
        return (
          <g key={i} className="da-growy" style={d(0.04 * i)}>
            <rect
              x={Math.max(padL - bw / 2, x)}
              y={padT + ih - bh}
              width={bw}
              height={Math.max(1, bh)}
              rx={1.6}
              fill={DASH.dark}
              opacity={0.28}
            >
              <title>{`${labels[i]} — ${b} ${barName.toLowerCase()}`}</title>
            </rect>
          </g>
        );
      })}
      <polyline
        points={line}
        fill="none"
        stroke={DASH.accent}
        strokeWidth={2.2}
        strokeLinejoin="round"
        pathLength={1}
        className="da-line"
      />
      {pts.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={2.8}
          fill="#fff"
          stroke={DASH.accent}
          strokeWidth={1.8}
          className="da-pop"
          style={d(0.05 * i + 0.35)}
        >
          <title>{`${labels[i]} — ${fmtRs(area[i])} ${areaName.toLowerCase()}`}</title>
        </circle>
      ))}
      {[0, 1, 2, 3].map((k) => {
        const gy = padT + (ih * k) / 3;
        return (
          <g key={k}>
            <line
              x1={padL}
              y1={gy}
              x2={w - 8}
              y2={gy}
              stroke={DASH.border}
              strokeWidth={0.7}
              strokeDasharray="3 3"
            />
            <text x={padL - 6} y={gy + 3} textAnchor="end" fontSize={8.5} fill={DASH.muted}>
              {fmtShort(maxA * (1 - k / 3))}
            </text>
          </g>
        );
      })}
      {labels.map((l, i) =>
        i % 2 === 0 ? (
          <text
            key={l + i}
            x={padL + i * (n > 1 ? step : 0)}
            y={height - 6}
            textAnchor="middle"
            fontSize={8.5}
            fill={DASH.muted}
          >
            {l}
          </text>
        ) : null
      )}
    </svg>
  );
}

/* ═══════════════════ HEATMAP ═══════════════════ */
export function Heatmap({
  rows,
  cols,
  values,
  formatter,
  cell = 32,
  rowHeight = 24,
}: {
  rows: string[];
  cols: string[];
  values: number[][];
  formatter?: (v: number) => string;
  cell?: number;
  rowHeight?: number;
}) {
  const max = Math.max(1, ...values.flat());
  const w = cols.length * cell + 62;
  const h = rows.length * rowHeight + 22;
  const f = formatter ?? fmtShort;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h}>
      {cols.map((c, ci) => (
        <text
          key={c + ci}
          x={62 + ci * cell + cell / 2}
          y={12}
          textAnchor="middle"
          fontSize={8}
          fontWeight={700}
          fill={DASH.muted}
        >
          {c}
        </text>
      ))}
      {rows.map((r, ri) => (
        <g key={r + ri}>
          <text
            x={56}
            y={20 + ri * rowHeight + cell * 0.45}
            textAnchor="end"
            fontSize={9.5}
            fontWeight={700}
            fill={DASH.accent}
          >
            {r}
          </text>
          {cols.map((_, ci) => {
            const v = values[ri]?.[ci] ?? 0;
            const t = clamp(v / max, 0, 1);
            const rr = Math.round(0xfc + (0x68 - 0xfc) * t);
            const gg = Math.round(0xf7 + (0x48 - 0xf7) * t);
            const bb = Math.round(0xf3 + (0x30 - 0xf3) * t);
            return (
              <g key={ci} className="da-fadein" style={d(0.02 * (ri * cols.length + ci) + 0.1)}>
                <rect
                  x={62 + ci * cell}
                  y={20 + ri * rowHeight}
                  width={cell - 3}
                  height={cell - 3}
                  rx={4}
                  fill={`rgb(${rr},${gg},${bb})`}
                  stroke={DASH.border}
                  strokeWidth={0.6}
                >
                  <title>{`${r} ${cols[ci]} — ${f(v)}`}</title>
                </rect>
                {v > 0 && (
                  <text
                    x={62 + ci * cell + (cell - 3) / 2}
                    y={20 + ri * rowHeight + (cell - 3) / 2 + 3}
                    textAnchor="middle"
                    fontSize={7.5}
                    fontWeight={700}
                    fill={t > 0.55 ? "#fff" : DASH.muted}
                  >
                    {fmtShort(v)}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      ))}
    </svg>
  );
}

/* ═══════════════════ WATERFALL ═══════════════════ */
export function Waterfall({
  parts,
  height = 200,
}: {
  parts: { label: string; value: number; kind: "base" | "plus" | "minus" | "total" }[];
  height?: number;
}) {
  if (!parts?.length)
    return <span style={{ fontSize: 11, color: DASH.muted }}>No data</span>;

  const w = 600;
  const padT = 18;
  const padB = 34;
  const padL = 44;
  const iw = w - padL - 10;
  const ih = height - padT - padB;

  let accTmp = 0;
  let accMax = 0;
  for (const p of parts) {
    if (p.kind === "base" || p.kind === "total") accTmp = p.value;
    else if (p.kind === "plus") accTmp += p.value;
    else accTmp -= p.value;
    accMax = Math.max(accMax, accTmp, p.value);
  }
  const scale = ih / (accMax || 1);
  const step = iw / parts.length;
  const bw = Math.min(64, step * 0.56);

  let run = 0;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height}>
      {parts.map((p, i) => {
        const cx = padL + i * step + step / 2;
        let y: number;
        let bh: number;
        let fill: string;
        let txt: string;

        if (p.kind === "base") {
          bh = p.value * scale;
          y = padT + ih - bh;
          run = p.value;
          fill = DASH.accent;
          txt = fmtShort(p.value);
        } else if (p.kind === "minus") {
          bh = p.value * scale;
          y = padT + ih - run * scale;
          run -= p.value;
          fill = DASH.bad;
          txt = `−${fmtShort(p.value)}`;
        } else if (p.kind === "plus") {
          run += p.value;
          bh = p.value * scale;
          y = padT + ih - run * scale;
          fill = DASH.good;
          txt = `+${fmtShort(p.value)}`;
        } else {
          bh = p.value * scale;
          y = padT + ih - bh;
          fill = DASH.dark;
          txt = fmtShort(p.value);
        }
        y = Math.max(padT, y);

        return (
          <g key={p.label + i}>
            <g className="da-growy" style={d(0.07 * i + 0.1)}>
              <rect x={cx - bw / 2} y={y} width={bw} height={Math.max(2, bh)} rx={3} fill={fill}>
                <title>{`${p.label}: ${txt}`}</title>
              </rect>
            </g>
            <text
              x={cx}
              y={Math.max(10, y - 4)}
              textAnchor="middle"
              fontSize={9}
              fontWeight={800}
              fill={DASH.dark}
              className="da-fadein"
              style={d(0.09 * i + 0.15)}
            >
              {txt}
            </text>
            <text x={cx} y={height - 14} textAnchor="middle" fontSize={8} fontWeight={700} fill={DASH.muted}>
              {p.label}
            </text>
          </g>
        );
      })}
      <line x1={padL} y1={padT + ih} x2={w - 8} y2={padT + ih} stroke={DASH.border} />
    </svg>
  );
}

/* ═══════════════════ FUNNEL ═══════════════════ */
export function Funnel({
  items,
  colors = DASH_COLORS,
}: {
  items: { label: string; value: number }[];
  colors?: string[];
}) {
  const list = items ?? [];
  if (!list.length)
    return <span style={{ fontSize: 11, color: DASH.muted }}>No data</span>;

  const w = 460;
  const barH = 26;
  const gap = 12;
  const h = list.length * (barH + gap) + 6;
  const base = list[0].value || 1;
  const maxW = w - 150;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h}>
      {list.map((it, i) => {
        const y = i * (barH + gap) + 2;
        const bw = Math.max(6, maxW * (it.value / base));
        return (
          <g key={it.label}>
            <text x={0} y={y + barH - 8} fontSize={10.5} fontWeight={700} fill={DASH.accent}>
              {it.label}
            </text>
            <rect
              x={112}
              y={y}
              width={maxW}
              height={barH}
              rx={13}
              fill={DASH.soft}
              stroke={DASH.border}
              strokeWidth={0.7}
            />
            <g className="da-grow" style={d(0.09 * i + 0.1)}>
              <rect
                x={112}
                y={y}
                width={bw}
                height={barH}
                rx={13}
                fill={colors[i % colors.length]}
              >
                <title>{`${it.label}: ${fmtInt(it.value)}`}</title>
              </rect>
            </g>
            <text
              x={w}
              y={y + barH - 8}
              textAnchor="end"
              fontSize={10.5}
              fontWeight={800}
              fill={DASH.dark}
              className="da-fadein"
              style={d(0.1 * i + 0.2)}
            >
              {fmtInt(it.value)} · {((it.value / base) * 100).toFixed(0)}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ═══════════════════ empty / loading ═══════════════════ */
export function EmptyBlock({ text = "No data for the selected range." }: { text?: string }) {
  return (
    <div
      style={{
        border: `1px dashed ${DASH.border}`,
        borderRadius: 10,
        background: DASH.soft,
        padding: "22px 12px",
        textAlign: "center",
        fontSize: 11.5,
        color: DASH.muted,
      }}
    >
      {text}
    </div>
  );
}

export function LoadingBlock({ text = "Loading…" }: { text?: string }) {
  return (
    <div style={{ padding: "26px 12px", textAlign: "center", fontSize: 11.5, color: DASH.muted }}>
      {text}
    </div>
  );
}
