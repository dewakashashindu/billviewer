// ============================================================
// LOCATION: components/order/WelcomePanel.tsx
// Step 1 of the customer flow — the screen the guest lands on
// after scanning the table QR.
//
//   • time-of-day greeting ("Good morning")
//   • the table they are sitting at
//   • one big "Start ordering" button → /order/menu
//
// The table details come from GET /api/order/table (the signed
// QR token is checked by the server).
// ============================================================
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { C, greeting } from "./theme";
import type { TableInfo } from "./types";

export default function WelcomePanel({
  table,
  token,
}: {
  table: string;
  token: string;
}) {
  const router = useRouter();
  const [info, setInfo] = useState<TableInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => Boolean(table));
  /* Greeting — computed on the client so it matches the guest's own
     clock. The server renders the same value, so the text can differ
     between the two (suppressHydrationWarning below). */
  const [hello] = useState(() => greeting(new Date()));

  /* Table details */
  useEffect(() => {
    if (!table) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(
          `/api/order/table?table=${encodeURIComponent(table)}&t=${encodeURIComponent(token)}`,
          { cache: "no-store" }
        );
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) {
          throw new Error(json?.error || "We could not read the table details.");
        }
        if (alive) setInfo(json.data as TableInfo);
      } catch (e) {
        if (alive) setError((e as Error)?.message ?? "We could not read the table details.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [table, token]);

  const goMenu = () => {
    const q = new URLSearchParams({ table });
    if (token) q.set("t", token);
    router.push(`/order/menu?${q.toString()}`);
  };

  /* ── error state ─────────────────────────────────────────────── */
  if (error || !table) {
    const message =
      error ??
      "No table number found. Please scan the QR code on your table.";
    return (
      <div className="ord-root">
        <div className="ord-col" style={{ justifyContent: "center", padding: 28 }}>
          <div
            className="ord-card ord-up"
            style={{ padding: 26, textAlign: "center", borderRadius: 24 }}
          >
            <div style={{ fontSize: 40, marginBottom: 8 }}>🙁</div>
            <div className="ord-title" style={{ marginBottom: 6 }}>
              We could not open this table
            </div>
            <p className="ord-body" style={{ margin: 0 }}>
              {message}
            </p>
            <button
              type="button"
              className="ord-btn ord-btn-primary"
              onClick={() => window.location.reload()}
              style={{ marginTop: 18, height: 46, padding: "0 24px", width: "100%" }}
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── welcome state ───────────────────────────────────────────── */
  return (
    <div className="ord-root">
      <div className="ord-col" style={{ position: "relative", overflow: "hidden" }}>
        {/* food photo + warm overlay */}
        <div style={{ position: "absolute", inset: 0, overflow: "hidden" }} aria-hidden>
          <div
            className="ord-drift"
            style={{
              position: "absolute",
              inset: "-6%",
              backgroundImage: "url('/menu-food-bg.jpg')",
              backgroundSize: "cover",
              backgroundPosition: "center 42%",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(38,25,16,0.62) 0%, rgba(46,30,18,0.72) 38%, rgba(30,20,12,0.93) 100%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(62% 40% at 76% 92%, rgba(192,138,78,0.34) 0%, rgba(30,20,12,0) 70%)",
            }}
          />
        </div>

        {/* content */}
        <div
          className="ord-safe-top"
          style={{
            position: "relative",
            zIndex: 1,
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            padding: "0 26px",
            paddingBottom: "calc(22px + env(safe-area-inset-bottom, 0px))",
          }}
        >
          {/* brand */}
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 40 }}>
            <div
              className="ord-pop"
              style={{
                width: 92,
                height: 92,
                borderRadius: 999,
                background: "rgba(255,249,242,0.10)",
                border: "1px solid rgba(255,249,242,0.22)",
                backdropFilter: "blur(6px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 16px 40px rgba(0,0,0,0.4)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/millamirissa.png"
                alt="Mila Mirissa"
                style={{ width: 74, height: 74, borderRadius: 999, display: "block" }}
              />
            </div>
          </div>

          {/* greeting */}
          <div className="ord-up" style={{ marginTop: 30 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "rgba(192,138,78,0.95)",
              }}
            >
              Welcome to Mila Mirissa
            </div>
            <h1
              className="ord-display"
              suppressHydrationWarning
              style={{
                color: C.inkOnDark,
                margin: "10px 0 0",
                textShadow: "0 6px 24px rgba(0,0,0,0.35)",
              }}
            >
              {hello.title}
              <span style={{ color: C.gold }}>.</span>
            </h1>
            <div
              style={{
                width: 54,
                height: 3,
                borderRadius: 2,
                margin: "14px 0 0",
                background: `linear-gradient(90deg, ${C.gold}, rgba(192,138,78,0))`,
              }}
            />
            <p
              suppressHydrationWarning
              style={{
                color: C.inkOnDarkSoft,
                fontSize: 14.5,
                lineHeight: 1.6,
                margin: "14px 0 0",
                maxWidth: 330,
              }}
            >
              {hello.line}
            </p>
          </div>

          <div style={{ flex: 1, minHeight: 24 }} />

          {/* table chip */}
          <div
            className="ord-up"
            style={{
              display: "inline-flex",
              alignSelf: "flex-start",
              alignItems: "center",
              gap: 9,
              padding: "9px 14px",
              borderRadius: 999,
              background: "rgba(255,249,242,0.10)",
              border: "1px solid rgba(255,249,242,0.18)",
              color: C.inkOnDark,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path
                d="M6 3v8m4-8v8m4-8v8m4-8v8M3 11h18M5 11v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {loading ? (
              <span style={{ opacity: 0.7 }}>Checking your table…</span>
            ) : (
              <span>
                Table&nbsp;
                <b style={{ color: C.gold }}>
                  {info?.tableNo || table || "—"}
                </b>
                {info?.tableGroup ? (
                  <span style={{ opacity: 0.65, fontWeight: 400 }}>
                    &nbsp;· {info.tableGroup}
                  </span>
                ) : null}
              </span>
            )}
          </div>

          {/* CTA */}
          <button
            type="button"
            onClick={goMenu}
            disabled={loading || !table}
            className="ord-btn ord-btn-gold ord-up"
            style={{
              width: "100%",
              height: 58,
              marginTop: 16,
              padding: "0 8px 0 26px",
              justifyContent: "space-between",
              fontSize: 16.5,
              letterSpacing: "0.01em",
            }}
          >
            <span>Start ordering</span>
            <span
              style={{
                width: 42,
                height: 42,
                borderRadius: 999,
                background: "rgba(255,255,255,0.2)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M5 12h14m-6-6 6 6-6 6"
                  stroke="#fff"
                  strokeWidth="2.1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </button>

          <p
            style={{
              textAlign: "center",
              color: "rgba(255,249,242,0.42)",
              fontSize: 11.5,
              margin: "14px 0 0",
            }}
          >
            Scan the QR code on your table to order
          </p>
        </div>
      </div>
    </div>
  );
}
