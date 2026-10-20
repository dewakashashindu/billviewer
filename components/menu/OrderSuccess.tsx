"use client";

// ============================================================
// LOCATION: components/menu/OrderSuccess.tsx
// Step 8 — order confirmed: invoice number + next actions (redesigned).
// ============================================================

import type { CSSProperties } from "react";
import { T } from "./theme";
import type { ConfirmResult } from "./types";

export default function OrderSuccess({
  result,
  onAddMore,
  onDone,
}: {
  result: ConfirmResult;
  onAddMore: () => void;
  onDone: () => void;
}) {
  const takeaway = result.orderType === "TA";

  return (
    <div style={s.wrap} className="mnu-anim-up">
      <div style={s.tickCircle}>
        <span style={s.tickGlow} aria-hidden />
        <span style={s.tick} />
      </div>
      <h2 style={s.title}>Order Confirmed</h2>
      <p style={s.sub}>
        {takeaway
          ? "Your takeaway order has been sent to the kitchen. Please collect it at the counter when your number is called."
          : "Your items have been sent to the kitchen."}
        <br />
        {takeaway ? "Thank you!" : "Please wait — we'll serve it fresh."}
      </p>

      <div style={s.card}>
        {takeaway ? (
          /* TA has no table: the serial IS the order number — showing
             "Takeaway no → Takeaway" told the guest nothing. */
          <div style={s.cardRow}>
            <span style={s.k}>Takeaway no</span>
            <span style={{ ...s.v, fontSize: 20 }}>{result.invoiceNo || "—"}</span>
          </div>
        ) : (
          <>
            <div style={s.cardRow}>
              <span style={s.k}>Invoice no</span>
              <span style={s.v}>{result.invoiceNo || "—"}</span>
            </div>
            <div style={s.rowLine} />
            <div style={s.cardRow}>
              <span style={s.k}>Table</span>
              <span style={s.v}>
                {result.tableNo}
                {result.tableGroup ? ` · ${result.tableGroup}` : ""}
              </span>
            </div>
          </>
        )}
        {result.itemCount > 0 && (
          <>
            <div style={s.rowLine} />
            <div style={s.cardRow}>
              <span style={s.k}>Items added</span>
              <span style={s.v}>{result.itemCount}</span>
            </div>
          </>
        )}
      </div>

      <div style={s.actions}>
        <button type="button" style={s.primary} className="mnu-tap" onClick={onAddMore}>
          Add more items
        </button>
        <button type="button" style={s.ghost} className="mnu-tap" onClick={onDone}>
          Done
        </button>
      </div>

      <p style={s.note}>
        Payment at the counter. Your final bill link is sent by SMS / shown at the till.
      </p>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  wrap: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: "60px 30px",
    maxWidth: 560,
    margin: "0 auto",
    width: "100%",
  },
  tickCircle: {
    position: "relative",
    width: 100,
    height: 100,
    borderRadius: "50%",
    background: T.greenSoft,
    border: "2px solid " + T.green,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    boxShadow: `0 0 0 10px rgba(111,211,154,0.08), 0 16px 40px rgba(111,211,154,0.20)`,
  },
  tickGlow: {
    position: "absolute",
    inset: -2,
    borderRadius: "50%",
    border: `2px solid ${T.green}`,
    animation: "mnuSuccessPing 1.6s ease-out 1",
  },
  tick: {
    width: 36,
    height: 19,
    borderLeft: `4.5px solid ${T.green}`,
    borderBottom: `4.5px solid ${T.green}`,
    transform: "rotate(-45deg) translateY(-3px)",
    display: "block",
  },
  title: { margin: 0, color: T.ink, fontSize: 25, fontWeight: 800, letterSpacing: -0.2 },
  sub: { color: T.w55, fontSize: 13.5, lineHeight: 1.75, margin: "10px 0 0" },
  card: {
    background: T.surface,
    border: `1px solid ${T.line}`,
    borderRadius: 18,
    padding: "6px 16px",
    margin: "24px 0 26px",
    width: "100%",
    maxWidth: 420,
    boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
  },
  cardRow: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
    padding: "11px 0",
    textAlign: "left",
  },
  rowLine: { height: 1, background: T.line },
  k: { color: T.w40, fontSize: 10, letterSpacing: 1.3, textTransform: "uppercase", fontWeight: 700, flex: "0 0 auto" },
  v: {
    color: T.gold,
    fontSize: 14,
    fontWeight: 800,
    letterSpacing: 0.2,
    textAlign: "right",
    wordBreak: "break-word",
    fontVariantNumeric: "tabular-nums",
  },
  actions: { display: "flex", gap: 12, width: "100%", maxWidth: 420 },
  primary: {
    flex: 1,
    height: 52,
    borderRadius: 15,
    background: T.goldGrad,
    border: "1px solid rgba(255,255,255,0.22)",
    color: T.goldInk,
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: T.shadowGold,
  },
  ghost: {
    flex: 1,
    height: 52,
    borderRadius: 15,
    background: T.card,
    border: `1px solid ${T.line}`,
    color: T.w92,
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
  },
  note: { color: T.w40, fontSize: 11.5, marginTop: 20, lineHeight: 1.65, maxWidth: 340 },
};
