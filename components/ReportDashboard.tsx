"use client";

// ============================================================
// LOCATION: components/ReportDashboard.tsx
// ✅ FLAT PROFESSIONAL BLUE Analytics View — GRADIENTS NAE:
//      1. SOLID NAVY HERO — big total + flat stat chips
//      2. Daily Trend — band-scale flat bars + line + hover tooltip
//      3. Order Mode donut — flat segments + % pills
//      4. Bill Type tiles — compact flat stat tiles
//      5. Ranking — flat progress list
//    Chart library ekak NAE — okkoma hand-drawn SVG.
//    Data: page eken fetch karapu eka itself (computeAnalytics).
// ============================================================

import { useState } from "react";
import type { CSSProperties } from "react";
import type { Analytics, AnaPoint } from "./reports/analytics";
import {
  IconTrendingUp,
  IconReceipt,
  IconCoins,
  IconTrophy,
} from "./reports/ReportIcons";

// ── flat blue theme ──
const NAVY = "#0d2b57";
const INK = "#0f172a";
const MUTED = "#64748b";
const FAINT = "#94a3b8";
const LINE = "#1d4ed8";
const BAR = "#93c5fd";
const BAR_HOVER = "#60a5fa";
const SOFT = "#eff6ff";
const BORDER = "#e5eaf3";

const BLUES = ["#1d4ed8", "#0ea5e9", "#3b82f6", "#60a5fa", "#1e40af", "#93c5fd", "#38bdf8", "#bfdbfe"];
const TYPE_COLORS: Record<string, string> = { SD: "#1d4ed8", CM: "#0ea5e9", CO: "#93c5fd" };

// ── formatting ─
const fmtRs = (n: number) =>
  "Rs. " + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtC = (n: number) =>
  n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e5 ? 0 : 1) + "k" : String(Math.round(n));
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtD = (d: string) => {
  const p = d.includes("-") ? d.split("-") : d.includes("/") ? d.split("/") : null;
  if (!p || p.length !== 3) return d;
  const dd = p[0].length === 4 ? p[2] : p[0];
  return `${dd} ${MON[Number(p[1]) - 1] ?? ""}`;
};
const niceMax = (v: number) => {
  if (v <= 0) return 100;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const d = v / p;
  return (d <= 1 ? 1 : d <= 2 ? 2 : d <= 5 ? 5 : 10) * p;
};
const tabular: CSSProperties = { fontVariantNumeric: "tabular-nums" };

