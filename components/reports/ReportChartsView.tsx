"use client";

// ============================================================
// LOCATION: components/reports/ReportChartsView.tsx
// Renders the per-report ChartModel[] list as a card grid:
// grouped/stacked bar charts, donut pies and horizontal
// rankings — flat blue palette, no gradients. All values come
// from the report's own table data (reportCharts.ts).
// ============================================================
import type { ChartModel } from "./reportCharts";

const COLORS = ["#1d4ed8", "#60a5fa", "#0d2b57", "#93c5fd", "#3b82f6", "#bfdbfe", "#2563eb", "#64748b"];

const fmtVal = (v: number, unit: ChartModel["unit"]) =>
  unit === "currency"
    ? v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : v.toLocaleString("en-US", { maximumFractionDigits: 2 });

const shortTick = (v: number) =>
  Math.abs(v) >= 1000 ? `${Math.round(v / 100) / 10}k` : `${Math.round(v * 100) / 100}`;

function Legend({ chart }: { chart: ChartModel }) {
  if (chart.kind !== "bars" || chart.series.length < 2) return null;
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
      {chart.series.map((s, i) => (
        <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, color: "#475569", fontFamily: "Inter, sans-serif", fontWeight: 600 }}>
          <span style={{ width: 9, height: 9, borderRadius: 2, background: COLORS[i % COLORS.length], display: "inline-block" }} />
          {s}
        </span>
      ))}
    </div>
  );
}

function BarsChart({ chart }: { chart: ChartModel }) {
  const max = Math.max(1, ...chart.points.map((p) => Math.max(...p.values, 0)));
  const every = Math.max(1, Math.ceil(chart.points.length / 12));
  return (
    <div>
      <Legend chart={chart} />
      <div style={{ position: "relative", height: 190 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: `${(i / 4) * 160}px`,
              borderTop: i === 4 ? "1px solid #94a3b8" : "1px dashed #e2e8f0",
            }}
          >
            <span style={{ position: "absolute", left: 0, top: -7, fontSize: 9, color: "#94a3b8", fontFamily: "Inter, sans-serif", background: "#fff", paddingRight: 4 }}>
              {shortTick(max * (1 - i / 4))}
            </span>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 160, marginLeft: 40, paddingLeft: 4 }}>
          {chart.points.map((p) => (
            <div key={p.label} style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 2, height: "100%" }}>
              {p.values.map((v, i) => (
                <div
                  key={i}
                  title={`${p.label} · ${chart.series[i]}: ${fmtVal(v, chart.unit)}`}
                  style={{
                    flex: 1,
                    height: `${Math.max(v > 0 ? 2 : 0, (v / max) * 100)}%`,
                    background: COLORS[i % COLORS.length],
                    borderRadius: "3px 3px 0 0",
                  }}
                />
              ))}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 4, marginLeft: 40, paddingLeft: 4, marginTop: 4 }}>
          {chart.points.map((p, pi) => (
            <div key={p.label} style={{ flex: 1, textAlign: "center", fontSize: 8.5, color: "#64748b", fontFamily: "Inter, sans-serif", overflow: "hidden", whiteSpace: "nowrap" }}>
              {pi % every === 0 ? p.label : ""}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PieChart({ chart }: { chart: ChartModel }) {
  const total = chart.points.reduce((s, p) => s + Math.max(0, p.values[0]), 0);
  if (total <= 0) return null;
  let acc = 0;
  const R = 62;
  const C = 70;
  const arcs = chart.points
    .filter((p) => p.values[0] > 0)
    .map((p, i) => {
      const frac = p.values[0] / total;
      const a0 = acc * 2 * Math.PI - Math.PI / 2;
      acc += frac;
      const a1 = acc * 2 * Math.PI - Math.PI / 2;
      const large = frac > 0.5 ? 1 : 0;
      const x0 = C + R * Math.cos(a0);
      const y0 = C + R * Math.sin(a0);
      const x1 = C + R * Math.cos(a1);
      const y1 = C + R * Math.sin(a1);
      return { d: `M ${C} ${C} L ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} Z`, color: COLORS[i % COLORS.length], p, frac };
    });
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
      <svg width={140} height={140} viewBox="0 0 140 140">
        {arcs.map((a, i) => (
          <path key={i} d={a.d} fill={a.color} stroke="#fff" strokeWidth={1}>
            <title>{`${a.p.label}: ${fmtVal(a.p.values[0], chart.unit)} (${Math.round(a.frac * 100)}%)`}</title>
          </path>
        ))}
        <circle cx={C} cy={C} r={30} fill="#fff" />
        <text x={C} y={C + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill="#0d2b57" fontFamily="Inter, sans-serif">
          {shortTick(total)}
        </text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 150 }}>
        {arcs
          .slice()
          .sort((a, b) => b.frac - a.frac)
          .slice(0, 8)
          .map((a) => (
            <div key={a.p.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: "#334155", fontFamily: "Inter, sans-serif" }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: a.color, flexShrink: 0 }} />
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>{a.p.label}</span>
              <span style={{ color: "#64748b", fontVariantNumeric: "tabular-nums" }}>{Math.round(a.frac * 100)}%</span>
            </div>
          ))}
      </div>
    </div>
  );
}

function HBarsChart({ chart }: { chart: ChartModel }) {
  const max = Math.max(1, ...chart.points.map((p) => p.values[0]));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {chart.points.map((p, i) => (
        <div key={p.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span title={p.label} style={{ width: 130, fontSize: 10.5, color: "#334155", fontFamily: "Inter, sans-serif", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0 }}>
            {p.label}
          </span>
          <div style={{ flex: 1, height: 14, background: "#eff6ff", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: `${(p.values[0] / max) * 100}%`, height: "100%", background: COLORS[i % 2 === 0 ? 0 : 2], borderRadius: 4 }} title={`${p.label}: ${fmtVal(p.values[0], chart.unit)}`} />
          </div>
          <span style={{ width: 90, textAlign: "right", fontSize: 10.5, color: "#0d2b57", fontFamily: "Inter, sans-serif", fontWeight: 700, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
            {fmtVal(p.values[0], chart.unit)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function ReportChartsView({ charts, title }: { charts: ChartModel[]; title: string }) {
  if (charts.length === 0)
    return (
      <p style={{ padding: 40, textAlign: "center", color: "#64748b", fontFamily: "Inter, sans-serif", fontSize: 13 }}>
        No chart data for this report yet.
      </p>
    );
  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#64748b", fontFamily: "Inter, sans-serif" }}>
        {title} — charts from this report's data
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
        {charts.map((c) => (
          <div
            key={c.id}
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              padding: "12px 14px",
              flex: c.kind === "bars" ? "2 1 420px" : "1 1 320px",
              minWidth: 0,
            }}
          >
            <p style={{ margin: "0 0 10px", fontSize: 12.5, fontWeight: 700, color: "#0d2b57", fontFamily: "Inter, sans-serif" }}>
              {c.title}
            </p>
            {c.kind === "bars" ? <BarsChart chart={c} /> : c.kind === "pie" ? <PieChart chart={c} /> : <HBarsChart chart={c} />}
          </div>
        ))}
      </div>
    </div>
  );
}
