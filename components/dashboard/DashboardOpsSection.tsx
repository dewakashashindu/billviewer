"use client";
import {useFeedbackState} from "@/components/FeedbackPopup";
import {displayMessage} from "@/lib/displayMessage";

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
import { getOpenTablesAction } from "@/app/actions/reports";
import type { OpenTablesData } from "@/components/reports/OpenTablesReport";
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

const fmtAmtDash = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
  /** range eka "today" da kiyala parent ekata kiyanawa (Live tab pulse ekata) */
  onLiveTodayChange,
}: {
  demoOnly?: boolean;
  active?: boolean;
  onLiveTodayChange?: (isToday: boolean) => void;
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
  const [error, setError] = useFeedbackState<string | null>(null,'error');
  const [runId, setRunId] = useState(1);
  /* Ongoing (open) tables — Today (Live) ekadi witharak */
  const [openTables, setOpenTables] = useState<OpenTablesData | null>(null);
  const [showTables, setShowTables] = useState(false);
  const paneRef = useRef<HTMLDivElement | null>(null);
  const locationInitialized = useRef(false);

  const load = useCallback(async (f: string, t: string, l: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getDashboardOpsAction({ from: f, to: t, loc: l });
      if (res.success && res.data) {
        setFetched(res.data);
        if (!locationInitialized.current) { locationInitialized.current=true; if(res.data.defaultLocation) setLoc(res.data.defaultLocation); }
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

  /* parent ekata kiyanawa range eka today da kiyala (Live tab pulse) */
  useEffect(() => {
    onLiveTodayChange?.(preset === "today");
  }, [preset, onLiveTodayChange]);

  /* Ongoing tables fetch — Today ekadi witharak. Permission nathnam card eka pennanne na. */
  useEffect(() => {
    if (preset !== "today") { setOpenTables(null); setShowTables(false); return; }
    if (demoOnly) {
      setOpenTables(DEMO_OPEN_TABLES);
      return;
    }
    let alive = true;
    getOpenTablesAction({ reportId: "open-tables", startDate: from, endDate: to, outletId: loc || undefined })
      .then((res) => {
        if (!alive) return;
        if (res?.success && res.data) setOpenTables(res.data as unknown as OpenTablesData);
        else setOpenTables(null);
      })
      .catch(() => { if (alive) setOpenTables(null); });
    return () => { alive = false; };
  }, [preset, from, to, loc, demoOnly]);

  /* popup eka Escape walin wahanawa */
  useEffect(() => {
    if (!showTables) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setShowTables(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showTables]);

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
  const hours = [...(data?.hourly ?? [])].sort((a,b)=>a.hour-b.hour);
  const hourlyLabels = hours.map((h) => HOUR_LABEL[h.hour] ?? String(h.hour));
  const hourlyNet = hours.map((h) => h.net);
  const hourlyBills = hours.map((h) => h.bills);
  let runningRevenue = 0;
  const cumulativeRevenue = hourlyNet.map(value => (runningRevenue += value));

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
              onPreset={(p) => setPreset(p)}
              onChange={(f, t) => {
                // preset chip eken awa nam onPreset eken preset eka set wela thiyenawa;
                // custom date inputs walin witharak meka call weddi preset eka ain karanna
                // onPreset passe ena onChange eka chip click ekada kiyala danaganna
                // chip eken set wuna preset ekata adala range ekamada balanawa.
                setPreset((prev) => {
                  if (prev) {
                    const r = presetRange(prev);
                    if (r.from === f && r.to === (t || f)) return prev;
                  }
                  return undefined; // custom
                });
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
            <b>Demo data</b> — sample numbers are shown while the service is unavailable.
          </div>
        )}

        {busy ? (
          <LoadingBlock text="Loading live operations…" />
        ) : error ? (
          <EmptyBlock text={displayMessage(error)} />
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


            {preset === "today" && openTables ? (
              <div
                className="da-anim"
                role="button"
                tabIndex={0}
                title="View ongoing table details"
                onClick={() => setShowTables(true)}
                onKeyDown={(e) => { if (e.key === "Enter") setShowTables(true); }}
                style={{
                  background: "#fff",
                  border: `1px solid ${DASH.border}`,
                  borderRadius: 14,
                  padding: "13px 16px",
                  marginBottom: 14,
                  cursor: "pointer",
                  boxShadow: "0 2px 4px rgba(114,86,60,0.05)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: DASH.dark }}>Ongoing Tables</div>
                    <div style={{ fontSize: 11, color: DASH.muted, marginTop: 2 }}>Tables still open — not yet billed</div>
                  </div>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 9, fontWeight: 800, letterSpacing: 0.8, color: "#1e6b3e", background: "#e2f2e7", border: "1px solid #9fd4ae", borderRadius: 999, padding: "3px 9px" }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#2F8F5B", animation: "daLiveBlink 1.1s ease-in-out infinite" }} />
                    LIVE NOW
                  </span>
                </div>
                <div style={{ display: "flex", gap: 28, flexWrap: "wrap", marginTop: 10 }}>
                  <div>
                    <div style={{ fontSize: 21, fontWeight: 800, color: DASH.dark }}>{fmtInt(openTables.sections.length)}</div>
                    <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: 0.9, color: DASH.muted }}>OPEN TABLES</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 21, fontWeight: 800, color: DASH.dark }}>{fmtRs(openTables.grandTotal)}</div>
                    <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: 0.9, color: DASH.muted }}>PENDING VALUE</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 21, fontWeight: 800, color: DASH.dark }}>{fmtInt(openTables.sections.reduce((n, sec) => n + sec.rows.length, 0))}</div>
                    <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: 0.9, color: DASH.muted }}>ITEMS ON TABLES</div>
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                  {openTables.sections.map((sec) => (
                    <span key={`${sec.locCode}-${sec.code}`} style={{ fontSize: 10.5, fontWeight: 700, color: DASH.accent, background: DASH.band, border: `1px solid ${DASH.border}`, borderRadius: 999, padding: "3px 10px" }}>
                      {sec.code} · {fmtRs(sec.amount)}
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: 10.5, fontWeight: 800, color: DASH.accent, marginTop: 10 }}>Click to view table details →</div>
              </div>
            ) : null}

            <div className="da-ops-responsive-grid" style={gridStyle}>
              <style>{`@media (max-width: 680px) {
                .da-ops-responsive-grid { grid-template-columns: minmax(0, 1fr) !important; }
                .da-ops-responsive-grid > .da-anim { grid-column: auto !important; }
              }`}</style>
              <ChartCard
                title="Sales & Revenue Flow"
                sub="Hourly revenue and cumulative revenue · bill counts shown as bars"
                span={2}
                delay={0.05}
              >
                {hours.length ? (
                  <>
                  <div style={{display:'flex',gap:14,flexWrap:'wrap',padding:'0 8px 8px',fontSize:11,color:'#6b543e'}}><span>● Hourly revenue</span><span style={{color:'#b86b2b'}}>● Cumulative revenue</span><span>▮ Bill count (separate scale)</span></div>
                  <ComboChart
                    labels={hourlyLabels}
                    area={hourlyNet}
                    bars={hourlyBills}
                    cumulative={cumulativeRevenue}
                    areaName="Hourly revenue"
                    barName="Bills"
                  />
                  <div style={{fontSize:10,color:'#907860',padding:'2px 8px 0'}}>For multiple days, values are grouped by hour across the selected period. The cumulative line adds these hourly groups in hour order.</div>
                  </>
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

      {showTables && openTables ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Ongoing table details"
          onClick={() => setShowTables(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 90,
            background: "rgba(69,48,29,0.38)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 16,
              border: `1px solid ${DASH.border}`,
              width: "min(880px, 96vw)",
              maxHeight: "88vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 18px 50px rgba(69,48,29,0.3)",
              fontFamily: "Inter, sans-serif",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: `1px solid ${DASH.border}` }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: DASH.dark }}>Ongoing Tables{loc ? ` — ${loc}` : ""}</div>
                <div style={{ fontSize: 11, color: DASH.muted }}>{openTables.sections.length} open table(s) · items shown per table</div>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setShowTables(false)}
                style={{ border: `1px solid ${DASH.border}`, background: "#fff", color: DASH.accent, borderRadius: 8, width: 30, height: 30, cursor: "pointer", fontSize: 14, fontFamily: "inherit" }}
              >
                ✕
              </button>
            </div>
            <div style={{ overflowY: "auto" }}>
              {openTables.sections.map((sec) => (
                <div key={`${sec.locCode}-${sec.code}`}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: DASH.band, padding: "8px 18px", borderBottom: `1px solid ${DASH.border}` }}>
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: DASH.dark }}>{sec.code} <span style={{ color: DASH.muted, fontWeight: 700 }}>· {sec.rows.length} item(s)</span></span>
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: DASH.accent }}>{fmtRs(sec.amount)}</span>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", minWidth: 760, borderCollapse: "collapse", fontSize: 11.5 }}>
                      <thead>
                        <tr style={{ background: "#FBF7F0" }}>
                          {["Item Code", "Description", "Qty", "Sales Price", "Item Price", "Order Mode", "Cancel", "Cashier"].map((h, hi) => (
                            <th key={h} style={{ textAlign: hi >= 2 && hi <= 4 ? "right" : "left", padding: "6px 10px", fontSize: 9.5, fontWeight: 800, letterSpacing: 0.6, color: DASH.muted, borderBottom: `1px solid ${DASH.border}`, whiteSpace: "nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sec.rows.map((r, ri) => (
                          <tr key={ri} style={{ background: ri % 2 ? "#FDFAF5" : "#fff" }}>
                            <td style={{ padding: "6px 10px", fontWeight: 700, color: DASH.dark, whiteSpace: "nowrap" }}>{r.itemCode}</td>
                            <td style={{ padding: "6px 10px", color: DASH.dark }}>{r.desc}</td>
                            <td style={{ padding: "6px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{r.qty.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td style={{ padding: "6px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtAmtDash(r.price)}</td>
                            <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmtAmtDash(r.value)}</td>
                            <td style={{ padding: "6px 10px", whiteSpace: "nowrap" }}>{r.mode}</td>
                            <td style={{ padding: "6px 10px", whiteSpace: "nowrap" }}>{r.cancel}</td>
                            <td style={{ padding: "6px 10px", whiteSpace: "nowrap" }}>{r.cashier}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 18px", background: DASH.dark, color: "#FDF6E9", fontSize: 13, fontWeight: 800 }}>
              <span>Grand Total (open)</span>
              <span>{fmtRs(openTables.grandTotal)}</span>
            </div>
          </div>
        </div>
      ) : null}
      </SectionShell>
    </>
  );
}


/* demoOnly preview ekata ongoing tables sample */
const DEMO_OPEN_TABLES: OpenTablesData = {
  sections: [
    { code: "T04", locCode: "01", amount: 8600, rows: [
      { itemCode: "MD134", desc: "COCONUT MATCHA CLOUD", qty: 2, price: 1800, value: 3600, mode: "DI", cancel: "—", cashier: "aura" },
      { itemCode: "MB001", desc: "MILA TROPICAL BOWL (VG)", qty: 1, price: 2400, value: 2400, mode: "DI", cancel: "—", cashier: "aura" },
      { itemCode: "MB059", desc: "CEYLON GARDEN (VG)", qty: 1, price: 2600, value: 2600, mode: "DI", cancel: "—", cashier: "aura" },
    ]},
    { code: "T09", locCode: "01", amount: 7920, rows: [
      { itemCode: "MB018", desc: "THAI PRAWN SALAD (GF)", qty: 2, price: 2500, value: 5000, mode: "DI", cancel: "—", cashier: "SAMAN" },
      { itemCode: "MD120", desc: "PASSION FRUIT MOJITO", qty: 2, price: 1460, value: 2920, mode: "DI", cancel: "—", cashier: "SAMAN" },
    ]},
  ],
  grandTotal: 16520,
};
