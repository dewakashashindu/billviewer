"use client";

// ============================================================
// LOCATION: components/dashboard/KitchenOpsSection.tsx   (ALUTH FILE)
//
// Tab 3 — "Kitchen" : preparation time, stations, delayed tickets
//   • separate tab + own date range controller (other tabs eken wenama)
//   • English copy only, DB / view / column names penenne naha
//   • green accent — Live tab (brown) eken hariyatama wenaskam penenawa
// ============================================================
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getKitchenOpsAction, type KitchenOpsData } from "@/app/actions/dashboardOps";
import { demoKitchen } from "./demoData";
import {
  ChartCard,
  DASH,
  DashStyles,
  EmptyBlock,
  Funnel,
  HBars,
  KITCHEN_COLORS,
  KpiCard,
  LoadingBlock,
  SectionShell,
  fmtInt,
  fmtMin,
  gridStyle,
  kpiGridStyle,
} from "./charts";
import RangeController, { presetRange, type RangePreset } from "./RangeController";

const ACCENT = DASH.kitchen;

export default function KitchenOpsSection({
  demoOnly = false,
  active = true,
}: {
  demoOnly?: boolean;
  active?: boolean;
} = {}) {
  const init = useMemo(() => presetRange("today"), []);
  const [from, setFrom] = useState(init.from);
  const [to, setTo] = useState(init.to);
  const [preset, setPreset] = useState<RangePreset | undefined>("today");
  const [fetched, setFetched] = useState<KitchenOpsData | null>(null);
  const [demo, setDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runId, setRunId] = useState(1);
  const paneRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async (f: string, t: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getKitchenOpsAction({ from: f, to: t });
      if (res.success && res.data) {
        setFetched(res.data);
        setDemo(Boolean(res.demo));
      } else {
        setError(res.error || "Could not load kitchen data");
      }
    } catch {
      setError("Could not load kitchen data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (demoOnly) return;
    load(from, to);
  }, [from, to, load, demoOnly]);

  useEffect(() => {
    if (!active) return;
    const el = paneRef.current;
    if (el) {
      el.classList.remove("dashgo");
      void el.offsetWidth;
      el.classList.add("dashgo");
    }
    setRunId((r) => r + 1);
  }, [active]);

  const localDemo = useMemo(() => (demoOnly ? demoKitchen(from, to) : null), [demoOnly, from, to]);
  const data: KitchenOpsData | null = demoOnly ? localDemo : fetched;
  const busy = demoOnly ? false : loading;

  const prepItems = (data?.stations ?? []).map((s) => ({ name: s.name, amt: s.avgPrep }));
  const loadItems = (data?.stations ?? [])
    .slice()
    .sort((a, b) => b.tickets - a.tickets)
    .map((s) => ({ name: s.name, amt: s.tickets }));
  const stewardItems = (data?.stewards ?? []).map((s) => ({ name: s.name, amt: s.tickets }));

  const onChange = (f: string, tt: string) => {
    setPreset(undefined);
    setFrom(f);
    setTo(tt || f);
  };

  return (
    <>
      <DashStyles />
      <SectionShell
        paneRef={paneRef}
        kicker={`KITCHEN · ${from} → ${to}`}
        title="Kitchen Performance"
        desc="Order preparation, station timings and delayed tickets for the selected period. This tab has its own date range."
        accent={ACCENT}
        right={
          <RangeController
            from={from}
            to={to}
            onChange={onChange}
            preset={preset}
            disabled={busy}
            accent={ACCENT}
          />
        }
      >
        {!demoOnly && demo && (
          <div
            style={{
              border: `1px dashed ${DASH.border}`,
              background: DASH.kitchenSoft,
              borderRadius: 9,
              padding: "7px 11px",
              fontSize: 11,
              color: ACCENT,
              marginBottom: 11,
            }}
          >
            <b>Demo data</b> — the database is not connected yet, so sample numbers are shown.
          </div>
        )}

        {busy ? (
          <LoadingBlock text="Loading kitchen performance…" />
        ) : error ? (
          <EmptyBlock text={error} />
        ) : !data ? (
          <EmptyBlock />
        ) : (
          <>
            <div style={kpiGridStyle}>
              <KpiCard
                label="TICKETS"
                value={fmtInt(data.tickets)}
                sub="orders in period"
                animKey={runId}
                delay={0}
                accent={ACCENT}
              />
              <KpiCard
                label="AVG PREP TIME"
                value={fmtMin(data.avgPrep)}
                sub="kitchen preparation"
                animKey={runId}
                delay={0.05}
                accent={ACCENT}
              />
              <KpiCard
                label="AVG PICK-UP TIME"
                value={fmtMin(data.avgPickup)}
                sub="ready to pick-up"
                animKey={runId}
                delay={0.1}
                accent={ACCENT}
              />
              <KpiCard
                label="AVG COLLECT TIME"
                value={fmtMin(data.avgCollect)}
                sub="pick-up to collection"
                animKey={runId}
                delay={0.15}
                accent={ACCENT}
              />
              <KpiCard
                label="DELAYED"
                value={fmtInt(data.delayed.length)}
                sub="over 20 minutes"
                animKey={runId}
                delay={0.2}
                accent={ACCENT}
              />
              <KpiCard
                label="DOCKETS PENDING"
                value={fmtInt(data.docket.pending)}
                sub={`${fmtInt(data.docket.printed)} printed`}
                animKey={runId}
                delay={0.25}
                accent={ACCENT}
              />
            </div>

            <div style={gridStyle}>
              <ChartCard
                title="Order Pipeline"
                sub="Placed → Started → Done → Collected"
                span={2}
                delay={0.05}
                accent={ACCENT}
              >
                {data.pipeline.placed > 0 ? (
                  <Funnel
                    colors={KITCHEN_COLORS}
                    items={[
                      { label: "Placed", value: data.pipeline.placed },
                      { label: "Started", value: data.pipeline.started },
                      { label: "Done", value: data.pipeline.done },
                      { label: "Collected", value: data.pipeline.collected },
                    ]}
                  />
                ) : (
                  <EmptyBlock />
                )}
              </ChartCard>

              <ChartCard
                title="Prep Time by Station"
                sub="Average preparation time at each station"
                delay={0.1}
                accent={ACCENT}
              >
                {prepItems.length ? (
                  <HBars
                    items={prepItems}
                    unit=" min"
                    formatter={(v) => v.toFixed(1)}
                    colors={KITCHEN_COLORS}
                  />
                ) : (
                  <EmptyBlock />
                )}
              </ChartCard>

              <ChartCard
                title="Ticket Load by Station"
                sub="Orders handled by each station"
                delay={0.15}
                accent={ACCENT}
              >
                {loadItems.length ? (
                  <HBars
                    items={loadItems}
                    formatter={(v) => fmtInt(v)}
                    colors={KITCHEN_COLORS}
                    colorOffset={1}
                  />
                ) : (
                  <EmptyBlock />
                )}
              </ChartCard>

              <ChartCard
                title="Steward Load"
                sub="Tickets handled by each steward"
                delay={0.2}
                accent={ACCENT}
              >
                {stewardItems.length ? (
                  <HBars
                    items={stewardItems}
                    formatter={(v) => fmtInt(v)}
                    colors={KITCHEN_COLORS}
                    colorOffset={2}
                  />
                ) : (
                  <EmptyBlock />
                )}
              </ChartCard>

              <ChartCard
                title="Docket Printing"
                sub="Printed and pending dockets"
                delay={0.25}
                accent={ACCENT}
              >
                <Funnel
                  colors={KITCHEN_COLORS.slice(2)}
                  items={[
                    { label: "Tickets", value: data.tickets },
                    { label: "Docket printed", value: data.docket.printed },
                    { label: "Pending", value: data.docket.pending },
                  ]}
                />
              </ChartCard>

              <ChartCard
                title="Delayed Tickets"
                sub="Orders that took longer than 20 minutes"
                span={2}
                delay={0.3}
                accent={ACCENT}
              >
                {data.delayed.length === 0 ? (
                  <EmptyBlock text="No delayed tickets — everything is on time." />
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: 11.5,
                        minWidth: 560,
                      }}
                    >
                      <thead>
                        <tr>
                          {["ORDER", "ITEM", "STATION", "TABLE", "STEWARD", "MINUTES", "STATUS"].map(
                            (h, i) => (
                              <th
                                key={h}
                                style={{
                                  textAlign: i >= 5 ? "right" : "left",
                                  background: "#E8EFE6",
                                  color: ACCENT,
                                  padding: "6px 9px",
                                  fontSize: 8.5,
                                  fontWeight: 800,
                                  letterSpacing: 0.7,
                                  borderRight: `1px solid ${DASH.border}`,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {h}
                              </th>
                            )
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {data.delayed.map((row, i) => (
                          <tr
                            key={`${row.orderNo}-${i}`}
                            className="da-fadein"
                            style={{
                              ["--d" as string]: `${(0.05 * i + 0.1).toFixed(2)}s`,
                              background: i % 2 ? "#FBFCFA" : "#fff",
                            }}
                          >
                            <td style={td}>{row.orderNo}</td>
                            <td style={{ ...td, whiteSpace: "normal", fontWeight: 500 }}>
                              {row.item}
                            </td>
                            <td style={td}>{row.station}</td>
                            <td style={td}>{row.table}</td>
                            <td style={td}>{row.steward}</td>
                            <td
                              style={{
                                ...td,
                                textAlign: "right",
                                fontWeight: 800,
                                color: row.minutes > 35 ? DASH.bad : DASH.dark,
                              }}
                            >
                              {row.minutes.toFixed(1)}
                            </td>
                            <td style={{ ...td, textAlign: "right" }}>
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "2px 7px",
                                  borderRadius: 999,
                                  fontSize: 9.5,
                                  fontWeight: 800,
                                  background:
                                    row.status === "D"
                                      ? "rgba(47,122,79,0.12)"
                                      : "rgba(180,70,47,0.12)",
                                  color: row.status === "D" ? DASH.good : DASH.bad,
                                }}
                              >
                                {row.status === "D"
                                  ? "DONE"
                                  : row.status === "S"
                                  ? "STARTED"
                                  : row.status || "—"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </ChartCard>
            </div>
          </>
        )}
      </SectionShell>
    </>
  );
}

const td: React.CSSProperties = {
  padding: "5.5px 9px",
  borderBottom: `1px solid ${DASH.soft}`,
  color: DASH.dark,
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
};
