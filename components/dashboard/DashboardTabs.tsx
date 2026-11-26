"use client";

// ============================================================
// LOCATION: components/dashboard/DashboardTabs.tsx   (ALUTH FILE)
//
// Dashboard tab bar — 2 tabs:
//   1) Live                   → DashboardOpsSection (always TODAY + location selector)
//   2) Performance Analytics  → children (existing dashboard content — unchanged)
//
// Kitchen tab REMOVED from the dashboard.
// Tab bar eka wadipura highlight karala thiyenawa (raised, bordered, active pill).
// Count badges (9 / 4) ain karala.
//
// ⚠️ Panes okkoma mount wela thiyenawa (display:none) — tab maru kalama
//    data aye fetch wenne nathiwa, animation witharak aye run wenawa.
// ============================================================
import { useEffect, useState, type ReactNode } from "react";
import { DASH, DashStyles } from "./charts";
import DashboardOpsSection from "./DashboardOpsSection";

type TabKey = "live" | "performance";

const TABS: { key: TabKey; label: string; hint: string }[] = [
  { key: "live", label: "Live", hint: "Today" },
  { key: "performance", label: "Performance Analytics", hint: "Month to date" },
];

export default function DashboardTabs({
  children,
  demoOnly = false,
  initial = "live",
}: {
  /** Performance Analytics tab eke content — existing dashboard (unchanged) */
  children?: ReactNode;
  /** public preview ekakata (DB/session nathiwa demo data) */
  demoOnly?: boolean;
  initial?: TabKey;
}) {
  const [tab, setTab] = useState<TabKey>(initial);
  /* Live tab pulse eka — ops range eka "today" weddi witharak */
  const [liveNow, setLiveNow] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.scrollY > 220) window.scrollTo({ top: 140, behavior: "smooth" });
  }, [tab]);

  return (
    <>
      {/* ── common header — tabs dekamatama penenawa ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 14,
          flexWrap: "wrap",
          padding: "2px 2px 12px",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 9.5,
              fontWeight: 800,
              letterSpacing: 1,
              color: DASH.muted,
            }}
          >
            DASHBOARD
          </div>
          <h1
            style={{
              margin: "2px 0 3px",
              fontSize: 22,
              fontWeight: 800,
              color: DASH.dark,
            }}
          >
            Dashboard
          </h1>
          <p style={{ margin: 0, fontSize: 12, color: DASH.muted }}>
            Live operations and performance analytics in one place.
          </p>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[
            tab === "live" ? "Today" : "Month to date",
            tab === "live" ? "Live feed" : "Performance",
          ].map((chip) => (
            <span
              key={chip}
              style={{
                display: "inline-flex",
                alignItems: "center",
                border: `1px solid ${DASH.border}`,
                background: "#fff",
                color: DASH.accent,
                borderRadius: 999,
                padding: "4px 11px",
                fontSize: 10.5,
                fontWeight: 700,
              }}
            >
              {chip}
            </span>
          ))}
        </div>
      </div>

    <div
      style={{
        /* tab bar eka wadipura highlight — raised card + strong border */
        position: "sticky",
        top: 0,
        zIndex: 25,
        background: "linear-gradient(180deg, #FFFFFF 0%, #FDF9F4 100%)",
        border: `1px solid ${DASH.border}`,
        borderRadius: 14,
        padding: "6px 8px",
        marginBottom: 16,
        boxShadow:
          "0 2px 4px rgba(114,86,60,0.06), 0 10px 24px rgba(114,86,60,0.10)",
      }}
    >
      <DashStyles />
      <style>{`
        @keyframes daLiveRing {
          0% { box-shadow: 0 0 0 0 rgba(47,143,91,.45), 0 3px 10px rgba(69,48,29,0.28) }
          70% { box-shadow: 0 0 0 13px rgba(47,143,91,0), 0 3px 10px rgba(69,48,29,0.28) }
          100% { box-shadow: 0 0 0 0 rgba(47,143,91,0), 0 3px 10px rgba(69,48,29,0.28) }
        }
        @keyframes daLiveBlink { 0%,100% { opacity:1 } 50% { opacity:.3 } }
        @media (prefers-reduced-motion: reduce) {
          .da-live-tab { animation: none !important; }
          .da-live-dot { animation: none !important; }
        }
      `}</style>

      <div
        role="tablist"
        aria-label="Dashboard sections"
        style={{
          display: "flex",
          gap: 6,
          overflowX: "auto",
          scrollbarWidth: "none",
        }}
      >
        {TABS.map((t) => {
          const on = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setTab(t.key)}
              className={t.key === "live" && liveNow ? "da-live-tab" : undefined}
              style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 2,
                ...(t.key === "live" && liveNow
                  ? { animation: "daLiveRing 1.8s ease-out infinite" }
                  : {}),
                border: `1px solid ${on ? DASH.dark : "transparent"}`,
                background: on
                  ? "linear-gradient(135deg, #45301D 0%, #684830 100%)"
                  : "transparent",
                color: on ? "#FDF6E9" : DASH.accent,
                borderRadius: 10,
                padding: "8px 16px 9px",
                cursor: "pointer",
                fontFamily: "inherit",
                whiteSpace: "nowrap",
                transition: "background .22s ease, color .22s ease, transform .12s ease",
                boxShadow: on
                  ? "0 3px 10px rgba(69,48,29,0.28), inset 0 1px 0 rgba(255,255,255,0.14)"
                  : "none",
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: 0.2,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                }}
              >
                {t.key === "live" && liveNow ? (
                  <span
                    className="da-live-dot"
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#3ECF6F",
                      animation: "daLiveBlink 1.1s ease-in-out infinite",
                      flexShrink: 0,
                    }}
                  />
                ) : null}
                {t.label}
              </span>
              <span
                style={{
                  fontSize: 8.5,
                  fontWeight: 800,
                  letterSpacing: 0.9,
                  textTransform: "uppercase",
                  color: on ? "rgba(253,246,233,0.72)" : DASH.muted,
                }}
              >
                {t.hint}
              </span>
            </button>
          );
        })}
      </div>

      {/* panes */}
      <div style={{ display: tab === "live" ? "block" : "none", marginTop: 14 }}>
        <DashboardOpsSection demoOnly={demoOnly} active={tab === "live"} onLiveTodayChange={setLiveNow} />
      </div>

      <div style={{ display: tab === "performance" ? "block" : "none", marginTop: 14 }}>
        {children}
      </div>
    </div>
    </>
  );
}
