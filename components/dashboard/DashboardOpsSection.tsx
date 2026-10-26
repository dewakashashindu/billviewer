"use client";

// ============================================================
// LOCATION: components/dashboard/DashboardOpsSection.tsx  (ALUTH FILE)
//
// Tab 1 — "Live" : sales / payments / items
//   • date range controller ekak — DEFAULT eka "Today" (presets + custom)
//   • location selector ekak thiyenawa (All Locations + outlets)
//   • English copy only — DB / table names penenne naha
//   • animations: KPI count-up, card stagger, bars grow, donut draw,
//     line draw, heatmap stagger (tab switch kalama aye run wenawa)
// ============================================================
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getDashboardOpsAction,
  type DashboardOpsData,
  type OpsLocation,
} from "@/app/actions/dashboardOps";
import { demoOps } from "./demoData";
import RangeController, { presetRange, type RangePreset } from "./RangeController";
import {
  ChartCard,
  ComboChart,
  DASH,
  DashStyles,
  Donut,
  EmptyBlock,
  HBars,
  Heatmap,
  KpiCard,
  LoadingBlock,
  SectionShell,
  Waterfall,
  fmtInt,
  fmtRs,
  fmtRs2,
  fmtShort,
  gridStyle,
  kpiGridStyle,
} from "./charts";

const HOUR_LABEL = Array.from({ length: 24 }, (_, h) => (h < 10 ? `0${h}` : String(h)));
const DAY_LABEL = (iso: string) => {
  const dd = new Date(`${iso}T00:00:00`);
  if (isNaN(dd.getTime())) return iso;
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dd.getDay()];
  return `${wd} ${dd.getDate()}`;
};