// smooth curve (catmull-rom → bezier) — pure helper, points 3+ vitara
function smoothPath(pts: { x: number; y: number }[]) {
  if (pts.length < 3)
    return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += ` C${(p1.x + (p2.x - p0.x) / 6).toFixed(1)},${(p1.y + (p2.y - p0.y) / 6).toFixed(1)} ${(p2.x - (p3.x - p1.x) / 6).toFixed(1)},${(p2.y - (p3.y - p1.y) / 6).toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

function donutSegments(values: number[], C: number) {
  const total = values.reduce((s, v) => s + v, 0);
  let acc = 0;
  return values.map((v) => {
    const len = total > 0 ? (v / total) * C : 0;
    const seg = { len, off: -acc };
    acc += len;
    return seg;
  });
}

// ── shared shell ──
const card: CSSProperties = {
  background: "#ffffff",
  border: `1px solid ${BORDER}`,
  borderRadius: 14,
  padding: "18px 20px",
  boxShadow: "0 1px 2px rgba(2,6,23,.05)",
};
const cardHead: CSSProperties = {
  margin: 0,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: ".08em",
  textTransform: "uppercase",
  color: MUTED,
  fontFamily: "Inter, sans-serif",
};

// ═══════════════ HERO (solid navy — no gradients) ═══════════════
function Hero({ a }: { a: Analytics }) {
  const chip: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "rgba(255,255,255,.07)",
    border: "1px solid rgba(255,255,255,.16)",
    borderRadius: 10,
    padding: "10px 14px",
  };
  const chipLbl: CSSProperties = {
    margin: 0,
    fontSize: 9.5,
    fontWeight: 700,
    letterSpacing: ".08em",
    textTransform: "uppercase",
    color: "rgba(255,255,255,.6)",
    fontFamily: "Inter, sans-serif",
  };
  const chipVal: CSSProperties = {
    margin: "2px 0 0",
    fontSize: 15,
    fontWeight: 800,
    color: "#fff",
    fontFamily: "Inter, sans-serif",
    whiteSpace: "nowrap",
    ...tabular,
  };
  return (
    <div
      style={{
        borderRadius: 14,
        padding: "22px 26px",
        background: NAVY,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 18,
        flexWrap: "wrap",
      }}
    >
      <div>
        <p style={{ margin: 0, fontSize: 10.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(255,255,255,.62)", fontFamily: "Inter, sans-serif" }}>
          Total Sales
        </p>
        <p style={{ margin: "6px 0 0", fontSize: 30, fontWeight: 800, color: "#fff", fontFamily: "Inter, sans-serif", ...tabular }}>
          {fmtRs(a.totalSales)}
        </p>
        <p style={{ margin: "6px 0 0", fontSize: 11, color: "rgba(255,255,255,.55)", fontFamily: "Inter, sans-serif" }}>
          net of discounts & taxes — auto-generated from report data
        </p>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={chip}>
          <span style={{ color: "#93c5fd" }}><IconReceipt size={18} /></span>
          <div>
            <p style={chipLbl}>Bills</p>
            <p style={chipVal}>{a.billCount.toLocaleString("en-US")}</p>
          </div>
        </div>
        <div style={chip}>
          <span style={{ color: "#93c5fd" }}><IconCoins size={18} /></span>
          <div>
            <p style={chipLbl}>Avg Bill</p>
            <p style={chipVal}>{fmtRs(a.avgBill)}</p>
          </div>
        </div>
        <div style={chip}>
          <span style={{ color: "#93c5fd" }}><IconTrophy size={18} /></span>
          <div>
            <p style={chipLbl}>{a.top?.kind === "item" ? "Top Item" : "Top Location"}</p>
            <p style={{ ...chipVal, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }}>{a.top?.label ?? "—"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════ TREND (band-scale flat bars + line) ═══════════════
function TrendChart({ data }: { data: AnaPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 920;
  const H = 280;
  const PL = 58;
  const PR = 14;
  const PT = 24;
  const PB = 30;
  const iw = W - PL - PR;
  const ih = H - PT - PB;
  const n = data.length;
  const max = niceMax(Math.max(...data.map((d) => d.value), 1));
  const slot = iw / n;
  const xc = (i: number) => PL + slot * (i + 0.5);
  const y = (v: number) => PT + ih - (v / max) * ih;
  const bw = Math.min(slot * 0.55, 90);
  const pts = data.map((d, i) => ({ x: xc(i), y: y(d.value) }));
  const line = smoothPath(pts);
  const step = Math.max(1, Math.ceil(n / 12));

  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
        {[0, 1, 2, 3, 4].map((t) => {
          const v = (max * t) / 4;
          const gy = y(v);
          return (
            <g key={t}>
              <line x1={PL} x2={W - PR} y1={gy} y2={gy} stroke={t === 0 ? "#cbd5e1" : "#eef2f7"} strokeWidth={1} />
              <text x={PL - 8} y={gy + 3.5} fontSize={10} fill={FAINT} textAnchor="end" fontFamily="Inter, sans-serif" style={tabular}>
                {fmtC(v)}
              </text>
            </g>
          );
        })}

        {/* flat bars — band scale (dates adu unath hariyata penawa) */}
        {data.map((d, i) => {
          const h = Math.max((d.value / max) * ih, 3);
          return (
            <rect
              key={`b-${d.label}-${i}`}
              x={xc(i) - bw / 2}
              y={PT + ih - h}
              width={bw}
              height={h}
              rx={5}
              fill={hover === i ? BAR_HOVER : BAR}
            />
          );
        })}

        {/* value labels (points 12k adu nam) */}
        {n <= 12 &&
          data.map((d, i) => (
            <text
              key={`v-${d.label}-${i}`}
              x={xc(i)}
              y={y(d.value) - 8}
              fontSize={10.5}
              fontWeight={700}
              fill={NAVY}
              textAnchor="middle"
              fontFamily="Inter, sans-serif"
              style={tabular}
            >
              {fmtC(d.value)}
            </text>
          ))}

        {/* hover guide */}
        {hover !== null && (
          <line x1={xc(hover)} x2={xc(hover)} y1={PT} y2={PT + ih} stroke={BAR_HOVER} strokeDasharray="3 4" strokeWidth={1.2} />
        )}

        {/* line + dots */}
        {n > 1 && <path d={line} fill="none" stroke={LINE} strokeWidth={2.2} strokeLinecap="round" />}
        {pts.map((p, i) => (
          <circle key={`d-${i}`} cx={p.x} cy={p.y} r={hover === i ? 5 : 3.5} fill="#fff" stroke={LINE} strokeWidth={2} />
        ))}

        {/* x labels + hit areas */}
        {data.map((d, i) => (
          <g key={`x-${d.label}-${i}`}>
            {(i % step === 0 || i === n - 1) && (
              <text x={xc(i)} y={H - 8} fontSize={10} fill={MUTED} textAnchor="middle" fontFamily="Inter, sans-serif">
                {fmtD(d.label)}
              </text>
            )}
            <rect
              x={PL + slot * i}
              y={PT}
              width={slot}
              height={ih}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: "pointer" }}
            />
          </g>
        ))}
      </svg>

      {hover !== null && (
        <div
          style={{
            position: "absolute",
            left: `${(xc(hover) / W) * 100}%`,
            top: `${(y(data[hover].value) / H) * 100}%`,
            transform: "translate(-50%, -120%)",
            background: NAVY,
            color: "#fff",
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 11,
            fontFamily: "Inter, sans-serif",
            pointerEvents: "none",
            whiteSpace: "nowrap",
            boxShadow: "0 8px 20px -10px rgba(13,43,87,.55)",
            zIndex: 5,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 2 }}>{fmtD(data[hover].label)}</div>
          <div style={{ color: "#93c5fd", fontWeight: 700, ...tabular }}>{fmtRs(data[hover].value)}</div>
          <div style={{ color: FAINT, ...tabular }}>{data[hover].bills} bills</div>
        </div>
      )}
    </div>
  );
}

// ═══════════════ DONUT (flat) ═══════════════
function Donut({ data }: { data: AnaPoint[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const R = 72;
  const C = 2 * Math.PI * R;
  const segs = donutSegments(
    data.map((d) => d.value),
    C
  );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
      <svg viewBox="0 0 200 200" style={{ width: 165, height: 165, flexShrink: 0 }}>
        <circle cx={100} cy={100} r={R} fill="none" stroke={SOFT} strokeWidth={22} />
        <g transform="rotate(-90 100 100)">
          {data.map((d, i) => (
            <circle
              key={d.label}
              cx={100}
              cy={100}
              r={R}
              fill="none"
              stroke={BLUES[i % BLUES.length]}
              strokeWidth={22}
              strokeDasharray={`${Math.max(segs[i].len - 3, 1)} ${C - Math.max(segs[i].len - 3, 1)}`}
              strokeDashoffset={segs[i].off - 1.5}
            />
          ))}
        </g>
        <text x={100} y={94} textAnchor="middle" fontSize={20} fontWeight={800} fill={NAVY} fontFamily="Inter, sans-serif" style={tabular}>
          {fmtC(total)}
        </text>
        <text x={100} y={112} textAnchor="middle" fontSize={9.5} letterSpacing=".08em" fill={FAINT} fontFamily="Inter, sans-serif" style={{ textTransform: "uppercase" }}>
          Total
        </text>
      </svg>
      <div style={{ flex: 1, minWidth: 170, display: "flex", flexDirection: "column", gap: 10 }}>
        {data.map((d, i) => {
          const pct = total > 0 ? (d.value / total) * 100 : 0;
          return (
            <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12, fontFamily: "Inter, sans-serif" }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: BLUES[i % BLUES.length], flexShrink: 0 }} />
              <span style={{ color: "#334155", fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.label}</span>
              <span style={{ background: SOFT, color: LINE, fontWeight: 700, fontSize: 10.5, borderRadius: 999, padding: "2px 8px", ...tabular }}>{pct.toFixed(1)}%</span>
              <span style={{ color: NAVY, fontWeight: 800, width: 54, textAlign: "right", ...tabular }}>{fmtC(d.value)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════ BILL TYPE TILES (compact, flat) ═══════════════
function TypeTiles({ data }: { data: AnaPoint[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 210px))", gap: 10 }}>
      {data.map((d) => {
        const pct = total > 0 ? (d.value / total) * 100 : 0;
        const c = TYPE_COLORS[d.label] ?? BLUES[3];
        return (
          <div key={d.label} style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: "12px 14px", background: "#fbfdff", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: c }} />
            <p style={{ margin: "4px 0 0", fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: MUTED, fontFamily: "Inter, sans-serif" }}>{d.label}</p>
            <p style={{ margin: "6px 0 0", fontSize: 19, fontWeight: 800, color: NAVY, fontFamily: "Inter, sans-serif", ...tabular }}>{pct.toFixed(1)}%</p>
            <p style={{ margin: "3px 0 0", fontSize: 11, color: FAINT, fontFamily: "Inter, sans-serif", ...tabular }}>{fmtRs(d.value)}</p>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════ RANKING (flat progress list) ═══════════════
function Ranking({ data }: { data: AnaPoint[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
      {data.map((d, i) => (
        <div key={d.label}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5 }}>
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10.5,
                fontWeight: 800,
                fontFamily: "Inter, sans-serif",
                background: i === 0 ? LINE : SOFT,
                color: i === 0 ? "#fff" : LINE,
                flexShrink: 0,
                ...tabular,
              }}
            >
              {i + 1}
            </span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "#334155", fontFamily: "Inter, sans-serif", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={d.label}>
              {d.label}
            </span>
            <span style={{ fontSize: 12.5, fontWeight: 800, color: NAVY, fontFamily: "Inter, sans-serif", ...tabular }}>Rs. {fmtC(d.value)}</span>
          </div>
          <div style={{ marginLeft: 32, height: 8, borderRadius: 4, background: SOFT, overflow: "hidden" }}>
            <div
              style={{
                width: `${(d.value / max) * 100}%`,
                height: "100%",
                borderRadius: 4,
                background: i === 0 ? LINE : BAR,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════ MAIN ═══════════════
export default function ReportDashboard({ analytics, title }: { analytics: Analytics; title: string }) {
  const a = analytics;
  const ranking = a.byLocation.length >= 2 ? a.byLocation.slice(0, 7) : a.topItems;
  const rankingTitle = a.byLocation.length >= 2 ? "Location Performance" : "Top Selling Items";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Hero a={a} />

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        {a.byDate.length > 0 && (
          <div style={{ ...card, flex: "5 1 480px", minWidth: 0 }}>
            <p style={cardHead}>Daily Sales Trend</p>
            <div style={{ marginTop: 12 }}>
              <TrendChart data={a.byDate} />
            </div>
          </div>
        )}
        {a.byMode.length > 0 && (
          <div style={{ ...card, flex: "2 1 300px", minWidth: 0 }}>
            <p style={cardHead}>Order Mode Split</p>
            <div style={{ marginTop: 14 }}>
              <Donut data={a.byMode} />
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        {ranking.length > 0 && (
          <div style={{ ...card, flex: "3 1 380px", minWidth: 0 }}>
            <p style={cardHead}>{rankingTitle}</p>
            <div style={{ marginTop: 14 }}>
              <Ranking data={ranking} />
            </div>
          </div>
        )}
        {a.byType.length > 0 && (
          <div style={{ ...card, flex: "2 1 300px", minWidth: 0 }}>
            <p style={cardHead}>Bill Type Share</p>
            <div style={{ marginTop: 14 }}>
              <TypeTiles data={a.byType} />
            </div>
          </div>
        )}
      </div>

      <p style={{ margin: 0, fontSize: 10.5, color: FAINT, fontFamily: "Inter, sans-serif" }}>
        Analytics — {title} · auto-generated from this report&apos;s data, no extra database calls
      </p>
    </div>
  );
}