/** local business date (YYYY-MM-DD) — toISOString epa (UTC shift bug) */
const todayIso = () => {
  const n = new Date();
  const p = (v: number) => String(v).padStart(2, "0");
  return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}`;
};
const prettyToday = () => {
  const n = new Date();
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][n.getDay()];
  const mo = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][
    n.getMonth()
  ];
  return `${wd}, ${n.getDate()} ${mo} ${n.getFullYear()}`;
};

/* ── location selector ── */
function LocationPicker({
  value,
  options,
  onChange,
  disabled,
}: {
  value: string;
  options: OpsLocation[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        border: `1px solid ${DASH.border}`,
        background: "#fff",
        borderRadius: 9,
        padding: "5px 9px",
      }}
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke={DASH.accent}
        strokeWidth="1.9"
        strokeLinecap="round"
      >
        <path d="M21 10c0 7-9 12-9 12S3 17 3 10a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
      <span
        style={{
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: 0.7,
          color: DASH.muted,
        }}
      >
        LOCATION
      </span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        style={{
          border: "none",
          outline: "none",
          background: "transparent",
          fontFamily: "inherit",
          fontSize: 11.5,
          fontWeight: 800,
          color: DASH.accent,
          cursor: disabled ? "not-allowed" : "pointer",
          maxWidth: 170,
        }}
      >
        <option value="">All Locations</option>
        {options.map((o) => (
          <option key={o.code} value={o.code}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function DashboardOpsSection({
  /** true = server action call nokara local demo data (public preview) */
  demoOnly = false,
  /** tab active da nattam da — active weddi animations aye run wenawa */
  active = true,
}: {
  demoOnly?: boolean;
  active?: boolean;
} = {}) {
  /* Live default = Today (presets walin maru karanna puluwan) */
  const initToday = useMemo(() => presetRange("today"), []);
  const [from, setFrom] = useState(initToday.from);
  const [to, setTo] = useState(initToday.to);
  const [preset, setPreset] = useState<RangePreset | undefined>("today");
  const [loc, setLoc] = useState("");
  const [fetched, setFetched] = useState<DashboardOpsData | null>(null);
  const [demo, setDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runId, setRunId] = useState(1);
  const paneRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async (f: string, t: string, l: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getDashboardOpsAction({ from: f, to: t, loc: l });
      if (res.success && res.data) {
        setFetched(res.data);
        setDemo(Boolean(res.demo));
      } else {
        setError(res.error || "Could not load live operations data");
      }
    } catch {
      setError("Could not load live operations data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (demoOnly) return;
    load(from, to, loc);
  }, [from, to, loc, load, demoOnly]);

  /* midnight rollover — "Today" preset eke thiyenakota dawasa maru unoth update */
  useEffect(() => {
    if (preset !== "today") return;
    const id = setInterval(() => {
      const t = todayIso();
      if (t !== from) {
        setFrom(t);
        setTo(t);
      }
    }, 60_000);
    return () => clearInterval(id);
  }, [from, preset]);

  /* animations — tab ekata awama aye run karanna */
  useEffect(() => {
    if (!active) return;
    const el = paneRef.current;
    if (el) {
      el.classList.remove("dashgo");
      void el.offsetWidth;
      el.classList.add("dashgo");
    }
    setRunId((r) => r + 1);
  }, [active, loading]);

  const localDemo = useMemo(() => (demoOnly ? demoOps(from, to, loc) : null), [demoOnly, from, to, loc]);
  const data: DashboardOpsData | null = demoOnly ? localDemo : fetched;
  const busy = demoOnly ? false : loading;

  /* derived */
  const hours = data?.hourly ?? [];
  const hourlyLabels = hours.map((h) => HOUR_LABEL[h.hour] ?? String(h.hour));
  const hourlyNet = hours.map((h) => h.net);
  const hourlyBills = hours.map((h) => h.bills);

  const heatDays = data?.days ?? [];
  const heatValues = heatDays.map((day) =>
    Array.from({ length: 14 }, (_, i) => {
      const cell = data?.heat.find((x) => x.day === day && x.hour === i + 10);
      return cell?.net ?? 0;
    })
  );
  const heatCols = HOUR_LABEL.slice(10, 24);

  const t = data?.totals;
  const collected = (data?.payModes ?? []).reduce((s, p) => s + p.amt, 0);
  const billCount = t?.bills ?? 0;
  const locOptions = data?.locations ?? [];
  const periodLabel =
    preset === "today"
      ? "today"
      : preset === "yesterday"
      ? "yesterday"
      : `${from} → ${to}`;

  return (
    <>
      <DashStyles />
      <SectionShell
        paneRef={paneRef}
        kicker="LIVE OPERATIONS"
        title="Sales & Payments"
        desc="Sales, payments and item performance for the selected period. The default is today."
        right={
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            <RangeController
              from={from}
              to={to}
              preset={preset}
              disabled={busy}
              compact
              onChange={(f, t) => {
                setPreset(undefined); // custom
                setFrom(f);
                setTo(t || f);
              }}
            />
            <LocationPicker value={loc} options={locOptions} onChange={setLoc} disabled={busy} />
          </div>
        }
      >
        {!demoOnly && demo && (
          <div
            style={{
              border: `1px dashed ${DASH.border}`,
              background: DASH.soft,
              borderRadius: 9,
              padding: "7px 11px",
              fontSize: 11,
              color: DASH.accent,
              marginBottom: 11,
            }}
          >
            <b>Demo data</b> — the database is not connected yet, so sample numbers are shown.
          </div>
        )}

        {busy ? (
          <LoadingBlock text="Loading live operations…" />
        ) : error ? (
          <EmptyBlock text={error} />
        ) : !data ? (
          <EmptyBlock />
        ) : (
          <>
            <div style={kpiGridStyle}>
              <KpiCard
                label="NET SALES"
                value={fmtRs(t?.net ?? 0)}
                sub={periodLabel}
                animKey={runId}
                delay={0}
              />
              <KpiCard
                label="BILLS"
                value={fmtInt(billCount)}
                sub={periodLabel}
                animKey={runId}
                delay={0.05}
              />
              <KpiCard
                label="AVG BILL"
                value={fmtRs2(t?.avgBill ?? 0)}
                sub="per bill"
                animKey={runId}
                delay={0.1}
              />
              <KpiCard
                label="GUESTS"
                value={fmtInt(t?.pax ?? 0)}
                sub={`${(t?.avgPax ?? 0).toFixed(1)} guests / bill`}
                animKey={runId}
                delay={0.15}
              />
              <KpiCard
                label="SERVICE CHARGE"
                value={fmtRs(t?.serviceCharge ?? 0)}
                sub="service charge collected"
                animKey={runId}
                delay={0.2}
              />
              <KpiCard
                label="TAX"
                value={fmtRs((t?.vat ?? 0) + (t?.tdl ?? 0))}
                sub="VAT and TDL"
                animKey={runId}
                delay={0.25}
              />
            </div>

            <div style={gridStyle}>
              <ChartCard
                title="Sales & Order Flow"
                sub="Revenue by hour with bill count"
                span={2}
                delay={0.05}
              >
                {hours.length ? (
                  <ComboChart
                    labels={hourlyLabels}
                    area={hourlyNet}
                    bars={hourlyBills}
                    areaName="Revenue"
                    barName="Bills"
                  />
                ) : (
                  <EmptyBlock />
                )}
              </ChartCard>

              <ChartCard title="Payment Modes" sub="How guests paid in this period" delay={0.1}>
                {data.payModes.length ? (
                  <Donut
                    items={data.payModes}
                    centerTop={fmtShort(collected)}
                    centerSub="COLLECTED"
                  />
                ) : (
                  <EmptyBlock />
                )}
              </ChartCard>

              <ChartCard title="Order Modes" sub="Dine-in, take away and delivery split" delay={0.15}>
                {data.orderModes.length ? (
                  <Donut items={data.orderModes} centerTop={fmtInt(billCount)} centerSub="BILLS" />
                ) : (
                  <EmptyBlock />
                )}
              </ChartCard>

              <ChartCard title="Bill Types" sub="Sales by bill type" delay={0.2}>
                {data.billTypes.length ? (
                  <HBars items={data.billTypes} formatter={fmtShort} colorOffset={2} />
                ) : (
                  <EmptyBlock />
                )}
              </ChartCard>

              <ChartCard title="Top Items by Revenue" sub="Best performing menu items" delay={0.25}>
                {data.topItemsRev.length ? (
                  <HBars items={data.topItemsRev} formatter={fmtShort} />
                ) : (
                  <EmptyBlock />
                )}
              </ChartCard>

              <ChartCard title="Top Items by Quantity" sub="Most ordered menu items" delay={0.3}>
                {data.topItemsQty.length ? (
                  <HBars items={data.topItemsQty} formatter={(v) => fmtInt(v)} colorOffset={4} />
                ) : (
                  <EmptyBlock />
                )}
              </ChartCard>

              <ChartCard title="Peak Hours" sub="Sales density by hour" span={2} delay={0.35}>
                {heatDays.length ? (
                  <Heatmap
                    rows={heatDays.map(DAY_LABEL)}
                    cols={heatCols}
                    values={heatValues}
                    formatter={fmtShort}
                  />
                ) : (
                  <EmptyBlock />
                )}
              </ChartCard>

              <ChartCard title="Bill Composition" sub="From gross sales to net total" delay={0.4}>
                <Waterfall
                  parts={[
                    { label: "Gross", value: t?.gross ?? 0, kind: "base" },
                    { label: "Discount", value: t?.discount ?? 0, kind: "minus" },
                    { label: "Service", value: t?.serviceCharge ?? 0, kind: "plus" },
                    { label: "VAT", value: t?.vat ?? 0, kind: "plus" },
                    { label: "TDL", value: t?.tdl ?? 0, kind: "plus" },
                    { label: "Net Total", value: t?.net ?? 0, kind: "total" },
                  ]}
                />
              </ChartCard>

              <ChartCard title="Cashier Performance" sub="Sales handled by each cashier" delay={0.45}>
                {data.cashiers.length ? (
                  <HBars items={data.cashiers} formatter={fmtShort} colorOffset={1} />
                ) : (
                  <EmptyBlock />
                )}
              </ChartCard>
            </div>
          </>
        )}
      </SectionShell>
    </>
  );
}
